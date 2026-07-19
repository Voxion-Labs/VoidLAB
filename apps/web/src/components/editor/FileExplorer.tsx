"use client";

import { useEffect, useRef, useState } from "react";
import {
  FileCode2,
  FilePlus2,
  Folder,
  FolderPlus,
  FolderTree,
  MoreHorizontal,
  MoveRight,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { languageGroups } from "@/lib/languages";
import {
  formatWorkspacePath,
  getWorkspaceBaseName,
  getWorkspaceParentPath,
  mountWorkspaceVfs,
} from "@/lib/workspace";

type ExplorerFile = {
  id: string;
  languageId: string;
  name: string;
  path: string;
};

type TreeItem =
  | { depth: number; kind: "folder"; path: string }
  | { depth: number; id: string; kind: "file"; languageId: string; path: string };

type FileExplorerProps = {
  activeFileId: string;
  cwd: string;
  draftLanguage: string;
  draftName: string;
  files: ExplorerFile[];
  folders: string[];
  onCreateFile: () => void;
  onCreateFolder: (folderName: string) => void;
  onDeleteFile: (id: string) => void;
  onDeleteFolder: (path: string) => void;
  onDraftLanguageChange: (value: string) => void;
  onDraftNameChange: (value: string) => void;
  onImportFiles: () => void;
  onImportFolder: () => void;
  onMoveFile: (fileId: string, targetFolder: string) => void;
  onMoveFolder: (srcPath: string, targetFolder: string) => void;
  onRenameFile: (fileId: string, newName: string) => void;
  onRenameFolder: (oldPath: string, newName: string) => void;
  onSelectFile: (id: string) => void;
};

/* ── New Folder Modal ───────────────────────────────────── */
function NewFolderModal({
  onConfirm,
  onClose,
}: {
  onConfirm: (name: string) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSubmit = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    onConfirm(trimmed);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
      style={{ background: "rgba(0,0,0,0.55)", backdropFilter: "blur(4px)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="w-full max-w-xs rounded-2xl p-6"
        style={{ background: "var(--panel-background)", border: "1px solid var(--border-strong)", boxShadow: "var(--shadow)" }}
      >
        <div className="flex items-center justify-between mb-5">
          <div className="text-sm font-semibold theme-text-strong flex items-center gap-2">
            <FolderPlus size={16} style={{ color: "var(--accent)" }} />
            New Folder
          </div>
          <button onClick={onClose} className="theme-muted hover:opacity-70 transition" type="button">
            <X size={16} />
          </button>
        </div>

        <input
          ref={inputRef}
          className="w-full rounded-2xl px-4 py-2.5 text-sm outline-none mb-5 theme-text transition hover:border-[var(--border-strong)]"
          style={{ background: "var(--input-background)", border: "1px solid var(--border)" }}
          placeholder="e.g. components"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleSubmit();
            if (e.key === "Escape") onClose();
          }}
        />

        <div className="flex gap-2 justify-end">
          <button
            className="rounded-2xl px-4 py-2 text-sm transition hover:opacity-70 hover:bg-[var(--control-hover)]"
            style={{ background: "var(--control-background)", border: "1px solid var(--border)", color: "var(--text)" }}
            onClick={onClose}
            type="button"
          >
            Cancel
          </button>
          <button
            className="rounded-2xl px-5 py-2 text-sm font-semibold transition hover:scale-105 hover:opacity-90 disabled:opacity-40 disabled:hover:scale-100"
            disabled={!name.trim()}
            style={{ background: "var(--action-background)", color: "var(--action-foreground)" }}
            onClick={handleSubmit}
            type="button"
          >
            Create
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Rename Modal ───────────────────────────────────── */
function RenameModal({
  initialName,
  onConfirm,
  onClose,
}: {
  initialName: string;
  onConfirm: (name: string) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState(initialName);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  const handleSubmit = () => {
    const trimmed = name.trim();
    if (!trimmed || trimmed === initialName) return;
    onConfirm(trimmed);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
      style={{ background: "rgba(0,0,0,0.55)", backdropFilter: "blur(4px)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="w-full max-w-xs rounded-2xl p-6"
        style={{ background: "var(--panel-background)", border: "1px solid var(--border-strong)", boxShadow: "var(--shadow)" }}
      >
        <div className="flex items-center justify-between mb-5">
          <div className="text-sm font-semibold theme-text-strong flex items-center gap-2">
            <FileCode2 size={16} style={{ color: "var(--accent)" }} />
            Rename
          </div>
          <button onClick={onClose} className="theme-muted hover:opacity-70 transition" type="button">
            <X size={16} />
          </button>
        </div>

        <input
          ref={inputRef}
          className="w-full rounded-2xl px-4 py-2.5 text-sm outline-none mb-5 theme-text transition hover:border-[var(--border-strong)]"
          style={{ background: "var(--input-background)", border: "1px solid var(--border)" }}
          placeholder="New name..."
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleSubmit();
            if (e.key === "Escape") onClose();
          }}
        />

        <div className="flex gap-2 justify-end">
          <button
            className="rounded-2xl px-4 py-2 text-sm transition hover:opacity-70 hover:bg-[var(--control-hover)]"
            style={{ background: "var(--control-background)", border: "1px solid var(--border)", color: "var(--text)" }}
            onClick={onClose}
            type="button"
          >
            Cancel
          </button>
          <button
            className="rounded-2xl px-5 py-2 text-sm font-semibold transition hover:scale-105 hover:opacity-90 disabled:opacity-40 disabled:hover:scale-100"
            disabled={!name.trim() || name.trim() === initialName}
            style={{ background: "var(--action-background)", color: "var(--action-foreground)" }}
            onClick={handleSubmit}
            type="button"
          >
            Rename
          </button>
        </div>
      </div>
    </div>
  );
}

const buildTree = (folders: string[], files: ExplorerFile[], parent = "", depth = 0): TreeItem[] => {
  const folderItems = folders
    .filter((folder) => getWorkspaceParentPath(folder) === parent)
    .sort((a, b) => a.localeCompare(b))
    .flatMap((folder) => [
      { depth, kind: "folder" as const, path: folder },
      ...buildTree(folders, files, folder, depth + 1),
    ]);

  const fileItems = files
    .filter((file) => getWorkspaceParentPath(file.path) === parent)
    .sort((a, b) => a.path.localeCompare(b.path))
    .map(
      (file) =>
        ({
          depth,
          id: file.id,
          kind: "file" as const,
          languageId: file.languageId,
          path: file.path,
        }) satisfies TreeItem,
    );

  return [...folderItems, ...fileItems];
};

/* ── Move modal ─────────────────────────────────────────── */
type MoveTarget = { kind: "file"; id: string; path: string } | { kind: "folder"; path: string } | null;

function MoveModal({
  target,
  folders,
  onMove,
  onClose,
}: {
  target: MoveTarget;
  folders: string[];
  onMove: (targetFolder: string) => void;
  onClose: () => void;
}) {
  const [selected, setSelected] = useState<string>("");

  if (!target) return null;

  const label = target.kind === "file"
    ? getWorkspaceBaseName(target.path)
    : getWorkspaceBaseName(target.path);

  const availableFolders = ["(root)", ...folders.filter((f) =>
    f !== target.path && !f.startsWith(`${target.path}/`)
  )];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
      style={{ background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="w-full max-w-sm rounded-2xl p-6"
        style={{ background: "var(--panel-background)", border: "1px solid var(--border-strong)", boxShadow: "var(--shadow)" }}
      >
        <div className="flex items-center justify-between mb-5">
          <div className="text-sm font-semibold theme-text-strong flex items-center gap-2">
            <MoveRight size={16} style={{ color: "var(--accent)" }} />
            Move &quot;{label}&quot;
          </div>
          <button onClick={onClose} className="theme-muted hover:opacity-70 transition" type="button">
            <X size={16} />
          </button>
        </div>

        <div className="text-sm theme-muted mb-3">Select destination folder:</div>

        <div className="space-y-1.5 max-h-48 overflow-y-auto scrollbar-thin pr-1">
          {availableFolders.map((folder) => (
            <button
              key={folder}
              className="w-full rounded-2xl px-4 py-2.5 text-left text-sm transition hover:scale-[1.01]"
              style={{
                background: selected === folder ? "var(--accent-soft)" : "var(--control-background)",
                border: selected === folder ? "1px solid var(--accent)" : "1px solid var(--border)",
                color: selected === folder ? "var(--accent)" : "var(--text)",
              }}
              onClick={() => setSelected(folder)}
              type="button"
            >
              {folder === "(root)" ? "/ (project root)" : `/${folder}`}
            </button>
          ))}
        </div>

        <div className="mt-5 flex gap-2 justify-end">
          <button
            className="rounded-2xl px-4 py-2 text-sm transition hover:bg-[var(--control-hover)]"
            style={{ background: "var(--control-background)", border: "1px solid var(--border)", color: "var(--text)" }}
            onClick={onClose}
            type="button"
          >
            Cancel
          </button>
          <button
            className="rounded-2xl px-5 py-2 text-sm font-semibold transition hover:scale-105 hover:opacity-90 disabled:opacity-40 disabled:hover:scale-100"
            disabled={!selected}
            style={{ background: "var(--action-background)", color: "var(--action-foreground)" }}
            onClick={() => { if (selected) { onMove(selected === "(root)" ? "" : selected); onClose(); } }}
            type="button"
          >
            Move here
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Context menu ───────────────────────────────────────── */
function ContextMenu({
  item,
  onRename,
  onDelete,
  onMove,
  onClose,
}: {
  item: TreeItem;
  onRename: () => void;
  onDelete: () => void;
  onMove: () => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  return (
    <div
      ref={ref}
      className="absolute right-0 top-10 z-20 rounded-2xl py-2 min-w-[150px]"
      style={{
        background: "var(--panel-background)",
        border: "1px solid var(--border-strong)",
        boxShadow: "var(--shadow)",
      }}
    >
      <button
        className="flex w-full items-center gap-2.5 px-4 py-2.5 text-sm theme-text transition hover:bg-[var(--control-hover)]"
        onClick={(e) => { e.stopPropagation(); onRename(); onClose(); }}
        type="button"
      >
        <FileCode2 size={15} style={{ color: "var(--accent)" }} />
        Rename
      </button>
      <button
        className="flex w-full items-center gap-2.5 px-4 py-2.5 text-sm theme-text transition hover:bg-[var(--control-hover)]"
        onClick={(e) => { e.stopPropagation(); onMove(); onClose(); }}
        type="button"
      >
        <MoveRight size={15} style={{ color: "var(--accent)" }} />
        Move to…
      </button>
      <button
        className="flex w-full items-center gap-2.5 px-4 py-2.5 text-sm transition hover:bg-[var(--control-hover)]"
        style={{ color: "#f43f5e" }}
        onClick={(e) => { e.stopPropagation(); onDelete(); onClose(); }}
        type="button"
      >
        <Trash2 size={15} />
        Delete
      </button>
    </div>
  );
}

export default function FileExplorer({
  activeFileId,
  cwd,
  draftLanguage,
  draftName,
  files,
  folders,
  onCreateFile,
  onCreateFolder,
  onDeleteFile,
  onDeleteFolder,
  onDraftLanguageChange,
  onDraftNameChange,
  onImportFiles,
  onImportFolder,
  onMoveFile,
  onMoveFolder,
  onRenameFile,
  onRenameFolder,
  onSelectFile,
}: FileExplorerProps) {
  const items = buildTree(folders, files);
  const [storageLabel, setStorageLabel] = useState("mounting local VFS");
  const [contextItem, setContextItem] = useState<TreeItem | null>(null);
  const [moveTarget, setMoveTarget] = useState<MoveTarget>(null);
  const [renameTarget, setRenameTarget] = useState<TreeItem | null>(null);
  const [showNewFolderModal, setShowNewFolderModal] = useState(false);

  useEffect(() => {
    let mounted = true;
    void mountWorkspaceVfs()
      .then(({ backend }) => {
        if (!mounted) return;
        setStorageLabel(backend === "opfs" ? "OPFS" : "IndexedDB");
      })
      .catch(() => { if (!mounted) return; setStorageLabel("local"); });
    return () => { mounted = false; };
  }, []);

  const openMove = (item: TreeItem) => {
    if (item.kind === "file") {
      setMoveTarget({ kind: "file", id: item.id, path: item.path });
    } else {
      setMoveTarget({ kind: "folder", path: item.path });
    }
  };

  const handleMove = (targetFolder: string) => {
    if (!moveTarget) return;
    if (moveTarget.kind === "file") {
      onMoveFile(moveTarget.id, targetFolder);
    } else {
      onMoveFolder(moveTarget.path, targetFolder);
    }
  };

  return (
    <div
      className="flex h-full flex-col"
      style={{ borderRight: "1px solid var(--border)", background: "var(--surface-soft)" }}
    >
      {/* ── Top controls ─────────────────────────────────── */}
      <div className="p-4" style={{ borderBottom: "1px solid var(--border)" }}>
        <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-widest theme-text-strong mb-4">
          <FolderTree size={16} style={{ color: "var(--accent)" }} />
          Explorer
        </div>

        <div className="text-xs theme-muted mb-2">Dir: {formatWorkspacePath(cwd)}</div>
        <div
          className="mb-4 rounded-2xl px-3 py-1.5 text-xs theme-muted"
          style={{ background: "var(--control-background)", border: "1px solid var(--border)" }}
        >
          Storage: {storageLabel}
        </div>

        {/* New file name + language */}
        <div className="space-y-3">
          <input
            className="w-full rounded-2xl px-4 py-2.5 text-sm outline-none theme-text transition hover:border-[var(--border-strong)]"
            style={{ background: "var(--input-background)", border: "1px solid var(--border)" }}
            onChange={(e) => onDraftNameChange(e.target.value)}
            placeholder="src/main"
            value={draftName}
          />
          <select
            className="w-full rounded-2xl px-4 py-2.5 text-sm outline-none theme-text transition hover:border-[var(--border-strong)] cursor-pointer"
            style={{ background: "var(--input-background)", border: "1px solid var(--border)" }}
            onChange={(e) => onDraftLanguageChange(e.target.value)}
            value={draftLanguage}
          >
            {languageGroups.map((group) => (
              <optgroup key={group.label} label={group.label}>
                {group.items.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.label}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>

          {/* Action buttons */}
          <div className="grid grid-cols-2 gap-2">
            <button
              className="inline-flex items-center justify-center gap-2 rounded-2xl py-2.5 text-sm font-semibold transition hover:scale-[1.02] hover:opacity-90"
              style={{ background: "var(--action-background)", color: "var(--action-foreground)" }}
              onClick={onCreateFile}
              type="button"
            >
              <FilePlus2 size={16} />
              New file
            </button>
            <button
              className="inline-flex items-center justify-center gap-2 rounded-2xl py-2.5 text-sm font-medium transition hover:bg-[var(--control-hover)]"
              style={{ background: "var(--control-background)", border: "1px solid var(--border)", color: "var(--text)" }}
              onClick={() => setShowNewFolderModal(true)}
              type="button"
            >
              <FolderPlus size={16} />
              New folder
            </button>
            <button
              className="inline-flex items-center justify-center gap-2 rounded-2xl py-2.5 text-sm font-medium transition hover:bg-[var(--control-hover)]"
              style={{ background: "var(--control-background)", border: "1px solid var(--border)", color: "var(--text)" }}
              onClick={onImportFiles}
              type="button"
            >
              <Upload size={16} />
              Import files
            </button>
            <button
              className="inline-flex items-center justify-center gap-2 rounded-2xl py-2.5 text-sm font-medium transition hover:bg-[var(--control-hover)]"
              style={{ background: "var(--control-background)", border: "1px solid var(--border)", color: "var(--text)" }}
              onClick={onImportFolder}
              type="button"
            >
              <Upload size={16} />
              Import folder
            </button>
          </div>
        </div>
      </div>

      {/* ── File tree ─────────────────────────────────────── */}
      <div className="scrollbar-thin flex-1 overflow-y-auto p-3">
        <div className="space-y-1">
          {items.length ? (
            items.map((item) => {
              const paddingLeft = 12 + item.depth * 16;
              const isFolder = item.kind === "folder";
              const isActive = item.kind === "file" && item.id === activeFileId;
              const isCtxOpen = contextItem === item;

              return (
                <div
                  className="relative flex items-center justify-between rounded-2xl px-2 py-2 group transition hover:bg-[var(--control-hover)]"
                  key={isFolder ? item.path : item.id}
                  style={{
                    paddingLeft,
                    background: isActive
                      ? "var(--accent-soft)"
                      : "transparent",
                  }}
                  onMouseLeave={() => { if (isCtxOpen) setContextItem(null); }}
                >
                  {/* Main clickable area */}
                  <button
                    className="min-w-0 flex-1 text-left"
                    onClick={() => {
                      if (!isFolder) onSelectFile((item as { id: string }).id);
                    }}
                    type="button"
                  >
                    <div className="flex items-center gap-2 truncate">
                      {isFolder ? (
                        <Folder size={16} style={{ color: "var(--accent)", flexShrink: 0 }} />
                      ) : (
                        <FileCode2 size={16} style={{ color: isActive ? "var(--accent)" : "var(--muted)", flexShrink: 0 }} />
                      )}
                      <span
                        className="truncate text-sm font-medium transition"
                        style={{ color: isActive ? "var(--accent)" : "var(--text-strong)" }}
                      >
                        {getWorkspaceBaseName(item.path)}
                      </span>
                    </div>
                    <div className="truncate pl-6 text-xs theme-muted mt-0.5" style={{ fontSize: "11px" }}>
                      {formatWorkspacePath(item.path)}
                    </div>
                  </button>

                  {/* ⋮ menu button */}
                  <button
                    className="relative shrink-0 rounded-xl p-1.5 opacity-0 group-hover:opacity-100 transition hover:bg-[var(--surface-strong)]"
                    style={{ color: "var(--muted)" }}
                    onClick={(e) => {
                      e.stopPropagation();
                      setContextItem(isCtxOpen ? null : item);
                    }}
                    type="button"
                  >
                    <MoreHorizontal size={16} />
                  </button>

                  {/* Context menu */}
                  {isCtxOpen && (
                    <ContextMenu
                      item={item}
                      onRename={() => { setRenameTarget(item); setContextItem(null); }}
                      onDelete={() => {
                        if (isFolder) onDeleteFolder(item.path);
                        else onDeleteFile((item as { id: string }).id);
                        setContextItem(null);
                      }}
                      onMove={() => { openMove(item); setContextItem(null); }}
                      onClose={() => setContextItem(null)}
                    />
                  )}
                </div>
              );
            })
          ) : (
            <div
              className="rounded-2xl px-4 py-6 text-sm theme-muted text-center"
              style={{ border: "1px dashed var(--border)" }}
            >
              Import a folder or create files to populate the workspace tree.
            </div>
          )}
        </div>
      </div>

      {/* ── Move modal ────────────────────────────────────── */}
      {moveTarget && (
        <MoveModal
          target={moveTarget}
          folders={folders}
          onMove={handleMove}
          onClose={() => setMoveTarget(null)}
        />
      )}

      {/* ── New Folder modal ──────────────────────────────── */}
      {showNewFolderModal && (
        <NewFolderModal
          onConfirm={(folderName) => onCreateFolder(folderName)}
          onClose={() => setShowNewFolderModal(false)}
        />
      )}

      {/* ── Rename modal ──────────────────────────────────── */}
      {renameTarget && (
        <RenameModal
          initialName={getWorkspaceBaseName(renameTarget.path)}
          onConfirm={(newName) => {
            if (renameTarget.kind === "folder") onRenameFolder(renameTarget.path, newName);
            else onRenameFile(renameTarget.id, newName);
          }}
          onClose={() => setRenameTarget(null)}
        />
      )}
    </div>
  );
}
