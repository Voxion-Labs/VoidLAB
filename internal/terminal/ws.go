package terminal

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"html"
	"io"
	"log"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"github.com/gorilla/websocket"

	"github.com/Voxion-Labs/VoidLAB/internal/docker"
	"github.com/Voxion-Labs/VoidLAB/internal/explorer"
)

var upgrader = websocket.Upgrader{
	ReadBufferSize:  8192,
	WriteBufferSize: 8192,
	CheckOrigin: func(r *http.Request) bool {
		return true // Allow local-first client connections
	},
}

// InboundMessage represents client actions arriving over WebSocket.
type InboundMessage struct {
	Type     string `json:"type"` // "run", "stdin", "command", "ping"
	Path     string `json:"path,omitempty"`
	Language string `json:"language,omitempty"`
	Data     string `json:"data,omitempty"`
	Command  string `json:"command,omitempty"`
}

// OutboundMessage represents live streaming events dispatched to clients.
type OutboundMessage struct {
	Type     string `json:"type"` // "stdout", "stderr", "status", "html", "exit"
	Text     string `json:"text,omitempty"`
	HTML     string `json:"html,omitempty"`
	Message  string `json:"message,omitempty"`
	Duration string `json:"duration,omitempty"`
	ExitCode int    `json:"exit_code,omitempty"`
	Running  bool   `json:"running,omitempty"`
}

// Client represents an active WebSocket terminal session.
type Client struct {
	conn       *websocket.Conn
	sendChan   chan []byte
	stdinPipe  io.WriteCloser
	cancelFunc context.CancelFunc
	cmdBuf     strings.Builder
	closed     bool
	mu         sync.Mutex
}

// Handler manages WebSocket upgrades, active connections, and execution broadcasts.
type Handler struct {
	orchestrator *docker.Orchestrator
	explorerSvc  *explorer.Service
	clients      map[*Client]bool
	mu           sync.RWMutex
}

// NewHandler constructs a terminal handler.
func NewHandler(orc *docker.Orchestrator, exp *explorer.Service) *Handler {
	return &Handler{
		orchestrator: orc,
		explorerSvc:  exp,
		clients:      make(map[*Client]bool),
	}
}

// HandleWebSocket upgrades HTTP connection to /api/ws/terminal.
func (h *Handler) HandleWebSocket(w http.ResponseWriter, r *http.Request) {
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Printf("[WS] upgrade error: %v", err)
		return
	}

	client := &Client{
		conn:     conn,
		sendChan: make(chan []byte, 1024),
	}

	h.registerClient(client)
	defer func() {
		client.cancelActiveProcess()
		h.unregisterClient(client)
		_ = conn.Close()
	}()

	isDocker := h.orchestrator.IsDockerAvailable(r.Context())
	engineLabel := "Local Sandbox Fallback"
	if isDocker {
		engineLabel = "Docker Ephemeral Container Engine"
	}

	// 1. Initial Status Frame for programmatic consumers
	welcomeMsg := OutboundMessage{
		Type:    "status",
		Message: fmt.Sprintf("VoidLAB Terminal Stream Online [%s]", engineLabel),
		HTML: fmt.Sprintf(
			`<div class="opacity-80 text-[10px] pb-1"><span class="text-emerald-400 font-semibold">[Connected]</span> VoidLAB Engine Active (%s)</div>`,
			engineLabel,
		),
		Running: false,
	}
	client.sendJSON(welcomeMsg)

	// 2. High-impact ANSI Terminal Banner
	banner := fmt.Sprintf(
		"\x1b[1;34m╔═════════════════════════════════════════════════════════════════╗\x1b[0m\r\n"+
			"\x1b[1;34m║\x1b[0m  \x1b[1;37mVoidLAB Engine v0.1.0\x1b[0m - Local-First Cloud Code Editor       \x1b[1;34m║\x1b[0m\r\n"+
			"\x1b[1;34m║\x1b[0m  Runtime: \x1b[32m%-52s\x1b[0m \x1b[1;34m║\x1b[0m\r\n"+
			"\x1b[1;34m╚═════════════════════════════════════════════════════════════════╝\x1b[0m\r\n"+
			"Type \x1b[33mrun\x1b[0m or \x1b[33mhelp\x1b[0m, or execute scripts via the topbar Run button.\r\n\r\n"+
			"\x1b[34mvoidlab\x1b[0m:\x1b[32m/workspace\x1b[0m$ ",
		engineLabel,
	)
	client.sendRaw([]byte(banner))

	// Pump outbound writes in dedicated goroutine
	go client.writePump()

	// Read inbound pump
	for {
		_, message, err := conn.ReadMessage()
		if err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
				log.Printf("[WS] client read error: %v", err)
			}
			break
		}

		h.dispatchInbound(client, message)
	}
}

// dispatchInbound handles incoming keystrokes or structured messages.
func (h *Handler) dispatchInbound(client *Client, message []byte) {
	// 1. Check for JSON structured payload
	if len(message) > 0 && message[0] == '{' {
		var inbound InboundMessage
		if err := json.Unmarshal(message, &inbound); err == nil && inbound.Type != "" {
			switch inbound.Type {
			case "run":
				go h.ExecuteRun(client, inbound.Path, inbound.Language)
				return
			case "stdin":
				client.writeStdin([]byte(inbound.Data))
				return
			case "command":
				if inbound.Command == "clear" {
					client.sendRaw([]byte("\x1b[2J\x1b[H\x1b[34mvoidlab\x1b[0m:\x1b[32m/workspace\x1b[0m$ "))
					return
				}
				go h.ExecuteSandboxCommand(client, inbound.Command)
				return
			case "ping":
				client.sendJSON(OutboundMessage{Type: "status", Message: "pong"})
				return
			}
		}
	}

	// 2. Direct Raw Keystrokes from xterm.js UI
	if client.hasActiveProcess() {
		// Active Docker / Sandbox process is running: pipe directly to process stdin
		// Check for Ctrl+C (\x03) interrupt
		if bytes.Equal(message, []byte("\x03")) {
			client.cancelActiveProcess()
			client.sendRaw([]byte("^C\r\n\x1b[31m[Process interrupted by user (SIGINT)]\x1b[0m\r\n\x1b[34mvoidlab\x1b[0m:\x1b[32m/workspace\x1b[0m$ "))
			client.sendJSON(OutboundMessage{Type: "status", Running: false})
			return
		}

		// Normalize carriage returns (\r -> \n) for unbuffered process line inputs
		if bytes.Contains(message, []byte("\r")) {
			normalized := bytes.ReplaceAll(message, []byte("\r"), []byte("\n"))
			client.writeStdin(normalized)
			client.sendRaw([]byte("\r\n")) // local terminal echo
			return
		}

		// Backspace handling
		if bytes.Equal(message, []byte("\x7f")) || bytes.Equal(message, []byte("\b")) {
			client.writeStdin([]byte("\b"))
			client.sendRaw([]byte("\b \b"))
			return
		}

		// Pipe raw bytes to container stdin and echo back to terminal UI
		client.writeStdin(message)
		client.sendRaw(message)
		return
	}

	// 3. No active process: Interactive Sandbox Shell
	// Ctrl+C in idle shell
	if bytes.Equal(message, []byte("\x03")) {
		client.mu.Lock()
		client.cmdBuf.Reset()
		client.mu.Unlock()
		client.sendRaw([]byte("^C\r\n\x1b[34mvoidlab\x1b[0m:\x1b[32m/workspace\x1b[0m$ "))
		return
	}

	// Backspace in idle shell
	if bytes.Equal(message, []byte("\x7f")) || bytes.Equal(message, []byte("\b")) {
		client.mu.Lock()
		current := client.cmdBuf.String()
		if len(current) > 0 {
			client.cmdBuf.Reset()
			client.cmdBuf.WriteString(current[:len(current)-1])
			client.mu.Unlock()
			client.sendRaw([]byte("\b \b"))
		} else {
			client.mu.Unlock()
		}
		return
	}

	// Enter key in idle shell
	if bytes.Contains(message, []byte("\r")) || bytes.Contains(message, []byte("\n")) {
		client.mu.Lock()
		cmdStr := strings.TrimSpace(client.cmdBuf.String())
		client.cmdBuf.Reset()
		client.mu.Unlock()

		client.sendRaw([]byte("\r\n"))
		if cmdStr == "" {
			client.sendRaw([]byte("\x1b[34mvoidlab\x1b[0m:\x1b[32m/workspace\x1b[0m$ "))
			return
		}

		if cmdStr == "clear" {
			client.sendRaw([]byte("\x1b[2J\x1b[H\x1b[34mvoidlab\x1b[0m:\x1b[32m/workspace\x1b[0m$ "))
			return
		}

		if cmdStr == "run" || strings.HasPrefix(cmdStr, "run ") {
			targetPath := strings.TrimSpace(strings.TrimPrefix(cmdStr, "run"))
			go h.ExecuteRun(client, targetPath, "")
			return
		}

		go h.ExecuteSandboxCommand(client, cmdStr)
		return
	}

	// Echo printable characters and buffer in command line
	client.mu.Lock()
	client.cmdBuf.Write(message)
	client.mu.Unlock()
	client.sendRaw(message)
}

// ExecuteRun initiates Docker/Sandbox execution and streams live bi-directional I/O.
func (h *Handler) ExecuteRun(client *Client, relPath string, lang string) {
	if relPath == "" {
		data, err := h.explorerSvc.BuildWorkspaceData()
		if err == nil && data.ActiveFile != nil {
			relPath = data.ActiveFile.Path
			lang = data.ActiveFile.Language
		}
	}
	if relPath == "" {
		relPath = "src/main.py"
	}

	client.mu.Lock()
	if client.cancelFunc != nil {
		client.cancelFunc()
	}
	ctx, cancel := context.WithCancel(context.Background())
	client.cancelFunc = cancel

	stdinReader, stdinWriter := io.Pipe()
	client.stdinPipe = stdinWriter
	client.mu.Unlock()

	defer func() {
		client.mu.Lock()
		if client.stdinPipe != nil {
			_ = client.stdinPipe.Close()
			client.stdinPipe = nil
		}
		client.cancelFunc = nil
		client.mu.Unlock()
		_ = stdinReader.Close()
	}()

	client.sendJSON(OutboundMessage{
		Type:    "status",
		Message: fmt.Sprintf("Executing %s...", relPath),
		Running: true,
	})

	client.sendRaw([]byte(fmt.Sprintf("\r\n\x1b[36m[VoidLAB]\x1b[0m \x1b[1mExecuting %s\x1b[0m...\r\n", html.EscapeString(relPath))))

	client.sendHTML(fmt.Sprintf(
		`<div class="opacity-80 pt-1 pb-0.5"><span class="text-sky-400 font-semibold">[Running]</span> Executing <strong class="text-[var(--text-strong)]">%s</strong>...</div>`,
		html.EscapeString(relPath),
	))

	// Live streaming stdout writer that pipes chunks directly to WebSocket
	stdoutWriter := newStreamWriter(func(chunk string) {
		client.sendRaw([]byte(chunk))
		client.sendHTML(fmt.Sprintf(`<div class="font-mono text-[11px] leading-5 text-[var(--terminal-text)] whitespace-pre-wrap break-words">%s</div>`, html.EscapeString(chunk)))
	})

	// Live streaming stderr writer that pipes errors in ANSI red
	stderrWriter := newStreamWriter(func(chunk string) {
		client.sendRaw([]byte(fmt.Sprintf("\x1b[31m%s\x1b[0m", chunk)))
		client.sendHTML(fmt.Sprintf(`<div class="font-mono text-[11px] leading-5 text-rose-400 whitespace-pre-wrap break-words">%s</div>`, html.EscapeString(chunk)))
	})

	result, err := h.orchestrator.Run(ctx, relPath, lang, stdinReader, stdoutWriter, stderrWriter)

	durationStr := "0.00s"
	exitCode := 0
	if result != nil {
		durationStr = fmt.Sprintf("%.2fs", result.Duration.Seconds())
		exitCode = result.ExitCode
	}

	exitColor := "\x1b[32m" // green
	statusTone := "text-emerald-400"
	statusText := "Execution completed"
	if err != nil || exitCode != 0 {
		exitColor = "\x1b[31m" // red
		statusTone = "text-rose-400"
		if err != nil {
			statusText = fmt.Sprintf("Execution error: %v", err)
		} else {
			statusText = fmt.Sprintf("Exited with code %d", exitCode)
		}
	}

	client.sendRaw([]byte(fmt.Sprintf("\r\n%s[Process finished with exit code %d (%s)]\x1b[0m\r\n\x1b[34mvoidlab\x1b[0m:\x1b[32m/workspace\x1b[0m$ ", exitColor, exitCode, durationStr)))

	client.sendHTML(fmt.Sprintf(
		`<div class="opacity-80 pt-0.5 pb-1 text-[10px] border-b border-[var(--border)]"><span class="%s font-semibold">[%s]</span> Exit code: %d | Time: %s</div>`,
		statusTone, statusText, exitCode, durationStr,
	))

	client.sendJSON(OutboundMessage{
		Type:     "exit",
		ExitCode: exitCode,
		Duration: durationStr,
		Running:  false,
	})
}

// ExecuteSandboxCommand runs workspace commands (ls, pwd, cat, whoami, help) and returns stream.
func (h *Handler) ExecuteSandboxCommand(client *Client, cmdStr string) {
	trimmed := strings.TrimSpace(cmdStr)
	if trimmed == "" {
		client.sendRaw([]byte("\x1b[34mvoidlab\x1b[0m:\x1b[32m/workspace\x1b[0m$ "))
		return
	}

	parts := strings.Fields(trimmed)
	cmdName := parts[0]
	args := parts[1:]

	switch cmdName {
	case "help":
		helpText := "\x1b[1mVoidLAB Built-in Sandbox Shell Commands:\x1b[0m\r\n" +
			"  \x1b[33mrun [file]\x1b[0m      - Execute active file or target script in container\r\n" +
			"  \x1b[33mls [path]\x1b[0m       - List directory contents\r\n" +
			"  \x1b[33mpwd\x1b[0m             - Print working directory\r\n" +
			"  \x1b[33mcat <file>\x1b[0m      - View file contents\r\n" +
			"  \x1b[33mwhoami\x1b[0m          - Show current user\r\n" +
			"  \x1b[33mecho [text]\x1b[0m     - Echo string\r\n" +
			"  \x1b[33mclear\x1b[0m           - Clear terminal screen\r\n"
		client.sendRaw([]byte(helpText))

	case "pwd":
		client.sendRaw([]byte("/workspace\r\n"))

	case "whoami":
		client.sendRaw([]byte("voidlab\r\n"))

	case "echo":
		client.sendRaw([]byte(strings.Join(args, " ") + "\r\n"))

	case "ls":
		subPath := ""
		if len(args) > 0 {
			subPath = args[0]
		}
		safePath, err := h.explorerSvc.ResolveSafePath(subPath)
		if err != nil {
			client.sendRaw([]byte(fmt.Sprintf("\x1b[31mls: %v\x1b[0m\r\n", err)))
		} else {
			entries, err := os.ReadDir(safePath)
			if err != nil {
				client.sendRaw([]byte(fmt.Sprintf("\x1b[31mls: %v\x1b[0m\r\n", err)))
			} else {
				var b strings.Builder
				for _, entry := range entries {
					name := entry.Name()
					if entry.IsDir() {
						b.WriteString(fmt.Sprintf("\x1b[1;34m%s/\x1b[0m  ", name))
					} else {
						b.WriteString(fmt.Sprintf("\x1b[32m%s\x1b[0m  ", name))
					}
				}
				b.WriteString("\r\n")
				client.sendRaw([]byte(b.String()))
			}
		}

	case "cat":
		if len(args) == 0 {
			client.sendRaw([]byte("cat: missing file operand\r\n"))
		} else {
			safePath, err := h.explorerSvc.ResolveSafePath(args[0])
			if err != nil {
				client.sendRaw([]byte(fmt.Sprintf("\x1b[31mcat: %v\x1b[0m\r\n", err)))
			} else {
				content, err := os.ReadFile(safePath)
				if err != nil {
					client.sendRaw([]byte(fmt.Sprintf("\x1b[31mcat: %v\x1b[0m\r\n", err)))
				} else {
					normalized := strings.ReplaceAll(string(content), "\n", "\r\n")
					client.sendRaw([]byte(normalized))
					if !strings.HasSuffix(normalized, "\r\n") {
						client.sendRaw([]byte("\r\n"))
					}
				}
			}
		}

	default:
		client.sendRaw([]byte(fmt.Sprintf("\x1b[31mvoidlab: command not found: %s. Type 'help' for commands or 'run' to execute.\x1b[0m\r\n", cmdName)))
	}

	client.sendRaw([]byte("\x1b[34mvoidlab\x1b[0m:\x1b[32m/workspace\x1b[0m$ "))
}

// ExecuteCommand maintains backward compatibility for generic string execution.
func (h *Handler) ExecuteCommand(client *Client, cmdStr string) {
	h.ExecuteSandboxCommand(client, cmdStr)
}

// HandleRunTrigger handles POST /api/code/run when user clicks "Run" in topbar.
func (h *Handler) HandleRunTrigger(w http.ResponseWriter, r *http.Request) {
	data, err := h.explorerSvc.BuildWorkspaceData()
	if err != nil || data.ActiveFile == nil {
		http.Error(w, "no active file to run", http.StatusBadRequest)
		return
	}

	ext := strings.ToLower(filepath.Ext(data.ActiveFile.Path))
	if ext == ".html" || ext == ".htm" || ext == ".css" {
		previewURL := "/preview?path=" + url.QueryEscape(data.ActiveFile.Path)
		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		fmt.Fprintf(w, `
<div class="space-y-0.5 pb-1">
  <div class="opacity-80">
    <span class="opacity-50">[browser preview]</span> $ preview %s
  </div>
  <pre class="whitespace-pre-wrap break-words pl-2 text-[11px] text-cyan-400">Live preview canvas rendered in new browser tab.
&gt; <a href="%s" target="_blank" class="underline text-cyan-300 font-mono hover:text-white">Click here if new tab was blocked: %s</a></pre>
  <div class="text-[9px] opacity-60 pl-2">Browser Canvas Runtime (instant)</div>
</div>
`, html.EscapeString(data.ActiveFile.Path), previewURL, html.EscapeString(previewURL))

		h.BroadcastRaw([]byte(fmt.Sprintf(
			"\r\n\x1b[36m[VoidLAB]\x1b[0m \x1b[1mLive Preview Canvas Opened in New Tab:\x1b[0m %s\r\n\x1b[34mvoidlab\x1b[0m:\x1b[32m/workspace\x1b[0m$ ",
			previewURL,
		)))
		return
	}

	var buf bytes.Buffer
	start := time.Now()

	result, execErr := h.orchestrator.Run(r.Context(), data.ActiveFile.Path, data.ActiveFile.Language, nil, &buf, &buf)

	output := buf.String()
	if output == "" {
		output = "[Process completed with empty output]"
	}

	elapsed := time.Since(start)
	exitCode := 0
	if result != nil {
		exitCode = result.ExitCode
	}

	engineBadge := "Docker Ephemeral"
	if result != nil && !result.IsDocker {
		engineBadge = "Local Sandbox"
	}

	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	fmt.Fprintf(w, `
<div class="space-y-0.5 pb-1">
  <div class="opacity-80">
    <span class="opacity-50">[engine: %s]</span> $ run %s
  </div>
  <pre class="whitespace-pre-wrap break-words pl-2 text-[11px] %s">%s</pre>
  <div class="text-[9px] opacity-60 pl-2">Finished in %.2fs (exit: %d)</div>
</div>
`, engineBadge, html.EscapeString(data.ActiveFile.Path), ternaryClass(execErr == nil, "text-emerald-400 opacity-90", "text-rose-500"), html.EscapeString(output), elapsed.Seconds(), exitCode)

	// Broadcast output to connected xterm.js sessions
	h.BroadcastRaw([]byte(fmt.Sprintf(
		"\r\n\x1b[36m[VoidLAB]\x1b[0m \x1b[1mRun Triggered:\x1b[0m %s\r\n%s\r\n\x1b[32m[Completed in %.2fs (exit: %d)]\x1b[0m\r\n\x1b[34mvoidlab\x1b[0m:\x1b[32m/workspace\x1b[0m$ ",
		data.ActiveFile.Path,
		strings.ReplaceAll(output, "\n", "\r\n"),
		elapsed.Seconds(),
		exitCode,
	)))

	h.BroadcastJSON(OutboundMessage{
		Type:     "status",
		Message:  fmt.Sprintf("Run completed for %s", data.ActiveFile.Path),
		Duration: fmt.Sprintf("%.2fs", elapsed.Seconds()),
		ExitCode: exitCode,
		Running:  false,
	})
}

// HandleTerminalExec handles POST /api/terminal/exec for bottom input bar.
func (h *Handler) HandleTerminalExec(w http.ResponseWriter, r *http.Request) {
	_ = r.ParseForm()
	cmdStr := strings.TrimSpace(r.FormValue("command"))
	if cmdStr == "" {
		return
	}

	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	fmt.Fprintf(w, `
<div class="space-y-0.5 pb-1">
  <div class="opacity-80">
    <span class="opacity-50">/workspace</span> $ %s
  </div>
  <pre class="whitespace-pre-wrap break-words pl-2 text-[11px] opacity-60">[Command executed in session]</pre>
</div>
`, html.EscapeString(cmdStr))
}

// HandleClear handles POST /api/terminal/clear.
func (h *Handler) HandleClear(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	fmt.Fprint(w, `
<div class="opacity-60 pb-1 text-[10px]">
  VoidLAB Sandbox Shell [Output cleared]
</div>
`)
}

func (h *Handler) registerClient(c *Client) {
	h.mu.Lock()
	defer h.mu.Unlock()
	h.clients[c] = true
}

func (h *Handler) unregisterClient(c *Client) {
	h.mu.Lock()
	defer h.mu.Unlock()
	delete(h.clients, c)
	c.close()
}

// BroadcastJSON sends a JSON message frame to all connected WebSocket clients.
func (h *Handler) BroadcastJSON(msg OutboundMessage) {
	h.mu.RLock()
	defer h.mu.RUnlock()

	data, err := json.Marshal(msg)
	if err != nil {
		return
	}

	for client := range h.clients {
		client.sendRaw(data)
	}
}

// BroadcastRaw sends a raw byte slice to all connected WebSocket clients.
func (h *Handler) BroadcastRaw(data []byte) {
	h.mu.RLock()
	defer h.mu.RUnlock()

	for client := range h.clients {
		client.sendRaw(data)
	}
}

func (c *Client) sendRaw(data []byte) {
	c.mu.Lock()
	defer c.mu.Unlock()
	if c.closed {
		return
	}
	copied := make([]byte, len(data))
	copy(copied, data)
	select {
	case c.sendChan <- copied:
	default:
		// Queue full, drop rather than blocking event loop
	}
}

func (c *Client) sendJSON(msg OutboundMessage) {
	bytes, err := json.Marshal(msg)
	if err == nil {
		c.sendRaw(bytes)
	}
}

func (c *Client) sendHTML(htmlFragment string) {
	c.sendJSON(OutboundMessage{
		Type: "html",
		HTML: htmlFragment,
	})
}

func (c *Client) writeStdin(data []byte) {
	c.mu.Lock()
	defer c.mu.Unlock()
	if c.stdinPipe != nil {
		_, _ = c.stdinPipe.Write(data)
	}
}

func (c *Client) hasActiveProcess() bool {
	c.mu.Lock()
	defer c.mu.Unlock()
	return c.stdinPipe != nil
}

func (c *Client) cancelActiveProcess() {
	c.mu.Lock()
	defer c.mu.Unlock()
	if c.cancelFunc != nil {
		c.cancelFunc()
		c.cancelFunc = nil
	}
	if c.stdinPipe != nil {
		_ = c.stdinPipe.Close()
		c.stdinPipe = nil
	}
}

func (c *Client) close() {
	c.mu.Lock()
	defer c.mu.Unlock()
	if !c.closed {
		c.closed = true
		close(c.sendChan)
	}
}

func (c *Client) writePump() {
	for msg := range c.sendChan {
		_ = c.conn.WriteMessage(websocket.TextMessage, msg)
	}
}

type streamWriter struct {
	onChunk func(string)
}

func newStreamWriter(fn func(string)) *streamWriter {
	return &streamWriter{onChunk: fn}
}

func (s *streamWriter) Write(p []byte) (n int, err error) {
	if len(p) > 0 {
		s.onChunk(string(p))
	}
	return len(p), nil
}

func ternaryClass(cond bool, a, b string) string {
	if cond {
		return a
	}
	return b
}
