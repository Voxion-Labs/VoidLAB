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
  onCreateFile: (filePath?: string, languageId?: string) => void;
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
  width?: number;
  style?: React.CSSProperties;
};

/* ── New File Modal ─────────────────────────────────────── */
function NewFileModal({
  initialName,
  folders,
  onConfirm,
  onClose,
}: {
  initialName: string;
  folders: string[];
  onConfirm: (filePath: string) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState(initialName || "new_file.py");
  const [selectedFolder, setSelectedFolder] = useState<string>("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  const handleSubmit = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const finalPath = selectedFolder
      ? `${selectedFolder}/${trimmed.replace(/^\/+/, "")}`
      : trimmed;
    onConfirm(finalPath);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="w-full max-w-sm rounded-[8px] p-5 shadow-2xl transition-colors font-sans"
        style={{
          background: "var(--panel-background)",
          border: "1px solid var(--border-strong)",
          color: "var(--text)",
        }}
      >
        <div className="flex items-center justify-between mb-4 pb-2" style={{ borderBottom: "1px solid var(--border)" }}>
          <div className="text-xs font-semibold uppercase tracking-wider theme-text-strong flex items-center gap-2 font-mono">
            <FilePlus2 size={15} style={{ color: "var(--accent)" }} />
            New File
          </div>
          <button onClick={onClose} className="theme-muted hover:opacity-100 p-1 rounded transition-opacity" type="button">
            <X size={15} />
          </button>
        </div>

        <div className="space-y-3 mb-4">
          <div>
            <label className="text-xs theme-muted mb-1 block font-mono">Location:</label>
            <select
              className="w-full rounded-[6px] px-3 py-1.5 text-xs font-mono outline-none cursor-pointer"
              style={{
                background: "var(--input-background)",
                border: "1px solid var(--border)",
                color: "var(--text)",
              }}
              value={selectedFolder}
              onChange={(e) => setSelectedFolder(e.target.value)}
            >
              <option value="">/ (project root)</option>
              {folders.map((f) => (
                <option key={f} value={f}>/{f}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs theme-muted mb-1 block font-mono">File Name / Relative Path:</label>
            <input
              ref={inputRef}
              className="w-full rounded-[6px] px-3 py-2 text-xs font-mono outline-none transition-colors"
              style={{
                background: "var(--input-background)",
                border: "1px solid var(--border)",
                color: "var(--text)",
              }}
              placeholder="e.g. index.ts or src/utils.py"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSubmit();
                if (e.key === "Escape") onClose();
              }}
            />
          </div>
        </div>

        <div className="flex gap-2 justify-end pt-2" style={{ borderTop: "1px solid var(--border)" }}>
          <button
            className="rounded-[6px] px-3 py-1.5 text-xs transition-colors"
            style={{
              background: "var(--control-background)",
              border: "1px solid var(--border)",
              color: "var(--text)",
            }}
            onClick={onClose}
            type="button"
          >
            Cancel
          </button>
          <button
            className="rounded-[6px] px-3.5 py-1.5 text-xs font-semibold transition-all shadow-sm disabled:opacity-40"
            style={{
              background: "var(--action-background)",
              color: "var(--action-foreground)",
            }}
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
  folders,
  onConfirm,
  onClose,
}: {
  folders: string[];
  onConfirm: (folderPath: string) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState("");
  const [selectedParent, setSelectedParent] = useState<string>("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSubmit = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const finalPath = selectedParent
      ? `${selectedParent}/${trimmed.replace(/^\/+/, "")}`
      : trimmed;
    onConfirm(finalPath);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="w-full max-w-sm rounded-[8px] p-5 shadow-2xl transition-colors font-sans"
        style={{
          background: "var(--panel-background)",
          border: "1px solid var(--border-strong)",
          color: "var(--text)",
        }}
      >
        <div className="flex items-center justify-between mb-4 pb-2" style={{ borderBottom: "1px solid var(--border)" }}>
          <div className="text-xs font-semibold uppercase tracking-wider theme-text-strong flex items-center gap-2 font-mono">
            <FolderPlus size={15} style={{ color: "var(--accent)" }} />
            New Folder
          </div>
          <button onClick={onClose} className="theme-muted hover:opacity-100 p-1 rounded transition-opacity" type="button">
            <X size={15} />
          </button>
        </div>

        <div className="space-y-3 mb-4">
          <div>
            <label className="text-xs theme-muted mb-1 block font-mono">Parent Folder:</label>
            <select
              className="w-full rounded-[6px] px-3 py-1.5 text-xs font-mono outline-none cursor-pointer"
              style={{
                background: "var(--input-background)",
                border: "1px solid var(--border)",
                color: "var(--text)",
              }}
              value={selectedParent}
              onChange={(e) => setSelectedParent(e.target.value)}
            >
              <option value="">/ (project root)</option>
              {folders.map((f) => (
                <option key={f} value={f}>/{f}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs theme-muted mb-1 block font-mono">Folder Name:</label>
            <input
              ref={inputRef}
              className="w-full rounded-[6px] px-3 py-2 text-xs font-mono outline-none transition-colors"
              style={{
                background: "var(--input-background)",
                border: "1px solid var(--border)",
                color: "var(--text)",
              }}
              placeholder="e.g. components or utils"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSubmit();
                if (e.key === "Escape") onClose();
              }}
            />
          </div>
        </div>

        <div className="flex gap-2 justify-end pt-2" style={{ borderTop: "1px solid var(--border)" }}>
          <button
            className="rounded-[6px] px-3 py-1.5 text-xs transition-colors"
            style={{
              background: "var(--control-background)",
              border: "1px solid var(--border)",
              color: "var(--text)",
            }}
            onClick={onClose}
            type="button"
          >
            Cancel
          </button>
          <button
            className="rounded-[6px] px-3.5 py-1.5 text-xs font-semibold transition-all shadow-sm disabled:opacity-40"
            style={{
              background: "var(--action-background)",
              color: "var(--action-foreground)",
            }}
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
  isFolder,
  onConfirm,
  onClose,
}: {
  initialName: string;
  isFolder: boolean;
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
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="w-full max-w-sm rounded-[8px] p-5 shadow-2xl transition-colors font-sans"
        style={{
          background: "var(--panel-background)",
          border: "1px solid var(--border-strong)",
          color: "var(--text)",
        }}
      >
        <div className="flex items-center justify-between mb-4 pb-2" style={{ borderBottom: "1px solid var(--border)" }}>
          <div className="text-xs font-semibold uppercase tracking-wider theme-text-strong flex items-center gap-2 font-mono">
            {isFolder ? <Folder size={15} style={{ color: "var(--accent)" }} /> : <FileCode2 size={15} style={{ color: "var(--accent)" }} />}
            Rename {isFolder ? "Folder" : "File"}
          </div>
          <button onClick={onClose} className="theme-muted hover:opacity-100 p-1 rounded transition-opacity" type="button">
            <X size={15} />
          </button>
        </div>

        <input
          ref={inputRef}
          className="w-full rounded-[6px] px-3 py-2 text-xs font-mono outline-none mb-4 transition-colors"
          style={{
            background: "var(--input-background)",
            border: "1px solid var(--border)",
            color: "var(--text)",
          }}
          placeholder="New name..."
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleSubmit();
            if (e.key === "Escape") onClose();
          }}
        />

        <div className="flex gap-2 justify-end pt-2" style={{ borderTop: "1px solid var(--border)" }}>
          <button
            className="rounded-[6px] px-3 py-1.5 text-xs transition-colors"
            style={{
              background: "var(--control-background)",
              border: "1px solid var(--border)",
              color: "var(--text)",
            }}
            onClick={onClose}
            type="button"
          >
            Cancel
          </button>
          <button
            className="rounded-[6px] px-3.5 py-1.5 text-xs font-semibold transition-all shadow-sm disabled:opacity-40"
            style={{
              background: "var(--action-background)",
              color: "var(--action-foreground)",
            }}
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

/* ── Move Modal ─────────────────────────────────────────── */
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
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="w-full max-w-sm rounded-[8px] p-5 shadow-2xl transition-colors font-sans"
        style={{
          background: "var(--panel-background)",
          border: "1px solid var(--border-strong)",
          color: "var(--text)",
        }}
      >
        <div className="flex items-center justify-between mb-4 pb-2" style={{ borderBottom: "1px solid var(--border)" }}>
          <div className="text-xs font-semibold uppercase tracking-wider theme-text-strong flex items-center gap-2 font-mono">
            <MoveRight size={15} style={{ color: "var(--accent)" }} />
            Move &quot;{label}&quot;
          </div>
          <button onClick={onClose} className="theme-muted hover:opacity-100 p-1 rounded transition-opacity" type="button">
            <X size={15} />
          </button>
        </div>

        <div className="text-xs theme-muted mb-2 font-mono">Select destination folder:</div>

        <div className="space-y-1 max-h-48 overflow-y-auto scrollbar-thin pr-1 mb-4">
          {availableFolders.map((folder) => (
            <button
              key={folder}
              className={`w-full rounded-[6px] px-3 py-1.5 text-left text-xs font-mono transition-colors ${
                selected === folder ? "font-semibold" : "opacity-80 hover:opacity-100"
              }`}
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

        <div className="flex gap-2 justify-end pt-2" style={{ borderTop: "1px solid var(--border)" }}>
          <button
            className="rounded-[6px] px-3 py-1.5 text-xs transition-colors"
            style={{
              background: "var(--control-background)",
              border: "1px solid var(--border)",
              color: "var(--text)",
            }}
            onClick={onClose}
            type="button"
          >
            Cancel
          </button>
          <button
            className="rounded-[6px] px-3.5 py-1.5 text-xs font-semibold transition-all shadow-sm disabled:opacity-40"
            style={{
              background: "var(--action-background)",
              color: "var(--action-foreground)",
            }}
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

/* ── Context Menu ───────────────────────────────────────── */
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
      className="absolute right-1 top-6 z-30 rounded-[6px] shadow-xl py-1 min-w-[130px] font-mono text-xs"
      style={{
        background: "var(--panel-background)",
        border: "1px solid var(--border-strong)",
      }}
    >
      <button
        className="flex w-full items-center gap-2 px-3 py-1.5 hover:bg-[var(--control-hover)] transition-colors text-left"
        style={{ color: "var(--text)" }}
        onClick={(e) => { e.stopPropagation(); onRename(); onClose(); }}
        type="button"
      >
        <FileCode2 size={13} style={{ color: "var(--muted)" }} />
        Rename
      </button>
      <button
        className="flex w-full items-center gap-2 px-3 py-1.5 hover:bg-[var(--control-hover)] transition-colors text-left"
        style={{ color: "var(--text)" }}
        onClick={(e) => { e.stopPropagation(); onMove(); onClose(); }}
        type="button"
      >
        <MoveRight size={13} style={{ color: "var(--muted)" }} />
        Move to…
      </button>
      <button
        className="flex w-full items-center gap-2 px-3 py-1.5 text-rose-500 hover:bg-[var(--control-hover)] transition-colors text-left"
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
  onImportFiles,
  onImportFolder,
  onMoveFile,
  onMoveFolder,
  onRenameFile,
  onRenameFolder,
  onSelectFile,
  onOpenSettings,
  currentLanguageLabel,
  width,
  style,
}: FileExplorerProps) {
  const items = buildTree(folders, files);
  const [storageLabel, setStorageLabel] = useState("local");
  const [contextItem, setContextItem] = useState<TreeItem | null>(null);
  const [moveTarget, setMoveTarget] = useState<MoveTarget>(null);
  const [renameTarget, setRenameTarget] = useState<TreeItem | null>(null);
  const [showNewFileModal, setShowNewFileModal] = useState(false);
  const [showNewFolderModal, setShowNewFolderModal] = useState(false);
  const [collapsedFolders, setCollapsedFolders] = useState<Set<string>>(new Set());

  // Drag and Drop state
  const [draggedItem, setDraggedItem] = useState<TreeItem | null>(null);
  const [dropTargetFolder, setDropTargetFolder] = useState<string | null>(null);

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

  /* ── Drag & Drop Handlers ───────────────────────────────── */
  const handleDragStart = (e: React.DragEvent, item: TreeItem) => {
    e.dataTransfer.setData("application/voidlab-item", JSON.stringify(item));
    e.dataTransfer.effectAllowed = "move";
    setDraggedItem(item);
  };

  const handleDragOver = (e: React.DragEvent, targetFolder: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (!draggedItem) return;

    // Cycle & invalid parent prevention
    if (draggedItem.kind === "folder") {
      if (targetFolder === draggedItem.path || targetFolder.startsWith(`${draggedItem.path}/`)) {
        e.dataTransfer.dropEffect = "none";
        return;
      }
      if (getWorkspaceParentPath(draggedItem.path) === targetFolder) {
        e.dataTransfer.dropEffect = "none";
        return;
      }
    } else {
      if (getWorkspaceParentPath(draggedItem.path) === targetFolder) {
        e.dataTransfer.dropEffect = "none";
        return;
      }
    }

    e.dataTransfer.dropEffect = "move";
    if (dropTargetFolder !== targetFolder) {
      setDropTargetFolder(targetFolder);
    }
  };

  const handleDragLeave = (e: React.DragEvent, targetFolder: string) => {
    e.preventDefault();
    if (dropTargetFolder === targetFolder) {
      setDropTargetFolder(null);
    }
  };

  const handleDrop = (e: React.DragEvent, targetFolder: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (!draggedItem) return;

    if (draggedItem.kind === "file") {
      if (getWorkspaceParentPath(draggedItem.path) !== targetFolder) {
        onMoveFile(draggedItem.id, targetFolder);
        if (targetFolder) {
          setCollapsedFolders((prev) => {
            const next = new Set(prev);
            next.delete(targetFolder);
            let p = getWorkspaceParentPath(targetFolder);
            while (p) {
              next.delete(p);
              p = getWorkspaceParentPath(p);
            }
            return next;
          });
        }
      }
    } else if (draggedItem.kind === "folder") {
      if (
        targetFolder !== draggedItem.path &&
        !targetFolder.startsWith(`${draggedItem.path}/`) &&
        getWorkspaceParentPath(draggedItem.path) !== targetFolder
      ) {
        onMoveFolder(draggedItem.path, targetFolder);
        if (targetFolder) {
          setCollapsedFolders((prev) => {
            const next = new Set(prev);
            next.delete(targetFolder);
            let p = getWorkspaceParentPath(targetFolder);
            while (p) {
              next.delete(p);
              p = getWorkspaceParentPath(p);
            }
            return next;
          });
        }
      }
    }

    setDraggedItem(null);
    setDropTargetFolder(null);
  };

  const handleDragEnd = () => {
    setDraggedItem(null);
    setDropTargetFolder(null);
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
    <aside
      style={{
        width: width ? `${width}px` : undefined,
        background: "var(--surface-soft)",
        borderRight: "1px solid var(--border)",
        color: "var(--text)",
        ...style,
      }}
      className={`shrink-0 flex flex-col h-full overflow-hidden select-none font-mono transition-colors ${
        !width ? "w-60" : ""
      }`}
    >
      {/* ── Explorer Header: Sleek Monochrome Action Bar ── */}
      <div
        className="h-8 px-2.5 flex items-center justify-between text-xs shrink-0 transition-colors"
        style={{
          background: "var(--surface-soft)",
          borderBottom: "1px solid var(--border)",
        }}
      >
        <span className="font-semibold tracking-wider text-[10px] uppercase font-mono theme-muted">
          Explorer
        </span>

        {/* Action Icons */}
        <div className="flex items-center gap-0.5">
          {/* New File */}
          <button
            onClick={() => setShowNewFileModal(true)}
            className="p-1 rounded opacity-70 hover:opacity-100 hover:bg-[var(--control-hover)] transition-all"
            title="New File"
            type="button"
          >
            <FilePlus2 size={13} strokeWidth={1.75} style={{ color: "var(--accent)" }} />
          </button>

          {/* New Folder */}
          <button
            onClick={() => setShowNewFolderModal(true)}
            className="p-1 rounded opacity-70 hover:opacity-100 hover:bg-[var(--control-hover)] transition-all"
            title="New Folder"
            type="button"
          >
            <FolderPlus size={13} strokeWidth={1.75} style={{ color: "var(--accent)" }} />
          </button>

          {/* Import Files */}
          <button
            onClick={onImportFiles}
            className="p-1 rounded opacity-70 hover:opacity-100 hover:bg-[var(--control-hover)] transition-all"
            title="Import Files"
            type="button"
          >
            <Upload size={13} strokeWidth={1.75} />
          </button>

          {/* Import Folder */}
          <button
            onClick={onImportFolder}
            className="p-1 rounded opacity-70 hover:opacity-100 hover:bg-[var(--control-hover)] transition-all"
            title="Import Folder"
            type="button"
          >
            <FolderTree size={13} strokeWidth={1.75} />
          </button>
        </div>
      </div>

      {/* ── File Tree (Compact, JetBrains Mono, Drag & Drop Support) ── */}
      <div
        className="scrollbar-thin flex-1 overflow-y-auto p-1 space-y-0.5 text-xs"
        onDragOver={(e) => handleDragOver(e, "")}
        onDragLeave={(e) => handleDragLeave(e, "")}
        onDrop={(e) => handleDrop(e, "")}
      >
        {visibleItems.length ? (
          visibleItems.map((item) => {
            const isFolder = item.kind === "folder";
            const isActive = item.kind === "file" && item.id === activeFileId;
            const isCollapsed = isFolder && collapsedFolders.has(item.path);
            const isCtxOpen = contextItem === item;
            const isDropTarget = isFolder && dropTargetFolder === item.path;
            const isDragging = draggedItem === item;
            const paddingLeft = 6 + item.depth * 12;

            return (
              <div
                draggable
                onDragStart={(e) => handleDragStart(e, item)}
                onDragEnd={handleDragEnd}
                onDragOver={(e) => {
                  if (isFolder) handleDragOver(e, item.path);
                }}
                onDragLeave={(e) => {
                  if (isFolder) handleDragLeave(e, item.path);
                }}
                onDrop={(e) => {
                  if (isFolder) handleDrop(e, item.path);
                }}
                className={`relative flex items-center justify-between rounded group text-left cursor-pointer transition-all duration-100 ${
                  isDragging ? "opacity-40" : ""
                } ${
                  isDropTarget
                    ? "ring-2 ring-[var(--accent)] bg-[var(--accent-soft)]"
                    : isActive
                      ? "font-medium"
                      : "opacity-80 hover:opacity-100 hover:bg-[var(--control-hover)]"
                }`}
                key={isFolder ? item.path : item.id}
                style={{
                  paddingLeft,
                  background: isActive ? "var(--control-hover)" : "transparent",
                  borderLeft: isActive ? "2px solid var(--accent)" : "2px solid transparent",
                }}
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
                        <ChevronRight size={11} className="theme-muted shrink-0" />
                      ) : (
                        <ChevronDown size={11} className="theme-muted shrink-0" />
                      )}
                      <Folder size={13} className="shrink-0" style={{ color: "var(--accent)" }} />
                    </>
                  ) : (
                    <FileCode2 size={13} className="shrink-0" style={{ color: isActive ? "var(--accent)" : "var(--muted)" }} />
                  )}
                  <span
                    className="truncate text-[11px]"
                    style={{ color: isActive ? "var(--accent-text)" : "var(--text)" }}
                  >
                    {getWorkspaceBaseName(item.path)}
                  </span>
                </button>

                {/* Context Menu Trigger */}
                <button
                  className="p-1 opacity-0 group-hover:opacity-100 rounded hover:bg-[var(--surface-strong)] transition-opacity duration-100 shrink-0 mr-1"
                  onClick={(e) => {
                    e.stopPropagation();
                    setContextItem(isCtxOpen ? null : item);
                  }}
                  title="Options"
                  type="button"
                >
                  <MoreHorizontal size={12} className="theme-muted" />
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
          <div className="py-6 px-3 text-center text-[10px] theme-muted font-mono">
            Empty workspace. Create a file or folder above.
          </div>
        )}

        {/* Drop zone indicator when dragging to root */}
        {draggedItem && (
          <div
            onDragOver={(e) => handleDragOver(e, "")}
            onDragLeave={(e) => handleDragLeave(e, "")}
            onDrop={(e) => handleDrop(e, "")}
            className={`mt-2 p-2 rounded text-center text-[10px] font-mono border border-dashed transition-all ${
              dropTargetFolder === ""
                ? "border-[var(--accent)] bg-[var(--accent-soft)] font-semibold"
                : "border-[var(--border)] opacity-60"
            }`}
            style={{ color: "var(--accent)" }}
          >
            Drop here for project root (/)
          </div>
        )}
      </div>

      {/* ── Sidebar Footer: Status & Runtime Pill ── */}
      <div
        className="h-8 px-2.5 flex items-center justify-between text-[10px] shrink-0 font-mono transition-colors"
        style={{
          background: "var(--surface-soft)",
          borderTop: "1px solid var(--border)",
          color: "var(--muted)",
        }}
      >
        <button
          onClick={onOpenSettings}
          className="flex items-center gap-1.5 hover:opacity-100 transition-opacity truncate"
          title="Storage Backend & Settings"
          type="button"
        >
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500/80" />
          <span className="truncate">{storageLabel}</span>
        </button>
        <span className="opacity-40">|</span>
        <button
          onClick={onOpenSettings}
          className="hover:opacity-100 transition-opacity truncate max-w-[80px]"
          title="Runtime Settings"
          type="button"
        >
          {currentLanguageLabel || "Runtime"}
        </button>
      </div>

      {/* ── Modals ── */}
      {showNewFileModal && (
        <NewFileModal
          folders={folders}
          initialName={draftName}
          onConfirm={(filePath) => onCreateFile(filePath)}
          onClose={() => setShowNewFileModal(false)}
        />
      )}

      {showNewFolderModal && (
        <NewFolderModal
          folders={folders}
          onConfirm={(folderPath) => onCreateFolder(folderPath)}
          onClose={() => setShowNewFolderModal(false)}
        />
      )}

      {renameTarget && (
        <RenameModal
          isFolder={renameTarget.kind === "folder"}
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
