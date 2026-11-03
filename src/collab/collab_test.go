package collab

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

func setupTestCollabHandler(t *testing.T) (*Handler, *template.Template, *explorer.Service) {
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

func TestCollabRoomEndpoints(t *testing.T) {
	handler, _, _ := setupTestCollabHandler(t)

	// 1. GET /api/collab/room -> Lobby launcher HTML fragment
	req := httptest.NewRequest(http.MethodGet, "/api/collab/room", nil)
	rec := httptest.NewRecorder()
	handler.HandleCollabRoom(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200 OK, got %d", rec.Code)
	}
	if !strings.Contains(rec.Body.String(), "Multiplayer Peer Collaboration") {
		t.Errorf("expected multiplayer lobby fragment, got: %s", rec.Body.String())
	}

	// 2. POST /api/collab/room?action=create -> Creates room and returns room card fragment
	form := url.Values{"action": {"create"}}
	req = httptest.NewRequest(http.MethodPost, "/api/collab/room", strings.NewReader(form.Encode()))
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	rec = httptest.NewRecorder()
	handler.HandleCollabRoom(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200 OK, got %d", rec.Code)
	}
	body := rec.Body.String()
	if !strings.Contains(body, "VOID-") || !strings.Contains(body, "collab-room-container") {
		t.Errorf("expected active room card fragment with VOID- code, got: %s", body)
	}

	// 3. POST /api/collab/room?action=message -> Sends chat in room
	msgForm := url.Values{
		"action":  {"message"},
		"room_id": {"VOID-TEST1"},
		"message": {"Hello from test peer!"},
	}
	req = httptest.NewRequest(http.MethodPost, "/api/collab/room", strings.NewReader(msgForm.Encode()))
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	rec = httptest.NewRecorder()
	handler.HandleCollabRoom(rec, req)

	if !strings.Contains(rec.Body.String(), "Hello from test peer!") {
		t.Errorf("expected room stream to contain sent message, got: %s", rec.Body.String())
	}
}

func TestEphemeralCollabRoomVanishing(t *testing.T) {
	cm := NewCollabManager()

	// 1. Create in-memory room
	_ = cm.GetOrCreateRoom("TEST-ROOM", "Alice")
	if !cm.RoomExists("TEST-ROOM") {
		t.Fatalf("expected room TEST-ROOM to exist in memory")
	}
	if cm.ActiveRoomCount() != 1 {
		t.Fatalf("expected 1 active room, got %d", cm.ActiveRoomCount())
	}

	// 2. Peer leaves room
	cm.LeaveRoom("TEST-ROOM", "Alice")

	// 3. Room vanishes from memory when empty
	if cm.RoomExists("TEST-ROOM") {
		t.Errorf("expected room TEST-ROOM to vanish from memory after last user left")
	}
	if cm.ActiveRoomCount() != 0 {
		t.Errorf("expected 0 active rooms, got %d", cm.ActiveRoomCount())
	}
}
