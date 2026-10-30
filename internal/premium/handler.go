package premium

import (
	"fmt"
	"html"
	"html/template"
	"net/http"
	"strings"
	"time"

	"github.com/Voxion-Labs/VoidLAB/internal/explorer"
)

// Handler serves premium feature routes (Multiplayer Collaboration, AI Guide, and Authentication).
type Handler struct {
	collabManager *CollabManager
	explorerSvc   *explorer.Service
}

// NewHandler constructs the premium features handler.
func NewHandler(exp *explorer.Service) *Handler {
	return &Handler{
		collabManager: NewCollabManager(),
		explorerSvc:   exp,
	}
}

// HandleCollabRoom handles /api/collab/room for both multiplayer WebSockets and HTMX HTML fragments.
func (h *Handler) HandleCollabRoom(w http.ResponseWriter, r *http.Request) {
	// 1. Upgrade to WebSocket if requested
	if strings.ToLower(r.Header.Get("Upgrade")) == "websocket" {
		h.collabManager.HandleWebSocketConnection(w, r)
		return
	}

	_ = r.ParseForm()
	action := strings.ToLower(strings.TrimSpace(r.FormValue("action")))
	if action == "" {
		action = strings.ToLower(strings.TrimSpace(r.URL.Query().Get("action")))
	}

	currentUser, _ := GetAuthenticatedUser(r)
	if currentUser == "" {
		currentUser = DefaultUsername
	}

	w.Header().Set("Content-Type", "text/html; charset=utf-8")

	switch action {
	case "create":
		room := h.collabManager.GetOrCreateRoom("", currentUser)
		fmt.Fprint(w, h.collabManager.RenderRoomCard(room, currentUser))

	case "join":
		roomID := strings.TrimSpace(r.FormValue("room_id"))
		if roomID == "" {
			roomID = strings.TrimSpace(r.URL.Query().Get("room_id"))
		}
		room := h.collabManager.GetOrCreateRoom(roomID, currentUser)
		room.mu.Lock()
		hasUser := false
		for _, p := range room.Participants {
			if p == currentUser {
				hasUser = true
				break
			}
		}
		if !hasUser {
			room.Participants = append(room.Participants, currentUser)
		}
		room.mu.Unlock()

		fmt.Fprint(w, h.collabManager.RenderRoomCard(room, currentUser))

	case "message":
		roomID := strings.TrimSpace(r.FormValue("room_id"))
		msgText := strings.TrimSpace(r.FormValue("message"))
		room := h.collabManager.GetOrCreateRoom(roomID, currentUser)

		if msgText != "" {
			room.mu.Lock()
			room.Messages = append(room.Messages, CollabMessage{
				Author:    currentUser,
				Text:      msgText,
				Timestamp: time.Now(),
			})
			room.mu.Unlock()
		}
		fmt.Fprint(w, h.collabManager.RenderRoomCard(room, currentUser))

	case "leave":
		fmt.Fprint(w, h.collabManager.RenderLauncherCard())

	default:
		fmt.Fprint(w, h.collabManager.RenderLauncherCard())
	}
}

// HandleAIPrompt handles /api/ai/prompt returning rich HTML fragments for the AI Guide.
func (h *Handler) HandleAIPrompt(w http.ResponseWriter, r *http.Request) {
	_ = r.ParseForm()

	prompt := strings.TrimSpace(r.FormValue("prompt"))
	if prompt == "" {
		prompt = strings.TrimSpace(r.URL.Query().Get("prompt"))
	}
	lang := strings.TrimSpace(r.FormValue("lang"))

	w.Header().Set("Content-Type", "text/html; charset=utf-8")

	if prompt == "" {
		// Return suggestions palette if prompt is empty
		fmt.Fprint(w, RenderAISuggestionsFragment())
		return
	}

	fmt.Fprint(w, RenderAIPromptFragment(prompt, lang))
}

// HandleLogin authenticates a user and sets a secure HTTP-only cookie.
func (h *Handler) HandleLogin(w http.ResponseWriter, r *http.Request) {
	_ = r.ParseForm()
	username := strings.TrimSpace(r.FormValue("username"))
	if username == "" {
		username = DefaultUsername
	}

	// Issue secure HTTP-only cookie
	SetAuthCookie(w, r, username)

	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	fmt.Fprint(w, RenderAuthenticatedBadge(username))
}

// HandleLogout clears the authentication cookie and returns the unauthenticated status badge.
func (h *Handler) HandleLogout(w http.ResponseWriter, r *http.Request) {
	ClearAuthCookie(w, r)
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	fmt.Fprint(w, RenderUnauthenticatedBadge())
}

// HandleAuthStatus checks the session cookie and returns the appropriate status fragment.
func (h *Handler) HandleAuthStatus(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	if user, ok := GetAuthenticatedUser(r); ok {
		fmt.Fprint(w, RenderAuthenticatedBadge(user))
	} else {
		fmt.Fprint(w, RenderUnauthenticatedBadge())
	}
}

// HandleProfileModal serves the profile settings dialog as an HTML fragment.
func (h *Handler) HandleProfileModal(w http.ResponseWriter, r *http.Request) {
	user, authenticated := GetAuthenticatedUser(r)
	if !authenticated {
		user = DefaultUsername
	}

	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	fmt.Fprintf(w, `
<div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onclick="if(event.target===this) this.remove()">
  <div class="w-full max-w-md rounded-xl p-6 shadow-2xl transition-colors font-sans" style="background: var(--panel-background); border: 1px solid var(--border-strong); color: var(--text);">
    <div class="flex items-center justify-between pb-3 mb-4 border-b border-[var(--border)]">
      <div class="flex items-center gap-2">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color: var(--accent);"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
        <div class="font-bold text-sm text-[var(--text-strong)]">Developer Profile & Authentication</div>
      </div>
      <button onclick="this.closest('.fixed').remove()" class="p-1 rounded opacity-70 hover:opacity-100 cursor-pointer" type="button">✕</button>
    </div>

    <div class="space-y-4 text-xs font-sans">
      <!-- User Card -->
      <div class="flex items-center gap-3 p-3 rounded-lg bg-[var(--surface-soft)] border border-[var(--border)]">
        <div class="w-12 h-12 rounded-full bg-[var(--accent)] text-white font-bold text-base flex items-center justify-center shadow-sm">
          %s
        </div>
        <div>
          <div class="font-bold text-sm text-[var(--text-strong)]">%s</div>
          <div class="text-[11px] text-[var(--muted)]">Voxion Labs Principal Engineer</div>
          <div class="inline-flex items-center gap-1 mt-1 text-[10px] text-emerald-500 font-medium">
            <span class="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
            HTTP-Only Cookie Authenticated
          </div>
        </div>
      </div>

      <!-- Session Security Card -->
      <div class="p-3 rounded-lg border border-[var(--border)] space-y-1.5 bg-[var(--panel-background)]">
        <div class="font-semibold text-[11px] text-[var(--text-strong)]">Security Architecture</div>
        <div class="text-[11px] text-[var(--muted)] leading-relaxed">
          Authentication credentials are stored exclusively in an HTTP-only, SameSite=Lax cookie (<code>voidlab_session</code>). No client-side JavaScript can inspect or tamper with session tokens.
        </div>
      </div>

      <!-- Auth Action Container -->
      <div id="modal-auth-container">
        %s
      </div>
    </div>

    <div class="flex justify-end gap-2 pt-4 mt-4 border-t border-[var(--border)]">
      <button onclick="this.closest('.fixed').remove()" class="px-3.5 py-1.5 rounded-md text-xs font-medium bg-[var(--control-background)] hover:bg-[var(--control-hover)] border border-[var(--border)] text-[var(--text)] cursor-pointer" type="button">
        Close
      </button>
    </div>
  </div>
</div>
`, strings.ToUpper(string(user[0])), html.EscapeString(user), RenderAuthenticatedBadge(user))
}

// HandleSettingsModal serves the workspace settings modal as an HTML fragment.
func (h *Handler) HandleSettingsModal(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	fmt.Fprint(w, `
<div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onclick="if(event.target===this) this.remove()">
  <div class="w-full max-w-md rounded-xl p-6 shadow-2xl transition-colors font-sans" style="background: var(--panel-background); border: 1px solid var(--border-strong); color: var(--text);">
    <div class="flex items-center justify-between pb-3 mb-4 border-b border-[var(--border)]">
      <div class="flex items-center gap-2">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color: var(--accent);"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
        <div class="font-bold text-sm text-[var(--text-strong)]">Workspace Preferences</div>
      </div>
      <button onclick="this.closest('.fixed').remove()" class="p-1 rounded opacity-70 hover:opacity-100 cursor-pointer" type="button">✕</button>
    </div>

    <div class="space-y-4 text-xs font-sans">
      <div>
        <label class="block text-[11px] font-semibold text-[var(--muted)] mb-1">Editor Font Family</label>
        <select class="w-full rounded px-2.5 py-1.5 border border-[var(--border)] bg-[var(--input-background)] text-[var(--text)] outline-none">
          <option selected>'JetBrains Mono', monospace</option>
          <option>'Fira Code', monospace</option>
          <option>'Cascadia Code', monospace</option>
        </select>
      </div>

      <div>
        <label class="block text-[11px] font-semibold text-[var(--muted)] mb-1">Tab Size</label>
        <select class="w-full rounded px-2.5 py-1.5 border border-[var(--border)] bg-[var(--input-background)] text-[var(--text)] outline-none">
          <option selected>2 Spaces (Standard)</option>
          <option>4 Spaces</option>
        </select>
      </div>

      <div>
        <label class="block text-[11px] font-semibold text-[var(--muted)] mb-1">Execution Engine</label>
        <div class="p-2 rounded bg-[var(--surface-soft)] border border-[var(--border)] text-[11px] text-[var(--muted)]">
          Dual-engine enabled: Docker Ephemeral Container with seamless local sandbox fallthrough.
        </div>
      </div>
    </div>

    <div class="flex justify-end gap-2 pt-4 mt-4 border-t border-[var(--border)]">
      <button onclick="this.closest('.fixed').remove()" class="px-3.5 py-1.5 rounded-md text-xs font-semibold bg-[var(--action-background)] text-[var(--action-foreground)] shadow-sm cursor-pointer" type="button">
        Save Preferences
      </button>
    </div>
  </div>
</div>
`)
}

// HandleCollabPage renders the collaboration panel view within base.tmpl.
func (h *Handler) HandleCollabPage(tmpl *template.Template, exp *explorer.Service) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		data, err := exp.BuildWorkspaceData()
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		data.Title = "Multiplayer Collaboration - VoidLAB"
		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		_ = tmpl.ExecuteTemplate(w, "base.tmpl", data)
	}
}

// HandleAIPage renders the AI guide panel view within base.tmpl.
func (h *Handler) HandleAIPage(tmpl *template.Template, exp *explorer.Service) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		data, err := exp.BuildWorkspaceData()
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		data.Title = "Local AI Guide - VoidLAB"
		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		_ = tmpl.ExecuteTemplate(w, "base.tmpl", data)
	}
}

// HandleProfilePage renders the profile page view.
func (h *Handler) HandleProfilePage(tmpl *template.Template, exp *explorer.Service) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		user, _ := GetAuthenticatedUser(r)
		if user == "" {
			SetAuthCookie(w, r, DefaultUsername)
		}
		data, err := exp.BuildWorkspaceData()
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		data.Title = "Developer Profile - VoidLAB"
		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		_ = tmpl.ExecuteTemplate(w, "base.tmpl", data)
	}
}

// HandleManualPage renders the VoidLAB docs and manual page.
func (h *Handler) HandleManualPage(tmpl *template.Template, exp *explorer.Service) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		data, err := exp.BuildWorkspaceData()
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		data.Title = "Engineering Manual - VoidLAB"
		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		_ = tmpl.ExecuteTemplate(w, "base.tmpl", data)
	}
}
