package ai

import (
	"encoding/json"
	"fmt"
	"html"
	"html/template"
	"log"
	"net/http"
	"strings"
	"time"

	"github.com/gorilla/websocket"

	"github.com/Voxion-Labs/VoidLAB/src/explorer"
)

// AIPromptResponse maps common programming and VoidLAB environment questions to precise guidance.
type AIPromptResponse struct {
	QueryKeywords []string
	Title         string
	Answer        string
	CodeSnippet   string
}

var knowledgeBase = []AIPromptResponse{
	{
		QueryKeywords: []string{"input", "stdin", "interactive", "scan", "cin", "readline"},
		Title:         "Handling Stdin & Interactive Input",
		Answer:        "VoidLAB features full bi-directional streaming. When an interactive program calls input() in Python, cin in C++, or bufio in Go, type your value into the terminal prompt or use the Output tab's 'Input Required' field and hit Enter. Keystrokes are piped live via WebSockets into the container stdin pipe.",
		CodeSnippet: `# Python Interactive Example
name = input("Enter your name: ")
print(f"Hello, {name}!")`,
	},
	{
		QueryKeywords: []string{"debug", "error", "fail", "timeout", "traceback", "crash"},
		Title:         "Debugging Failed Execution",
		Answer:        "1. Check the Stderr stream: compiler and runtime exceptions are highlighted in ANSI red.\n2. Confirm memory and CPU limits: containers are bounded by 256MB memory and 0.5 CPU to prevent runaway fork bombs.\n3. Verify file syntax: client-side WebAssembly validates bracket balance and syntax errors in sub-milliseconds without network overhead.",
		CodeSnippet: `# Debugging tip: check exit codes and timeout metrics in the metric strip:
STATUS: Exited (code 1) | TIME: 0.04s | MEMORY: 1840KB`,
	},
	{
		QueryKeywords: []string{"docker", "container", "sandbox", "limits", "ephemeral"},
		Title:         "Docker Sandboxing & Security Boundaries",
		Answer:        "Every code execution runs in an ephemeral, single-use container (using Alpine/slim images for C++, Rust, Python, Go, Node, etc.). The local workspace is mounted read-write into /workspace, with strict flags --rm --memory=256m --cpus=0.5 --pids-limit=64 to ensure rock-solid process isolation.",
		CodeSnippet: `docker run --rm -i --memory=256m --cpus=0.5 --pids-limit=64 -v $PWD:/workspace:rw python:3.11-alpine python3 main.py`,
	},
	{
		QueryKeywords: []string{"wasm", "webassembly", "format", "format code", "prettier"},
		Title:         "Client-Side WebAssembly Engine",
		Answer:        "VoidLAB compiles src/wasmcore into public/wasm/voidlab.wasm. It executes on the browser thread asynchronously, performing zero-lag syntax verification and code formatting on keyup without sending source code over the network.",
		CodeSnippet: `// Trigger instant WASM format
voidlabFormatCode(); // Calls voidlabWASM.format(content, lang)`,
	},
	{
		QueryKeywords: []string{"local", "local-first", "storage", "offline", "stateless"},
		Title:         "100% Stateless & Local-First Architecture",
		Answer:        "VoidLAB operates with a 100% stateless backend and zero database dependency. All your profile data, user settings, workspace states, and history are preserved locally in the browser (localStorage and IndexedDB).",
	},
	{
		QueryKeywords: []string{"html", "css", "preview", "web", "browser"},
		Title:         "Live HTML & CSS Browser Preview",
		Answer:        "Clicking the Run button while editing an .html or .css file automatically opens a live rendered preview canvas in a new browser tab via /preview?path=... without requiring an external web server.",
		CodeSnippet: `<button onclick="window.open('/preview?path=index.html', '_blank')">Preview Canvas</button>`,
	},
}

// Handler manages AI endpoints and guidance views.
type Handler struct {
	explorerSvc *explorer.Service
	templates   *template.Template
}

// NewHandler constructs an AI guidance HTTP and WebSocket handler.
func NewHandler(exp *explorer.Service, tmpl *template.Template) *Handler {
	return &Handler{
		explorerSvc: exp,
		templates:   tmpl,
	}
}

// GenerateAIResponse resolves a prompt to an AI Guide response.
func GenerateAIResponse(prompt string, lang string) (string, string, string) {
	promptLower := strings.ToLower(strings.TrimSpace(prompt))

	for _, kb := range knowledgeBase {
		for _, kw := range kb.QueryKeywords {
			if strings.Contains(promptLower, kw) {
				return kb.Title, kb.Answer, kb.CodeSnippet
			}
		}
	}

	// Dynamic fallback
	title := "VoidLAB Stateless Copilot Guidance"
	answer := fmt.Sprintf(
		"Regarding \"%s\": VoidLAB is engineered as a 100%% stateless coding engine. Your workspace is stored locally in the browser, while execution runs inside ephemeral Alpine/slim containers with 256MB RAM and 0.5 CPU limits. Use the Run button (Ctrl+Enter) to trigger execution or WASM Format to clean up syntax.",
		html.EscapeString(prompt),
	)
	return title, answer, ""
}

// HandleAIStream streams an AI response back via Server-Sent Events (SSE).
// 100% stateless: proxies prompt without storing any chat history on the server.
func HandleAIStream(w http.ResponseWriter, r *http.Request) {
	StreamHandler(w, r)
}

// StreamHandler is the package-level handler for streaming AI responses via SSE.
func StreamHandler(w http.ResponseWriter, r *http.Request) {
	flusher, ok := w.(http.Flusher)
	if !ok {
		http.Error(w, "streaming unsupported", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")
	w.Header().Set("X-Accel-Buffering", "no")

	_ = r.ParseForm()
	prompt := strings.TrimSpace(r.FormValue("prompt"))
	if prompt == "" {
		prompt = strings.TrimSpace(r.URL.Query().Get("prompt"))
	}
	lang := strings.TrimSpace(r.FormValue("lang"))

	if prompt == "" {
		prompt = "Welcome to VoidLAB"
	}

	title, answer, snippet := GenerateAIResponse(prompt, lang)
	fullText := answer
	if snippet != "" {
		fullText += "\n\n```" + lang + "\n" + snippet + "\n```"
	}

	// Stream initial title event
	metaEvent, _ := json.Marshal(map[string]any{
		"title": title,
		"time":  time.Now().Format("15:04:05"),
	})
	fmt.Fprintf(w, "event: start\ndata: %s\n\n", metaEvent)
	flusher.Flush()

	// Stream response tokens chunk-by-chunk
	words := strings.Fields(fullText)
	for i, word := range words {
		chunk := word
		if i < len(words)-1 {
			chunk += " "
		}

		payload, _ := json.Marshal(map[string]any{
			"chunk": chunk,
			"done":  false,
		})
		fmt.Fprintf(w, "event: chunk\ndata: %s\n\n", payload)
		flusher.Flush()
	}

	// Stream completion event
	donePayload, _ := json.Marshal(map[string]any{
		"chunk": "",
		"done":  true,
	})
	fmt.Fprintf(w, "event: done\ndata: %s\n\n", donePayload)
	flusher.Flush()
}

// HandleAIWebSocket handles streaming LLM responses over WebSockets.
func HandleAIWebSocket(w http.ResponseWriter, r *http.Request) {
	WebSocketHandler(w, r)
}

// WebSocketHandler is the package-level handler for streaming LLM responses over WebSockets.
func WebSocketHandler(w http.ResponseWriter, r *http.Request) {
	upgrader := websocket.Upgrader{
		CheckOrigin: func(r *http.Request) bool { return true },
	}

	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Printf("[AI WS] upgrade error: %v", err)
		return
	}
	defer conn.Close()

	for {
		var req map[string]string
		if err := conn.ReadJSON(&req); err != nil {
			break
		}

		prompt := strings.TrimSpace(req["prompt"])
		lang := strings.TrimSpace(req["lang"])
		if prompt == "" {
			continue
		}

		title, answer, snippet := GenerateAIResponse(prompt, lang)
		fullText := answer
		if snippet != "" {
			fullText += "\n\n```" + lang + "\n" + snippet + "\n```"
		}

		_ = conn.WriteJSON(map[string]any{
			"type":  "start",
			"title": title,
			"time":  time.Now().Format("15:04:05"),
		})

		words := strings.Fields(fullText)
		for i, word := range words {
			chunk := word
			if i < len(words)-1 {
				chunk += " "
			}

			_ = conn.WriteJSON(map[string]any{
				"type":  "chunk",
				"chunk": chunk,
				"done":  false,
			})
		}

		_ = conn.WriteJSON(map[string]any{
			"type": "done",
			"done": true,
		})
	}
}

// RenderAIPromptFragment generates the HTMX HTML message pair (user message + assistant message).
func RenderAIPromptFragment(prompt string, lang string) string {
	title, answer, codeSnippet := GenerateAIResponse(prompt, lang)
	now := time.Now().Format("15:04:05")

	var snippetHTML string
	if codeSnippet != "" {
		snippetHTML = fmt.Sprintf(
			`<pre class="mt-2 p-2 rounded bg-[var(--background-main)] border border-[var(--border)] font-mono text-[10px] text-[var(--accent)] overflow-x-auto scrollbar-thin">%s</pre>`,
			html.EscapeString(codeSnippet),
		)
	}

	return fmt.Sprintf(`
<!-- User Query Bubble -->
<div class="flex justify-end mb-3">
  <div class="max-w-[85%%] rounded-xl rounded-tr-none px-3.5 py-2 text-xs font-sans shadow-sm" style="background: var(--action-background); color: var(--action-foreground);">
    <div class="font-medium text-[10px] opacity-80 mb-0.5">You (%s)</div>
    <div class="leading-relaxed">%s</div>
  </div>
</div>

<!-- AI Guide Assistant Response Bubble -->
<div class="flex items-start gap-2.5 mb-4 animate-in fade-in duration-100">
  <div class="w-6 h-6 rounded-md flex items-center justify-center font-bold text-[10px] bg-[var(--accent)] text-white shadow-sm shrink-0 mt-0.5">
    AI
  </div>
  <div class="flex-1 max-w-[90%%] rounded-xl rounded-tl-none p-3.5 text-xs font-sans transition-colors border" style="background: var(--surface-soft); border-color: var(--border-strong); color: var(--text);">
    <div class="flex items-center justify-between pb-1.5 mb-1.5 border-b border-[var(--border)]">
      <span class="font-semibold text-[11px] text-[var(--text-strong)] flex items-center gap-1.5">
        <span class="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
        %s
      </span>
      <span class="text-[9px] font-mono text-[var(--muted)]">%s</span>
    </div>
    <div class="text-[11px] leading-relaxed whitespace-pre-wrap text-[var(--text)]">%s</div>
    %s
  </div>
</div>
`, now, html.EscapeString(prompt), html.EscapeString(title), now, html.EscapeString(answer), snippetHTML)
}

// RenderAISuggestionsFragment generates starter prompt pills for instant queries.
func RenderAISuggestionsFragment() string {
	return `
<div id="ai-suggestions-palette" class="space-y-2 pt-2 border-t border-[var(--border)]">
  <div class="text-[10px] font-semibold uppercase tracking-wider text-[var(--muted)]">Suggested Prompts:</div>
  <div class="flex flex-wrap gap-1.5">
    <button
      hx-post="/api/ai/prompt"
      hx-vals='{"prompt": "How do I run input-output programs correctly?"}'
      hx-target="#ai-messages-list"
      hx-swap="beforeend"
      class="px-2.5 py-1 rounded-full text-[10px] bg-[var(--surface-soft)] hover:bg-[var(--control-hover)] text-[var(--text)] border border-[var(--border)] transition-colors cursor-pointer text-left"
      type="button"
    >
      💬 How do I run input-output programs?
    </button>
    <button
      hx-post="/api/ai/prompt"
      hx-vals='{"prompt": "How do I debug a failing run or timeout?"}'
      hx-target="#ai-messages-list"
      hx-swap="beforeend"
      class="px-2.5 py-1 rounded-full text-[10px] bg-[var(--surface-soft)] hover:bg-[var(--control-hover)] text-[var(--text)] border border-[var(--border)] transition-colors cursor-pointer text-left"
      type="button"
    >
      ⚡ How do I debug a failing run?
    </button>
    <button
      hx-post="/api/ai/prompt"
      hx-vals='{"prompt": "Explain Docker sandboxing and security limits"}'
      hx-target="#ai-messages-list"
      hx-swap="beforeend"
      class="px-2.5 py-1 rounded-full text-[10px] bg-[var(--surface-soft)] hover:bg-[var(--control-hover)] text-[var(--text)] border border-[var(--border)] transition-colors cursor-pointer text-left"
      type="button"
    >
      🔒 Docker security limits
    </button>
    <button
      hx-post="/api/ai/prompt"
      hx-vals='{"prompt": "How does WebAssembly client formatting work?"}'
      hx-target="#ai-messages-list"
      hx-swap="beforeend"
      class="px-2.5 py-1 rounded-full text-[10px] bg-[var(--surface-soft)] hover:bg-[var(--control-hover)] text-[var(--text)] border border-[var(--border)] transition-colors cursor-pointer text-left"
      type="button"
    >
      ⚡ WebAssembly syntax & format
    </button>
  </div>
</div>
`
}

// HandleAIPrompt handles /api/ai/prompt returning rich HTML fragments or SSE streams.
func (h *Handler) HandleAIPrompt(w http.ResponseWriter, r *http.Request) {
	PromptHandler(w, r)
}

// PromptHandler is the package-level handler for /api/ai/prompt.
func PromptHandler(w http.ResponseWriter, r *http.Request) {
	if strings.Contains(r.Header.Get("Accept"), "text/event-stream") || r.URL.Query().Get("stream") == "true" {
		StreamHandler(w, r)
		return
	}

	_ = r.ParseForm()
	prompt := strings.TrimSpace(r.FormValue("prompt"))
	if prompt == "" {
		prompt = strings.TrimSpace(r.URL.Query().Get("prompt"))
	}
	lang := strings.TrimSpace(r.FormValue("lang"))

	w.Header().Set("Content-Type", "text/html; charset=utf-8")

	if prompt == "" {
		fmt.Fprint(w, RenderAISuggestionsFragment())
		return
	}

	fmt.Fprint(w, RenderAIPromptFragment(prompt, lang))
}

// HandleAIStream serves the Server-Sent Events (SSE) streaming proxy.
func (h *Handler) HandleAIStream(w http.ResponseWriter, r *http.Request) {
	StreamHandler(w, r)
}

// HandleAIWebSocket serves the WebSocket streaming proxy.
func (h *Handler) HandleAIWebSocket(w http.ResponseWriter, r *http.Request) {
	WebSocketHandler(w, r)
}

// HandleUIAI returns the ai.tmpl HTMX fragment for the side panel.
func (h *Handler) HandleUIAI(w http.ResponseWriter, r *http.Request) {
	var data *explorer.WorkspaceData
	if h.explorerSvc != nil {
		var err error
		data, err = h.explorerSvc.BuildWorkspaceData()
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
	} else {
		data = &explorer.WorkspaceData{}
	}

	data.IsEditor = true
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	if h.templates != nil {
		if err := h.templates.ExecuteTemplate(w, "ai.tmpl", data); err != nil {
			_ = h.templates.ExecuteTemplate(w, "ai", data)
		}
	}
}

// HandleAIPage renders the full-page local AI guide view.
func (h *Handler) HandleAIPage(w http.ResponseWriter, r *http.Request) {
	var data *explorer.WorkspaceData
	if h.explorerSvc != nil {
		var err error
		data, err = h.explorerSvc.BuildWorkspaceData()
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
	} else {
		data = &explorer.WorkspaceData{}
	}

	data.IsEditor = true
	data.SubView = "ai"
	data.Title = "Local AI Guide - VoidLAB"
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	if h.templates != nil {
		_ = h.templates.ExecuteTemplate(w, "base.tmpl", data)
	}
}
