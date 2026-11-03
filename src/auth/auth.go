package auth

import (
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"html"
	"html/template"
	"net/http"
	"strings"
	"time"

	"github.com/Voxion-Labs/VoidLAB/src/explorer"
)

const (
	// SessionCookieName is the secure HTTP-only cookie name used for authentication.
	SessionCookieName = "voidlab_session"
	// DefaultUsername used for single-user local-first developer environments.
	DefaultUsername = "Rudra"
)

// UserSession represents an authenticated VoidLAB user profile.
type UserSession struct {
	Username    string    `json:"username"`
	Role        string    `json:"role"`
	Bio         string    `json:"bio"`
	Email       string    `json:"email"`
	Location    string    `json:"location"`
	CreatedAt   time.Time `json:"created_at"`
	IsProtected bool      `json:"is_protected"`
}

// Handler manages user authentication, cookie sessions, and profile modals.
type Handler struct {
	explorerSvc *explorer.Service
	templates   *template.Template
}

// NewHandler constructs an auth and profile HTTP handler.
func NewHandler(exp *explorer.Service, tmpl *template.Template) *Handler {
	return &Handler{
		explorerSvc: exp,
		templates:   tmpl,
	}
}

// SetAuthCookie issues a secure, HTTP-only cookie mitigating XSS access.
func SetAuthCookie(w http.ResponseWriter, r *http.Request, username string) string {
	if strings.TrimSpace(username) == "" {
		username = DefaultUsername
	}
	username = strings.TrimSpace(username)

	tokenBytes := make([]byte, 16)
	_, _ = rand.Read(tokenBytes)
	token := hex.EncodeToString(tokenBytes)

	// Format: username:token:timestamp
	cookieVal := fmt.Sprintf("%s:%s:%d", username, token, time.Now().Unix())
	isSecure := r.TLS != nil || r.Header.Get("X-Forwarded-Proto") == "https"

	http.SetCookie(w, &http.Cookie{
		Name:     SessionCookieName,
		Value:    cookieVal,
		Path:     "/",
		HttpOnly: true,
		Secure:   isSecure,
		SameSite: http.SameSiteLaxMode,
		MaxAge:   86400 * 7, // 7 days expiration
	})

	return cookieVal
}

// ClearAuthCookie clears the session cookie to securely log out the user.
func ClearAuthCookie(w http.ResponseWriter, r *http.Request) {
	isSecure := r.TLS != nil || r.Header.Get("X-Forwarded-Proto") == "https"
	http.SetCookie(w, &http.Cookie{
		Name:     SessionCookieName,
		Value:    "",
		Path:     "/",
		HttpOnly: true,
		Secure:   isSecure,
		SameSite: http.SameSiteLaxMode,
		MaxAge:   -1,
		Expires:  time.Unix(0, 0),
	})
}

// GetAuthenticatedUser inspects incoming HTTP-only cookies and returns the active username.
func GetAuthenticatedUser(r *http.Request) (string, bool) {
	cookie, err := r.Cookie(SessionCookieName)
	if err != nil || cookie.Value == "" {
		return "", false
	}

	parts := strings.Split(cookie.Value, ":")
	if len(parts) >= 1 && strings.TrimSpace(parts[0]) != "" {
		return parts[0], true
	}

	return "", false
}

// RenderAuthenticatedBadge generates the HTML fragment for HTMX swapping after login/status checks.
func RenderAuthenticatedBadge(username string) string {
	initial := "U"
	if len(username) > 0 {
		initial = strings.ToUpper(string(username[0]))
	}
	escapedUser := html.EscapeString(username)

	return fmt.Sprintf(`
<div id="auth-status-container" class="flex items-center gap-2 p-2 rounded-lg border border-[var(--border)] bg-[var(--surface-soft)] font-sans text-xs transition-colors">
  <div class="h-7 w-7 rounded-full flex items-center justify-center font-bold text-xs bg-[var(--accent)] text-white shadow-sm shrink-0">
    %s
  </div>
  <div class="flex-1 min-w-0 pr-2">
    <div class="flex items-center gap-1.5">
      <span class="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
      <span class="font-semibold text-[var(--text-strong)] truncate">%s</span>
    </div>
    <div class="text-[10px] text-[var(--muted)]">Authenticated via HTTP-only cookie</div>
  </div>
  <button
    hx-post="/api/auth/logout"
    hx-target="#auth-status-container"
    hx-swap="outerHTML"
    class="px-2 py-1 text-[11px] rounded bg-[var(--control-background)] hover:bg-[var(--control-hover)] text-rose-500 font-medium transition-colors cursor-pointer border border-[var(--border)]"
    title="Clear authentication session"
    type="button"
  >
    Sign Out
  </button>
</div>
`, initial, escapedUser)
}

// RenderUnauthenticatedBadge generates the HTML fragment for unauthenticated state.
func RenderUnauthenticatedBadge() string {
	return `
<div id="auth-status-container" class="flex items-center justify-between p-2 rounded-lg border border-[var(--border)] bg-[var(--surface-soft)] font-sans text-xs transition-colors">
  <div class="flex items-center gap-2">
    <span class="w-2 h-2 rounded-full bg-amber-400"></span>
    <span class="text-[var(--muted)]">Session unauthenticated</span>
  </div>
  <form hx-post="/api/auth/login" hx-target="#auth-status-container" hx-swap="outerHTML" class="flex items-center gap-1.5">
    <input type="hidden" name="username" value="Rudra">
    <button
      type="submit"
      class="px-2.5 py-1 text-[11px] font-semibold rounded bg-[var(--action-background)] text-[var(--action-foreground)] shadow-sm hover:opacity-90 transition-all cursor-pointer"
    >
      Sign In as Rudra
    </button>
  </form>
</div>
`
}

// HandleLogin authenticates a user and redirects to /editor via HX-Redirect.
func (h *Handler) HandleLogin(w http.ResponseWriter, r *http.Request) {
	LoginHandler(w, r)
}

// HandleLogout clears the authentication cookie and redirects back to / via HX-Redirect.
func (h *Handler) HandleLogout(w http.ResponseWriter, r *http.Request) {
	LogoutHandler(w, r)
}

// HandleAuthStatus checks the session cookie and returns the appropriate status fragment.
func (h *Handler) HandleAuthStatus(w http.ResponseWriter, r *http.Request) {
	AuthStatusHandler(w, r)
}

// LoginHandler is the package-level handler for POST /api/auth/login.
func LoginHandler(w http.ResponseWriter, r *http.Request) {
	_ = r.ParseForm()
	username := strings.TrimSpace(r.FormValue("username"))
	if username == "" {
		username = strings.TrimSpace(r.FormValue("email"))
	}
	if username == "" {
		username = DefaultUsername
	}
	if idx := strings.Index(username, "@"); idx != -1 {
		username = username[:idx]
	}

	SetAuthCookie(w, r, username)

	w.Header().Set("HX-Redirect", "/editor")
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	w.WriteHeader(http.StatusOK)
	fmt.Fprint(w, RenderAuthenticatedBadge(username))
}

// LogoutHandler is the package-level handler for POST /api/auth/logout.
func LogoutHandler(w http.ResponseWriter, r *http.Request) {
	ClearAuthCookie(w, r)

	w.Header().Set("HX-Redirect", "/")
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	w.WriteHeader(http.StatusOK)
	fmt.Fprint(w, RenderUnauthenticatedBadge())
}

// AuthStatusHandler is the package-level handler for GET /api/auth/status.
func AuthStatusHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	if user, ok := GetAuthenticatedUser(r); ok {
		fmt.Fprint(w, RenderAuthenticatedBadge(user))
	} else {
		fmt.Fprint(w, RenderUnauthenticatedBadge())
	}
}

// HandleProfileModal serves the profile settings dialog as an HTML fragment.
func (h *Handler) HandleProfileModal(w http.ResponseWriter, r *http.Request) {
	ProfileModalHandler(w, r)
}

// ProfileModalHandler is the package-level handler for GET /api/ui/modal/profile.
func ProfileModalHandler(w http.ResponseWriter, r *http.Request) {
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
            Stateless Browser Storage
          </div>
        </div>
      </div>

      <!-- Stateless Architecture Note -->
      <div class="p-3 rounded-lg border border-[var(--border)] space-y-1.5 bg-[var(--panel-background)]">
        <div class="font-semibold text-[11px] text-[var(--text-strong)]">Stateless Architecture</div>
        <div class="text-[11px] text-[var(--muted)] leading-relaxed">
          Zero external database. Profile, settings, and workspace data are saved locally in your browser via <code>localStorage</code>.
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
	SettingsModalHandler(w, r)
}

// SettingsModalHandler is the package-level handler for GET /api/ui/modal/settings.
func SettingsModalHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	fmt.Fprint(w, `
<div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onclick="if(event.target===this) this.remove()">
  <div class="w-full max-w-md rounded-xl p-6 shadow-2xl transition-colors font-sans" style="background: var(--panel-background); border: 1px solid var(--border-strong); color: var(--text);">
    <div class="flex items-center justify-between pb-3 mb-4 border-b border-[var(--border)]">
      <div class="flex items-center gap-2">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color: var(--accent);"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
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

// HandleUIProfile returns the profile.tmpl HTMX fragment for the side panel.
func (h *Handler) HandleUIProfile(w http.ResponseWriter, r *http.Request) {
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

	if user, ok := GetAuthenticatedUser(r); ok {
		data.User = user
		if len(user) > 0 {
			data.UserInitial = strings.ToUpper(string(user[0]))
		}
	}
	data.IsEditor = true
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	if h.templates != nil {
		if err := h.templates.ExecuteTemplate(w, "profile.tmpl", data); err != nil {
			_ = h.templates.ExecuteTemplate(w, "profile", data)
		}
	}
}

// HandleProfilePage renders the full-page developer profile view.
func (h *Handler) HandleProfilePage(w http.ResponseWriter, r *http.Request) {
	user, _ := GetAuthenticatedUser(r)
	if user == "" {
		SetAuthCookie(w, r, DefaultUsername)
	}

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
	data.SubView = "profile"
	data.Title = "Developer Profile - VoidLAB"
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	if h.templates != nil {
		_ = h.templates.ExecuteTemplate(w, "base.tmpl", data)
	}
}
