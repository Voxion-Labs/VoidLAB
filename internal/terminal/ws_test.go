package terminal

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/gorilla/websocket"

	"github.com/Voxion-Labs/VoidLAB/internal/docker"
	"github.com/Voxion-Labs/VoidLAB/internal/explorer"
)

func setupTestTerminal(t *testing.T) (*Handler, *httptest.Server) {
	t.Helper()
	tempDir := t.TempDir()

	exp, err := explorer.NewService(tempDir)
	if err != nil {
		t.Fatalf("failed to create explorer service: %v", err)
	}

	orc, err := docker.NewOrchestrator(tempDir)
	if err != nil {
		t.Fatalf("failed to create docker orchestrator: %v", err)
	}

	handler := NewHandler(orc, exp)

	mux := http.NewServeMux()
	mux.HandleFunc("GET /api/ws/terminal", handler.HandleWebSocket)
	mux.HandleFunc("POST /api/code/run", handler.HandleRunTrigger)
	mux.HandleFunc("POST /api/terminal/exec", handler.HandleTerminalExec)
	mux.HandleFunc("POST /api/terminal/clear", handler.HandleClear)

	server := httptest.NewServer(mux)
	t.Cleanup(func() {
		server.Close()
	})

	return handler, server
}

func TestWebSocketTerminalUpgradeAndStreaming(t *testing.T) {
	_, server := setupTestTerminal(t)

	wsURL := "ws" + strings.TrimPrefix(server.URL, "http") + "/api/ws/terminal"

	dialer := websocket.DefaultDialer
	conn, resp, err := dialer.Dial(wsURL, nil)
	if err != nil {
		t.Fatalf("failed to dial websocket at %s (resp: %v): %v", wsURL, resp, err)
	}
	defer conn.Close()

	// 1. Read initial status frame
	_ = conn.SetReadDeadline(time.Now().Add(3 * time.Second))
	_, msgBytes, err := conn.ReadMessage()
	if err != nil {
		t.Fatalf("failed to read initial message from websocket: %v", err)
	}

	var greeting OutboundMessage
	if err := json.Unmarshal(msgBytes, &greeting); err != nil {
		t.Fatalf("failed to unmarshal greeting: %v", err)
	}

	if greeting.Type != "status" {
		t.Errorf("expected initial frame type 'status', got %s", greeting.Type)
	}

	// 2. Read ANSI banner frame
	_, bannerBytes, err := conn.ReadMessage()
	if err != nil {
		t.Fatalf("failed to read banner frame: %v", err)
	}
	if !strings.Contains(string(bannerBytes), "VoidLAB Engine") {
		t.Errorf("expected banner to contain VoidLAB Engine, got %s", string(bannerBytes))
	}

	// 3. Send ping message
	pingMsg := InboundMessage{Type: "ping"}
	if err := conn.WriteJSON(pingMsg); err != nil {
		t.Fatalf("failed to send ping: %v", err)
	}

	_ = conn.SetReadDeadline(time.Now().Add(3 * time.Second))
	_, pongBytes, err := conn.ReadMessage()
	if err != nil {
		t.Fatalf("failed to read pong: %v", err)
	}

	var pong OutboundMessage
	if err := json.Unmarshal(pongBytes, &pong); err != nil {
		t.Fatalf("failed to unmarshal pong: %v", err)
	}
	if pong.Message != "pong" {
		t.Errorf("expected pong message, got %s", pong.Message)
	}
}

func TestWebSocketRawKeystrokesAndShellCommands(t *testing.T) {
	_, server := setupTestTerminal(t)

	wsURL := "ws" + strings.TrimPrefix(server.URL, "http") + "/api/ws/terminal"

	conn, _, err := websocket.DefaultDialer.Dial(wsURL, nil)
	if err != nil {
		t.Fatalf("dial failed: %v", err)
	}
	defer conn.Close()

	// Consume initial greeting and banner
	_ = conn.SetReadDeadline(time.Now().Add(2 * time.Second))
	_, _, _ = conn.ReadMessage()
	_, _, _ = conn.ReadMessage()

	// Send raw keystrokes: 'p', 'w', 'd', '\r'
	if err := conn.WriteMessage(websocket.TextMessage, []byte("pwd\r")); err != nil {
		t.Fatalf("failed to write raw keystrokes: %v", err)
	}

	var received strings.Builder
	deadline := time.Now().Add(2 * time.Second)
	for time.Now().Before(deadline) {
		_ = conn.SetReadDeadline(time.Now().Add(500 * time.Millisecond))
		_, chunk, err := conn.ReadMessage()
		if err != nil {
			break
		}
		received.WriteString(string(chunk))
		if strings.Contains(received.String(), "/workspace") {
			break
		}
	}

	if !strings.Contains(received.String(), "/workspace") {
		t.Errorf("expected output to contain '/workspace', got: %s", received.String())
	}
}

func TestWebSocketExecuteRunBiDirectional(t *testing.T) {
	handler, server := setupTestTerminal(t)

	// Create test python file in workspace
	data, _ := handler.explorerSvc.BuildWorkspaceData()
	if data != nil && data.ActiveFile != nil {
		_ = os.WriteFile(filepath.Join(data.Cwd, data.ActiveFile.Path), []byte("print('STREAM_HELLO_VOXION')\n"), 0644)
	}

	wsURL := "ws" + strings.TrimPrefix(server.URL, "http") + "/api/ws/terminal"
	conn, _, err := websocket.DefaultDialer.Dial(wsURL, nil)
	if err != nil {
		t.Fatalf("dial failed: %v", err)
	}
	defer conn.Close()

	// Drain greeting & banner
	_ = conn.SetReadDeadline(time.Now().Add(2 * time.Second))
	_, _, _ = conn.ReadMessage()
	_, _, _ = conn.ReadMessage()

	// Send JSON Run command
	runCmd := InboundMessage{Type: "run", Path: data.ActiveFile.Path}
	if err := conn.WriteJSON(runCmd); err != nil {
		t.Fatalf("failed to write run command: %v", err)
	}

	// Read stream chunks
	var streamOutput strings.Builder
	deadline := time.Now().Add(5 * time.Second)
	for time.Now().Before(deadline) {
		_ = conn.SetReadDeadline(time.Now().Add(1 * time.Second))
		_, msg, err := conn.ReadMessage()
		if err != nil {
			break
		}
		streamOutput.WriteString(string(msg))
		if strings.Contains(streamOutput.String(), "STREAM_HELLO_VOXION") || strings.Contains(streamOutput.String(), "exit code") {
			break
		}
	}

	out := streamOutput.String()
	if !strings.Contains(out, "Executing") && !strings.Contains(out, "STREAM_HELLO_VOXION") && !strings.Contains(out, "exit") {
		t.Errorf("expected execution output stream, got: %s", out)
	}
}

func TestHandleRunTrigger(t *testing.T) {
	handler, _ := setupTestTerminal(t)

	// Create a test file in workspace
	data, _ := handler.explorerSvc.BuildWorkspaceData()
	if data != nil && data.ActiveFile != nil {
		_ = os.WriteFile(filepath.Join(data.Cwd, data.ActiveFile.Path), []byte("print('RUN_TRIGGER_SUCCESS')\n"), 0644)
	}

	req := httptest.NewRequest(http.MethodPost, "/api/code/run", nil)
	rec := httptest.NewRecorder()

	handler.HandleRunTrigger(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200 OK for /api/code/run, got %d: %s", rec.Code, rec.Body.String())
	}

	body := rec.Body.String()
	if !strings.Contains(body, "[engine:") && !strings.Contains(body, "Finished in") {
		t.Errorf("expected run output badge, got: %s", body)
	}
}

func TestHandleTerminalExecAndClear(t *testing.T) {
	handler, _ := setupTestTerminal(t)

	// Test exec
	form := url.Values{"command": {"ls -la"}}
	req := httptest.NewRequest(http.MethodPost, "/api/terminal/exec", strings.NewReader(form.Encode()))
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	rec := httptest.NewRecorder()

	handler.HandleTerminalExec(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200 OK, got %d", rec.Code)
	}
	if !strings.Contains(rec.Body.String(), "ls -la") {
		t.Errorf("expected command output to contain 'ls -la', got: %s", rec.Body.String())
	}

	// Test clear
	req = httptest.NewRequest(http.MethodPost, "/api/terminal/clear", nil)
	rec = httptest.NewRecorder()
	handler.HandleClear(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200 OK on clear, got %d", rec.Code)
	}
	if !strings.Contains(rec.Body.String(), "Output cleared") {
		t.Errorf("expected clear message, got: %s", rec.Body.String())
	}
}
