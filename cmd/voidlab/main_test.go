package main

import (
	"html/template"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"strings"
	"testing"
)

func TestRootRouteRendersLandingPage(t *testing.T) {
	tempDir := t.TempDir()
	tmplPattern := filepath.Join("..", "..", "web", "templates", "*.tmpl")
	publicDir := filepath.Join("..", "..", "public")

	mux, _, _, err := setupServer(tempDir, tmplPattern, publicDir)
	if err != nil {
		t.Fatalf("setupServer failed: %v", err)
	}

	req := httptest.NewRequest(http.MethodGet, "/", nil)
	rec := httptest.NewRecorder()
	mux.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200 OK for GET /, got %d: %s", rec.Code, rec.Body.String())
	}

	body := rec.Body.String()
	if !strings.Contains(body, "Sign in to VoidLAB") {
		t.Errorf("expected root landing page to contain 'Sign in to VoidLAB'")
	}
	if !strings.Contains(body, "Reach users on") {
		t.Errorf("expected root landing page to contain hero title 'Reach users on'")
	}
	if !strings.Contains(body, `hx-post="/api/auth/login"`) {
		t.Errorf("expected login form with hx-post=\"/api/auth/login\"")
	}
	// Root route should NOT render the editor workspace
	if strings.Contains(body, `id="editor-workspace"`) {
		t.Errorf("root route GET / must NOT render the editor workspace")
	}
}

func TestServerSetupAndEditorRoute(t *testing.T) {
	tempDir := t.TempDir()
	tmplPattern := filepath.Join("..", "..", "web", "templates", "*.tmpl")
	publicDir := filepath.Join("..", "..", "public")

	mux, _, _, err := setupServer(tempDir, tmplPattern, publicDir)
	if err != nil {
		t.Fatalf("setupServer failed: %v", err)
	}

	req := httptest.NewRequest(http.MethodGet, "/editor", nil)
	rec := httptest.NewRecorder()
	mux.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200 OK for GET /editor, got %d: %s", rec.Code, rec.Body.String())
	}

	body := rec.Body.String()
	if !strings.Contains(body, "Explorer") || !strings.Contains(body, "VoidLAB") {
		t.Errorf("expected rendered editor HTML to contain 'Explorer' and 'VoidLAB'")
	}
	if !strings.Contains(body, "Logout") {
		t.Errorf("expected Navbar in editor to contain 'Logout' button")
	}
	if !strings.Contains(body, `hx-post="/api/auth/logout"`) {
		t.Errorf("expected Navbar in editor to contain hx-post=\"/api/auth/logout\"")
	}
}

func TestTemplateParsing(t *testing.T) {
	pattern := filepath.Join("..", "..", "web", "templates", "*.tmpl")
	tmpl, err := template.ParseGlob(pattern)
	if err != nil {
		t.Fatalf("Failed to parse templates at %s: %v", pattern, err)
	}
	if tmpl == nil {
		t.Fatalf("Expected parsed template, got nil")
	}
}

func TestPremiumRoutesWiring(t *testing.T) {
	tempDir := t.TempDir()
	tmplPattern := filepath.Join("..", "..", "web", "templates", "*.tmpl")
	publicDir := filepath.Join("..", "..", "public")

	mux, _, _, err := setupServer(tempDir, tmplPattern, publicDir)
	if err != nil {
		t.Fatalf("setupServer failed: %v", err)
	}

	// 1. Collab Room endpoint
	req := httptest.NewRequest(http.MethodGet, "/api/collab/room", nil)
	rec := httptest.NewRecorder()
	mux.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Errorf("expected 200 OK for /api/collab/room, got %d", rec.Code)
	}
	if !strings.Contains(rec.Body.String(), "Multiplayer Peer Collaboration") {
		t.Errorf("expected collab HTML fragment, got: %s", rec.Body.String())
	}

	// 2. AI Prompt endpoint
	req = httptest.NewRequest(http.MethodGet, "/api/ai/prompt", nil)
	rec = httptest.NewRecorder()
	mux.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Errorf("expected 200 OK for /api/ai/prompt, got %d", rec.Code)
	}
	if !strings.Contains(rec.Body.String(), "ai-suggestions-palette") {
		t.Errorf("expected AI suggestions fragment, got: %s", rec.Body.String())
	}

	// 3. Auth Login endpoint (sets HTTP-only cookie and HX-Redirect header)
	loginReq := httptest.NewRequest(http.MethodPost, "/api/auth/login", strings.NewReader("username=Tester"))
	loginReq.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	loginReq.Header.Set("HX-Request", "true")
	rec = httptest.NewRecorder()
	mux.ServeHTTP(rec, loginReq)
	if rec.Code != http.StatusOK {
		t.Errorf("expected 200 OK for /api/auth/login, got %d", rec.Code)
	}
	if hxRedirect := rec.Header().Get("HX-Redirect"); hxRedirect != "/editor" {
		t.Errorf("expected HX-Redirect to /editor, got %q", hxRedirect)
	}
	cookies := rec.Result().Cookies()
	var authFound bool
	for _, c := range cookies {
		if c.Name == "voidlab_session" && c.HttpOnly {
			authFound = true
			break
		}
	}
	if !authFound {
		t.Errorf("expected HTTP-only voidlab_session cookie to be set")
	}

	// 4. Auth Logout endpoint (clears cookie and redirects to /)
	logoutReq := httptest.NewRequest(http.MethodPost, "/api/auth/logout", nil)
	logoutReq.Header.Set("HX-Request", "true")
	rec = httptest.NewRecorder()
	mux.ServeHTTP(rec, logoutReq)
	if rec.Code != http.StatusOK {
		t.Errorf("expected 200 OK for /api/auth/logout, got %d", rec.Code)
	}
	if hxRedirect := rec.Header().Get("HX-Redirect"); hxRedirect != "/" {
		t.Errorf("expected HX-Redirect to /, got %q", hxRedirect)
	}
}

func BenchmarkVoidLABServerEditor(b *testing.B) {
	tempDir := b.TempDir()
	tmplPattern := filepath.Join("..", "..", "web", "templates", "*.tmpl")
	publicDir := filepath.Join("..", "..", "public")

	mux, _, _, err := setupServer(tempDir, tmplPattern, publicDir)
	if err != nil {
		b.Fatalf("setupServer failed: %v", err)
	}

	req := httptest.NewRequest(http.MethodGet, "/editor", nil)

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		rec := httptest.NewRecorder()
		mux.ServeHTTP(rec, req)
		if rec.Code != http.StatusOK {
			b.Fatalf("expected 200 OK, got %d", rec.Code)
		}
	}
}
