"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Check, Copy, MessageSquare, RefreshCcw, Send, Share2, Users2, Wifi, WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useUser } from "@/context/UserContext";
import { persistWorkspace, readWorkspace } from "@/lib/workspace";

/* ─── Types ─────────────────────────────────────────────────── */
type ChatMessage = {
  authorId: string;
  authorName: string;
  id: string;
  text: string;
  ts: number;
};

type Participant = {
  color: string;
  id: string;
  name: string;
  joinedAt: number;
};

type RoomWorkspace = {
  activeFileId: string;
  files: Array<{ content: string; id: string; languageId: string; name: string; path: string }>;
  folders: string[];
  updatedAt: number;
  updatedBy: string;
};

type RoomData = {
  id: string;
  messages: ChatMessage[];
  name: string;
  participants: Participant[];
  workspace: RoomWorkspace | null;
};

/* ─── Helpers ───────────────────────────────────────────────── */
const STORAGE_PREFIX = "voidlab-collab-room-";
const CHANNEL_NAME = "voidlab-collab";
const COLORS = ["#e11d48", "#f59e0b", "#10b981", "#6366f1", "#ec4899", "#0ea5e9", "#84cc16"];

function genId(length = 6): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({ length }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

function genParticipantId(): string {
  return `p-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function randomColor(): string {
  return COLORS[Math.floor(Math.random() * COLORS.length)];
}

function loadRoom(roomId: string): RoomData | null {
  try {
    const raw = localStorage.getItem(`${STORAGE_PREFIX}${roomId}`);
    return raw ? (JSON.parse(raw) as RoomData) : null;
  } catch {
    return null;
  }
}

function saveRoom(room: RoomData): void {
  localStorage.setItem(`${STORAGE_PREFIX}${room.id}`, JSON.stringify(room));
}

function broadcastUpdate(channel: BroadcastChannel | null, roomId: string) {
  channel?.postMessage({ type: "room-update", roomId });
}

/* ─── Component ─────────────────────────────────────────────── */
export default function CollaborationPanel() {
  const searchParams = useSearchParams();
  const initialRoomId = searchParams.get("room")?.toUpperCase() ?? "";
  const { profile } = useUser();

  const [roomId, setRoomId] = useState(initialRoomId);
  const [roomNameInput, setRoomNameInput] = useState("VoidLAB Team Room");
  const [joinInput, setJoinInput] = useState(initialRoomId);
  const [room, setRoom] = useState<RoomData | null>(null);
  const [participantId] = useState(() => genParticipantId());
  const [participantColor] = useState(() => randomColor());
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState(
    initialRoomId
      ? `Room ${initialRoomId} detected. Click Join Room to connect.`
      : "Create a room or join one with a 6-letter code.",
  );
  const [copied, setCopied] = useState(false);
  const [isConnected, setIsConnected] = useState(false);

  const channelRef = useRef<BroadcastChannel | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  /* ── Setup BroadcastChannel ───────────────────────────────── */
  useEffect(() => {
    if (typeof window === "undefined" || !("BroadcastChannel" in window)) return;
    const ch = new BroadcastChannel(CHANNEL_NAME);
    channelRef.current = ch;

    ch.onmessage = (event: MessageEvent<{ type: string; roomId: string }>) => {
      if (event.data?.type === "room-update" && event.data.roomId === roomId) {
        const fresh = loadRoom(event.data.roomId);
        if (fresh) setRoom(fresh);
      }
    };

    return () => {
      ch.close();
      channelRef.current = null;
    };
  }, [roomId]);

  /* ── Auto-poll localStorage for cross-tab sync ────────────── */
  useEffect(() => {
    if (!roomId || !isConnected) return;
    const interval = setInterval(() => {
      const fresh = loadRoom(roomId);
      if (fresh) setRoom(fresh);
    }, 2500);
    return () => clearInterval(interval);
  }, [roomId, isConnected]);

  /* ── Auto-scroll chat ─────────────────────────────────────── */
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [room?.messages]);

  /* ── Create room ──────────────────────────────────────────── */
  const handleCreateRoom = () => {
    if (!profile?.name) return;
    const id = genId();
    const me: Participant = {
      color: participantColor,
      id: participantId,
      name: profile.name,
      joinedAt: Date.now(),
    };
    const newRoom: RoomData = {
      id,
      messages: [],
      name: roomNameInput.trim() || "VoidLAB Team Room",
      participants: [me],
      workspace: null,
    };
    saveRoom(newRoom);
    setRoom(newRoom);
    setRoomId(id);
    setJoinInput(id);
    setIsConnected(true);
    setStatus(`Room created! Share code: ${id}`);
  };

  /* ── Join room ────────────────────────────────────────────── */
  const handleJoinRoom = () => {
    if (!profile?.name || !joinInput.trim()) return;
    const code = joinInput.trim().toUpperCase();
    const existing = loadRoom(code);

    if (!existing) {
      setStatus(`Room ${code} not found. Make sure the creator is on the same device/browser.`);
      return;
    }

    const alreadyIn = existing.participants.some((p) => p.id === participantId);
    if (!alreadyIn) {
      const me: Participant = {
        color: participantColor,
        id: participantId,
        name: profile.name,
        joinedAt: Date.now(),
      };
      existing.participants.push(me);
      saveRoom(existing);
      broadcastUpdate(channelRef.current, code);
    }

    setRoom(existing);
    setRoomId(code);
    setIsConnected(true);
    setStatus(`Connected to room ${code}.`);
  };

  /* ── Send message ─────────────────────────────────────────── */
  const handleSendMessage = () => {
    if (!room || !message.trim()) return;
    const fresh = loadRoom(room.id) ?? room;
    const msg: ChatMessage = {
      authorId: participantId,
      authorName: profile?.name ?? "Anonymous",
      id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      text: message.trim(),
      ts: Date.now(),
    };
    const updated: RoomData = { ...fresh, messages: [...fresh.messages, msg] };
    saveRoom(updated);
    broadcastUpdate(channelRef.current, room.id);
    setRoom(updated);
    setMessage("");
  };

  /* ── Push workspace ───────────────────────────────────────── */
  const handlePushWorkspace = () => {
    if (!room) return;
    const ws = readWorkspace();
    const fresh = loadRoom(room.id) ?? room;
    const snapshot: RoomWorkspace = {
      activeFileId: ws.activeFileId,
      files: ws.files,
      folders: ws.folders,
      updatedAt: Date.now(),
      updatedBy: profile?.name ?? "Anonymous",
    };
    const updated: RoomData = { ...fresh, workspace: snapshot };
    saveRoom(updated);
    broadcastUpdate(channelRef.current, room.id);
    setRoom(updated);
    setStatus("Workspace pushed to room.");
  };

  /* ── Pull workspace ───────────────────────────────────────── */
  const handlePullWorkspace = () => {
    if (!room?.workspace) return;
    const current = readWorkspace();
    persistWorkspace({
      ...current,
      activeFileId: room.workspace.activeFileId,
      files: room.workspace.files,
      folders: room.workspace.folders,
    });
    setStatus(`Pulled workspace from ${room.workspace.updatedBy}.`);
  };

  /* ── Manual refresh ───────────────────────────────────────── */
  const handleRefresh = () => {
    if (!roomId) return;
    const fresh = loadRoom(roomId);
    if (fresh) { setRoom(fresh); setStatus("Refreshed."); }
    else setStatus("Room not found in local storage.");
  };

  /* ── Copy room code ───────────────────────────────────────── */
  const handleCopyCode = async () => {
    if (!room?.id) return;
    await navigator.clipboard.writeText(room.id);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  /* ── Render ─────────────────────────────────────────────────── */
  return (
    <div className="grid gap-4 xl:grid-cols-[340px_minmax(0,1fr)]">
      {/* ── Left: room controls ─────────────────────────────── */}
      <section
        className="rounded-sm p-5 space-y-4"
        style={{ background: "var(--surface-soft)", border: "1px solid var(--border)" }}
      >
        {/* Header */}
        <div className="flex items-center gap-3">
          <div
            className="flex h-10 w-10 items-center justify-center rounded-sm"
            style={{ background: "var(--accent-soft)", border: "1px solid var(--border-strong)" }}
          >
            <Users2 size={18} style={{ color: "var(--accent)" }} />
          </div>
          <div>
            <div className="text-sm font-semibold theme-text-strong">Room controls</div>
            <div className="text-xs theme-muted flex items-center gap-1">
              {isConnected
                ? <><Wifi size={11} style={{ color: "#10b981" }} /> Connected</>
                : <><WifiOff size={11} /> Not connected</>}
            </div>
          </div>
        </div>

        {/* Create room */}
        <div
          className="rounded-sm p-4 space-y-3"
          style={{ background: "var(--panel-background)", border: "1px solid var(--border)" }}
        >
          <div className="text-xs font-semibold uppercase tracking-widest theme-muted">Create a room</div>
          <input
            className="w-full rounded-sm px-3 py-2.5 text-sm outline-none theme-text"
            style={{ background: "var(--input-background)", border: "1px solid var(--border)" }}
            onChange={(e) => setRoomNameInput(e.target.value)}
            placeholder="Room name"
            value={roomNameInput}
          />
          <Button
            disabled={!profile?.name}
            onClick={handleCreateRoom}
            type="button"
          >
            <Share2 size={14} />
            Create Room
          </Button>
        </div>

        {/* Join room */}
        <div
          className="rounded-sm p-4 space-y-3"
          style={{ background: "var(--panel-background)", border: "1px solid var(--border)" }}
        >
          <div className="text-xs font-semibold uppercase tracking-widest theme-muted">Join with code</div>
          <input
            className="w-full rounded-sm px-3 py-2.5 text-sm uppercase font-mono outline-none theme-text"
            style={{ background: "var(--input-background)", border: "1px solid var(--border)" }}
            onChange={(e) => setJoinInput(e.target.value.toUpperCase())}
            placeholder="XXXXXX"
            maxLength={8}
            value={joinInput}
          />
          <Button
            disabled={!profile?.name || !joinInput.trim()}
            onClick={handleJoinRoom}
            tone="secondary"
            type="button"
          >
            Join Room
          </Button>
        </div>

        {/* Room code */}
        {room && (
          <div
            className="rounded-sm p-4 space-y-3"
            style={{ background: "var(--accent-soft)", border: "1px solid var(--border-strong)" }}
          >
            <div className="text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--accent)" }}>
              Active room
            </div>
            <div className="flex items-center justify-between gap-2">
              <span
                className="font-mono text-2xl font-bold tracking-widest"
                style={{ color: "var(--accent)" }}
              >
                {room.id}
              </span>
              <button
                className="flex items-center gap-1.5 rounded-sm px-3 py-1.5 text-xs font-semibold transition hover:opacity-80"
                style={{
                  background: "var(--action-background)",
                  color: "var(--action-foreground)",
                }}
                onClick={() => void handleCopyCode()}
                type="button"
              >
                {copied ? <Check size={13} /> : <Copy size={13} />}
                {copied ? "Copied!" : "Copy code"}
              </button>
            </div>
            <div className="text-xs theme-muted">
              Share this code. Works across tabs on this browser.
            </div>
          </div>
        )}

        {/* Status */}
        <div
          className="rounded-sm px-3 py-2.5 text-xs theme-muted"
          style={{ background: "var(--panel-background)", border: "1px solid var(--border)" }}
        >
          {status}
        </div>

        {/* Workspace sync */}
        {room && (
          <div className="grid gap-2 sm:grid-cols-2">
            <Button disabled={!room} onClick={handlePushWorkspace} tone="secondary" type="button">
              Push workspace
            </Button>
            <Button disabled={!room?.workspace} onClick={handlePullWorkspace} tone="secondary" type="button">
              Pull workspace
            </Button>
          </div>
        )}

        {/* Info note */}
        <div
          className="rounded-sm p-3 text-xs leading-6 theme-muted"
          style={{ background: "var(--surface-elevated)", border: "1px solid var(--border)" }}
        >
          💡 Rooms use your browser's local storage + BroadcastChannel. Share the code with teammates on the same device, or open a second tab to test collab.
        </div>
      </section>

      {/* ── Right: participants + chat ───────────────────────── */}
      <section className="flex flex-col gap-4">
        {/* Participants + workspace info */}
        <div className="grid gap-4 lg:grid-cols-[200px_minmax(0,1fr)]">
          {/* Participants */}
          <div
            className="rounded-sm p-4"
            style={{ background: "var(--surface-soft)", border: "1px solid var(--border)" }}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="text-sm font-semibold theme-text-strong">Participants</div>
              <button
                className="rounded-sm p-1.5 transition hover:opacity-70"
                style={{ background: "var(--control-background)", border: "1px solid var(--border)" }}
                onClick={handleRefresh}
                title="Refresh"
                type="button"
              >
                <RefreshCcw size={13} style={{ color: "var(--muted)" }} />
              </button>
            </div>
            <div className="space-y-2">
              {room?.participants.length ? (
                room.participants.map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center gap-2 rounded-sm px-3 py-2"
                    style={{ background: "var(--panel-background)", border: "1px solid var(--border)" }}
                  >
                    <span
                      className="h-2.5 w-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: p.color }}
                    />
                    <span className="text-sm theme-text truncate">{p.name}</span>
                    {p.id === participantId && (
                      <span className="ml-auto text-xs theme-muted">(you)</span>
                    )}
                  </div>
                ))
              ) : (
                <div className="text-sm theme-muted">No room active.</div>
              )}
            </div>
          </div>

          {/* Workspace sync info */}
          <div
            className="rounded-sm p-4"
            style={{ background: "var(--surface-soft)", border: "1px solid var(--border)" }}
          >
            <div className="text-sm font-semibold theme-text-strong mb-3">Shared workspace</div>
            <div
              className="rounded-sm p-3 text-sm theme-muted"
              style={{ background: "var(--panel-background)", border: "1px solid var(--border)" }}
            >
              {room?.workspace ? (
                <>
                  <div className="theme-text font-medium mb-1">{room.workspace.files.length} files shared</div>
                  <div>{room.workspace.folders.length} folders</div>
                  <div className="mt-1">By: {room.workspace.updatedBy}</div>
                  <div className="mt-1">{new Date(room.workspace.updatedAt).toLocaleTimeString()}</div>
                </>
              ) : (
                "Push your workspace to share files with the room."
              )}
            </div>
          </div>
        </div>

        {/* ── Live Chat ─────────────────────────────────── */}
        <div
          className="flex-1 rounded-sm p-4"
          style={{ background: "var(--surface-soft)", border: "1px solid var(--border)" }}
        >
          <div className="flex items-center gap-2 mb-4">
            <MessageSquare size={15} style={{ color: "var(--accent)" }} />
            <span className="text-sm font-semibold theme-text-strong">Live chat</span>
            {room && (
              <span className="ml-auto text-xs theme-muted">
                {room.messages.length} message{room.messages.length !== 1 ? "s" : ""}
              </span>
            )}
          </div>

          {/* Messages */}
          <div
            className="scrollbar-thin h-[300px] overflow-y-auto space-y-2 pr-1 rounded-sm p-3"
            style={{ background: "var(--panel-background)", border: "1px solid var(--border)" }}
          >
            {room?.messages.length ? (
              <>
                {room.messages.map((msg) => {
                  const isMe = msg.authorId === participantId;
                  const author = room.participants.find((p) => p.id === msg.authorId);
                  return (
                    <div key={msg.id} className={`flex flex-col ${isMe ? "items-end" : "items-start"}`}>
                      {/* Author name */}
                      <span
                        className="text-xs font-semibold mb-0.5 px-1"
                        style={{ color: author?.color ?? "var(--muted)" }}
                      >
                        {isMe ? "You" : msg.authorName}
                      </span>
                      {/* Bubble */}
                      <div
                        className="max-w-[85%] rounded-sm px-3 py-2 text-sm leading-6"
                        style={
                          isMe
                            ? {
                                background: "var(--action-background)",
                                color: "var(--action-foreground)",
                              }
                            : {
                                background: "var(--surface-soft)",
                                border: "1px solid var(--border)",
                                color: "var(--text)",
                              }
                        }
                      >
                        {msg.text}
                      </div>
                      {/* Timestamp */}
                      <span className="text-xs theme-muted mt-0.5 px-1">
                        {new Date(msg.ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>
                  );
                })}
                <div ref={chatEndRef} />
              </>
            ) : (
              <div className="text-sm theme-muted h-full flex items-center justify-center">
                {isConnected ? "No messages yet. Say hello! 👋" : "Join or create a room to start chatting."}
              </div>
            )}
          </div>

          {/* Message input */}
          <div
            className="mt-3 flex gap-2 rounded-sm p-2"
            style={{ background: "var(--panel-background)", border: "1px solid var(--border)" }}
          >
            <input
              className="flex-1 bg-transparent text-sm outline-none theme-text placeholder:theme-muted"
              style={{ caretColor: "var(--accent)" }}
              disabled={!isConnected}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage();
                }
              }}
              placeholder={isConnected ? "Type a message… press Enter to send" : "Connect to a room first"}
              value={message}
            />
            <button
              className="flex items-center justify-center rounded-sm p-2 transition hover:opacity-80 disabled:opacity-40"
              disabled={!isConnected || !message.trim()}
              onClick={handleSendMessage}
              style={{
                background: "var(--action-background)",
                color: "var(--action-foreground)",
              }}
              type="button"
            >
              <Send size={15} />
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
