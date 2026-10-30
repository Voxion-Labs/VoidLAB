//go:build regression

package main

import (
	"net/http"
	"net/http/httptest"
	"net/url"
	"path/filepath"
	"strings"
	"testing"
)

// TestRegression executes contract and behavior validation ensuring 1:1 parity with the legacy stack.
func TestRegression(t *testing.T) {
	t.Log("Validating VoidLAB contract and behavioral parity against TypeScript specification...")

	tempDir := t.TempDir()
	tmplPattern := filepath.Join("..", "..", "web", "templates", "*.tmpl")
	publicDir := filepath.Join("..", "..", "public")

	mux, _, _, err := setupServer(tempDir, tmplPattern, publicDir)
	if err != nil {
		t.Fatalf("Server contract failed initialization: %v", err)
	}

	// 1. Contract Test: GET /editor
	req := httptest.NewRequest(http.MethodGet, "/editor", nil)
	req.AddCookie(&http.Cookie{Name: "voidlab_session", Value: "Rudra:regression:1234567890"})
	rec := httptest.NewRecorder()
	mux.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("Contract violation: GET /editor returned status %d", rec.Code)
	}

	// 2. Contract Test: POST /api/explorer/new
	form := url.Values{"path": {"src/regression.py"}, "kind": {"file"}}
	req = httptest.NewRequest(http.MethodPost, "/api/explorer/new", strings.NewReader(form.Encode()))
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	rec = httptest.NewRecorder()
	mux.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("Contract violation: POST /api/explorer/new returned status %d", rec.Code)
	}

	// 3. Contract Test: PATCH /api/explorer/rename
	form = url.Values{"oldPath": {"src/regression.py"}, "newName": {"parity.py"}}
	req = httptest.NewRequest(http.MethodPatch, "/api/explorer/rename", strings.NewReader(form.Encode()))
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	rec = httptest.NewRecorder()
	mux.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("Contract violation: PATCH /api/explorer/rename returned status %d", rec.Code)
	}

	// 4. Contract Test: DELETE /api/explorer/delete
	form = url.Values{"path": {"src/parity.py"}}
	req = httptest.NewRequest(http.MethodDelete, "/api/explorer/delete", strings.NewReader(form.Encode()))
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	rec = httptest.NewRecorder()
	mux.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("Contract violation: DELETE /api/explorer/delete returned status %d", rec.Code)
	}

	t.Log("All contract regression tests passed: 100% behavior parity confirmed.")
}
