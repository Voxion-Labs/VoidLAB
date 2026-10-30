package premium

import (
	"html/template"
	"net/http"
	"net/http/httptest"
	"net/url"
	"path/filepath"
	"strings"
	"testing"

	"github.com/Voxion-Labs/VoidLAB/internal/explorer"
)

func setupTestPremiumHandler(t *testing.T) (*Handler, *template.Template, *explorer.Service) {
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

	handler := NewHandler(exp)
	return handler, tmpl, exp
}

func TestAuthCookieAndLoginLogout(t *testing.T) {
	handler, _, _ := setupTestPremiumHandler(t)

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
	cookie := rec.Result().Cookies()
	var authCookie *http.Cookie
	for _, c := range cookie {
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

func TestCollabRoomEndpoints(t *testing.T) {
	handler, _, _ := setupTestPremiumHandler(t)

	// 1. GET /api/collab/room -> Lobby launcher HTML fragment
	req := httptest.NewRequest(http.MethodGet, "/api/collab/room", nil)
	rec := httptest.NewRecorder()
	handler.HandleCollabRoom(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200 OK, got %d", rec.Code)
	}
	if !strings.Contains(rec.Body.String(), "Multiplayer Peer Collaboration") {
		t.Errorf("expected multiplayer lobby fragment, got: %s", rec.Body.String())
	}

	// 2. POST /api/collab/room?action=create -> Creates room and returns room card fragment
	form := url.Values{"action": {"create"}}
	req = httptest.NewRequest(http.MethodPost, "/api/collab/room", strings.NewReader(form.Encode()))
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	rec = httptest.NewRecorder()
	handler.HandleCollabRoom(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200 OK, got %d", rec.Code)
	}
	body := rec.Body.String()
	if !strings.Contains(body, "VOID-") || !strings.Contains(body, "collab-room-container") {
		t.Errorf("expected active room card fragment with VOID- code, got: %s", body)
	}

	// 3. POST /api/collab/room?action=message -> Sends chat in room
	msgForm := url.Values{
		"action":   {"message"},
		"room_id":  {"VOID-TEST1"},
		"message":  {"Hello from test peer!"},
	}
	req = httptest.NewRequest(http.MethodPost, "/api/collab/room", strings.NewReader(msgForm.Encode()))
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	rec = httptest.NewRecorder()
	handler.HandleCollabRoom(rec, req)

	if !strings.Contains(rec.Body.String(), "Hello from test peer!") {
		t.Errorf("expected room stream to contain sent message, got: %s", rec.Body.String())
	}
}

func TestAIPromptEndpoints(t *testing.T) {
	handler, _, _ := setupTestPremiumHandler(t)

	// 1. GET /api/ai/prompt -> Returns suggestions palette HTML fragment
	req := httptest.NewRequest(http.MethodGet, "/api/ai/prompt", nil)
	rec := httptest.NewRecorder()
	handler.HandleAIPrompt(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200 OK, got %d", rec.Code)
	}
	if !strings.Contains(rec.Body.String(), "ai-suggestions-palette") {
		t.Errorf("expected suggestions palette, got: %s", rec.Body.String())
	}

	// 2. POST /api/ai/prompt with question -> Returns formatted user+assistant HTML bubbles
	form := url.Values{"prompt": {"How do I run input-output programs correctly?"}}
	req = httptest.NewRequest(http.MethodPost, "/api/ai/prompt", strings.NewReader(form.Encode()))
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	rec = httptest.NewRecorder()
	handler.HandleAIPrompt(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200 OK, got %d", rec.Code)
	}
	body := rec.Body.String()
	if !strings.Contains(body, "Handling Stdin") || !strings.Contains(body, "input()") {
		t.Errorf("expected AI Guide response for stdin, got: %s", body)
	}
}

func TestModalAndPageRoutes(t *testing.T) {
	handler, tmpl, exp := setupTestPremiumHandler(t)

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

	// 3. Navigation page views
	collabPage := handler.HandleCollabPage(tmpl, exp)
	rec = httptest.NewRecorder()
	collabPage(rec, httptest.NewRequest(http.MethodGet, "/editor/collaboration", nil))
	if rec.Code != http.StatusOK {
		t.Errorf("expected 200 OK for /editor/collaboration, got %d", rec.Code)
	}
}
