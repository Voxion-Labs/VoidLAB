package main

import (
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"testing"
)

// TestAllHTMXRoutesHaveValidHandlers enforces that every hx-get, hx-post, hx-delete,
// hx-patch, and hx-put endpoint across all template files maps to an active, registered Go handler.
func TestAllHTMXRoutesHaveValidHandlers(t *testing.T) {
	tempDir := t.TempDir()
	tmplPattern := filepath.Join("..", "..", "web", "templates", "*.tmpl")
	publicDir := filepath.Join("..", "..", "public")

	mux, _, _, err := setupServer(tempDir, tmplPattern, publicDir)
	if err != nil {
		t.Fatalf("setupServer failed: %v", err)
	}

	hxRegex := regexp.MustCompile(`hx-(get|post|delete|patch|put)=["']([^"']+)["']`)

	templateFiles, err := filepath.Glob(tmplPattern)
	if err != nil || len(templateFiles) == 0 {
		t.Fatalf("no template files found at %s: %v", tmplPattern, err)
	}

	type hxCall struct {
		method   string
		endpoint string
		template string
	}

	var calls []hxCall
	seen := make(map[string]bool)

	for _, tmplFile := range templateFiles {
		content, err := os.ReadFile(tmplFile)
		if err != nil {
			t.Fatalf("failed to read template %s: %v", tmplFile, err)
		}

		matches := hxRegex.FindAllStringSubmatch(string(content), -1)
		for _, m := range matches {
			method := strings.ToUpper(m[1])
			rawURL := m[2]
			endpoint := strings.Split(rawURL, "?")[0]
			if strings.HasPrefix(endpoint, "/") {
				key := method + " " + endpoint
				if !seen[key] {
					seen[key] = true
					calls = append(calls, hxCall{
						method:   method,
						endpoint: endpoint,
						template: filepath.Base(tmplFile),
					})
				}
			}
		}
	}

	if len(calls) == 0 {
		t.Fatal("expected to find HTMX routes in templates, found 0")
	}

	t.Logf("Auditing %d unique HTMX route endpoints across templates...", len(calls))

	for _, call := range calls {
		t.Run(call.method+" "+call.endpoint, func(t *testing.T) {
			req := httptest.NewRequest(call.method, call.endpoint, nil)
			req.Header.Set("HX-Request", "true")
			rec := httptest.NewRecorder()
			mux.ServeHTTP(rec, req)

			// Handlers may return 200 (OK), 303 (auth redirect), 401 (JWT required),
			// or 400 (missing form fields). A 404 Not Found indicates a broken or missing route.
			if rec.Code == http.StatusNotFound {
				t.Errorf("Broken HTMX route in %s: %s %s returned 404 Not Found!",
					call.template, call.method, call.endpoint)
			}
		})
	}
}
