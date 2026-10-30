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

	"github.com/Voxion-Labs/VoidLAB/internal/docker"
	"github.com/Voxion-Labs/VoidLAB/internal/explorer"
	"github.com/Voxion-Labs/VoidLAB/internal/premium"
	"github.com/Voxion-Labs/VoidLAB/internal/terminal"
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
	premiumHandler := premium.NewHandler(explorerService)

	// Standard Go 1.22+ multiplexer
	mux := http.NewServeMux()

	// Register explicit WebAssembly and JavaScript MIME types
	_ = mime.AddExtensionType(".wasm", "application/wasm")
	_ = mime.AddExtensionType(".js", "application/javascript")

	// 1. Static asset server (zero bloat, streaming file server)
	if _, err := os.Stat(publicDir); err == nil {
		fileServer := http.StripPrefix("/public/", http.FileServer(http.Dir(publicDir)))
		mux.Handle("GET /public/", fileServer)
	}

	// 2. Full-Page Routes
	mux.HandleFunc("GET /editor", func(w http.ResponseWriter, r *http.Request) {
		data, err := explorerService.BuildWorkspaceData()
		if err != nil {
			http.Error(w, fmt.Sprintf("failed to load workspace: %v", err), http.StatusInternalServerError)
			return
		}
		data.IsEditor = true
		data.IsLanding = false
		if user, ok := premium.GetAuthenticatedUser(r); ok {
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
	})

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
		if user, ok := premium.GetAuthenticatedUser(r); ok {
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

	// 4. Explorer Tree Fragments & Folder Toggles
	mux.HandleFunc("GET /api/explorer", explorerHandler.HandleGetTree)
	mux.HandleFunc("GET /api/ui/explorer", explorerHandler.HandleGetTree)
	mux.HandleFunc("GET /api/ui/explorer/toggle", explorerHandler.HandleToggleFolder)

	// 5. Context Modals & Menu Endpoints
	mux.HandleFunc("GET /api/ui/modal/new-file", explorerHandler.HandleModalNewFile)
	mux.HandleFunc("GET /api/ui/modal/new-folder", explorerHandler.HandleModalNewFolder)
	mux.HandleFunc("GET /api/ui/modal/rename", explorerHandler.HandleModalRename)
	mux.HandleFunc("GET /api/ui/file/menu", explorerHandler.HandleFileMenu)

	// 6. Buffer and File Workspace Actions
	mux.HandleFunc("GET /api/files/open", explorerHandler.HandleOpenFile)
	mux.HandleFunc("POST /api/files/save", explorerHandler.HandleSaveFile)
	mux.HandleFunc("GET /preview", explorerHandler.HandlePreview)
	mux.HandleFunc("GET /api/preview", explorerHandler.HandlePreview)

	// 7. WebSocket Terminal Streaming & Ephemeral Docker Execution
	mux.HandleFunc("GET /api/ws/terminal", terminalHandler.HandleWebSocket)
	mux.HandleFunc("POST /api/code/run", terminalHandler.HandleRunTrigger)
	mux.HandleFunc("POST /api/terminal/exec", terminalHandler.HandleTerminalExec)
	mux.HandleFunc("POST /api/terminal/clear", terminalHandler.HandleClear)

	// 8. Premium Feature Routes (HTMX HTML Fragments)
	// Collaboration & Multiplayer WebSockets
	mux.HandleFunc("GET /api/collab/room", premiumHandler.HandleCollabRoom)
	mux.HandleFunc("POST /api/collab/room", premiumHandler.HandleCollabRoom)

	// AI Guide Prompts & Suggestions
	mux.HandleFunc("GET /api/ai/prompt", premiumHandler.HandleAIPrompt)
	mux.HandleFunc("POST /api/ai/prompt", premiumHandler.HandleAIPrompt)

	// Authentication & Secure HTTP-Only Cookie Session Management
	mux.HandleFunc("POST /api/auth/login", premiumHandler.HandleLogin)
	mux.HandleFunc("POST /api/auth/logout", premiumHandler.HandleLogout)
	mux.HandleFunc("GET /api/auth/status", premiumHandler.HandleAuthStatus)
	mux.HandleFunc("GET /api/ui/modal/profile", premiumHandler.HandleProfileModal)
	mux.HandleFunc("GET /api/ui/modal/settings", premiumHandler.HandleSettingsModal)

	// Navigation Panel Page Views (Full-page views with HTMX integration)
	mux.HandleFunc("GET /editor/collaboration", premiumHandler.HandleCollabPage(tmpl, explorerService))
	mux.HandleFunc("GET /editor/ai", premiumHandler.HandleAIPage(tmpl, explorerService))
	mux.HandleFunc("GET /editor/profile", premiumHandler.HandleProfilePage(tmpl, explorerService))
	mux.HandleFunc("GET /editor/manual", premiumHandler.HandleManualPage(tmpl, explorerService))

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
