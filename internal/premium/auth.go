package premium

import (
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"html"
	"net/http"
	"strings"
	"time"
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
