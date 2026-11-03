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

func TestJWTGenerationAndValidation(t *testing.T) {
	// 1. Generate valid JWT
	token, err := GenerateJWT("Alice")
	if err != nil {
		t.Fatalf("unexpected error generating JWT: %v", err)
	}
	if token == "" {
		t.Fatal("expected non-empty token string")
	}

	// 2. Validate token and verify claims
	claims, err := ValidateJWT(token)
	if err != nil {
		t.Fatalf("unexpected error validating valid JWT: %v", err)
	}
	if claims.Username != "Alice" {
		t.Errorf("expected username 'Alice', got %q", claims.Username)
	}
	if claims.Subject != "Alice" {
		t.Errorf("expected subject 'Alice', got %q", claims.Subject)
	}
	if claims.Issuer != "voidlab" {
		t.Errorf("expected issuer 'voidlab', got %q", claims.Issuer)
	}

	// 3. Reject tampered token signature
	tampered := token[:len(token)-4] + "fake"
	if _, err := ValidateJWT(tampered); err == nil {
		t.Error("expected error for tampered token signature, got nil")
	}

	// 4. Reject empty token
	if _, err := ValidateJWT(""); err == nil {
		t.Error("expected error for empty token string, got nil")
	}

	// 5. Default username fallback
	defaultToken, err := GenerateJWT("")
	if err != nil {
		t.Fatalf("unexpected error generating default JWT: %v", err)
	}
	defaultClaims, err := ValidateJWT(defaultToken)
	if err != nil {
		t.Fatalf("unexpected error validating default JWT: %v", err)
	}
	if defaultClaims.Username != DefaultUsername {
		t.Errorf("expected default username %q, got %q", DefaultUsername, defaultClaims.Username)
	}
}

func TestJWTMiddleware(t *testing.T) {
	handlerCalled := false
	dummyHandler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		handlerCalled = true
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte("protected-content"))
	})

	protected := RequireJWT(dummyHandler)

	// 1. Unauthenticated request without JWT -> 401 Unauthorized
	req := httptest.NewRequest(http.MethodGet, "/api/collab/room", nil)
	rec := httptest.NewRecorder()
	protected(rec, req)
	if rec.Code != http.StatusUnauthorized {
		t.Errorf("expected 401 Unauthorized for missing JWT, got %d", rec.Code)
	}
	if handlerCalled {
		t.Error("expected inner handler NOT to be called when unauthenticated")
	}

	// 2. Unauthenticated HTMX request -> 401 Unauthorized + HX-Redirect: /
	req = httptest.NewRequest(http.MethodGet, "/api/collab/room", nil)
	req.Header.Set("HX-Request", "true")
	rec = httptest.NewRecorder()
	protected(rec, req)
	if rec.Code != http.StatusUnauthorized {
		t.Errorf("expected 401 Unauthorized for HTMX request, got %d", rec.Code)
	}
	if rec.Header().Get("HX-Redirect") != "/" {
		t.Errorf("expected HX-Redirect header '/', got %q", rec.Header().Get("HX-Redirect"))
	}

	// 3. Forged non-JWT cookie string -> 401 Unauthorized
	req = httptest.NewRequest(http.MethodGet, "/api/collab/room", nil)
	req.AddCookie(&http.Cookie{Name: SessionCookieName, Value: "Alice:forged:123456789"})
	rec = httptest.NewRecorder()
	protected(rec, req)
	if rec.Code != http.StatusUnauthorized {
		t.Errorf("expected 401 Unauthorized for forged cookie, got %d", rec.Code)
	}

	// 4. Authenticated with valid cookie -> 200 OK
	token, _ := GenerateJWT("Bob")
	req = httptest.NewRequest(http.MethodGet, "/api/collab/room", nil)
	req.AddCookie(&http.Cookie{Name: SessionCookieName, Value: token})
	rec = httptest.NewRecorder()
	handlerCalled = false
	protected(rec, req)
	if rec.Code != http.StatusOK {
		t.Errorf("expected 200 OK with valid JWT cookie, got %d", rec.Code)
	}
	if !handlerCalled {
		t.Error("expected inner handler to be called with valid cookie")
	}

	// 5. Authenticated with Authorization Bearer header -> 200 OK
	req = httptest.NewRequest(http.MethodGet, "/api/ai/prompt", nil)
	req.Header.Set("Authorization", "Bearer "+token)
	rec = httptest.NewRecorder()
	handlerCalled = false
	protected(rec, req)
	if rec.Code != http.StatusOK {
		t.Errorf("expected 200 OK with Authorization Bearer header, got %d", rec.Code)
	}
	if !handlerCalled {
		t.Error("expected inner handler to be called with Bearer header")
	}

	// 6. Authenticated with HX-Auth-Token header -> 200 OK
	req = httptest.NewRequest(http.MethodGet, "/api/ai/prompt", nil)
	req.Header.Set("HX-Auth-Token", token)
	rec = httptest.NewRecorder()
	handlerCalled = false
	protected(rec, req)
	if rec.Code != http.StatusOK {
		t.Errorf("expected 200 OK with HX-Auth-Token header, got %d", rec.Code)
	}
	if !handlerCalled {
		t.Error("expected inner handler to be called with HX-Auth-Token")
	}
}

func TestAuthCookieAndLoginLogout(t *testing.T) {
	handler, _, _ := setupTestAuthHandler(t)

	// 1. POST /api/auth/login
	form := url.Values{"username": {"Alice"}}
	req := httptest.NewRequest(http.MethodPost, "/api/auth/login", strings.NewReader(form.Encode()))
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	req.Header.Set("HX-Request", "true")
	rec := httptest.NewRecorder()

	handler.HandleLogin(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200 OK on login, got %d", rec.Code)
	}
	if hxRedirect := rec.Header().Get("HX-Redirect"); hxRedirect != "/editor" {
		t.Errorf("expected HX-Redirect header '/editor', got %q", hxRedirect)
	}
	if userHdr := rec.Header().Get("X-Authenticated-User"); userHdr != "Alice" {
		t.Errorf("expected X-Authenticated-User 'Alice', got %q", userHdr)
	}
	if bearer := rec.Header().Get("Authorization"); !strings.HasPrefix(bearer, "Bearer ") {
		t.Errorf("expected Authorization header starting with 'Bearer ', got %q", bearer)
	}

	// Verify secure HTTP-only cookie containing valid JWT
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

	claims, err := ValidateJWT(authCookie.Value)
	if err != nil {
		t.Fatalf("expected auth cookie value to be a valid signed JWT: %v", err)
	}
	if claims.Username != "Alice" {
		t.Errorf("expected claims username 'Alice', got %q", claims.Username)
	}

	body := rec.Body.String()
	if !strings.Contains(body, "Alice") || !strings.Contains(body, "auth-status-container") {
		t.Errorf("expected HTML fragment containing 'Alice' and 'auth-status-container', got: %s", body)
	}

	// 2. GET /api/auth/status with cookie -> 200 OK
	statusReq := httptest.NewRequest(http.MethodGet, "/api/auth/status", nil)
	statusReq.AddCookie(authCookie)
	statusRec := httptest.NewRecorder()
	handler.HandleAuthStatus(statusRec, statusReq)

	if statusRec.Code != http.StatusOK {
		t.Errorf("expected 200 OK for auth status, got %d", statusRec.Code)
	}
	if statusRec.Header().Get("X-Authenticated-User") != "Alice" {
		t.Errorf("expected X-Authenticated-User 'Alice', got %q", statusRec.Header().Get("X-Authenticated-User"))
	}
	if !strings.Contains(statusRec.Body.String(), "Alice") {
		t.Errorf("expected authenticated status for Alice, got: %s", statusRec.Body.String())
	}

	// 3. GET /api/auth/status without cookie -> 401 Unauthorized
	unauthStatusReq := httptest.NewRequest(http.MethodGet, "/api/auth/status", nil)
	unauthStatusRec := httptest.NewRecorder()
	handler.HandleAuthStatus(unauthStatusRec, unauthStatusReq)
	if unauthStatusRec.Code != http.StatusUnauthorized {
		t.Errorf("expected 401 Unauthorized without auth cookie, got %d", unauthStatusRec.Code)
	}

	// 4. POST /api/auth/logout clears cookie and redirects to /
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
