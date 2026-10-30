package premium

import (
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"html"
	"log"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/gorilla/websocket"
)

// CollabMessage represents a chat or synchronization event in a multiplayer session.
type CollabMessage struct {
	Author    string    `json:"author"`
	Text      string    `json:"text"`
	Timestamp time.Time `json:"timestamp"`
}

// CollabRoom represents an active peer room for collaborative editing.
type CollabRoom struct {
	ID           string
	Name         string
	Host         string
	Participants []string
	Messages     []CollabMessage
	Clients      map[*websocket.Conn]bool
	mu           sync.RWMutex
}

// CollabManager manages multiplayer rooms and WebSockets.
type CollabManager struct {
	rooms    map[string]*CollabRoom
	upgrader websocket.Upgrader
	mu       sync.RWMutex
}

// NewCollabManager initializes a multiplayer collaboration manager.
func NewCollabManager() *CollabManager {
	return &CollabManager{
		rooms: make(map[string]*CollabRoom),
		upgrader: websocket.Upgrader{
			ReadBufferSize:  4096,
			WriteBufferSize: 4096,
			CheckOrigin: func(r *http.Request) bool {
				return true
			},
		},
	}
}

// GenerateRoomCode creates an uppercase 6-character room token.
func GenerateRoomCode() string {
	bytes := make([]byte, 3)
	_, _ = rand.Read(bytes)
	return fmt.Sprintf("VOID-%s", strings.ToUpper(hex.EncodeToString(bytes)))
}

// GetOrCreateRoom finds or instantiates a multiplayer room.
func (cm *CollabManager) GetOrCreateRoom(id string, host string) *CollabRoom {
	cm.mu.Lock()
	defer cm.mu.Unlock()

	id = strings.ToUpper(strings.TrimSpace(id))
	if id == "" {
		id = GenerateRoomCode()
	}

	if room, exists := cm.rooms[id]; exists {
		return room
	}

	if host == "" {
		host = DefaultUsername
	}

	room := &CollabRoom{
		ID:           id,
		Name:         fmt.Sprintf("Room %s", id),
		Host:         host,
		Participants: []string{host},
		Messages: []CollabMessage{
			{
				Author:    "System",
				Text:      fmt.Sprintf("Room %s initialized. Share the room code to start multiplayer peer sync.", id),
				Timestamp: time.Now(),
			},
		},
		Clients: make(map[*websocket.Conn]bool),
	}

	cm.rooms[id] = room
	return room
}

// HandleWebSocketConnection handles multiplayer WebSocket streaming for collaborative sync.
func (cm *CollabManager) HandleWebSocketConnection(w http.ResponseWriter, r *http.Request) {
	roomID := strings.ToUpper(strings.TrimSpace(r.URL.Query().Get("room")))
	username := strings.TrimSpace(r.URL.Query().Get("user"))
	if username == "" {
		if authUser, ok := GetAuthenticatedUser(r); ok {
			username = authUser
		} else {
			username = "Guest-" + GenerateRoomCode()[5:]
		}
	}

	room := cm.GetOrCreateRoom(roomID, username)

	conn, err := cm.upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Printf("[Collab WS] upgrade error: %v", err)
		return
	}
	defer conn.Close()

	room.mu.Lock()
	room.Clients[conn] = true
	hasUser := false
	for _, p := range room.Participants {
		if p == username {
			hasUser = true
			break
		}
	}
	if !hasUser {
		room.Participants = append(room.Participants, username)
	}
	room.mu.Unlock()

	defer func() {
		room.mu.Lock()
		delete(room.Clients, conn)
		room.mu.Unlock()
	}()

	// Initial welcome message over WebSocket
	_ = conn.WriteJSON(map[string]any{
		"type":    "connected",
		"room":    room.ID,
		"user":    username,
		"message": fmt.Sprintf("Connected to multiplayer room %s", room.ID),
	})

	// Message broadcast pump
	for {
		var msg map[string]string
		if err := conn.ReadJSON(&msg); err != nil {
			break
		}

		if text, ok := msg["text"]; ok && strings.TrimSpace(text) != "" {
			chatMsg := CollabMessage{
				Author:    username,
				Text:      strings.TrimSpace(text),
				Timestamp: time.Now(),
			}

			room.mu.Lock()
			room.Messages = append(room.Messages, chatMsg)
			room.mu.Unlock()

			// Broadcast to all connected clients in the room
			room.mu.RLock()
			for client := range room.Clients {
				_ = client.WriteJSON(map[string]any{
					"type":      "chat",
					"author":    chatMsg.Author,
					"text":      chatMsg.Text,
					"timestamp": chatMsg.Timestamp.Format("15:04:05"),
				})
			}
			room.mu.RUnlock()
		}
	}
}

// RenderRoomCard renders the active room fragment for HTMX swapping.
func (cm *CollabManager) RenderRoomCard(room *CollabRoom, currentUser string) string {
	room.mu.RLock()
	defer room.mu.RUnlock()

	var participantsHTML strings.Builder
	for _, p := range room.Participants {
		isMe := p == currentUser
		participantsHTML.WriteString(fmt.Sprintf(
			`<span class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium %s border">`+
				`<span class="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>%s%s</span>`,
			ternary(isMe, "bg-[var(--accent-soft)] text-[var(--accent)] border-[var(--accent-strong)]", "bg-[var(--surface-soft)] text-[var(--text)] border-[var(--border)]"),
			html.EscapeString(p),
			ternary(isMe, " (You)", ""),
		))
	}

	var messagesHTML strings.Builder
	for _, m := range room.Messages {
		isSystem := m.Author == "System"
		messagesHTML.WriteString(fmt.Sprintf(
			`<div class="p-1.5 rounded text-[11px] font-mono %s">`+
				`<span class="font-semibold %s">%s:</span> `+
				`<span class="text-[var(--text)]">%s</span> `+
				`<span class="text-[9px] opacity-40 float-right">%s</span></div>`,
			ternary(isSystem, "bg-[var(--surface-soft)] opacity-80", "hover:bg-[var(--control-hover)]"),
			ternary(isSystem, "text-[var(--accent)]", "text-emerald-500"),
			html.EscapeString(m.Author),
			html.EscapeString(m.Text),
			m.Timestamp.Format("15:04"),
		))
	}

	return fmt.Sprintf(`
<div id="collab-room-container" class="rounded-lg border border-[var(--border)] bg-[var(--surface-soft)] p-4 font-sans text-xs space-y-3 transition-colors shadow-sm">
  <div class="flex items-center justify-between border-b border-[var(--border)] pb-2.5">
    <div class="flex items-center gap-2">
      <span class="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
      <span class="font-bold text-xs uppercase tracking-wider text-[var(--text-strong)]">Multiplayer Room</span>
      <span class="px-2 py-0.5 rounded bg-[var(--control-background)] border border-[var(--border)] font-mono text-[11px] font-semibold text-[var(--accent)] select-all">%s</span>
    </div>
    <div class="flex items-center gap-1.5">
      <button
        onclick="navigator.clipboard.writeText('%s'); alert('Room code %s copied to clipboard!');"
        class="px-2 py-1 rounded bg-[var(--control-background)] hover:bg-[var(--control-hover)] text-[10px] font-medium border border-[var(--border)] cursor-pointer"
        type="button"
      >
        Copy Code
      </button>
      <button
        hx-post="/api/collab/room?action=leave"
        hx-target="#collab-room-container"
        hx-swap="outerHTML"
        class="px-2 py-1 rounded bg-[var(--control-background)] hover:bg-rose-500/10 text-rose-500 text-[10px] font-medium border border-[var(--border)] cursor-pointer"
        type="button"
      >
        Leave Room
      </button>
    </div>
  </div>

  <div>
    <div class="text-[10px] font-semibold uppercase tracking-wider text-[var(--muted)] mb-1.5">Connected Peers (%d):</div>
    <div class="flex flex-wrap gap-1.5">%s</div>
  </div>

  <div>
    <div class="text-[10px] font-semibold uppercase tracking-wider text-[var(--muted)] mb-1">Peer Room Stream:</div>
    <div id="collab-messages-stream" class="h-28 overflow-y-auto space-y-1 p-2 rounded bg-[var(--background-main)] border border-[var(--border)] scrollbar-thin">
      %s
    </div>
  </div>

  <form hx-post="/api/collab/room" hx-target="#collab-room-container" hx-swap="outerHTML" class="flex gap-2">
    <input type="hidden" name="action" value="message">
    <input type="hidden" name="room_id" value="%s">
    <input
      name="message"
      class="flex-1 px-3 py-1.5 text-xs rounded border border-[var(--border)] bg-[var(--input-background)] text-[var(--text)] outline-none font-sans"
      placeholder="Type a peer message or sync note..."
      autocomplete="off"
      required
    >
    <button
      type="submit"
      class="px-3 py-1.5 rounded font-semibold text-xs bg-[var(--action-background)] text-[var(--action-foreground)] shadow-sm hover:opacity-95 cursor-pointer"
    >
      Send
    </button>
  </form>
</div>
`, room.ID, room.ID, room.ID, len(room.Participants), participantsHTML.String(), messagesHTML.String(), room.ID)
}

// RenderLauncherCard renders the initial multiplayer lobby card.
func (cm *CollabManager) RenderLauncherCard() string {
	return `
<div id="collab-room-container" class="rounded-lg border border-[var(--border)] bg-[var(--surface-soft)] p-4 font-sans text-xs space-y-4 transition-colors shadow-sm">
  <div class="flex items-center justify-between border-b border-[var(--border)] pb-2">
    <div class="flex items-center gap-2">
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="text-[var(--accent)]"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M22 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
      <span class="font-bold text-xs uppercase tracking-wider text-[var(--text-strong)]">Multiplayer Peer Collaboration</span>
    </div>
    <span class="px-2 py-0.5 rounded text-[10px] font-mono bg-emerald-500/10 text-emerald-500 font-medium">Ready</span>
  </div>

  <p class="text-xs text-[var(--muted)] leading-relaxed">
    Collaborate with other developers in real-time. Spawn a private local room or join an existing session code with zero cloud database dependencies.
  </p>

  <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
    <!-- Action 1: Create New Room -->
    <div class="p-3 rounded-lg border border-[var(--border)] bg-[var(--panel-background)] space-y-2 flex flex-col justify-between">
      <div>
        <div class="font-semibold text-xs text-[var(--text-strong)]">Start New Session</div>
        <div class="text-[11px] text-[var(--muted)]">Generate a unique session token and host a peer sync room.</div>
      </div>
      <form hx-post="/api/collab/room" hx-target="#collab-room-container" hx-swap="outerHTML">
        <input type="hidden" name="action" value="create">
        <button
          type="submit"
          class="w-full py-1.5 px-3 rounded font-semibold text-xs bg-[var(--action-background)] text-[var(--action-foreground)] shadow-sm hover:opacity-90 cursor-pointer"
        >
          Create Room
        </button>
      </form>
    </div>

    <!-- Action 2: Join Existing Room -->
    <div class="p-3 rounded-lg border border-[var(--border)] bg-[var(--panel-background)] space-y-2 flex flex-col justify-between">
      <div>
        <div class="font-semibold text-xs text-[var(--text-strong)]">Join With Code</div>
        <div class="text-[11px] text-[var(--muted)]">Enter the 6-character room token provided by your peer.</div>
      </div>
      <form hx-post="/api/collab/room" hx-target="#collab-room-container" hx-swap="outerHTML" class="flex gap-1.5">
        <input type="hidden" name="action" value="join">
        <input
          name="room_id"
          class="flex-1 px-2.5 py-1 text-xs rounded border border-[var(--border)] bg-[var(--input-background)] text-[var(--text)] font-mono uppercase outline-none"
          placeholder="VOID-XXXX"
          required
        >
        <button
          type="submit"
          class="py-1 px-3 rounded font-semibold text-xs bg-[var(--control-background)] hover:bg-[var(--control-hover)] text-[var(--text)] border border-[var(--border)] cursor-pointer"
        >
          Join
        </button>
      </form>
    </div>
  </div>
</div>
`
}

func ternary(cond bool, a, b string) string {
	if cond {
		return a
	}
	return b
}
