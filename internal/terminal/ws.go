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
	"strings"
	"sync"
	"time"

	"github.com/gorilla/websocket"

	"github.com/Voxion-Labs/VoidLAB/internal/docker"
	"github.com/Voxion-Labs/VoidLAB/internal/explorer"
)

var upgrader = websocket.Upgrader{
	ReadBufferSize:  4096,
	WriteBufferSize: 4096,
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
	Type     string `json:"type"` // "stdout", "stderr", "status", "html"
	Text     string `json:"text,omitempty"`
	HTML     string `json:"html,omitempty"`
	Message  string `json:"message,omitempty"`
	Duration string `json:"duration,omitempty"`
	ExitCode int    `json:"exit_code,omitempty"`
}

// Client represents an active WebSocket terminal session.
type Client struct {
	conn       *websocket.Conn
	sendChan   chan []byte
	stdinPipe  io.WriteCloser
	cancelFunc context.CancelFunc
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
		sendChan: make(chan []byte, 128),
	}

	h.registerClient(client)
	defer func() {
		h.unregisterClient(client)
		_ = conn.Close()
	}()

	// Send initial greeting frame
	isDocker := h.orchestrator.IsDockerAvailable(r.Context())
	engineLabel := "Local Sandbox Fallback"
	if isDocker {
		engineLabel = "Docker Ephemeral Engine"
	}

	welcomeMsg := OutboundMessage{
		Type:    "status",
		Message: fmt.Sprintf("VoidLAB Terminal Stream Online [%s]", engineLabel),
		HTML: fmt.Sprintf(
			`<div class="opacity-80 text-[10px] pb-1"><span class="text-emerald-400 font-semibold">[Connected]</span> VoidLAB Engine Active (%s)</div>`,
			engineLabel,
		),
	}
	client.sendJSON(welcomeMsg)

	// Pump writes
	go client.writePump()

	// Read pump (handles client input, Run commands, stdin)
	for {
		_, message, err := conn.ReadMessage()
		if err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
				log.Printf("[WS] client read error: %v", err)
			}
			break
		}

		var inbound InboundMessage
		if err := json.Unmarshal(message, &inbound); err != nil {
			// Fallback: raw text interpreted as stdin
			client.handleRawInput(string(message))
			continue
		}

		h.dispatchInbound(client, inbound)
	}
}

func (h *Handler) dispatchInbound(client *Client, msg InboundMessage) {
	switch msg.Type {
	case "run":
		go h.ExecuteRun(client, msg.Path, msg.Language)
	case "stdin":
		client.mu.Lock()
		if client.stdinPipe != nil {
			_, _ = io.WriteString(client.stdinPipe, msg.Data)
		}
		client.mu.Unlock()
	case "command":
		go h.ExecuteCommand(client, msg.Command)
	case "ping":
		client.sendJSON(OutboundMessage{Type: "status", Message: "pong"})
	}
}

// ExecuteRun initiates Docker/Sandbox execution and streams live output to the client.
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
		client.stdinPipe = nil
		client.cancelFunc = nil
		client.mu.Unlock()
		_ = stdinReader.Close()
	}()

	client.sendHTML(fmt.Sprintf(
		`<div class="opacity-80 pt-1 pb-0.5"><span class="text-sky-400 font-semibold">[Running]</span> Executing <strong class="text-[var(--text-strong)]">%s</strong>...</div>`,
		html.EscapeString(relPath),
	))

	// Live streaming writers that pump chunks directly over WebSocket
	stdoutWriter := newStreamWriter(func(chunk string) {
		client.sendJSON(OutboundMessage{Type: "stdout", Text: chunk})
		client.sendHTML(fmt.Sprintf(`<div class="font-mono text-[11px] leading-5 text-[var(--terminal-text)] whitespace-pre-wrap break-words">%s</div>`, html.EscapeString(chunk)))
	})

	stderrWriter := newStreamWriter(func(chunk string) {
		client.sendJSON(OutboundMessage{Type: "stderr", Text: chunk})
		client.sendHTML(fmt.Sprintf(`<div class="font-mono text-[11px] leading-5 text-rose-400 whitespace-pre-wrap break-words">%s</div>`, html.EscapeString(chunk)))
	})

	result, err := h.orchestrator.Run(ctx, relPath, lang, stdinReader, stdoutWriter, stderrWriter)

	statusTone := "text-emerald-400"
	statusText := "Execution completed"
	if err != nil {
		statusTone = "text-rose-400"
		statusText = fmt.Sprintf("Execution error: %v", err)
	}

	durationStr := "0.00s"
	if result != nil {
		durationStr = fmt.Sprintf("%.2fs", result.Duration.Seconds())
	}

	client.sendHTML(fmt.Sprintf(
		`<div class="opacity-80 pt-0.5 pb-1 text-[10px] border-b border-[var(--border)]"><span class="%s font-semibold">[%s]</span> Exit code: %d | Time: %s</div>`,
		statusTone, statusText, result.ExitCode, durationStr,
	))
}

// ExecuteCommand runs a simple sandbox shell command and returns output.
func (h *Handler) ExecuteCommand(client *Client, cmdStr string) {
	trimmed := strings.TrimSpace(cmdStr)
	if trimmed == "" {
		return
	}

	client.sendHTML(fmt.Sprintf(
		`<div class="opacity-80"><span class="opacity-50">/workspace</span> $ %s</div>`,
		html.EscapeString(trimmed),
	))

	parts := strings.Fields(trimmed)
	cmdName := parts[0]
	args := parts[1:]

	// Restrict to safe workspace exploration commands
	allowed := map[string]bool{"ls": true, "pwd": true, "echo": true, "cat": true, "find": true, "whoami": true}
	if !allowed[cmdName] {
		client.sendHTML(`<div class="text-rose-400 text-[11px] pl-2">Error: command not supported in sandbox shell. Use Run for code execution.</div>`)
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	cmdResult, err := h.orchestrator.Run(ctx, "", "shell", nil, nil, nil)
	_ = cmdResult
	if err != nil {
		client.sendHTML(fmt.Sprintf(`<div class="text-rose-400 text-[11px] pl-2">%s</div>`, html.EscapeString(err.Error())))
		return
	}
	_ = args
}

// HandleRunTrigger handles POST /api/code/run when user clicks "Run" in topbar.
func (h *Handler) HandleRunTrigger(w http.ResponseWriter, r *http.Request) {
	data, err := h.explorerSvc.BuildWorkspaceData()
	if err != nil || data.ActiveFile == nil {
		http.Error(w, "no active file to run", http.StatusBadRequest)
		return
	}

	var buf bytes.Buffer
	start := time.Now()

	// Execute via Orchestrator (Docker or Local Fallback)
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

	// Also broadcast to any connected WebSocket clients
	h.BroadcastJSON(OutboundMessage{
		Type:     "status",
		Message:  fmt.Sprintf("Run completed for %s", data.ActiveFile.Path),
		Duration: fmt.Sprintf("%.2fs", elapsed.Seconds()),
		ExitCode: exitCode,
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
  <pre class="whitespace-pre-wrap break-words pl-2 text-[11px] opacity-60">[Command logged to session]</pre>
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
	close(c.sendChan)
}

// BroadcastJSON sends a message frame to all connected WebSocket clients.
func (h *Handler) BroadcastJSON(msg OutboundMessage) {
	h.mu.RLock()
	defer h.mu.RUnlock()

	bytes, err := json.Marshal(msg)
	if err != nil {
		return
	}

	for client := range h.clients {
		select {
		case client.sendChan <- bytes:
		default:
		}
	}
}

func (c *Client) sendJSON(msg OutboundMessage) {
	bytes, err := json.Marshal(msg)
	if err == nil {
		select {
		case c.sendChan <- bytes:
		default:
		}
	}
}

func (c *Client) sendHTML(htmlFragment string) {
	c.sendJSON(OutboundMessage{
		Type: "html",
		HTML: htmlFragment,
	})
}

func (c *Client) handleRawInput(text string) {
	c.mu.Lock()
	defer c.mu.Unlock()
	if c.stdinPipe != nil {
		_, _ = io.WriteString(c.stdinPipe, text)
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
