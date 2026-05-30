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
        className="w-full max-w-xs rounded-sm p-5"
        style={{ background: "var(--panel-background)", border: "1px solid var(--border-strong)", boxShadow: "var(--shadow)" }}
      >
        <div className="flex items-center justify-between mb-4">
          <div className="text-sm font-semibold theme-text-strong flex items-center gap-2">
            <FolderPlus size={15} style={{ color: "var(--accent)" }} />
            New Folder
          </div>
          <button onClick={onClose} className="theme-muted hover:opacity-70" type="button">
            <X size={15} />
          </button>
        </div>

        <input
          ref={inputRef}
          className="w-full rounded-sm px-3 py-2 text-sm outline-none mb-4 theme-text"
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
            className="rounded-sm px-3 py-2 text-sm transition hover:opacity-70"
            style={{ background: "var(--control-background)", border: "1px solid var(--border)", color: "var(--text)" }}
            onClick={onClose}
            type="button"
          >
            Cancel
          </button>
          <button
            className="rounded-sm px-4 py-2 text-sm font-semibold transition hover:opacity-90 disabled:opacity-40"
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
        className="w-full max-w-sm rounded-sm p-5"
        style={{ background: "var(--panel-background)", border: "1px solid var(--border-strong)", boxShadow: "var(--shadow)" }}
      >
        <div className="flex items-center justify-between mb-4">
          <div className="text-sm font-semibold theme-text-strong flex items-center gap-2">
            <MoveRight size={15} style={{ color: "var(--accent)" }} />
            Move &quot;{label}&quot;
          </div>
          <button onClick={onClose} className="theme-muted hover:opacity-70" type="button">
            <X size={15} />
          </button>
        </div>

        <div className="text-xs theme-muted mb-3">Select destination folder:</div>

        <div className="space-y-1 max-h-48 overflow-y-auto scrollbar-thin">
          {availableFolders.map((folder) => (
            <button
              key={folder}
              className="w-full rounded-sm px-3 py-2 text-left text-sm transition hover:opacity-80"
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

        <div className="mt-4 flex gap-2 justify-end">
          <button
            className="rounded-sm px-3 py-2 text-sm transition hover:opacity-70"
            style={{ background: "var(--control-background)", border: "1px solid var(--border)", color: "var(--text)" }}
            onClick={onClose}
            type="button"
          >
            Cancel
          </button>
          <button
            className="rounded-sm px-4 py-2 text-sm font-semibold transition hover:opacity-90 disabled:opacity-40"
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
  onDelete,
  onMove,
  onClose,
}: {
  item: TreeItem;
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
      className="absolute right-0 top-8 z-20 rounded-sm py-1 min-w-[130px]"
      style={{
        background: "var(--panel-background)",
        border: "1px solid var(--border-strong)",
        boxShadow: "var(--shadow)",
      }}
    >
      <button
        className="flex w-full items-center gap-2 px-3 py-2 text-xs theme-text transition hover:opacity-70"
        onClick={() => { onMove(); onClose(); }}
        type="button"
      >
        <MoveRight size={13} style={{ color: "var(--accent)" }} />
        Move to…
      </button>
      <button
        className="flex w-full items-center gap-2 px-3 py-2 text-xs transition hover:opacity-70"
        style={{ color: "#f43f5e" }}
        onClick={() => { onDelete(); onClose(); }}
        type="button"
      >
        <Trash2 size={13} />
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
  onSelectFile,
}: FileExplorerProps) {
  const items = buildTree(folders, files);
  const [storageLabel, setStorageLabel] = useState("mounting local VFS");
  const [contextItem, setContextItem] = useState<TreeItem | null>(null);
  const [moveTarget, setMoveTarget] = useState<MoveTarget>(null);
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
      <div className="p-3" style={{ borderBottom: "1px solid var(--border)" }}>
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest theme-text-strong mb-3">
          <FolderTree size={13} style={{ color: "var(--accent)" }} />
          Explorer
        </div>

        <div className="text-xs theme-muted mb-1">Dir: {formatWorkspacePath(cwd)}</div>
        <div
          className="mb-3 rounded-sm px-2 py-1 text-xs theme-muted"
          style={{ background: "var(--control-background)", border: "1px solid var(--border)" }}
        >
          Storage: {storageLabel}
        </div>

        {/* New file name + language */}
        <div className="space-y-2">
          <input
            className="w-full rounded-sm px-3 py-2 text-xs outline-none theme-text"
            style={{ background: "var(--input-background)", border: "1px solid var(--border)" }}
            onChange={(e) => onDraftNameChange(e.target.value)}
            placeholder="src/main"
            value={draftName}
          />
          <select
            className="w-full rounded-sm px-3 py-2 text-xs outline-none theme-text"
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
          <div className="grid grid-cols-2 gap-1.5">
            <button
              className="inline-flex items-center justify-center gap-1.5 rounded-sm py-2 text-xs font-semibold transition hover:opacity-90"
              style={{ background: "var(--action-background)", color: "var(--action-foreground)" }}
              onClick={onCreateFile}
              type="button"
            >
              <FilePlus2 size={13} />
              New file
            </button>
            <button
              className="inline-flex items-center justify-center gap-1.5 rounded-sm py-2 text-xs font-medium transition hover:opacity-70"
              style={{ background: "var(--control-background)", border: "1px solid var(--border)", color: "var(--text)" }}
              onClick={() => setShowNewFolderModal(true)}
              type="button"
            >
              <FolderPlus size={13} />
              New folder
            </button>
            <button
              className="inline-flex items-center justify-center gap-1.5 rounded-sm py-2 text-xs font-medium transition hover:opacity-70"
              style={{ background: "var(--control-background)", border: "1px solid var(--border)", color: "var(--text)" }}
              onClick={onImportFiles}
              type="button"
            >
              <Upload size={13} />
              Import files
            </button>
            <button
              className="inline-flex items-center justify-center gap-1.5 rounded-sm py-2 text-xs font-medium transition hover:opacity-70"
              style={{ background: "var(--control-background)", border: "1px solid var(--border)", color: "var(--text)" }}
              onClick={onImportFolder}
              type="button"
            >
              <Upload size={13} />
              Import folder
            </button>
          </div>
        </div>
      </div>

      {/* ── File tree ─────────────────────────────────────── */}
      <div className="scrollbar-thin flex-1 overflow-y-auto p-2">
        <div className="space-y-0.5">
          {items.length ? (
            items.map((item) => {
              const paddingLeft = 8 + item.depth * 14;
              const isFolder = item.kind === "folder";
              const isActive = item.kind === "file" && item.id === activeFileId;
              const isCtxOpen = contextItem === item;

              return (
                <div
                  className="relative flex items-center justify-between rounded-sm px-2 py-2 group transition"
                  key={isFolder ? item.path : item.id}
                  style={{
                    paddingLeft,
                    background: isActive
                      ? "var(--accent-soft)"
                      : "transparent",
                    border: isActive
                      ? "1px solid var(--border-strong)"
                      : "1px solid transparent",
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
                    <div className="flex items-center gap-1.5 truncate">
                      {isFolder ? (
                        <Folder size={12} style={{ color: "var(--accent)", flexShrink: 0 }} />
                      ) : (
                        <FileCode2 size={12} style={{ color: isActive ? "var(--accent)" : "var(--muted)", flexShrink: 0 }} />
                      )}
                      <span
                        className="truncate text-xs font-medium"
                        style={{ color: isActive ? "var(--accent)" : "var(--text-strong)" }}
                      >
                        {getWorkspaceBaseName(item.path)}
                      </span>
                    </div>
                    <div className="truncate pl-4 text-xs theme-muted" style={{ fontSize: "10px" }}>
                      {formatWorkspacePath(item.path)}
                    </div>
                  </button>

                  {/* ⋮ menu button */}
                  <button
                    className="relative shrink-0 rounded-sm p-1 opacity-0 group-hover:opacity-100 transition"
                    style={{ color: "var(--muted)" }}
                    onClick={(e) => {
                      e.stopPropagation();
                      setContextItem(isCtxOpen ? null : item);
                    }}
                    type="button"
                  >
                    <MoreHorizontal size={13} />
                  </button>

                  {/* Context menu */}
                  {isCtxOpen && (
                    <ContextMenu
                      item={item}
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
              className="rounded-sm px-3 py-4 text-xs theme-muted"
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
    </div>
  );
}
