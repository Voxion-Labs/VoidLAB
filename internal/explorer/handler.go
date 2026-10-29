package explorer

import (
	"fmt"
	"html"
	"html/template"
	"io"
	"net/http"
	"net/url"
	"path/filepath"
	"strings"
)

// Handler wraps the explorer service and template engine to serve HTMX endpoints.
type Handler struct {
	service   *Service
	templates *template.Template
}

// NewHandler constructs an Explorer HTTP handler.
func NewHandler(service *Service, tmpl *template.Template) *Handler {
	return &Handler{
		service:   service,
		templates: tmpl,
	}
}

// RenderTreeFragment sends only the file tree HTML fragment for HTMX swap.
func (h *Handler) RenderTreeFragment(w http.ResponseWriter) {
	data, err := h.service.BuildWorkspaceData()
	if err != nil {
		http.Error(w, fmt.Sprintf("failed to scan workspace: %v", err), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	if err := h.templates.ExecuteTemplate(w, "file-tree", data); err != nil {
		http.Error(w, fmt.Sprintf("template execution error: %v", err), http.StatusInternalServerError)
	}
}

// HandleGetTree handles GET /api/explorer and GET /api/ui/explorer.
func (h *Handler) HandleGetTree(w http.ResponseWriter, r *http.Request) {
	h.RenderTreeFragment(w)
}

// HandleToggleFolder handles GET /api/ui/explorer/toggle.
func (h *Handler) HandleToggleFolder(w http.ResponseWriter, r *http.Request) {
	path := r.URL.Query().Get("path")
	if path != "" {
		h.service.ToggleFolder(path)
	}
	h.RenderTreeFragment(w)
}

// HandleNew handles POST /api/explorer/new.
func (h *Handler) HandleNew(w http.ResponseWriter, r *http.Request) {
	if err := r.ParseForm(); err != nil {
		http.Error(w, "invalid form body", http.StatusBadRequest)
		return
	}

	path := strings.TrimSpace(r.FormValue("path"))
	if path == "" {
		path = strings.TrimSpace(r.FormValue("name"))
	}
	if path == "" {
		path = strings.TrimSpace(r.URL.Query().Get("path"))
	}
	if path == "" {
		http.Error(w, "file or folder path is required", http.StatusBadRequest)
		return
	}

	parent := strings.TrimSpace(r.FormValue("parent"))
	if parent == "" {
		parent = strings.TrimSpace(r.URL.Query().Get("parent"))
	}
	if parent != "" && !strings.HasPrefix(path, parent+"/") && path != parent {
		path = parent + "/" + path
	}

	kind := strings.ToLower(strings.TrimSpace(r.FormValue("kind")))
	if kind == "" {
		kind = strings.ToLower(strings.TrimSpace(r.URL.Query().Get("kind")))
	}
	isFolder := kind == "folder" || strings.HasSuffix(path, "/")

	if err := h.service.CreateItem(path, isFolder); err != nil {
		http.Error(w, fmt.Sprintf("failed to create item: %v", err), http.StatusInternalServerError)
		return
	}

	h.RenderTreeFragment(w)
}

// HandleRename handles PATCH /api/explorer/rename (and POST fallback).
func (h *Handler) HandleRename(w http.ResponseWriter, r *http.Request) {
	_ = r.ParseForm()

	oldPath := strings.TrimSpace(r.FormValue("oldPath"))
	if oldPath == "" {
		oldPath = strings.TrimSpace(r.URL.Query().Get("oldPath"))
	}
	if oldPath == "" {
		oldPath = strings.TrimSpace(r.FormValue("path"))
	}

	newName := strings.TrimSpace(r.FormValue("newName"))
	if newName == "" {
		newName = strings.TrimSpace(r.URL.Query().Get("newName"))
	}
	if newName == "" {
		newName = strings.TrimSpace(r.FormValue("name"))
	}

	if (oldPath == "" || newName == "") && r.Body != nil {
		bodyBytes, _ := io.ReadAll(r.Body)
		if len(bodyBytes) > 0 {
			values, err := url.ParseQuery(string(bodyBytes))
			if err == nil {
				if oldPath == "" {
					oldPath = strings.TrimSpace(values.Get("oldPath"))
					if oldPath == "" {
						oldPath = strings.TrimSpace(values.Get("path"))
					}
				}
				if newName == "" {
					newName = strings.TrimSpace(values.Get("newName"))
					if newName == "" {
						newName = strings.TrimSpace(values.Get("name"))
					}
				}
			}
		}
	}

	if oldPath == "" || newName == "" {
		http.Error(w, "oldPath and newName parameters are required", http.StatusBadRequest)
		return
	}

	if err := h.service.RenameItem(oldPath, newName); err != nil {
		http.Error(w, fmt.Sprintf("failed to rename item: %v", err), http.StatusInternalServerError)
		return
	}

	h.RenderTreeFragment(w)
}

// HandleDelete handles DELETE /api/explorer/delete (and POST fallback).
func (h *Handler) HandleDelete(w http.ResponseWriter, r *http.Request) {
	_ = r.ParseForm()

	path := strings.TrimSpace(r.URL.Query().Get("path"))
	if path == "" {
		path = strings.TrimSpace(r.FormValue("path"))
	}

	if path == "" && r.Body != nil {
		bodyBytes, _ := io.ReadAll(r.Body)
		if len(bodyBytes) > 0 {
			values, err := url.ParseQuery(string(bodyBytes))
			if err == nil {
				path = strings.TrimSpace(values.Get("path"))
			}
		}
	}

	if path == "" {
		http.Error(w, "path parameter is required", http.StatusBadRequest)
		return
	}

	if err := h.service.DeleteItem(path); err != nil {
		http.Error(w, fmt.Sprintf("failed to delete item: %v", err), http.StatusInternalServerError)
		return
	}

	h.RenderTreeFragment(w)
}

// HandleMove handles PATCH /api/explorer/move (and POST fallback).
func (h *Handler) HandleMove(w http.ResponseWriter, r *http.Request) {
	_ = r.ParseForm()

	source := strings.TrimSpace(r.FormValue("source"))
	if source == "" {
		source = strings.TrimSpace(r.URL.Query().Get("source"))
	}
	if source == "" {
		source = strings.TrimSpace(r.FormValue("src"))
	}

	target := strings.TrimSpace(r.FormValue("target"))
	if target == "" {
		target = strings.TrimSpace(r.URL.Query().Get("target"))
	}
	if target == "" {
		target = strings.TrimSpace(r.FormValue("dest"))
	}

	if (source == "") && r.Body != nil {
		bodyBytes, _ := io.ReadAll(r.Body)
		if len(bodyBytes) > 0 {
			values, err := url.ParseQuery(string(bodyBytes))
			if err == nil {
				if source == "" {
					source = strings.TrimSpace(values.Get("source"))
					if source == "" {
						source = strings.TrimSpace(values.Get("src"))
					}
				}
				if target == "" {
					target = strings.TrimSpace(values.Get("target"))
					if target == "" {
						target = strings.TrimSpace(values.Get("dest"))
					}
				}
			}
		}
	}

	if source == "" {
		http.Error(w, "source parameter is required", http.StatusBadRequest)
		return
	}

	if err := h.service.MoveItem(source, target); err != nil {
		http.Error(w, fmt.Sprintf("failed to move item: %v", err), http.StatusInternalServerError)
		return
	}

	h.RenderTreeFragment(w)
}

// HandleModalNewFile renders the creation modal for files.
func (h *Handler) HandleModalNewFile(w http.ResponseWriter, r *http.Request) {
	parent := strings.TrimSpace(r.URL.Query().Get("parent"))
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	fmt.Fprintf(w, `
<div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onclick="if(event.target===this) this.remove()">
  <div class="w-full max-w-sm rounded-xl p-5 shadow-2xl transition-colors font-sans" style="background: var(--panel-background); border: 1px solid var(--border-strong); color: var(--text);">
    <div class="flex items-center justify-between mb-4 pb-2" style="border-bottom: 1px solid var(--border);">
      <div class="text-xs font-semibold uppercase tracking-wider flex items-center gap-2" style="color: var(--text-strong);">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color: var(--accent);"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="12" y1="18" x2="12" y2="12"></line><line x1="9" y1="15" x2="15" y2="15"></line></svg>
        New File %s
      </div>
      <button onclick="this.closest('.fixed').remove()" class="p-1 rounded opacity-70 hover:opacity-100 cursor-pointer" type="button">✕</button>
    </div>
    <form hx-post="/api/explorer/new" hx-target="#file-tree" hx-swap="innerHTML" hx-on::after-request="this.closest('.fixed').remove()">
      <input type="hidden" name="kind" value="file">
      <input type="hidden" name="parent" value="%s">
      <label class="text-[11px] mb-1 block" style="color: var(--muted);">File Name or Relative Path:</label>
      <input name="path" autofocus class="w-full rounded-md px-3 py-2 text-xs outline-none mb-4 transition-colors font-mono" style="background: var(--input-background); border: 1px solid var(--border); color: var(--text);" placeholder="e.g. main.py, utils/app.go" required>
      <div class="flex gap-2 justify-end pt-2" style="border-top: 1px solid var(--border);">
        <button type="button" onclick="this.closest('.fixed').remove()" class="rounded-md px-3 py-1.5 text-xs font-medium cursor-pointer" style="background: var(--control-background); border: 1px solid var(--border); color: var(--text);">Cancel</button>
        <button type="submit" class="rounded-md px-3.5 py-1.5 text-xs font-semibold shadow-sm cursor-pointer" style="background: var(--action-background); color: var(--action-foreground);">Create File</button>
      </div>
    </form>
  </div>
</div>
`, formatParentLabel(parent), template.HTMLEscapeString(parent))
}

// HandleModalNewFolder renders the creation modal for folders.
func (h *Handler) HandleModalNewFolder(w http.ResponseWriter, r *http.Request) {
	parent := strings.TrimSpace(r.URL.Query().Get("parent"))
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	fmt.Fprintf(w, `
<div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onclick="if(event.target===this) this.remove()">
  <div class="w-full max-w-sm rounded-xl p-5 shadow-2xl transition-colors font-sans" style="background: var(--panel-background); border: 1px solid var(--border-strong); color: var(--text);">
    <div class="flex items-center justify-between mb-4 pb-2" style="border-bottom: 1px solid var(--border);">
      <div class="text-xs font-semibold uppercase tracking-wider flex items-center gap-2" style="color: var(--text-strong);">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color: var(--accent);"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path><line x1="12" y1="11" x2="12" y2="17"></line><line x1="9" y1="14" x2="15" y2="14"></line></svg>
        New Folder %s
      </div>
      <button onclick="this.closest('.fixed').remove()" class="p-1 rounded opacity-70 hover:opacity-100 cursor-pointer" type="button">✕</button>
    </div>
    <form hx-post="/api/explorer/new" hx-target="#file-tree" hx-swap="innerHTML" hx-on::after-request="this.closest('.fixed').remove()">
      <input type="hidden" name="kind" value="folder">
      <input type="hidden" name="parent" value="%s">
      <label class="text-[11px] mb-1 block" style="color: var(--muted);">Folder Name:</label>
      <input name="path" autofocus class="w-full rounded-md px-3 py-2 text-xs outline-none mb-4 transition-colors font-mono" style="background: var(--input-background); border: 1px solid var(--border); color: var(--text);" placeholder="e.g. components, utils" required>
      <div class="flex gap-2 justify-end pt-2" style="border-top: 1px solid var(--border);">
        <button type="button" onclick="this.closest('.fixed').remove()" class="rounded-md px-3 py-1.5 text-xs font-medium cursor-pointer" style="background: var(--control-background); border: 1px solid var(--border); color: var(--text);">Cancel</button>
        <button type="submit" class="rounded-md px-3.5 py-1.5 text-xs font-semibold shadow-sm cursor-pointer" style="background: var(--action-background); color: var(--action-foreground);">Create Folder</button>
      </div>
    </form>
  </div>
</div>
`, formatParentLabel(parent), template.HTMLEscapeString(parent))
}

// HandleModalRename renders the rename dialog for a file or folder.
func (h *Handler) HandleModalRename(w http.ResponseWriter, r *http.Request) {
	path := strings.TrimSpace(r.URL.Query().Get("path"))
	if path == "" {
		http.Error(w, "path is required", http.StatusBadRequest)
		return
	}
	base := filepath.Base(path)

	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	fmt.Fprintf(w, `
<div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onclick="if(event.target===this) this.remove()">
  <div class="w-full max-w-sm rounded-xl p-5 shadow-2xl transition-colors font-sans" style="background: var(--panel-background); border: 1px solid var(--border-strong); color: var(--text);">
    <div class="flex items-center justify-between mb-4 pb-2" style="border-bottom: 1px solid var(--border);">
      <div class="text-xs font-semibold uppercase tracking-wider flex items-center gap-2" style="color: var(--text-strong);">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color: var(--accent);"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>
        Rename Item
      </div>
      <button onclick="this.closest('.fixed').remove()" class="p-1 rounded opacity-70 hover:opacity-100 cursor-pointer" type="button">✕</button>
    </div>
    <form hx-patch="/api/explorer/rename" hx-target="#file-tree" hx-swap="innerHTML" hx-on::after-request="this.closest('.fixed').remove()">
      <input type="hidden" name="oldPath" value="%s">
      <label class="text-[11px] mb-1 block" style="color: var(--muted);">New Name:</label>
      <input name="newName" value="%s" autofocus class="w-full rounded-md px-3 py-2 text-xs outline-none mb-4 transition-colors font-mono" style="background: var(--input-background); border: 1px solid var(--border); color: var(--text);" required>
      <div class="flex gap-2 justify-end pt-2" style="border-top: 1px solid var(--border);">
        <button type="button" onclick="this.closest('.fixed').remove()" class="rounded-md px-3 py-1.5 text-xs font-medium cursor-pointer" style="background: var(--control-background); border: 1px solid var(--border); color: var(--text);">Cancel</button>
        <button type="submit" class="rounded-md px-3.5 py-1.5 text-xs font-semibold shadow-sm cursor-pointer" style="background: var(--action-background); color: var(--action-foreground);">Rename</button>
      </div>
    </form>
  </div>
</div>
`, template.HTMLEscapeString(path), template.HTMLEscapeString(base))
}

// HandleFileMenu renders a sleek floating dropdown menu for file & folder actions.
func (h *Handler) HandleFileMenu(w http.ResponseWriter, r *http.Request) {
	path := strings.TrimSpace(r.URL.Query().Get("path"))
	kind := strings.TrimSpace(r.URL.Query().Get("kind"))
	isFolder := kind == "folder"

	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	escapedPath := template.HTMLEscapeString(path)

	fmt.Fprintf(w, `
<div class="fixed inset-0 z-50 select-none" onclick="this.remove()" oncontextmenu="event.preventDefault(); this.remove()">
  <div style="left: min(calc(100vw - 190px), max(10px, 210px)); top: 120px; background: var(--panel-background); border: 1px solid var(--border-strong); box-shadow: 0 10px 30px rgba(0,0,0,0.35);"
       class="fixed z-50 min-w-[170px] rounded-lg p-1 font-sans text-xs shadow-2xl animate-in fade-in zoom-in-95 duration-75"
       onclick="event.stopPropagation()">
`)

	if isFolder {
		fmt.Fprintf(w, `
    <button hx-get="/api/ui/modal/new-file?parent=%s" hx-target="#modal-container" hx-swap="innerHTML" onclick="this.closest('.fixed').remove()" class="flex w-full items-center gap-2.5 px-3 py-1.5 rounded-md hover:bg-[var(--control-hover)] text-left transition-colors cursor-pointer" style="color: var(--text);" type="button">
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color: var(--accent);"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><line x1="12" y1="18" x2="12" y2="12"></line><line x1="9" y1="15" x2="15" y2="15"></line></svg>
      <span>New File...</span>
    </button>
    <button hx-get="/api/ui/modal/new-folder?parent=%s" hx-target="#modal-container" hx-swap="innerHTML" onclick="this.closest('.fixed').remove()" class="flex w-full items-center gap-2.5 px-3 py-1.5 rounded-md hover:bg-[var(--control-hover)] text-left transition-colors cursor-pointer" style="color: var(--text);" type="button">
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color: var(--accent);"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path><line x1="12" y1="11" x2="12" y2="17"></line><line x1="9" y1="14" x2="15" y2="14"></line></svg>
      <span>New Subfolder...</span>
    </button>
    <div class="h-px my-1" style="background: var(--border);"></div>
`, escapedPath, escapedPath)
	}

	fmt.Fprintf(w, `
    <button hx-get="/api/ui/modal/rename?path=%s" hx-target="#modal-container" hx-swap="innerHTML" onclick="this.closest('.fixed').remove()" class="flex w-full items-center gap-2.5 px-3 py-1.5 rounded-md hover:bg-[var(--control-hover)] text-left transition-colors cursor-pointer" style="color: var(--text);" type="button">
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color: var(--muted);"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>
      <span>Rename</span>
    </button>
    <div class="h-px my-1" style="background: var(--border);"></div>
    <button hx-delete="/api/explorer/delete?path=%s" hx-target="#file-tree" hx-swap="innerHTML" hx-confirm="Permanently delete %s?" onclick="this.closest('.fixed').remove()" class="flex w-full items-center gap-2.5 px-3 py-1.5 rounded-md text-rose-500 hover:bg-rose-500/10 text-left transition-colors cursor-pointer" type="button">
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
      <span>Delete %s</span>
    </button>
  </div>
</div>
`, escapedPath, escapedPath, escapedPath, ternary(isFolder, "Folder", "File"))
}

// HandleOpenFile switches the active file and renders the entire updated workspace fragment.
func (h *Handler) HandleOpenFile(w http.ResponseWriter, r *http.Request) {
	path := strings.TrimSpace(r.URL.Query().Get("path"))
	if path == "" {
		path = strings.TrimSpace(r.URL.Query().Get("id"))
	}
	if path != "" {
		h.service.SetActiveFile(path)
	}

	data, err := h.service.BuildWorkspaceData()
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	if err := h.templates.ExecuteTemplate(w, "editor", data); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
	}
}

// HandleSaveFile writes editor textarea content to disk.
func (h *Handler) HandleSaveFile(w http.ResponseWriter, r *http.Request) {
	_ = r.ParseForm()
	content := r.FormValue("content")

	data, err := h.service.BuildWorkspaceData()
	if err != nil || data.ActiveFile == nil {
		http.Error(w, "no active file", http.StatusBadRequest)
		return
	}

	if err := h.service.WriteFileContent(data.ActiveFile.Path, []byte(content)); err != nil {
		http.Error(w, fmt.Sprintf("failed to save: %v", err), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	fmt.Fprintf(w, "Saved %s", data.ActiveFile.Name)
}

// HandlePreview serves a live browser preview for HTML, CSS, and Markdown documents.
func (h *Handler) HandlePreview(w http.ResponseWriter, r *http.Request) {
	relPath := strings.TrimSpace(r.URL.Query().Get("path"))
	if relPath == "" {
		relPath = strings.TrimSpace(r.URL.Query().Get("id"))
	}

	if relPath == "" {
		data, err := h.service.BuildWorkspaceData()
		if err == nil && data.ActiveFile != nil {
			relPath = data.ActiveFile.Path
		}
	}

	if relPath == "" {
		relPath = "index.html"
	}

	content, err := h.service.ReadFileContent(relPath)
	if err != nil {
		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		w.WriteHeader(http.StatusNotFound)
		fmt.Fprintf(w, `<!DOCTYPE html><html><head><meta charset="utf-8"><title>VoidLAB Preview - Not Found</title><style>body{background:#030712;color:#f3f4f6;font-family:sans-serif;display:grid;place-items:center;min-height:100vh;margin:0;}div{text-align:center;padding:32px;border:1px solid #1f2937;border-radius:12px;background:#111827;}</style></head><body><div><h2>Preview File Not Found</h2><p style="color:#9ca3af;">Could not find document <code>%s</code></p><p style="font-size:12px;color:#6b7280;">Create an HTML or CSS file to view live previews.</p></div></body></html>`, html.EscapeString(relPath))
		return
	}

	ext := strings.ToLower(filepath.Ext(relPath))
	w.Header().Set("Content-Type", "text/html; charset=utf-8")

	switch ext {
	case ".html", ".htm":
		if strings.Contains(strings.ToLower(content), "<html") || strings.Contains(strings.ToLower(content), "<!doctype") {
			_, _ = w.Write([]byte(content))
			return
		}
		fmt.Fprintf(w, `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>VoidLAB HTML Preview - %s</title>
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #030712; color: #f3f4f6; padding: 24px; min-height: 100vh; }
  </style>
</head>
<body>
%s
</body>
</html>`, html.EscapeString(filepath.Base(relPath)), content)

	case ".css":
		fmt.Fprintf(w, `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>VoidLAB CSS Preview - %s</title>
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #0b0f19; color: #f3f4f6; min-height: 100vh; display: grid; place-items: center; padding: 32px; }
    .preview-canvas { background: #131b2e; border: 1px solid #1e293b; border-radius: 16px; padding: 32px; max-width: 640px; width: 100%%; box-shadow: 0 20px 40px rgba(0,0,0,0.5); }
    .preview-badge { display: inline-block; padding: 4px 10px; font-size: 11px; font-weight: 600; font-family: monospace; background: rgba(59, 130, 246, 0.2); color: #60a5fa; border-radius: 9999px; margin-bottom: 16px; }
    .preview-canvas h1 { margin-top: 0; font-size: 24px; font-weight: 700; color: #ffffff; }
    .preview-canvas p { color: #94a3b8; font-size: 14px; line-height: 1.6; margin-bottom: 24px; }
    .btn-action { background: #2563eb; color: #ffffff; border: none; padding: 10px 20px; font-size: 14px; font-weight: 600; border-radius: 8px; cursor: pointer; transition: background 0.2s; }
    .btn-action:hover { background: #1d4ed8; }
    /* User Custom CSS Injected Below */
    %s
  </style>
</head>
<body>
  <main class="preview-canvas">
    <span class="preview-badge">VoidLAB Stylesheet Canvas</span>
    <h1>VoidLAB CSS Preview</h1>
    <p>Your stylesheet <code>%s</code> is loaded and rendered in this live canvas.</p>
    <button class="btn-action">Action Component</button>
  </main>
</body>
</html>`, html.EscapeString(filepath.Base(relPath)), content, html.EscapeString(filepath.Base(relPath)))

	case ".md", ".markdown":
		fmt.Fprintf(w, `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>VoidLAB Markdown Preview - %s</title>
  <style>
    body { max-width: 760px; margin: 40px auto; padding: 0 24px; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; line-height: 1.6; background: #030712; color: #f3f4f6; }
    pre { background: #111827; padding: 16px; border-radius: 8px; border: 1px solid #1f2937; overflow-x: auto; }
  </style>
</head>
<body>
  <pre>%s</pre>
</body>
</html>`, html.EscapeString(filepath.Base(relPath)), html.EscapeString(content))

	default:
		fmt.Fprintf(w, `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>VoidLAB Preview - %s</title>
  <style>
    body { background: #030712; color: #f3f4f6; font-family: monospace; padding: 24px; }
    pre { white-space: pre-wrap; word-break: break-all; }
  </style>
</head>
<body>
  <pre>%s</pre>
</body>
</html>`, html.EscapeString(filepath.Base(relPath)), html.EscapeString(content))
	}
}

func formatParentLabel(parent string) string {
	if parent == "" {
		return "(Root)"
	}
	return "in " + filepath.Base(parent)
}

func ternary(cond bool, a, b string) string {
	if cond {
		return a
	}
	return b
}
