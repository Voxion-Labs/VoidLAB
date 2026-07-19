"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Copy, MessagesSquare, RefreshCcw, Share2, Users2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useUser } from "@/context/UserContext";
import { persistWorkspace, readWorkspace, type WorkspaceState } from "@/lib/workspace";

type RoomMessage = {
  authorName: string;
  createdAt: string;
  id: string;
  text: string;
};

type RoomState = {
  id: string;
  messages: RoomMessage[];
  name: string;
  participants: string[];
  updatedAt: string;
  workspace: WorkspaceState | null;
};

const roomStoragePrefix = "voidlab-local-room-";

const createRoomCode = () =>
  Math.random().toString(36).replace(/[^a-z0-9]/gi, "").slice(2, 8).toUpperCase();

const readRoom = (id: string): RoomState | null => {
  if (!id) return null;
  const raw = window.localStorage.getItem(`${roomStoragePrefix}${id}`);
  return raw ? (JSON.parse(raw) as RoomState) : null;
};

const writeRoom = (room: RoomState) => {
  window.localStorage.setItem(`${roomStoragePrefix}${room.id}`, JSON.stringify(room));
};

export default function CollaborationPanel() {
  const { profile } = useUser();
  const [roomId, setRoomId] = useState("");
  const [roomName, setRoomName] = useState("VoidLAB Local Room");
  const [room, setRoom] = useState<RoomState | null>(null);
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState("Create or join a local room. Works across tabs on this browser origin.");
  const channelRef = useRef<BroadcastChannel | null>(null);

  const roomShareText = useMemo(() => {
    if (!room?.id) return "";
    return `VoidLAB room code: ${room.id}`;
  }, [room?.id]);

  const publishRoom = (nextRoom: RoomState) => {
    writeRoom(nextRoom);
    setRoom(nextRoom);
    channelRef.current?.postMessage({ room: nextRoom, type: "room-update" });
  };

  const connectChannel = (id: string) => {
    channelRef.current?.close();
    const channel = new BroadcastChannel(`voidlab-room-${id}`);
    channel.onmessage = (event) => {
      if (event.data?.type === "room-update") {
        setRoom(event.data.room as RoomState);
      }
    };
    channelRef.current = channel;
  };

  useEffect(() => () => channelRef.current?.close(), []);

  const handleCreateRoom = () => {
    const id = createRoomCode();
    const nextRoom: RoomState = {
      id,
      messages: [],
      name: roomName.trim() || "VoidLAB Local Room",
      participants: [profile?.name ?? "Local user"],
      updatedAt: new Date().toISOString(),
      workspace: null,
    };
    setRoomId(id);
    connectChannel(id);
    publishRoom(nextRoom);
    setStatus(`Room ${id} created. Share the code with another local tab or window.`);
  };

  const handleJoinRoom = () => {
    const id = roomId.trim().toUpperCase();
    const existing = readRoom(id);

    if (!existing) {
      setStatus(`Room ${id || "code"} was not found in this browser.`);
      return;
    }

    const participant = profile?.name ?? "Local user";
    const nextRoom = {
      ...existing,
      participants: Array.from(new Set([...existing.participants, participant])),
      updatedAt: new Date().toISOString(),
    };
    connectChannel(id);
    publishRoom(nextRoom);
    setStatus(`Joined room ${id}.`);
  };

  const handlePushWorkspace = () => {
    if (!room) return;
    publishRoom({
      ...room,
      updatedAt: new Date().toISOString(),
      workspace: readWorkspace(),
    });
    setStatus("Workspace snapshot shared with the local room.");
  };

  const handlePullWorkspace = () => {
    if (!room?.workspace) return;
    persistWorkspace(room.workspace);
    setStatus("Workspace snapshot pulled into this browser workspace. Refresh the editor to view it.");
  };

  const handleSendMessage = () => {
    if (!room || !message.trim()) return;

    publishRoom({
      ...room,
      messages: [
        ...room.messages,
        {
          authorName: profile?.name ?? "Local user",
          createdAt: new Date().toISOString(),
          id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          text: message.trim(),
        },
      ],
      updatedAt: new Date().toISOString(),
    });
    setMessage("");
    setStatus("Message sent locally.");
  };

  const copyRoomCode = async () => {
    if (!roomShareText) return;
    await navigator.clipboard.writeText(roomShareText);
    setStatus("Room code copied.");
  };

  return (
    <div className="grid gap-5 xl:grid-cols-[360px_minmax(0,1fr)]">
      <section className="panel rounded-[6px] p-5">
        <div className="flex items-center gap-3">
          <div className="theme-chip flex h-10 w-10 items-center justify-center rounded-[6px]">
            <Users2 size={18} />
          </div>
          <div>
            <div className="text-sm font-semibold theme-text-strong">Local room controls</div>
            <div className="text-sm theme-muted">Room codes, chat, and workspace snapshots without backend storage.</div>
          </div>
        </div>

        <div className="mt-5 space-y-3">
          <input className="theme-input w-full rounded-[6px] px-4 py-3 text-sm outline-none" onChange={(event) => setRoomName(event.target.value)} placeholder="Room name" value={roomName} />
          <input className="theme-input w-full rounded-[6px] px-4 py-3 text-sm uppercase outline-none" onChange={(event) => setRoomId(event.target.value.toUpperCase())} placeholder="Enter room code" value={roomId} />
        </div>

        <div className="mt-4 grid gap-3">
          <Button onClick={handleCreateRoom} type="button"><Share2 size={15} />Create room</Button>
          <Button disabled={!roomId.trim()} onClick={handleJoinRoom} tone="secondary" type="button">Join room</Button>
        </div>

        <div className="theme-surface mt-4 rounded-[6px] p-4 text-sm leading-7 theme-muted">{status}</div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <Button disabled={!room} onClick={handlePushWorkspace} tone="secondary" type="button">Share workspace</Button>
          <Button disabled={!room?.workspace} onClick={handlePullWorkspace} tone="secondary" type="button">Pull workspace</Button>
        </div>

        {room ? (
          <button className="theme-chip mt-4 inline-flex items-center gap-2 rounded-[6px] px-4 py-3 text-sm" onClick={() => void copyRoomCode()} type="button">
            <Copy size={15} />
            {room.id}
          </button>
        ) : null}
      </section>

      <section className="grid gap-5">
        <div className="grid gap-5 lg:grid-cols-[280px_minmax(0,1fr)]">
          <div className="panel rounded-[6px] p-5">
            <div className="text-sm font-semibold theme-text-strong">Participants</div>
            <div className="mt-4 space-y-3">
              {room?.participants.length ? room.participants.map((participant) => (
                <div className="theme-surface rounded-[6px] px-4 py-3 text-sm theme-text" key={participant}>{participant}</div>
              )) : <div className="text-sm theme-muted">No active room yet.</div>}
            </div>
          </div>

          <div className="panel rounded-[6px] p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-semibold theme-text-strong">Shared workspace</div>
                <div className="text-sm theme-muted">{room?.workspace ? "A local workspace snapshot is available." : "No workspace snapshot yet."}</div>
              </div>
              <button className="theme-surface rounded-[6px] p-2 theme-text" onClick={() => roomId && setRoom(readRoom(roomId))} type="button">
                <RefreshCcw size={16} />
              </button>
            </div>

            <div className="theme-surface mt-4 rounded-[6px] p-4 text-sm theme-muted">
              {room?.workspace ? (
                <>
                  <div>Files shared: {room.workspace.files.length}</div>
                  <div className="mt-2">Folders shared: {room.workspace.folders.length}</div>
                  <div className="mt-2">Updated at: {new Date(room.updatedAt).toLocaleString()}</div>
                </>
              ) : (
                <div>Share the current editor state to send a local snapshot.</div>
              )}
            </div>
          </div>
        </div>

        <div className="panel rounded-[6px] p-5">
          <div className="flex items-center gap-2 text-sm font-semibold theme-text-strong">
            <MessagesSquare size={16} />
            Team chat
          </div>
          <div className="scrollbar-thin mt-4 h-[320px] space-y-3 overflow-y-auto pr-2">
            {room?.messages.length ? room.messages.map((entry) => (
              <div className="theme-surface rounded-[6px] px-4 py-3" key={entry.id}>
                <div className="text-sm font-medium theme-text-strong">{entry.authorName}</div>
                <div className="mt-1 text-sm leading-7 theme-muted">{entry.text}</div>
              </div>
            )) : <div className="text-sm theme-muted">Messages will appear here once a room is active.</div>}
          </div>

          <div className="theme-surface mt-4 rounded-[6px] p-3">
            <textarea className="min-h-[100px] w-full resize-none bg-transparent text-sm leading-7 theme-text outline-none" onChange={(event) => setMessage(event.target.value)} placeholder="Send a local room message..." value={message} />
            <div className="mt-3 flex justify-end">
              <Button disabled={!room || !message.trim()} onClick={handleSendMessage} type="button">Send message</Button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
