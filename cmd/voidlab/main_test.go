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

	// 1. Unauthenticated GET /editor must redirect to / (Objective 3)
	unauthReq := httptest.NewRequest(http.MethodGet, "/editor", nil)
	unauthRec := httptest.NewRecorder()
	mux.ServeHTTP(unauthRec, unauthReq)

	if unauthRec.Code != http.StatusSeeOther {
		t.Errorf("expected 303 See Other for unauthenticated /editor, got %d", unauthRec.Code)
	}
	if unauthRec.Header().Get("HX-Redirect") != "/" {
		t.Errorf("expected HX-Redirect header '/', got %q", unauthRec.Header().Get("HX-Redirect"))
	}

	// 2. Authenticated GET /editor renders the full workspace (Objective 1 & 2)
	req := httptest.NewRequest(http.MethodGet, "/editor", nil)
	req.AddCookie(&http.Cookie{Name: "voidlab_session", Value: "Rudra:token:1234567890"})
	rec := httptest.NewRecorder()
	mux.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200 OK for authenticated GET /editor, got %d: %s", rec.Code, rec.Body.String())
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
	if !strings.Contains(body, `id="main-editor-pane"`) {
		t.Errorf("expected 3-column workspace to contain #main-editor-pane host")
	}
	if !strings.Contains(body, `hx-get="/api/ui/ai"`) {
		t.Errorf("expected Navbar to contain button with hx-get=\"/api/ui/ai\"")
	}
	if !strings.Contains(body, `hx-get="/api/ui/collab"`) {
		t.Errorf("expected Navbar to contain button with hx-get=\"/api/ui/collab\"")
	}
	if !strings.Contains(body, `hx-get="/api/ui/profile"`) {
		t.Errorf("expected Navbar to contain button with hx-get=\"/api/ui/profile\"")
	}
}

func TestDynamicSubViewsAndAuthState(t *testing.T) {
	tempDir := t.TempDir()
	tmplPattern := filepath.Join("..", "..", "web", "templates", "*.tmpl")
	publicDir := filepath.Join("..", "..", "public")

	mux, _, _, err := setupServer(tempDir, tmplPattern, publicDir)
	if err != nil {
		t.Fatalf("setupServer failed: %v", err)
	}

	authCookie := &http.Cookie{Name: "voidlab_session", Value: "Rudra:token:1234567890"}

	// 1. AI Guide Sub-View (/api/ui/ai)
	// Unauthenticated
	unauthReq := httptest.NewRequest(http.MethodGet, "/api/ui/ai", nil)
	unauthRec := httptest.NewRecorder()
	mux.ServeHTTP(unauthRec, unauthReq)
	if unauthRec.Header().Get("HX-Redirect") != "/" {
		t.Errorf("expected unauthenticated /api/ui/ai to redirect to /")
	}

	// Authenticated
	aiReq := httptest.NewRequest(http.MethodGet, "/api/ui/ai", nil)
	aiReq.AddCookie(authCookie)
	aiRec := httptest.NewRecorder()
	mux.ServeHTTP(aiRec, aiReq)
	if aiRec.Code != http.StatusOK {
		t.Errorf("expected 200 OK for /api/ui/ai, got %d", aiRec.Code)
	}
	if !strings.Contains(aiRec.Body.String(), "AI Guide & Copilot") {
		t.Errorf("expected AI Guide fragment to contain 'AI Guide & Copilot', got: %s", aiRec.Body.String())
	}
	if !strings.Contains(aiRec.Body.String(), `id="ai-messages-list"`) {
		t.Errorf("expected AI Guide fragment to contain #ai-messages-list")
	}

	// 2. Collab Sub-View (/api/ui/collab)
	// Unauthenticated
	unauthReq = httptest.NewRequest(http.MethodGet, "/api/ui/collab", nil)
	unauthRec = httptest.NewRecorder()
	mux.ServeHTTP(unauthRec, unauthReq)
	if unauthRec.Header().Get("HX-Redirect") != "/" {
		t.Errorf("expected unauthenticated /api/ui/collab to redirect to /")
	}

	// Authenticated
	collabReq := httptest.NewRequest(http.MethodGet, "/api/ui/collab", nil)
	collabReq.AddCookie(authCookie)
	collabRec := httptest.NewRecorder()
	mux.ServeHTTP(collabRec, collabReq)
	if collabRec.Code != http.StatusOK {
		t.Errorf("expected 200 OK for /api/ui/collab, got %d", collabRec.Code)
	}
	if !strings.Contains(collabRec.Body.String(), "Multiplayer Collaboration") {
		t.Errorf("expected Collab fragment to contain 'Multiplayer Collaboration'")
	}

	// 3. Profile Sub-View (/api/ui/profile)
	// Unauthenticated
	unauthReq = httptest.NewRequest(http.MethodGet, "/api/ui/profile", nil)
	unauthRec = httptest.NewRecorder()
	mux.ServeHTTP(unauthRec, unauthReq)
	if unauthRec.Header().Get("HX-Redirect") != "/" {
		t.Errorf("expected unauthenticated /api/ui/profile to redirect to /")
	}

	// Authenticated
	profileReq := httptest.NewRequest(http.MethodGet, "/api/ui/profile", nil)
	profileReq.AddCookie(authCookie)
	profileRec := httptest.NewRecorder()
	mux.ServeHTTP(profileRec, profileReq)
	if profileRec.Code != http.StatusOK {
		t.Errorf("expected 200 OK for /api/ui/profile, got %d", profileRec.Code)
	}
	if !strings.Contains(profileRec.Body.String(), "Developer Profile") {
		t.Errorf("expected Profile fragment to contain 'Developer Profile'")
	}

	// 4. Editor Sub-View (/api/ui/editor)
	editorReq := httptest.NewRequest(http.MethodGet, "/api/ui/editor", nil)
	editorReq.AddCookie(authCookie)
	editorRec := httptest.NewRecorder()
	mux.ServeHTTP(editorRec, editorReq)
	if editorRec.Code != http.StatusOK {
		t.Errorf("expected 200 OK for /api/ui/editor, got %d", editorRec.Code)
	}
	if !strings.Contains(editorRec.Body.String(), `id="editor-pane"`) {
		t.Errorf("expected Editor fragment to contain #editor-pane")
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
	req.AddCookie(&http.Cookie{Name: "voidlab_session", Value: "Rudra:bench:1234567890"})

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		rec := httptest.NewRecorder()
		mux.ServeHTTP(rec, req)
		if rec.Code != http.StatusOK {
			b.Fatalf("expected 200 OK, got %d", rec.Code)
		}
	}
}
