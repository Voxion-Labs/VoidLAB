"use client";

import { useEffect, useRef, useState } from "react";
import {
  ChevronDown,
  ChevronRight,
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
import {
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
  onOpenSettings?: () => void;
  currentLanguageLabel?: string;
};

/* ── New File Modal ─────────────────────────────────────── */
function NewFileModal({
  initialName,
  onConfirm,
  onClose,
}: {
  initialName: string;
  onConfirm: (name: string) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState(initialName || "src/new_file.py");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  const handleSubmit = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    onConfirm(trimmed);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-sm rounded-lg p-5 bg-[#09090b] border border-white/10 shadow-2xl text-zinc-200">
        <div className="flex items-center justify-between mb-4 pb-2 border-b border-white/10">
          <div className="text-xs font-semibold uppercase tracking-wider text-zinc-100 flex items-center gap-2 font-mono">
            <FilePlus2 size={14} className="text-zinc-300" />
            New File
          </div>
          <button onClick={onClose} className="text-zinc-400 hover:text-white p-1 rounded transition-colors" type="button">
            <X size={14} />
          </button>
        </div>

        <div className="text-xs text-zinc-400 mb-2 font-mono">File path (relative to workspace):</div>
        <input
          ref={inputRef}
          className="w-full rounded bg-[#000000] border border-white/10 px-3 py-2 text-xs font-mono text-zinc-100 outline-none mb-4 focus:border-zinc-400 transition-colors"
          placeholder="e.g. src/index.ts"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleSubmit();
            if (e.key === "Escape") onClose();
          }}
        />

        <div className="flex gap-2 justify-end">
          <button
            className="rounded px-3 py-1.5 text-xs text-zinc-400 hover:text-white border border-white/10 hover:bg-zinc-800 transition-colors"
            onClick={onClose}
            type="button"
          >
            Cancel
          </button>
          <button
            className="rounded px-3 py-1.5 text-xs font-medium bg-zinc-100 hover:bg-white text-zinc-950 transition-colors disabled:opacity-40"
            disabled={!name.trim()}
            onClick={handleSubmit}
            type="button"
          >
            Create File
          </button>
        </div>
      </div>
    </div>
  );
}

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
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-sm rounded-lg p-5 bg-[#09090b] border border-white/10 shadow-2xl text-zinc-200">
        <div className="flex items-center justify-between mb-4 pb-2 border-b border-white/10">
          <div className="text-xs font-semibold uppercase tracking-wider text-zinc-100 flex items-center gap-2 font-mono">
            <FolderPlus size={14} className="text-zinc-300" />
            New Folder
          </div>
          <button onClick={onClose} className="text-zinc-400 hover:text-white p-1 rounded transition-colors" type="button">
            <X size={14} />
          </button>
        </div>

        <div className="text-xs text-zinc-400 mb-2 font-mono">Folder name:</div>
        <input
          ref={inputRef}
          className="w-full rounded bg-[#000000] border border-white/10 px-3 py-2 text-xs font-mono text-zinc-100 outline-none mb-4 focus:border-zinc-400 transition-colors"
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
            className="rounded px-3 py-1.5 text-xs text-zinc-400 hover:text-white border border-white/10 hover:bg-zinc-800 transition-colors"
            onClick={onClose}
            type="button"
          >
            Cancel
          </button>
          <button
            className="rounded px-3 py-1.5 text-xs font-medium bg-zinc-100 hover:bg-white text-zinc-950 transition-colors disabled:opacity-40"
            disabled={!name.trim()}
            onClick={handleSubmit}
            type="button"
          >
            Create Folder
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
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-sm rounded-lg p-5 bg-[#09090b] border border-white/10 shadow-2xl text-zinc-200">
        <div className="flex items-center justify-between mb-4 pb-2 border-b border-white/10">
          <div className="text-xs font-semibold uppercase tracking-wider text-zinc-100 flex items-center gap-2 font-mono">
            <FileCode2 size={14} className="text-zinc-300" />
            Rename
          </div>
          <button onClick={onClose} className="text-zinc-400 hover:text-white p-1 rounded transition-colors" type="button">
            <X size={14} />
          </button>
        </div>

        <input
          ref={inputRef}
          className="w-full rounded bg-[#000000] border border-white/10 px-3 py-2 text-xs font-mono text-zinc-100 outline-none mb-4 focus:border-zinc-400 transition-colors"
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
            className="rounded px-3 py-1.5 text-xs text-zinc-400 hover:text-white border border-white/10 hover:bg-zinc-800 transition-colors"
            onClick={onClose}
            type="button"
          >
            Cancel
          </button>
          <button
            className="rounded px-3 py-1.5 text-xs font-medium bg-zinc-100 hover:bg-white text-zinc-950 transition-colors disabled:opacity-40"
            disabled={!name.trim() || name.trim() === initialName}
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

  const label = getWorkspaceBaseName(target.path);
  const availableFolders = ["(root)", ...folders.filter((f) =>
    f !== target.path && !f.startsWith(`${target.path}/`)
  )];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-sm rounded-lg p-5 bg-[#09090b] border border-white/10 shadow-2xl text-zinc-200">
        <div className="flex items-center justify-between mb-4 pb-2 border-b border-white/10">
          <div className="text-xs font-semibold uppercase tracking-wider text-zinc-100 flex items-center gap-2 font-mono">
            <MoveRight size={14} className="text-zinc-300" />
            Move &quot;{label}&quot;
          </div>
          <button onClick={onClose} className="text-zinc-400 hover:text-white p-1 rounded transition-colors" type="button">
            <X size={14} />
          </button>
        </div>

        <div className="text-xs text-zinc-400 mb-2 font-mono">Select destination folder:</div>

        <div className="space-y-1 max-h-48 overflow-y-auto scrollbar-thin pr-1 mb-4">
          {availableFolders.map((folder) => (
            <button
              key={folder}
              className={`w-full rounded px-3 py-1.5 text-left text-xs font-mono transition-colors ${
                selected === folder
                  ? "bg-zinc-800 text-zinc-100 border border-zinc-500"
                  : "bg-black/50 text-zinc-400 border border-white/5 hover:bg-zinc-900 hover:text-zinc-200"
              }`}
              onClick={() => setSelected(folder)}
              type="button"
            >
              {folder === "(root)" ? "/ (project root)" : `/${folder}`}
            </button>
          ))}
        </div>

        <div className="flex gap-2 justify-end">
          <button
            className="rounded px-3 py-1.5 text-xs text-zinc-400 hover:text-white border border-white/10 hover:bg-zinc-800 transition-colors"
            onClick={onClose}
            type="button"
          >
            Cancel
          </button>
          <button
            className="rounded px-3 py-1.5 text-xs font-medium bg-zinc-100 hover:bg-white text-zinc-950 transition-colors disabled:opacity-40"
            disabled={!selected}
            onClick={() => { if (selected) { onMove(selected === "(root)" ? "" : selected); onClose(); } }}
            type="button"
          >
            Move Here
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Context menu ───────────────────────────────────────── */
function ContextMenu({
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
      className="absolute right-1 top-6 z-30 rounded border border-white/10 bg-[#09090b] shadow-xl py-1 min-w-[130px] font-mono text-xs"
    >
      <button
        className="flex w-full items-center gap-2 px-3 py-1.5 text-zinc-300 hover:text-white hover:bg-zinc-800 transition-colors text-left"
        onClick={(e) => { e.stopPropagation(); onRename(); onClose(); }}
        type="button"
      >
        <FileCode2 size={13} className="text-zinc-400" />
        Rename
      </button>
      <button
        className="flex w-full items-center gap-2 px-3 py-1.5 text-zinc-300 hover:text-white hover:bg-zinc-800 transition-colors text-left"
        onClick={(e) => { e.stopPropagation(); onMove(); onClose(); }}
        type="button"
      >
        <MoveRight size={13} className="text-zinc-400" />
        Move to…
      </button>
      <button
        className="flex w-full items-center gap-2 px-3 py-1.5 text-rose-400 hover:text-rose-300 hover:bg-zinc-800 transition-colors text-left"
        onClick={(e) => { e.stopPropagation(); onDelete(); onClose(); }}
        type="button"
      >
        <Trash2 size={13} />
        Delete
      </button>
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

export default function FileExplorer({
  activeFileId,
  draftName,
  files,
  folders,
  onCreateFile,
  onCreateFolder,
  onDeleteFile,
  onDeleteFolder,
  onDraftNameChange,
  onImportFiles,
  onImportFolder,
  onMoveFile,
  onMoveFolder,
  onRenameFile,
  onRenameFolder,
  onSelectFile,
  onOpenSettings,
  currentLanguageLabel,
}: FileExplorerProps) {
  const items = buildTree(folders, files);
  const [storageLabel, setStorageLabel] = useState("local");
  const [contextItem, setContextItem] = useState<TreeItem | null>(null);
  const [moveTarget, setMoveTarget] = useState<MoveTarget>(null);
  const [renameTarget, setRenameTarget] = useState<TreeItem | null>(null);
  const [showNewFileModal, setShowNewFileModal] = useState(false);
  const [showNewFolderModal, setShowNewFolderModal] = useState(false);
  const [collapsedFolders, setCollapsedFolders] = useState<Set<string>>(new Set());

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

  const toggleFolder = (folderPath: string) => {
    setCollapsedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(folderPath)) next.delete(folderPath);
      else next.add(folderPath);
      return next;
    });
  };

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

  // Filter items based on collapsed folders
  const visibleItems = items.filter((item) => {
    let parent = getWorkspaceParentPath(item.path);
    while (parent) {
      if (collapsedFolders.has(parent)) return false;
      parent = getWorkspaceParentPath(parent);
    }
    return true;
  });

  return (
    <aside className="w-56 shrink-0 border-r border-white/10 bg-[#09090b] flex flex-col h-full overflow-hidden select-none font-mono">
      {/* ── Explorer Header: Sleek Monochrome Action Bar ── */}
      <div className="h-8 px-2.5 border-b border-white/10 flex items-center justify-between text-xs text-zinc-400 shrink-0 bg-[#000000]">
        <span className="font-semibold tracking-wider text-[10px] uppercase text-zinc-400 font-mono">
          Explorer
        </span>

        {/* Sleek Monochrome Icon Actions */}
        <div className="flex items-center gap-0.5">
          {/* New File */}
          <button
            onClick={() => setShowNewFileModal(true)}
            className="p-1 text-zinc-400 hover:text-white hover:bg-zinc-800/80 rounded transition-colors duration-100"
            title="New File"
            type="button"
          >
            <FilePlus2 size={13} strokeWidth={1.75} />
          </button>

          {/* New Folder */}
          <button
            onClick={() => setShowNewFolderModal(true)}
            className="p-1 text-zinc-400 hover:text-white hover:bg-zinc-800/80 rounded transition-colors duration-100"
            title="New Folder"
            type="button"
          >
            <FolderPlus size={13} strokeWidth={1.75} />
          </button>

          {/* Import Files */}
          <button
            onClick={onImportFiles}
            className="p-1 text-zinc-400 hover:text-white hover:bg-zinc-800/80 rounded transition-colors duration-100"
            title="Import Files"
            type="button"
          >
            <Upload size={13} strokeWidth={1.75} />
          </button>

          {/* Import Folder */}
          <button
            onClick={onImportFolder}
            className="p-1 text-zinc-400 hover:text-white hover:bg-zinc-800/80 rounded transition-colors duration-100"
            title="Import Folder"
            type="button"
          >
            <FolderTree size={13} strokeWidth={1.75} />
          </button>
        </div>
      </div>

      {/* ── File Tree (Compact, JetBrains Mono, Fast Hover) ── */}
      <div className="scrollbar-thin flex-1 overflow-y-auto p-1 space-y-0.5 text-xs">
        {visibleItems.length ? (
          visibleItems.map((item) => {
            const isFolder = item.kind === "folder";
            const isActive = item.kind === "file" && item.id === activeFileId;
            const isCollapsed = isFolder && collapsedFolders.has(item.path);
            const isCtxOpen = contextItem === item;
            const paddingLeft = 6 + item.depth * 12;

            return (
              <div
                className={`relative flex items-center justify-between rounded group text-left transition-colors duration-100 ${
                  isActive
                    ? "bg-zinc-800/70 text-zinc-100 border-l-2 border-zinc-200 font-medium"
                    : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/30"
                }`}
                key={isFolder ? item.path : item.id}
                style={{ paddingLeft }}
              >
                {/* Main clickable button */}
                <button
                  className="min-w-0 flex-1 py-1 pr-1 flex items-center gap-1.5 truncate text-left"
                  onClick={() => {
                    if (isFolder) toggleFolder(item.path);
                    else onSelectFile((item as { id: string }).id);
                  }}
                  type="button"
                >
                  {isFolder ? (
                    <>
                      {isCollapsed ? (
                        <ChevronRight size={11} className="text-zinc-500 shrink-0" />
                      ) : (
                        <ChevronDown size={11} className="text-zinc-500 shrink-0" />
                      )}
                      <Folder size={13} className="text-zinc-400 shrink-0 group-hover:text-zinc-200 transition-colors" />
                    </>
                  ) : (
                    <FileCode2 size={13} className={`shrink-0 ${isActive ? "text-zinc-200" : "text-zinc-500"}`} />
                  )}
                  <span className="truncate text-[11px]">
                    {getWorkspaceBaseName(item.path)}
                  </span>
                </button>

                {/* Context Menu Trigger */}
                <button
                  className="p-1 opacity-0 group-hover:opacity-100 hover:bg-zinc-800 rounded text-zinc-400 hover:text-white transition-opacity duration-100 shrink-0 mr-1"
                  onClick={(e) => {
                    e.stopPropagation();
                    setContextItem(isCtxOpen ? null : item);
                  }}
                  title="Options"
                  type="button"
                >
                  <MoreHorizontal size={12} />
                </button>

                {/* Context menu popup */}
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
          <div className="py-6 px-3 text-center text-[10px] text-zinc-600 font-mono">
            Empty workspace. Create a file or folder above.
          </div>
        )}
      </div>

      {/* ── Sidebar Footer: Status & Runtime Pill ── */}
      <div className="h-8 px-2.5 border-t border-white/10 bg-[#000000] flex items-center justify-between text-[10px] text-zinc-500 shrink-0 font-mono">
        <button
          onClick={onOpenSettings}
          className="flex items-center gap-1.5 hover:text-zinc-300 transition-colors truncate"
          title="Storage Backend & Settings"
          type="button"
        >
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500/80" />
          <span className="truncate">{storageLabel}</span>
        </button>
        <span className="text-zinc-700">|</span>
        <button
          onClick={onOpenSettings}
          className="hover:text-zinc-300 transition-colors text-zinc-400 truncate max-w-[80px]"
          title="Runtime Settings"
          type="button"
        >
          {currentLanguageLabel || "Runtime"}
        </button>
      </div>

      {/* ── Modals ── */}
      {showNewFileModal && (
        <NewFileModal
          initialName={draftName}
          onConfirm={(name) => {
            onDraftNameChange(name);
            onCreateFile();
          }}
          onClose={() => setShowNewFileModal(false)}
        />
      )}

      {showNewFolderModal && (
        <NewFolderModal
          onConfirm={(folderName) => onCreateFolder(folderName)}
          onClose={() => setShowNewFolderModal(false)}
        />
      )}

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

      {moveTarget && (
        <MoveModal
          target={moveTarget}
          folders={folders}
          onMove={handleMove}
          onClose={() => setMoveTarget(null)}
        />
      )}
    </aside>
  );
}
