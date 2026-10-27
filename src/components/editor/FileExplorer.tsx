"use client";

import { useEffect, useRef, useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  Copy,
  Edit3,
  FileCode2,
  FilePlus2,
  FileText,
  FolderPlus,
  FolderTree,
  GitBranch,
  Image as ImageIcon,
  Info,
  MoreHorizontal,
  MoveRight,
  RefreshCw,
  SlidersHorizontal,
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
  onDuplicateFile?: (fileId: string) => void;
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

/* ── Realistic VS-Code Style File Icon ───────────────────────── */
function FileIcon({ path }: { path: string }) {
  const fileName = getWorkspaceBaseName(path).toLowerCase();

  // Special config & documentation files
  if (fileName.startsWith(".env")) {
    return <SlidersHorizontal size={13} className="text-zinc-400 shrink-0" />;
  }
  if (fileName === ".gitignore" || fileName.startsWith(".git")) {
    return <GitBranch size={13} className="text-teal-400 shrink-0" />;
  }
  if (fileName === "readme.md" || fileName.endsWith(".md")) {
    return <Info size={13} className="text-sky-400 shrink-0" />;
  }
  if (fileName === "contributing.md") {
    return <Info size={13} className="text-rose-400 shrink-0" />;
  }
  if (fileName === "license" || fileName === "license.md") {
    return <span className="text-xs text-amber-400 font-bold shrink-0 leading-none">§</span>;
  }

  // React TSX/JSX (Cyan Atom Icon)
  if (fileName.endsWith(".tsx") || fileName.endsWith(".jsx")) {
    return (
      <svg className="w-3.5 h-3.5 shrink-0 text-cyan-400" viewBox="0 0 115.3 100" fill="currentColor">
        <ellipse cx="57.65" cy="50" rx="16.7" ry="49.5" fill="none" stroke="currentColor" strokeWidth="6" transform="rotate(30 57.65 50)" />
        <ellipse cx="57.65" cy="50" rx="16.7" ry="49.5" fill="none" stroke="currentColor" strokeWidth="6" transform="rotate(90 57.65 50)" />
        <ellipse cx="57.65" cy="50" rx="16.7" ry="49.5" fill="none" stroke="currentColor" strokeWidth="6" transform="rotate(150 57.65 50)" />
        <circle cx="57.65" cy="50" r="10" fill="currentColor" />
      </svg>
    );
  }

  // TypeScript (Blue TS Badge)
  if (fileName.endsWith(".ts")) {
    return (
      <span className="w-3.5 h-3.5 flex items-center justify-center text-[8.5px] font-bold rounded-[2px] bg-[#3178c6] text-white shrink-0 select-none">
        TS
      </span>
    );
  }

  // JavaScript (Yellow JS Badge)
  if (fileName.endsWith(".js") || fileName.endsWith(".mjs") || fileName.endsWith(".cjs")) {
    return (
      <span className="w-3.5 h-3.5 flex items-center justify-center text-[8.5px] font-black rounded-[2px] bg-[#f7df1e] text-black shrink-0 select-none">
        JS
      </span>
    );
  }

  // JSON (Golden {} Brackets)
  if (fileName.endsWith(".json")) {
    return (
      <span className="w-3.5 text-center text-xs font-bold text-amber-400 shrink-0 font-mono select-none leading-none">
        {"{}"}
      </span>
    );
  }

  // CSS / SCSS (Sky Blue # Hash)
  if (fileName.endsWith(".css") || fileName.endsWith(".scss") || fileName.endsWith(".sass")) {
    return (
      <span className="w-3.5 text-center text-xs font-bold text-sky-400 shrink-0 select-none leading-none">
        #
      </span>
    );
  }

  // Images & SVGs (Purple Icon)
  if (
    fileName.endsWith(".svg") ||
    fileName.endsWith(".png") ||
    fileName.endsWith(".jpg") ||
    fileName.endsWith(".jpeg") ||
    fileName.endsWith(".ico")
  ) {
    return <ImageIcon size={13} className="text-purple-400 shrink-0" />;
  }

  // C / C++ (Blue C++ Badge)
  if (
    fileName.endsWith(".cpp") ||
    fileName.endsWith(".cc") ||
    fileName.endsWith(".cxx") ||
    fileName.endsWith(".c") ||
    fileName.endsWith(".h") ||
    fileName.endsWith(".hpp")
  ) {
    return (
      <span className="px-0.5 py-[0.5px] text-[7.5px] font-bold rounded-[2px] bg-[#00599c] text-white shrink-0 select-none leading-none">
        C++
      </span>
    );
  }

  // Python (Blue-Amber PY Badge)
  if (fileName.endsWith(".py")) {
    return (
      <span className="px-0.5 py-[0.5px] text-[8px] font-bold rounded-[2px] bg-gradient-to-r from-blue-500 to-amber-400 text-white shrink-0 select-none leading-none">
        PY
      </span>
    );
  }

  // HTML (Orange <> Brackets)
  if (fileName.endsWith(".html") || fileName.endsWith(".htm")) {
    return (
      <span className="w-3.5 text-center text-xs font-bold text-orange-500 shrink-0 select-none leading-none">
        &lt;&gt;
      </span>
    );
  }

  // Generic Code File
  return <FileText size={13} className="text-zinc-400 shrink-0" />;
}

/* ── New File Modal ─────────────────────────────────────── */
function NewFileModal({
  initialName,
  initialFolder = "",
  folders,
  onConfirm,
  onClose,
}: {
  initialName: string;
  initialFolder?: string;
  folders: string[];
  onConfirm: (filePath: string) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState(initialName || "index.ts");
  const [selectedFolder, setSelectedFolder] = useState<string>(initialFolder);
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
        className="w-full max-w-sm rounded-xl p-5 shadow-2xl transition-colors font-sans"
        style={{
          background: "var(--panel-background)",
          border: "1px solid var(--border-strong)",
          color: "var(--text)",
        }}
      >
        <div className="flex items-center justify-between mb-4 pb-2" style={{ borderBottom: "1px solid var(--border)" }}>
          <div className="text-xs font-semibold uppercase tracking-wider flex items-center gap-2" style={{ color: "var(--text-strong)" }}>
            <FilePlus2 size={15} style={{ color: "var(--accent)" }} />
            New File
          </div>
          <button onClick={onClose} className="p-1 rounded opacity-70 hover:opacity-100 transition-opacity" type="button">
            <X size={15} />
          </button>
        </div>

        <div className="space-y-3 mb-4 text-xs">
          <div>
            <label className="text-[11px] mb-1 block" style={{ color: "var(--muted)" }}>Destination Folder:</label>
            <select
              className="w-full rounded-md px-3 py-1.5 text-xs outline-none cursor-pointer transition-colors"
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
            <label className="text-[11px] mb-1 block" style={{ color: "var(--muted)" }}>File Name (with extension):</label>
            <input
              ref={inputRef}
              className="w-full rounded-md px-3 py-2 text-xs outline-none transition-colors"
              style={{
                background: "var(--input-background)",
                border: "1px solid var(--border)",
                color: "var(--text)",
              }}
              placeholder="e.g. main.py or utils.ts"
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
            className="rounded-md px-3 py-1.5 text-xs font-medium transition-colors"
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
            className="rounded-md px-3.5 py-1.5 text-xs font-semibold shadow-sm transition-all disabled:opacity-40"
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
  initialParent = "",
  folders,
  onConfirm,
  onClose,
}: {
  initialParent?: string;
  folders: string[];
  onConfirm: (folderPath: string) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState("");
  const [selectedParent, setSelectedParent] = useState<string>(initialParent);
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
        className="w-full max-w-sm rounded-xl p-5 shadow-2xl transition-colors font-sans"
        style={{
          background: "var(--panel-background)",
          border: "1px solid var(--border-strong)",
          color: "var(--text)",
        }}
      >
        <div className="flex items-center justify-between mb-4 pb-2" style={{ borderBottom: "1px solid var(--border)" }}>
          <div className="text-xs font-semibold uppercase tracking-wider flex items-center gap-2" style={{ color: "var(--text-strong)" }}>
            <FolderPlus size={15} style={{ color: "var(--accent)" }} />
            New Folder
          </div>
          <button onClick={onClose} className="p-1 rounded opacity-70 hover:opacity-100 transition-opacity" type="button">
            <X size={15} />
          </button>
        </div>

        <div className="space-y-3 mb-4 text-xs">
          <div>
            <label className="text-[11px] mb-1 block" style={{ color: "var(--muted)" }}>Parent Folder:</label>
            <select
              className="w-full rounded-md px-3 py-1.5 text-xs outline-none cursor-pointer transition-colors"
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
            <label className="text-[11px] mb-1 block" style={{ color: "var(--muted)" }}>Folder Name:</label>
            <input
              ref={inputRef}
              className="w-full rounded-md px-3 py-2 text-xs outline-none transition-colors"
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
            className="rounded-md px-3 py-1.5 text-xs font-medium transition-colors"
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
            className="rounded-md px-3.5 py-1.5 text-xs font-semibold shadow-sm transition-all disabled:opacity-40"
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
        className="w-full max-w-sm rounded-xl p-5 shadow-2xl transition-colors font-sans"
        style={{
          background: "var(--panel-background)",
          border: "1px solid var(--border-strong)",
          color: "var(--text)",
        }}
      >
        <div className="flex items-center justify-between mb-4 pb-2" style={{ borderBottom: "1px solid var(--border)" }}>
          <div className="text-xs font-semibold uppercase tracking-wider flex items-center gap-2" style={{ color: "var(--text-strong)" }}>
            <Edit3 size={15} style={{ color: "var(--accent)" }} />
            Rename {isFolder ? "Folder" : "File"}
          </div>
          <button onClick={onClose} className="p-1 rounded opacity-70 hover:opacity-100 transition-opacity" type="button">
            <X size={15} />
          </button>
        </div>

        <input
          ref={inputRef}
          className="w-full rounded-md px-3 py-2 text-xs outline-none mb-4 transition-colors"
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
            className="rounded-md px-3 py-1.5 text-xs font-medium transition-colors"
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
            className="rounded-md px-3.5 py-1.5 text-xs font-semibold shadow-sm transition-all disabled:opacity-40"
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
        className="w-full max-w-sm rounded-xl p-5 shadow-2xl transition-colors font-sans"
        style={{
          background: "var(--panel-background)",
          border: "1px solid var(--border-strong)",
          color: "var(--text)",
        }}
      >
        <div className="flex items-center justify-between mb-4 pb-2" style={{ borderBottom: "1px solid var(--border)" }}>
          <div className="text-xs font-semibold uppercase tracking-wider flex items-center gap-2" style={{ color: "var(--text-strong)" }}>
            <MoveRight size={15} style={{ color: "var(--accent)" }} />
            Move &quot;{label}&quot;
          </div>
          <button onClick={onClose} className="p-1 rounded opacity-70 hover:opacity-100 transition-opacity" type="button">
            <X size={15} />
          </button>
        </div>

        <div className="text-xs mb-2" style={{ color: "var(--muted)" }}>Select destination folder:</div>

        <div className="space-y-1 max-h-48 overflow-y-auto scrollbar-thin pr-1 mb-4">
          {availableFolders.map((folder) => (
            <button
              key={folder}
              className={`w-full rounded-md px-3 py-1.5 text-left text-xs font-sans transition-colors ${
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
            className="rounded-md px-3 py-1.5 text-xs font-medium transition-colors"
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
            className="rounded-md px-3.5 py-1.5 text-xs font-semibold shadow-sm transition-all disabled:opacity-40"
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
  onDuplicateFile,
  onImportFiles,
  onImportFolder,
  onMoveFile,
  onMoveFolder,
  onRenameFile,
  onRenameFolder,
  onSelectFile,
  width,
  style,
}: FileExplorerProps) {
  const items = buildTree(folders, files);
  const [, setStorageLabel] = useState("local");
  const [moveTarget, setMoveTarget] = useState<MoveTarget>(null);
  const [renameTarget, setRenameTarget] = useState<TreeItem | null>(null);
  const [showNewFileModal, setShowNewFileModal] = useState(false);
  const [initialFolderForNewFile, setInitialFolderForNewFile] = useState("");
  const [showNewFolderModal, setShowNewFolderModal] = useState(false);
  const [initialFolderForNewFolder, setInitialFolderForNewFolder] = useState("");
  const [collapsedFolders, setCollapsedFolders] = useState<Set<string>>(new Set());

  // Floating Context / 3-Dots Menu State (Positioned via Fixed Coordinates to Prevent Overflow Clipping)
  const [floatingMenu, setFloatingMenu] = useState<{
    item: TreeItem;
    x: number;
    y: number;
  } | null>(null);

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

  const collapseAll = () => {
    setCollapsedFolders(new Set(folders));
  };

  const expandAll = () => {
    setCollapsedFolders(new Set());
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

  // Open 3-dots / context menu at button position or click position
  const handleOpenMenu = (e: React.MouseEvent, item: TreeItem) => {
    e.preventDefault();
    e.stopPropagation();

    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const x = Math.min(window.innerWidth - 180, Math.max(10, rect.right > 0 && rect.right < window.innerWidth ? rect.right - 20 : e.clientX));
    const y = Math.min(window.innerHeight - 240, Math.max(10, rect.bottom > 0 ? rect.bottom + 4 : e.clientY));

    setFloatingMenu({ item, x, y });
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
      className={`shrink-0 flex flex-col h-full overflow-hidden select-none font-sans transition-colors ${
        !width ? "w-60" : ""
      }`}
    >
      {/* ── Explorer Header: VS Code Minimal Aesthetic ── */}
      <div
        className="h-9 px-3 flex items-center justify-between text-xs shrink-0 select-none transition-colors"
        style={{
          background: "var(--surface-soft)",
          borderBottom: "1px solid var(--border)",
        }}
      >
        <span
          className="font-bold tracking-wider text-[11px] uppercase font-sans"
          style={{ color: "var(--text-strong)" }}
        >
          Explorer
        </span>

        {/* Action Icons */}
        <div className="flex items-center gap-1">
          {/* New File */}
          <button
            onClick={() => {
              setInitialFolderForNewFile("");
              setShowNewFileModal(true);
            }}
            className="p-1 rounded opacity-75 hover:opacity-100 hover:bg-[var(--control-hover)] transition-all"
            title="New File (Root)"
            type="button"
          >
            <FilePlus2 size={14} style={{ color: "var(--accent)" }} />
          </button>

          {/* New Folder */}
          <button
            onClick={() => {
              setInitialFolderForNewFolder("");
              setShowNewFolderModal(true);
            }}
            className="p-1 rounded opacity-75 hover:opacity-100 hover:bg-[var(--control-hover)] transition-all"
            title="New Folder (Root)"
            type="button"
          >
            <FolderPlus size={14} style={{ color: "var(--accent)" }} />
          </button>

          {/* Import Files */}
          <button
            onClick={onImportFiles}
            className="p-1 rounded opacity-70 hover:opacity-100 hover:bg-[var(--control-hover)] transition-all"
            title="Import Files"
            type="button"
          >
            <Upload size={13} />
          </button>

          {/* Import Folder */}
          <button
            onClick={onImportFolder}
            className="p-1 rounded opacity-70 hover:opacity-100 hover:bg-[var(--control-hover)] transition-all"
            title="Import Folder"
            type="button"
          >
            <FolderTree size={13} />
          </button>

          {/* Toggle Folders (Collapse / Expand) */}
          <button
            onClick={() => (collapsedFolders.size > 0 ? expandAll() : collapseAll())}
            className="p-1 rounded opacity-70 hover:opacity-100 hover:bg-[var(--control-hover)] transition-all"
            title={collapsedFolders.size > 0 ? "Expand All" : "Collapse All"}
            type="button"
          >
            <RefreshCw size={12} />
          </button>
        </div>
      </div>

      {/* ── File Tree (VS Code Look, Clean Chevrons, Tree Lines, Drag & Drop) ── */}
      <div
        className="scrollbar-thin flex-1 overflow-y-auto py-1 text-[13px] font-sans"
        onDragOver={(e) => handleDragOver(e, "")}
        onDragLeave={(e) => handleDragLeave(e, "")}
        onDrop={(e) => handleDrop(e, "")}
      >
        {visibleItems.length ? (
          visibleItems.map((item) => {
            const isFolder = item.kind === "folder";
            const isActive = item.kind === "file" && item.id === activeFileId;
            const isCollapsed = isFolder && collapsedFolders.has(item.path);
            const isDropTarget = isFolder && dropTargetFolder === item.path;
            const isDragging = draggedItem === item;
            const indentPadding = 8 + item.depth * 14;

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
                onContextMenu={(e) => handleOpenMenu(e, item)}
                className={`relative flex items-center justify-between group cursor-pointer h-[26px] pr-2 transition-colors duration-75 select-none ${
                  isDragging ? "opacity-30" : ""
                } ${
                  isDropTarget
                    ? "ring-1 ring-[var(--accent)] bg-[var(--accent-soft)]"
                    : isActive
                      ? "font-medium"
                      : "hover:bg-[var(--control-hover)]"
                }`}
                key={isFolder ? item.path : item.id}
                style={{
                  paddingLeft: `${indentPadding}px`,
                  background: isActive ? "var(--accent-soft)" : undefined,
                  borderLeft: isActive ? "2px solid var(--accent)" : "2px solid transparent",
                }}
              >
                {/* Visual Tree Indentation Line (VS Code style) */}
                {Array.from({ length: item.depth }).map((_, i) => (
                  <span
                    key={i}
                    className="absolute top-0 bottom-0 pointer-events-none"
                    style={{
                      left: `${14 + i * 14}px`,
                      borderLeft: "1px solid var(--border)",
                      opacity: 0.6,
                    }}
                  />
                ))}

                {/* Main clickable item */}
                <button
                  className="min-w-0 flex-1 h-full flex items-center gap-1.5 truncate text-left focus:outline-none"
                  onClick={() => {
                    if (isFolder) toggleFolder(item.path);
                    else onSelectFile((item as { id: string }).id);
                  }}
                  onDoubleClick={(e) => {
                    e.preventDefault();
                    if (isFolder) toggleFolder(item.path);
                    else onSelectFile((item as { id: string }).id);
                  }}
                  type="button"
                >
                  {isFolder ? (
                    // Sleek Chevron Only - Exactly matching Screenshot 2!
                    <span className="w-4 h-4 flex items-center justify-center shrink-0">
                      {isCollapsed ? (
                        <ChevronRight size={13} className="opacity-70 group-hover:opacity-100 transition-transform" />
                      ) : (
                        <ChevronDown size={13} className="opacity-80 group-hover:opacity-100 transition-transform" />
                      )}
                    </span>
                  ) : (
                    // File Type Icon - Exactly matching Screenshot 2!
                    <span className="w-4 h-4 flex items-center justify-center shrink-0">
                      <FileIcon path={item.path} />
                    </span>
                  )}

                  {/* File / Folder Label */}
                  <span
                    className="truncate text-[13px] font-sans tracking-normal"
                    style={{
                      color: isActive ? "var(--text-strong)" : "var(--text)",
                      fontWeight: isActive ? 600 : isFolder ? 500 : 400,
                    }}
                  >
                    {getWorkspaceBaseName(item.path)}
                  </span>
                </button>

                {/* 3-Dots Action Button (Always available on hover, or click) */}
                <button
                  className="p-1 opacity-0 group-hover:opacity-100 rounded hover:bg-[var(--control-hover)] transition-opacity duration-100 shrink-0 ml-1"
                  onClick={(e) => handleOpenMenu(e, item)}
                  title="File & Folder Actions"
                  type="button"
                >
                  <MoreHorizontal size={13} style={{ color: "var(--muted)" }} />
                </button>
              </div>
            );
          })
        ) : (
          <div className="py-8 px-4 text-center text-xs theme-muted font-sans">
            Workspace is empty. Create a file or folder above.
          </div>
        )}
      </div>

      {/* ── Fixed 3-Dots / Context Menu (Never Clipped by Scroll Container) ── */}
      {floatingMenu && (
        <div
          className="fixed inset-0 z-50 select-none"
          onClick={() => setFloatingMenu(null)}
          onContextMenu={(e) => {
            e.preventDefault();
            setFloatingMenu(null);
          }}
        >
          <div
            style={{
              left: `${floatingMenu.x}px`,
              top: `${floatingMenu.y}px`,
              background: "var(--panel-background)",
              border: "1px solid var(--border-strong)",
              boxShadow: "0 10px 30px rgba(0,0,0,0.35)",
            }}
            className="fixed z-50 min-w-[170px] rounded-lg p-1 font-sans text-xs shadow-2xl animate-in fade-in zoom-in-95 duration-75"
            onClick={(e) => e.stopPropagation()}
          >
            {floatingMenu.item.kind === "folder" ? (
              <>
                <button
                  onClick={() => {
                    setInitialFolderForNewFile(floatingMenu.item.path);
                    setShowNewFileModal(true);
                    setFloatingMenu(null);
                  }}
                  className="flex w-full items-center gap-2.5 px-3 py-1.5 rounded-md hover:bg-[var(--control-hover)] text-left transition-colors"
                  style={{ color: "var(--text)" }}
                  type="button"
                >
                  <FilePlus2 size={13} style={{ color: "var(--accent)" }} />
                  <span>New File...</span>
                </button>
                <button
                  onClick={() => {
                    setInitialFolderForNewFolder(floatingMenu.item.path);
                    setShowNewFolderModal(true);
                    setFloatingMenu(null);
                  }}
                  className="flex w-full items-center gap-2.5 px-3 py-1.5 rounded-md hover:bg-[var(--control-hover)] text-left transition-colors"
                  style={{ color: "var(--text)" }}
                  type="button"
                >
                  <FolderPlus size={13} style={{ color: "var(--accent)" }} />
                  <span>New Subfolder...</span>
                </button>
                <div className="h-px my-1" style={{ background: "var(--border)" }} />
                <button
                  onClick={() => {
                    setRenameTarget(floatingMenu.item);
                    setFloatingMenu(null);
                  }}
                  className="flex w-full items-center gap-2.5 px-3 py-1.5 rounded-md hover:bg-[var(--control-hover)] text-left transition-colors"
                  style={{ color: "var(--text)" }}
                  type="button"
                >
                  <Edit3 size={13} style={{ color: "var(--muted)" }} />
                  <span>Rename</span>
                </button>
                <button
                  onClick={() => {
                    openMove(floatingMenu.item);
                    setFloatingMenu(null);
                  }}
                  className="flex w-full items-center gap-2.5 px-3 py-1.5 rounded-md hover:bg-[var(--control-hover)] text-left transition-colors"
                  style={{ color: "var(--text)" }}
                  type="button"
                >
                  <MoveRight size={13} style={{ color: "var(--muted)" }} />
                  <span>Move to...</span>
                </button>
                <div className="h-px my-1" style={{ background: "var(--border)" }} />
                <button
                  onClick={() => {
                    onDeleteFolder(floatingMenu.item.path);
                    setFloatingMenu(null);
                  }}
                  className="flex w-full items-center gap-2.5 px-3 py-1.5 rounded-md text-rose-500 hover:bg-rose-500/10 text-left transition-colors"
                  type="button"
                >
                  <Trash2 size={13} />
                  <span>Delete Folder</span>
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => {
                    onSelectFile((floatingMenu.item as { id: string }).id);
                    setFloatingMenu(null);
                  }}
                  className="flex w-full items-center gap-2.5 px-3 py-1.5 rounded-md hover:bg-[var(--control-hover)] text-left transition-colors"
                  style={{ color: "var(--text)" }}
                  type="button"
                >
                  <FileCode2 size={13} style={{ color: "var(--accent)" }} />
                  <span>Open</span>
                </button>
                {onDuplicateFile && (
                  <button
                    onClick={() => {
                      onDuplicateFile((floatingMenu.item as { id: string }).id);
                      setFloatingMenu(null);
                    }}
                    className="flex w-full items-center gap-2.5 px-3 py-1.5 rounded-md hover:bg-[var(--control-hover)] text-left transition-colors"
                    style={{ color: "var(--text)" }}
                    type="button"
                  >
                    <Copy size={13} style={{ color: "var(--muted)" }} />
                    <span>Duplicate</span>
                  </button>
                )}
                <div className="h-px my-1" style={{ background: "var(--border)" }} />
                <button
                  onClick={() => {
                    setRenameTarget(floatingMenu.item);
                    setFloatingMenu(null);
                  }}
                  className="flex w-full items-center gap-2.5 px-3 py-1.5 rounded-md hover:bg-[var(--control-hover)] text-left transition-colors"
                  style={{ color: "var(--text)" }}
                  type="button"
                >
                  <Edit3 size={13} style={{ color: "var(--muted)" }} />
                  <span>Rename</span>
                </button>
                <button
                  onClick={() => {
                    openMove(floatingMenu.item);
                    setFloatingMenu(null);
                  }}
                  className="flex w-full items-center gap-2.5 px-3 py-1.5 rounded-md hover:bg-[var(--control-hover)] text-left transition-colors"
                  style={{ color: "var(--text)" }}
                  type="button"
                >
                  <MoveRight size={13} style={{ color: "var(--muted)" }} />
                  <span>Move to...</span>
                </button>
                <div className="h-px my-1" style={{ background: "var(--border)" }} />
                <button
                  onClick={() => {
                    onDeleteFile((floatingMenu.item as { id: string }).id);
                    setFloatingMenu(null);
                  }}
                  className="flex w-full items-center gap-2.5 px-3 py-1.5 rounded-md text-rose-500 hover:bg-rose-500/10 text-left transition-colors"
                  type="button"
                >
                  <Trash2 size={13} />
                  <span>Delete File</span>
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── Modals ── */}
      {showNewFileModal && (
        <NewFileModal
          folders={folders}
          initialFolder={initialFolderForNewFile}
          initialName={draftName}
          onClose={() => setShowNewFileModal(false)}
          onConfirm={(path) => onCreateFile(path)}
        />
      )}

      {showNewFolderModal && (
        <NewFolderModal
          folders={folders}
          initialParent={initialFolderForNewFolder}
          onClose={() => setShowNewFolderModal(false)}
          onConfirm={(path) => onCreateFolder(path)}
        />
      )}

      {renameTarget && (
        <RenameModal
          initialName={getWorkspaceBaseName(renameTarget.path)}
          isFolder={renameTarget.kind === "folder"}
          onClose={() => setRenameTarget(null)}
          onConfirm={(newName) => {
            if (renameTarget.kind === "folder") {
              onRenameFolder(renameTarget.path, newName);
            } else {
              onRenameFile(renameTarget.id, newName);
            }
          }}
        />
      )}

      {moveTarget && (
        <MoveModal
          folders={folders}
          onClose={() => setMoveTarget(null)}
          onMove={handleMove}
          target={moveTarget}
        />
      )}
    </aside>
  );
}
