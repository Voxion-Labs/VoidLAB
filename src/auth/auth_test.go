package auth

import (
	"html/template"
	"net/http"
	"net/http/httptest"
	"net/url"
	"path/filepath"
	"strings"
	"testing"

	"github.com/Voxion-Labs/VoidLAB/src/explorer"
)

func setupTestAuthHandler(t *testing.T) (*Handler, *template.Template, *explorer.Service) {
	t.Helper()
	tempDir := t.TempDir()

	exp, err := explorer.NewService(tempDir)
	if err != nil {
		t.Fatalf("failed to create explorer service: %v", err)
	}

	tmplPattern := filepath.Join("..", "..", "web", "templates", "*.tmpl")
	tmpl, err := template.ParseGlob(tmplPattern)
	if err != nil {
		t.Fatalf("failed to parse templates: %v", err)
	}

	handler := NewHandler(exp, tmpl)
	return handler, tmpl, exp
}

func TestAuthCookieAndLoginLogout(t *testing.T) {
	handler, _, _ := setupTestAuthHandler(t)

	// 1. POST /api/auth/login
	form := url.Values{"username": {"Alice"}}
	req := httptest.NewRequest(http.MethodPost, "/api/auth/login", strings.NewReader(form.Encode()))
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	rec := httptest.NewRecorder()

	handler.HandleLogin(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200 OK on login, got %d", rec.Code)
	}
	if hxRedirect := rec.Header().Get("HX-Redirect"); hxRedirect != "/editor" {
		t.Errorf("expected HX-Redirect header '/editor', got %q", hxRedirect)
	}

	// Verify secure HTTP-only cookie
	cookies := rec.Result().Cookies()
	var authCookie *http.Cookie
	for _, c := range cookies {
		if c.Name == SessionCookieName {
			authCookie = c
			break
		}
	}

	if authCookie == nil {
		t.Fatalf("expected cookie %q to be set", SessionCookieName)
	}
	if !authCookie.HttpOnly {
		t.Errorf("expected cookie to have HttpOnly = true")
	}
	if !strings.HasPrefix(authCookie.Value, "Alice:") {
		t.Errorf("expected cookie value to start with 'Alice:', got %q", authCookie.Value)
	}

	body := rec.Body.String()
	if !strings.Contains(body, "Alice") || !strings.Contains(body, "auth-status-container") {
		t.Errorf("expected HTML fragment containing 'Alice' and 'auth-status-container', got: %s", body)
	}

	// 2. GET /api/auth/status with cookie
	statusReq := httptest.NewRequest(http.MethodGet, "/api/auth/status", nil)
	statusReq.AddCookie(authCookie)
	statusRec := httptest.NewRecorder()
	handler.HandleAuthStatus(statusRec, statusReq)

	if !strings.Contains(statusRec.Body.String(), "Alice") {
		t.Errorf("expected authenticated status for Alice, got: %s", statusRec.Body.String())
	}

	// 3. POST /api/auth/logout clears cookie
	logoutReq := httptest.NewRequest(http.MethodPost, "/api/auth/logout", nil)
	logoutReq.AddCookie(authCookie)
	logoutRec := httptest.NewRecorder()
	handler.HandleLogout(logoutRec, logoutReq)
	if hxRedirect := logoutRec.Header().Get("HX-Redirect"); hxRedirect != "/" {
		t.Errorf("expected HX-Redirect header '/', got %q", hxRedirect)
	}

	logoutCookie := logoutRec.Result().Cookies()
	cleared := false
	for _, c := range logoutCookie {
		if c.Name == SessionCookieName && c.MaxAge < 0 {
			cleared = true
			break
		}
	}
	if !cleared {
		t.Errorf("expected auth cookie to have MaxAge < 0 on logout")
	}
	if !strings.Contains(logoutRec.Body.String(), "Session unauthenticated") {
		t.Errorf("expected unauthenticated badge on logout, got: %s", logoutRec.Body.String())
	}
}

func TestProfileAndSettingsModals(t *testing.T) {
	handler, _, _ := setupTestAuthHandler(t)

	// 1. Profile modal
	req := httptest.NewRequest(http.MethodGet, "/api/ui/modal/profile", nil)
	rec := httptest.NewRecorder()
	handler.HandleProfileModal(rec, req)
	if !strings.Contains(rec.Body.String(), "Developer Profile & Authentication") {
		t.Errorf("expected profile modal HTML fragment, got: %s", rec.Body.String())
	}

	// 2. Settings modal
	req = httptest.NewRequest(http.MethodGet, "/api/ui/modal/settings", nil)
	rec = httptest.NewRecorder()
	handler.HandleSettingsModal(rec, req)
	if !strings.Contains(rec.Body.String(), "Workspace Preferences") {
		t.Errorf("expected settings modal HTML fragment, got: %s", rec.Body.String())
	}
}
