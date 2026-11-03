package main

import (
	"context"
	"errors"
	"fmt"
	"html/template"
	"log"
	"mime"
	"net/http"
	"os"
	"os/signal"
	"path/filepath"
	"strings"
	"syscall"
	"time"

	"github.com/Voxion-Labs/VoidLAB/src/ai"
	"github.com/Voxion-Labs/VoidLAB/src/auth"
	"github.com/Voxion-Labs/VoidLAB/src/collab"
	"github.com/Voxion-Labs/VoidLAB/src/docker"
	"github.com/Voxion-Labs/VoidLAB/src/explorer"
	"github.com/Voxion-Labs/VoidLAB/src/terminal"
)

const (
	// Version of the VoidLAB engine
	Version = "0.1.0"
	// Banner displayed on initialization
	Banner = "VoidLAB Engine v" + Version + " - High-Performance Local-First Cloud IDE"
	// DefaultPort for the HTTP server
	DefaultPort = "8080"
)

func findTemplatePattern() string {
	candidates := []string{
		filepath.Join("web", "templates", "*.tmpl"),
		filepath.Join("..", "..", "web", "templates", "*.tmpl"),
	}
	for _, pattern := range candidates {
		matches, err := filepath.Glob(pattern)
		if err == nil && len(matches) > 0 {
			return pattern
		}
	}
	return filepath.Join("web", "templates", "*.tmpl")
}

func findDir(dir string) string {
	candidates := []string{
		dir,
		filepath.Join("..", "..", dir),
	}
	for _, candidate := range candidates {
		if info, err := os.Stat(candidate); err == nil && info.IsDir() {
			return candidate
		}
	}
	return dir
}

// requireAuth guards handlers by enforcing a valid HTTP-only session cookie.
// If unauthorized, it redirects to / (attaching the HX-Redirect header for HTMX clients).
func requireAuth(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if _, ok := auth.GetAuthenticatedUser(r); !ok {
			w.Header().Set("HX-Redirect", "/")
			http.Redirect(w, r, "/", http.StatusSeeOther)
			return
		}
		next(w, r)
	}
}

// setupServer wires all Go 1.22+ routes and handlers to the mux.
func setupServer(workspaceDir string, tmplPattern string, publicDir string) (*http.ServeMux, *explorer.Service, *template.Template, error) {
	tmpl, err := template.ParseGlob(tmplPattern)
	if err != nil {
		return nil, nil, nil, fmt.Errorf("failed to parse templates from %s: %w", tmplPattern, err)
	}

	explorerService, err := explorer.NewService(workspaceDir)
	if err != nil {
		return nil, nil, nil, fmt.Errorf("failed to initialize workspace service: %w", err)
	}

	explorerHandler := explorer.NewHandler(explorerService, tmpl)

	dockerOrchestrator, err := docker.NewOrchestrator(workspaceDir)
	if err != nil {
		return nil, nil, nil, fmt.Errorf("failed to initialize docker orchestrator: %w", err)
	}

	terminalHandler := terminal.NewHandler(dockerOrchestrator, explorerService)
	authHandler := auth.NewHandler(explorerService, tmpl)
	collabHandler := collab.NewHandler(explorerService, tmpl)
	aiHandler := ai.NewHandler(explorerService, tmpl)

	// Standard Go 1.22+ multiplexer
	mux := http.NewServeMux()

	// Register explicit WebAssembly and JavaScript MIME types
	_ = mime.AddExtensionType(".wasm", "application/wasm")
	_ = mime.AddExtensionType(".js", "application/javascript")

	// 1. Static asset server (zero bloat, streaming file server)
	if _, err := os.Stat(publicDir); err == nil {
		fileServer := http.StripPrefix("/public/", http.FileServer(http.Dir(publicDir)))
		mux.Handle("GET /public/", fileServer)
		mux.HandleFunc("GET /favicon.svg", func(w http.ResponseWriter, r *http.Request) {
			http.ServeFile(w, r, filepath.Join(publicDir, "favicon.svg"))
		})
		mux.HandleFunc("GET /favicon.ico", func(w http.ResponseWriter, r *http.Request) {
			http.ServeFile(w, r, filepath.Join(publicDir, "favicon.svg"))
		})

		for _, sub := range []string{"showcase", "manual", "avatars", "assets", "wasm"} {
			dir := filepath.Join(publicDir, sub)
			if _, err := os.Stat(dir); err == nil {
				mux.Handle("GET /"+sub+"/", http.StripPrefix("/"+sub+"/", http.FileServer(http.Dir(dir))))
			}
		}
	}

	// 2. Full-Page Routes
	mux.HandleFunc("GET /editor", requireAuth(func(w http.ResponseWriter, r *http.Request) {
		data, err := explorerService.BuildWorkspaceData()
		if err != nil {
			http.Error(w, fmt.Sprintf("failed to load workspace: %v", err), http.StatusInternalServerError)
			return
		}
		data.IsEditor = true
		data.IsLanding = false
		if user, ok := auth.GetAuthenticatedUser(r); ok {
			data.User = user
			if len(user) > 0 {
				data.UserInitial = strings.ToUpper(string(user[0]))
			}
		}

		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		if err := tmpl.ExecuteTemplate(w, "base.tmpl", data); err != nil {
			log.Printf("[HTTP] error rendering editor template: %v", err)
			http.Error(w, err.Error(), http.StatusInternalServerError)
		}
	}))

	mux.HandleFunc("GET /", func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/" {
			http.NotFound(w, r)
			return
		}
		data, err := explorerService.BuildWorkspaceData()
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		data.IsLanding = true
		data.IsEditor = false
		if user, ok := auth.GetAuthenticatedUser(r); ok {
			data.User = user
			if len(user) > 0 {
				data.UserInitial = strings.ToUpper(string(user[0]))
			}
		}

		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		if err := tmpl.ExecuteTemplate(w, "base.tmpl", data); err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
		}
	})

	// 3. Bulletproof Explorer API Routes (HTMX Handlers)
	mux.HandleFunc("POST /api/explorer/new", explorerHandler.HandleNew)

	mux.HandleFunc("PATCH /api/explorer/rename", explorerHandler.HandleRename)
	mux.HandleFunc("POST /api/explorer/rename", explorerHandler.HandleRename) // fallback for standard HTML forms

	mux.HandleFunc("DELETE /api/explorer/delete", explorerHandler.HandleDelete)
	mux.HandleFunc("POST /api/explorer/delete", explorerHandler.HandleDelete) // fallback

	mux.HandleFunc("PATCH /api/explorer/move", explorerHandler.HandleMove)
	mux.HandleFunc("POST /api/explorer/move", explorerHandler.HandleMove) // fallback

	// 4. Sub-views & Side-Panel Endpoints (HTMX Side-Panels and Fragments)
	mux.HandleFunc("GET /api/ui/manual", requireAuth(explorerHandler.HandleUIManual))
	mux.HandleFunc("GET /api/ui/github", requireAuth(explorerHandler.HandleUIGitHub))
	mux.HandleFunc("GET /api/ui/ai", requireAuth(aiHandler.HandleUIAI))
	mux.HandleFunc("GET /api/ui/collab", requireAuth(collabHandler.HandleUICollab))
	mux.HandleFunc("GET /api/ui/profile", requireAuth(authHandler.HandleUIProfile))
	mux.HandleFunc("GET /api/ui/editor", requireAuth(explorerHandler.HandleUIEditor))
	mux.HandleFunc("GET /api/ui/empty", requireAuth(explorerHandler.HandleEmpty))

	// 5. Explorer Tree Fragments & Folder Toggles (Auth Protected - Objective 3)
	mux.HandleFunc("GET /api/explorer", requireAuth(explorerHandler.HandleGetTree))
	mux.HandleFunc("GET /api/ui/explorer", requireAuth(explorerHandler.HandleGetTree))
	mux.HandleFunc("GET /api/ui/explorer/toggle", requireAuth(explorerHandler.HandleToggleFolder))

	// 6. Context Modals & Menu Endpoints (Auth Protected - Objective 3)
	mux.HandleFunc("GET /api/ui/modal/new-file", requireAuth(explorerHandler.HandleModalNewFile))
	mux.HandleFunc("GET /api/ui/modal/new-folder", requireAuth(explorerHandler.HandleModalNewFolder))
	mux.HandleFunc("GET /api/ui/modal/import", requireAuth(explorerHandler.HandleModalImport))
	mux.HandleFunc("GET /api/ui/modal/import-folder", requireAuth(explorerHandler.HandleModalImportFolder))
	mux.HandleFunc("GET /api/ui/modal/rename", requireAuth(explorerHandler.HandleModalRename))
	mux.HandleFunc("GET /api/ui/file/menu", requireAuth(explorerHandler.HandleFileMenu))
	mux.HandleFunc("GET /api/ui/modal/profile", requireAuth(authHandler.HandleProfileModal))
	mux.HandleFunc("GET /api/ui/modal/settings", requireAuth(authHandler.HandleSettingsModal))

	// 6. Buffer and File Workspace Actions
	mux.HandleFunc("GET /api/files/open", explorerHandler.HandleOpenFile)
	mux.HandleFunc("POST /api/files/save", explorerHandler.HandleSaveFile)
	mux.HandleFunc("POST /api/code/boilerplate", explorerHandler.HandleBoilerplate)
	mux.HandleFunc("GET /api/files/download", explorerHandler.HandleDownload)
	mux.HandleFunc("DELETE /api/files/close", explorerHandler.HandleCloseTab)
	mux.HandleFunc("POST /api/files/close", explorerHandler.HandleCloseTab)
	mux.HandleFunc("POST /api/files/import", explorerHandler.HandleImport)
	mux.HandleFunc("GET /preview", explorerHandler.HandlePreview)
	mux.HandleFunc("GET /api/preview", explorerHandler.HandlePreview)

	// Theme Toggle Endpoint
	mux.HandleFunc("POST /api/ui/theme", func(w http.ResponseWriter, r *http.Request) {
		cookie, err := r.Cookie("voidlab_theme")
		nextTheme := "dark"
		if err == nil && cookie.Value == "dark" {
			nextTheme = "light"
		}
		http.SetCookie(w, &http.Cookie{
			Name:     "voidlab_theme",
			Value:    nextTheme,
			Path:     "/",
			MaxAge:   31536000,
			SameSite: http.SameSiteLaxMode,
		})
		referer := r.Header.Get("Referer")
		if referer == "" {
			referer = "/editor"
		}
		w.Header().Set("HX-Redirect", referer)
		http.Redirect(w, r, referer, http.StatusSeeOther)
	})

	// 7. WebSocket Terminal Streaming & Ephemeral Docker Execution
	mux.HandleFunc("GET /api/ws/terminal", terminalHandler.HandleWebSocket)
	mux.HandleFunc("POST /api/code/run", terminalHandler.HandleRunTrigger)
	mux.HandleFunc("POST /api/terminal/exec", terminalHandler.HandleTerminalExec)
	mux.HandleFunc("POST /api/terminal/clear", terminalHandler.HandleClear)

	// 8. Collaboration & Multiplayer WebSockets (Protected via JWT Middleware)
	mux.HandleFunc("GET /api/collab/room", auth.RequireJWT(collabHandler.HandleCollabRoom))
	mux.HandleFunc("POST /api/collab/room", auth.RequireJWT(collabHandler.HandleCollabRoom))

	// AI Guide Prompts & Streaming (Protected via JWT Middleware)
	mux.HandleFunc("GET /api/ai/prompt", auth.RequireJWT(aiHandler.HandleAIPrompt))
	mux.HandleFunc("POST /api/ai/prompt", auth.RequireJWT(aiHandler.HandleAIPrompt))
	mux.HandleFunc("GET /api/ai/stream", auth.RequireJWT(aiHandler.HandleAIStream))
	mux.HandleFunc("POST /api/ai/stream", auth.RequireJWT(aiHandler.HandleAIStream))
	mux.HandleFunc("GET /api/ws/ai", auth.RequireJWT(aiHandler.HandleAIWebSocket))

	// Authentication & Secure HTTP-Only Cookie Session Management
	mux.HandleFunc("POST /api/auth/login", authHandler.HandleLogin)
	mux.HandleFunc("POST /api/auth/logout", authHandler.HandleLogout)
	mux.HandleFunc("GET /api/auth/status", authHandler.HandleAuthStatus)

	// Navigation Panel Page Views (Full-page views with HTMX integration)
	mux.HandleFunc("GET /editor/collaboration", requireAuth(collabHandler.HandleCollabPage))
	mux.HandleFunc("GET /editor/ai", requireAuth(aiHandler.HandleAIPage))
	mux.HandleFunc("GET /editor/profile", requireAuth(authHandler.HandleProfilePage))
	mux.HandleFunc("GET /editor/manual", requireAuth(explorerHandler.HandleManualPage))
	mux.HandleFunc("GET /editor/github", requireAuth(func(w http.ResponseWriter, r *http.Request) {
		data, err := explorerService.BuildWorkspaceData()
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		data.IsEditor = true
		data.SubView = "github"
		data.Title = "GitHub Sync & Version Control - VoidLAB"
		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		_ = tmpl.ExecuteTemplate(w, "base.tmpl", data)
	}))

	return mux, explorerService, tmpl, nil
}

func run() error {
	workspaceDir := os.Getenv("VOIDLAB_WORKSPACE")
	if workspaceDir == "" {
		workspaceDir = "./workspace"
	}

	tmplPattern := findTemplatePattern()
	publicDir := findDir("public")

	mux, _, _, err := setupServer(workspaceDir, tmplPattern, publicDir)
	if err != nil {
		return err
	}

	port := os.Getenv("PORT")
	if port == "" {
		port = DefaultPort
	}
	addr := ":" + port

	server := &http.Server{
		Addr:              addr,
		Handler:           mux,
		ReadHeaderTimeout: 5 * time.Second,
		IdleTimeout:       60 * time.Second,
	}

	log.Printf("[VFS]  Workspace directory: %s", workspaceDir)
	log.Printf("[HTTP] Static assets serving from: %s", publicDir)
	log.Printf("[HTTP] Server listening on http://127.0.0.1%s", addr)
	log.Printf("[HTTP] Split-pane editor available at http://127.0.0.1%s/editor", addr)

	// Graceful shutdown handling
	serverErr := make(chan error, 1)
	go func() {
		if err := server.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			serverErr <- err
		}
	}()

	stop := make(chan os.Signal, 1)
	signal.Notify(stop, os.Interrupt, syscall.SIGTERM)

	select {
	case err := <-serverErr:
		return fmt.Errorf("server error: %w", err)
	case sig := <-stop:
		log.Printf("[HTTP] Received shutdown signal: %v. Shutting down gracefully...", sig)
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		return server.Shutdown(ctx)
	}
}

func main() {
	fmt.Println(Banner)
	if err := run(); err != nil {
		fmt.Fprintf(os.Stderr, "Error: %v\n", err)
		os.Exit(1)
	}
}
