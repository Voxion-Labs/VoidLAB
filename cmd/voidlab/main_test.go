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
