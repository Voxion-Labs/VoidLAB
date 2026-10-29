package explorer

import (
	"fmt"
	"html/template"
	"net/http"
	"net/http/httptest"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func setupTestWorkspace(t *testing.T) (*Service, *template.Template) {
	t.Helper()
	tempDir, err := os.MkdirTemp("", "voidlab-test-*")
	if err != nil {
		t.Fatalf("failed to create temp dir: %v", err)
	}
	t.Cleanup(func() {
		_ = os.RemoveAll(tempDir)
	})

	svc, err := NewService(tempDir)
	if err != nil {
		t.Fatalf("failed to create service: %v", err)
	}

	tmplPattern := filepath.Join("..", "..", "web", "templates", "*.tmpl")
	tmpl, err := template.ParseGlob(tmplPattern)
	if err != nil {
		t.Fatalf("failed to parse templates: %v", err)
	}

	return svc, tmpl
}

func TestPathTraversalSecurity(t *testing.T) {
	svc, _ := setupTestWorkspace(t)

	maliciousPaths := []string{
		"../../etc/passwd",
		"../outside.txt",
		"/etc/shadow",
		"src/../../outside.txt",
		"..\\..\\windows\\system32",
	}

	for _, p := range maliciousPaths {
		_, err := svc.ResolveSafePath(p)
		if err == nil {
			t.Errorf("expected security error for path traversal attempt %q, but got none", p)
		}
	}
}

func TestFileAndFolderOperations(t *testing.T) {
	svc, _ := setupTestWorkspace(t)

	// 1. Create file
	if err := svc.CreateItem("src/utils.py", false); err != nil {
		t.Fatalf("failed to create file: %v", err)
	}

	// 2. Create folder
	if err := svc.CreateItem("components", true); err != nil {
		t.Fatalf("failed to create folder: %v", err)
	}

	// 3. Move file into folder
	if err := svc.MoveItem("src/utils.py", "components"); err != nil {
		t.Fatalf("failed to move file: %v", err)
	}

	// 4. Circular move rejection
	if err := svc.CreateItem("components/nested", true); err != nil {
		t.Fatalf("failed to create nested folder: %v", err)
	}
	if err := svc.MoveItem("components", "components/nested"); err == nil {
		t.Errorf("expected error when moving folder into its own subdirectory, got nil")
	}

	// 5. Rename item
	if err := svc.RenameItem("components/utils.py", "helper.py"); err != nil {
		t.Fatalf("failed to rename item: %v", err)
	}

	// 6. Delete item
	if err := svc.DeleteItem("components/helper.py"); err != nil {
		t.Fatalf("failed to delete file: %v", err)
	}

	// 7. Verify tree contents
	data, err := svc.BuildWorkspaceData()
	if err != nil {
		t.Fatalf("failed to build workspace tree: %v", err)
	}

	for _, item := range data.TreeItems {
		if item.Name == "helper.py" {
			t.Errorf("deleted item helper.py still found in tree")
		}
	}
}

func TestHTMXEndpoints(t *testing.T) {
	svc, tmpl := setupTestWorkspace(t)
	handler := NewHandler(svc, tmpl)

	// 1. POST /api/explorer/new -> returns HTML tree fragment
	form := url.Values{}
	form.Set("path", "server.go")
	form.Set("kind", "file")
	req := httptest.NewRequest(http.MethodPost, "/api/explorer/new", strings.NewReader(form.Encode()))
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	rec := httptest.NewRecorder()

	handler.HandleNew(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200 OK, got %d: %s", rec.Code, rec.Body.String())
	}
	body := rec.Body.String()
	if !strings.Contains(body, "server.go") {
		t.Errorf("expected HTML tree fragment to contain 'server.go', got: %s", body)
	}

	// 2. PATCH /api/explorer/rename -> returns updated tree fragment
	renameForm := url.Values{}
	renameForm.Set("oldPath", "server.go")
	renameForm.Set("newName", "main.go")
	req = httptest.NewRequest(http.MethodPatch, "/api/explorer/rename", strings.NewReader(renameForm.Encode()))
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	rec = httptest.NewRecorder()

	handler.HandleRename(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200 OK on rename, got %d: %s", rec.Code, rec.Body.String())
	}
	body = rec.Body.String()
	if !strings.Contains(body, "main.go") {
		t.Errorf("expected tree to contain 'main.go', got: %s", body)
	}

	// 3. DELETE /api/explorer/delete -> deletes and returns updated tree fragment
	deleteForm := url.Values{}
	deleteForm.Set("path", "main.go")
	req = httptest.NewRequest(http.MethodDelete, "/api/explorer/delete", strings.NewReader(deleteForm.Encode()))
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	rec = httptest.NewRecorder()

	handler.HandleDelete(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200 OK on delete, got %d: %s", rec.Code, rec.Body.String())
	}
	body = rec.Body.String()
	if strings.Contains(body, "main.go") {
		t.Errorf("deleted item 'main.go' still present in tree: %s", body)
	}
}

func BenchmarkBuildWorkspaceData(b *testing.B) {
	tempDir, err := os.MkdirTemp("", "voidlab-bench-*")
	if err != nil {
		b.Fatalf("failed to create temp dir: %v", err)
	}
	defer os.RemoveAll(tempDir)

	svc, err := NewService(tempDir)
	if err != nil {
		b.Fatalf("failed to create service: %v", err)
	}

	// Create 50 files across 5 folders
	for i := 0; i < 5; i++ {
		folder := filepath.Join(tempDir, fmt.Sprintf("folder_%d", i))
		_ = os.MkdirAll(folder, 0755)
		for j := 0; j < 10; j++ {
			_ = os.WriteFile(filepath.Join(folder, fmt.Sprintf("file_%d.py", j)), []byte("print('hello')"), 0644)
		}
	}

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_, err := svc.BuildWorkspaceData()
		if err != nil {
			b.Fatalf("build tree failed: %v", err)
		}
	}
}


func TestHandlePreview(t *testing.T) {
	tempDir := t.TempDir()
	svc, err := NewService(tempDir)
	if err != nil {
		t.Fatalf("failed to create service: %v", err)
	}

	tmpl := template.Must(template.New("tree").Parse(`<div>tree</div>`))
	handler := NewHandler(svc, tmpl)

	// Create test html and css
	_ = os.WriteFile(filepath.Join(tempDir, "index.html"), []byte("<h1>Preview Test</h1>"), 0644)
	_ = os.WriteFile(filepath.Join(tempDir, "style.css"), []byte("body { color: red; }"), 0644)

	// 1. Preview HTML
	req := httptest.NewRequest(http.MethodGet, "/preview?path=index.html", nil)
	rec := httptest.NewRecorder()
	handler.HandlePreview(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200 OK for HTML preview, got: %d", rec.Code)
	}
	if !strings.Contains(rec.Body.String(), "Preview Test") {
		t.Errorf("HTML preview missing content: %s", rec.Body.String())
	}

	// 2. Preview CSS
	reqCSS := httptest.NewRequest(http.MethodGet, "/preview?path=style.css", nil)
	recCSS := httptest.NewRecorder()
	handler.HandlePreview(recCSS, reqCSS)

	if recCSS.Code != http.StatusOK {
		t.Fatalf("expected 200 OK for CSS preview, got: %d", recCSS.Code)
	}
	if !strings.Contains(recCSS.Body.String(), "body { color: red; }") {
		t.Errorf("CSS preview missing stylesheet: %s", recCSS.Body.String())
	}

	// 3. Security: traversal
	reqSec := httptest.NewRequest(http.MethodGet, "/preview?path=../../etc/passwd", nil)
	recSec := httptest.NewRecorder()
	handler.HandlePreview(recSec, reqSec)

	if recSec.Code != http.StatusNotFound {
		t.Errorf("expected 404 for traversal attempt, got: %d", recSec.Code)
	}
}
