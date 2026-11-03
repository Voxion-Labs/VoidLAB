package ai

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

func setupTestAIHandler(t *testing.T) (*Handler, *template.Template, *explorer.Service) {
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

func TestAIPromptEndpoints(t *testing.T) {
	handler, _, _ := setupTestAIHandler(t)

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

func TestAIStreamSSE(t *testing.T) {
	req := httptest.NewRequest(http.MethodGet, "/api/ai/stream?prompt=how+to+debug", nil)
	rec := httptest.NewRecorder()

	HandleAIStream(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200 OK for SSE stream, got %d", rec.Code)
	}

	contentType := rec.Header().Get("Content-Type")
	if !strings.Contains(contentType, "text/event-stream") {
		t.Errorf("expected text/event-stream content type, got %q", contentType)
	}

	body := rec.Body.String()
	if !strings.Contains(body, "event: start") {
		t.Errorf("expected SSE body to contain 'event: start', got: %s", body)
	}
	if !strings.Contains(body, "event: chunk") {
		t.Errorf("expected SSE body to contain 'event: chunk', got: %s", body)
	}
	if !strings.Contains(body, "event: done") {
		t.Errorf("expected SSE body to contain 'event: done', got: %s", body)
	}
}
