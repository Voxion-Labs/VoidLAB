package main

import (
	"html/template"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"strings"
	"testing"
)

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

	// 3. Auth Login endpoint (sets HTTP-only cookie)
	loginReq := httptest.NewRequest(http.MethodPost, "/api/auth/login", strings.NewReader("username=Tester"))
	loginReq.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	rec = httptest.NewRecorder()
	mux.ServeHTTP(rec, loginReq)
	if rec.Code != http.StatusOK {
		t.Errorf("expected 200 OK for /api/auth/login, got %d", rec.Code)
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
	if !strings.Contains(rec.Body.String(), "Tester") {
		t.Errorf("expected HTML badge with 'Tester', got: %s", rec.Body.String())
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
