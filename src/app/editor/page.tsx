"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  ExternalLink,
  Loader2,
  Play,
  Save,
  Settings,
  X,
} from "lucide-react";
import EditorTabs from "@/components/editor/EditorTabs";
import FileExplorer from "@/components/editor/FileExplorer";
import MonacoEditor from "@/components/editor/MonacoEditor";
import TerminalBox, { type OutputTranscriptEntry } from "@/components/editor/TerminalBox";
import Brand from "@/components/layout/Brand";
import ThemeSwitcher from "@/components/layout/ThemeSwitcher";
import { useTheme } from "@/context/ThemeContext";
import { useUser } from "@/context/UserContext";
import { useCompiler } from "@/hooks/useCompiler";
import { useShortcuts } from "@/hooks/useShortcuts";
import { DEFAULT_LANGUAGE, getLanguageByExtension, getLanguageById, languageGroups } from "@/lib/languages";
import { openPreview } from "@/lib/preview";
import {
  appendTerminalHistory,
  buildStarterFile,
  createFolderPath,
  createWorkspaceFile,
  executeWorkspaceCommand,
  formatWorkspacePath,
  getWorkspaceBaseName,
  getWorkspaceParentPath,
  normalizeWorkspacePath,
  normalizeWorkspaceState,
  persistWorkspace,
  readWorkspace,
  type ProjectFile,
  type WorkspaceState,
} from "@/lib/workspace";

const readBrowserFile = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(new Error(`Unable to read ${file.name}`));
    reader.readAsText(file);
  });

type InteractiveSession = {
  helperText: string;
  promptLabel: string;
};

const createTranscriptEntry = (
  tone: OutputTranscriptEntry["tone"],
  text: string,
): OutputTranscriptEntry => ({
  id: `output-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  text,
  tone,
});

export default function EditorPage() {
  const { profile, recordActivity, saveProfile } = useUser();
  const { editorTheme } = useTheme();

  const [workspace, setWorkspace] = useState<WorkspaceState | null>(() =>
    typeof window === "undefined" ? null : readWorkspace(),
  );
  const [draftName, setDraftName] = useState("src/main");
  const [draftLanguage, setDraftLanguage] = useState("python");
  const [statusMessage, setStatusMessage] = useState("Ready");
  const [stdin, setStdin] = useState("");
  const [pendingInteractiveInput, setPendingInteractiveInput] = useState("");
  const [interactiveSession] = useState<InteractiveSession | null>(null);
  const [transcript, setTranscript] = useState<OutputTranscriptEntry[]>([]);
  const [commandInput, setCommandInput] = useState("");
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // 3-Column Resizable Widths (Explorer: 230px, Output: 520px by default, Middle: flex-1)
  const [explorerWidth, setExplorerWidth] = useState(230);
  const [outputWidth, setOutputWidth] = useState(() => {
    if (typeof window !== "undefined" && window.innerWidth >= 1280) {
      return Math.max(480, Math.min(620, Math.floor(window.innerWidth * 0.38)));
    }
    return 520;
  });
  const activeDragRef = useRef<"left" | "right" | null>(null);

  const { error, execution, loading, runCode, cancelExecution, resetExecutionState } = useCompiler();
  const fileImportRef = useRef<HTMLInputElement>(null);
  const folderImportRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    folderImportRef.current?.setAttribute("webkitdirectory", "");
    folderImportRef.current?.setAttribute("directory", "");
  }, []);

  useEffect(() => {
    return () => {
      cancelExecution();
    };
  }, [cancelExecution]);

  // Horizontal mouse drag handler for both column dividers
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!activeDragRef.current) return;

      if (activeDragRef.current === "left") {
        let nextW = e.clientX;
        if (nextW < 170) nextW = 170;
        if (nextW > 450) nextW = 450;
        setExplorerWidth(nextW);
      } else if (activeDragRef.current === "right") {
        let nextW = window.innerWidth - e.clientX;
        if (nextW < 260) nextW = 260;
        if (nextW > 850) nextW = 850;
        setOutputWidth(nextW);
      }
    };

    const handleMouseUp = () => {
      if (activeDragRef.current) {
        activeDragRef.current = null;
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
      }
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, []);

  const persist = (nextState: WorkspaceState) => {
    const normalized = normalizeWorkspaceState(nextState);
    setWorkspace(normalized);
    persistWorkspace(normalized);
  };

  const activeFile =
    workspace?.files.find((file) => file.id === workspace.activeFileId) ?? workspace?.files[0];
  const currentLanguage = activeFile
    ? getLanguageById(activeFile.languageId) ?? getLanguageByExtension(activeFile.path)
    : DEFAULT_LANGUAGE;

  const handleSelectFile = (fileId: string) => {
    if (!workspace) return;
    persist({ ...workspace, activeFileId: fileId });
    const target = workspace.files.find((f) => f.id === fileId);
    if (target) {
      setStatusMessage(`Opened ${formatWorkspacePath(target.path)}`);
    }
  };

  const handleCodeChange = (content: string) => {
    if (!workspace || !activeFile) return;
    const nextFiles = workspace.files.map((file) =>
      file.id === activeFile.id ? { ...file, content } : file,
    );
    persist({ ...workspace, files: nextFiles });
  };

  const handleSave = () => {
    if (!workspace || !activeFile) return;
    persist(workspace);
    setStatusMessage(`Saved ${activeFile.name}`);
    recordActivity({
      detail: `Saved ${formatWorkspacePath(activeFile.path)}.`,
      title: "File saved",
      type: "workspace",
    });
  };

  const handleCreateFile = (filePath?: string, customLang?: string) => {
    if (!workspace) return;
    const targetPath = filePath || draftName || "main";
    const detectedLang = filePath ? getLanguageByExtension(filePath) : null;
    const langId = customLang || (detectedLang ? detectedLang.id : draftLanguage);

    const nextFile = createWorkspaceFile(
      targetPath,
      langId,
      workspace.files,
      workspace.terminal.cwd,
    );

    const parentPath = getWorkspaceParentPath(nextFile.path);
    const nextFolders = parentPath && !workspace.folders.includes(parentPath)
      ? [...workspace.folders, parentPath]
      : workspace.folders;

    const nextWorkspace = {
      ...workspace,
      activeFileId: nextFile.id,
      files: [...workspace.files, nextFile],
      folders: nextFolders,
    };
    persist(nextWorkspace);
    setStatusMessage(`Created ${formatWorkspacePath(nextFile.path)}`);
    recordActivity({
      detail: `Created ${formatWorkspacePath(nextFile.path)}.`,
      title: "File created",
      type: "workspace",
    });
  };

  const handleCreateFolder = (folderName: string) => {
    if (!workspace) return;
    const nextFolderPath = createFolderPath(
      folderName,
      workspace.folders,
      workspace.files,
      workspace.terminal.cwd,
    );
    if (!nextFolderPath) {
      setStatusMessage("Folder name is required.");
      return;
    }
    const nextWorkspace = {
      ...workspace,
      folders: [...workspace.folders, nextFolderPath],
    };
    persist(nextWorkspace);
    setStatusMessage(`${formatWorkspacePath(nextFolderPath)} folder created.`);
    recordActivity({
      detail: `Created folder ${formatWorkspacePath(nextFolderPath)}.`,
      title: "Folder created",
      type: "workspace",
    });
  };

  const handleDeleteFile = (id: string) => {
    if (!workspace) return;
    const nextFiles = workspace.files.filter((f) => f.id !== id);
    if (nextFiles.length === 0) {
      const starter = buildStarterFile(DEFAULT_LANGUAGE);
      persist({
        ...workspace,
        activeFileId: starter.id,
        files: [starter],
      });
      setStatusMessage("Workspace reset to starter file.");
      return;
    }
    const nextActiveId = id === workspace.activeFileId ? nextFiles[0].id : workspace.activeFileId;
    persist({ ...workspace, activeFileId: nextActiveId, files: nextFiles });
    setStatusMessage("File deleted.");
  };

  const handleDeleteFolder = (path: string) => {
    if (!workspace) return;
    const nextFolders = workspace.folders.filter((f) => f !== path && !f.startsWith(`${path}/`));
    let nextFiles = workspace.files.filter((f) => !f.path.startsWith(`${path}/`) && f.path !== path);
    if (nextFiles.length === 0) {
      const starter = buildStarterFile(DEFAULT_LANGUAGE);
      nextFiles = [starter];
    }
    const nextActiveId = nextFiles.some((f) => f.id === workspace.activeFileId)
      ? workspace.activeFileId
      : nextFiles[0].id;
    persist({ ...workspace, activeFileId: nextActiveId, files: nextFiles, folders: nextFolders });
    setStatusMessage(`Deleted folder ${getWorkspaceBaseName(path)}.`);
  };

  const handleDuplicateFile = (fileId: string) => {
    if (!workspace) return;
    const file = workspace.files.find((f) => f.id === fileId);
    if (!file) return;

    const baseName = getWorkspaceBaseName(file.path);
    const parentPath = getWorkspaceParentPath(file.path);
    const dotIndex = baseName.lastIndexOf(".");
    const stem = dotIndex > 0 ? baseName.slice(0, dotIndex) : baseName;
    const ext = dotIndex > 0 ? baseName.slice(dotIndex) : "";
    const newName = `${stem}-copy${ext}`;
    const newPath = parentPath ? `${parentPath}/${newName}` : newName;

    const duplicateFile: ProjectFile = {
      content: file.content,
      id: `copy-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      languageId: file.languageId,
      name: newName,
      path: newPath,
    };

    const nextWorkspace = {
      ...workspace,
      activeFileId: duplicateFile.id,
      files: [...workspace.files, duplicateFile],
    };

    persist(nextWorkspace);
    setStatusMessage(`Duplicated ${baseName}`);
  };

  const handleMoveFile = (fileId: string, targetFolder: string) => {
    if (!workspace) return;
    const file = workspace.files.find((f) => f.id === fileId);
    if (!file) return;
    const baseName = getWorkspaceBaseName(file.path);
    const targetParent = normalizeWorkspacePath(targetFolder);
    const newPath = targetParent ? `${targetParent}/${baseName}` : baseName;

    if (newPath === file.path) return;

    const nextFiles = workspace.files.map((f) =>
      f.id === fileId ? { ...f, path: newPath, name: baseName } : f,
    );
    const nextFolders = new Set(workspace.folders);
    if (targetParent) {
      const parts = targetParent.split("/");
      let accumulated = "";
      for (const part of parts) {
        accumulated = accumulated ? `${accumulated}/${part}` : part;
        nextFolders.add(accumulated);
      }
    }
    persist({ ...workspace, files: nextFiles, folders: Array.from(nextFolders) });
    setStatusMessage(`Moved ${baseName} to ${targetParent ? `/${targetParent}` : "root"}.`);
  };

  const handleMoveFolder = (srcPath: string, targetFolder: string) => {
    if (!workspace) return;
    const normSrc = normalizeWorkspacePath(srcPath);
    const normTarget = normalizeWorkspacePath(targetFolder);

    if (normTarget === normSrc || normTarget.startsWith(`${normSrc}/`)) {
      setStatusMessage("Cannot move a folder into itself or its subfolder.");
      return;
    }

    const folderName = getWorkspaceBaseName(normSrc);
    const newFolderPath = normTarget ? `${normTarget}/${folderName}` : folderName;

    if (newFolderPath === normSrc) return;

    const nextFolders = workspace.folders
      .filter((f) => f !== normSrc && !f.startsWith(`${normSrc}/`))
      .concat([newFolderPath]);

    if (normTarget) {
      const parts = normTarget.split("/");
      let acc = "";
      for (const p of parts) {
        acc = acc ? `${acc}/${p}` : p;
        if (!nextFolders.includes(acc)) nextFolders.push(acc);
      }
    }

    const nextFiles = workspace.files.map((file) => {
      if (file.path === normSrc || file.path.startsWith(`${normSrc}/`)) {
        const relative = file.path.slice(normSrc.length);
        const updatedPath = `${newFolderPath}${relative}`;
        return {
          ...file,
          path: updatedPath,
          name: getWorkspaceBaseName(updatedPath),
        };
      }
      return file;
    });

    persist({ ...workspace, files: nextFiles, folders: nextFolders });
    setStatusMessage(`Moved folder ${folderName} to ${normTarget ? `/${normTarget}` : "root"}.`);
  };

  const handleRenameFile = (fileId: string, newName: string) => {
    if (!workspace) return;
    const file = workspace.files.find((f) => f.id === fileId);
    if (!file) return;
    const cleanName = getWorkspaceBaseName(newName.trim());
    if (!cleanName || cleanName === file.name) return;

    const parentPath = getWorkspaceParentPath(file.path);
    const newPath = parentPath ? `${parentPath}/${cleanName}` : cleanName;
    const nextLang = getLanguageByExtension(newPath);

    const nextFiles = workspace.files.map((f) =>
      f.id === fileId
        ? {
            ...f,
            languageId: nextLang.id,
            name: cleanName,
            path: newPath,
          }
        : f,
    );
    persist({ ...workspace, files: nextFiles });
    setStatusMessage(`Renamed to ${cleanName}.`);
  };

  const handleRenameFolder = (oldPath: string, newName: string) => {
    if (!workspace) return;
    const cleanName = getWorkspaceBaseName(newName.trim());
    if (!cleanName) return;

    const normOld = normalizeWorkspacePath(oldPath);
    const parentPath = getWorkspaceParentPath(normOld);
    const newPath = parentPath ? `${parentPath}/${cleanName}` : cleanName;

    if (newPath === normOld) return;

    const nextFolders = workspace.folders.map((f) => {
      if (f === normOld) return newPath;
      if (f.startsWith(`${normOld}/`)) {
        return `${newPath}${f.slice(normOld.length)}`;
      }
      return f;
    });

    const nextFiles = workspace.files.map((file) => {
      if (file.path === normOld || file.path.startsWith(`${normOld}/`)) {
        const relative = file.path.slice(normOld.length);
        const updatedPath = `${newPath}${relative}`;
        return {
          ...file,
          path: updatedPath,
          name: getWorkspaceBaseName(updatedPath),
        };
      }
      return file;
    });

    persist({ ...workspace, files: nextFiles, folders: nextFolders });
    setStatusMessage(`Renamed folder to ${cleanName}.`);
  };

  const handleRun = async () => {
    if (!activeFile) return;

    if (currentLanguage.previewable) {
      if (workspace) {
        openPreview(workspace.files, activeFile.id);
        setStatusMessage("Preview opened in new window.");
      }
      return;
    }

    if (!currentLanguage.runnable) {
      setStatusMessage(`${currentLanguage.label} does not have a browser runtime.`);
      return;
    }

    setStatusMessage(`Executing ${activeFile.name}...`);
    setTranscript((prev) => [
      ...prev,
      createTranscriptEntry("status", `[system] Running ${activeFile.name} with ${currentLanguage.label}...`),
    ]);

    await runCode(
      currentLanguage,
      activeFile.content,
      stdin,
    );
    setStatusMessage("Ready");
  };

  const handleDownload = () => {
    if (!activeFile) return;
    const blob = new Blob([activeFile.content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = activeFile.name;
    anchor.click();
    URL.revokeObjectURL(url);
    setStatusMessage("File downloaded.");
  };

  const handleInsertBoilerplate = () => {
    if (!workspace || !activeFile) return;
    const template = currentLanguage.template;
    persist({
      ...workspace,
      files: workspace.files.map((file) =>
        file.id === activeFile.id ? { ...file, content: template } : file,
      ),
    });
    setStatusMessage(`${currentLanguage.label} boilerplate inserted.`);
  };

  const importWorkspaceFiles = async (fileList: FileList | null, preserveRelativePath: boolean) => {
    if (!workspace || !fileList?.length) return;
    const browserFiles = Array.from(fileList);
    const importedFiles = await Promise.all(
      browserFiles.map(async (file) => {
        const relativePath = preserveRelativePath
          ? normalizeWorkspacePath((file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name)
          : normalizeWorkspacePath(file.name);
        const content = await readBrowserFile(file);
        const language = getLanguageByExtension(relativePath);

        return {
          content,
          id: `imported-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          languageId: language.id,
          name: getWorkspaceBaseName(relativePath),
          path: relativePath,
        } satisfies ProjectFile;
      }),
    );

    const existingByPath = new Map(workspace.files.map((file) => [file.path, file]));
    importedFiles.forEach((file) => existingByPath.set(file.path, file));

    const nextFolders = new Set(workspace.folders);
    importedFiles.forEach((file) => {
      const segments = getWorkspaceParentPath(file.path).split("/").filter(Boolean);
      const chain: string[] = [];
      segments.forEach((segment) => {
        chain.push(segment);
        nextFolders.add(chain.join("/"));
      });
    });

    const nextWorkspace = {
      ...workspace,
      activeFileId: importedFiles[0]?.id ?? workspace.activeFileId,
      files: Array.from(existingByPath.values()),
      folders: Array.from(nextFolders),
    };

    persist(nextWorkspace);
    setStatusMessage(`Imported ${importedFiles.length} file(s).`);
  };

  const handleCommandRun = () => {
    if (!workspace || !commandInput.trim()) return;
    const trimmed = commandInput.trim();
    const result = executeWorkspaceCommand(workspace, trimmed);
    const nextWorkspace = result.clearHistory
      ? result.workspace
      : appendTerminalHistory(result.workspace, trimmed, result.output, result.status, result.cwd);

    persist(nextWorkspace);
    setCommandInput("");
    if (result.openFileId) {
      const f = nextWorkspace.files.find((file) => file.id === result.openFileId);
      if (f) setStatusMessage(`Opened ${f.name}`);
    } else {
      setStatusMessage(result.output.split("\n")[0] || "Command executed.");
    }
  };

  useShortcuts({
    onEscape: () => setIsSettingsOpen(false),
    onNewFile: () => handleCreateFile(),
    onRun: handleRun,
    onSave: handleSave,
  });

  if (!profile || !workspace || !activeFile) return null;

  const firstName = profile.name.trim().split(/\s+/)[0] || "User";

  return (
    <main
      className="min-h-screen w-full flex flex-col font-sans select-none antialiased transition-colors"
      style={{
        background: "var(--background-main)",
        color: "var(--text)",
      }}
    >
      {/* Hidden File Import Inputs */}
      <input
        className="hidden"
        multiple
        onChange={(event) => void importWorkspaceFiles(event.target.files, false)}
        ref={fileImportRef}
        type="file"
      />
      <input
        className="hidden"
        multiple
        onChange={(event) => void importWorkspaceFiles(event.target.files, true)}
        ref={folderImportRef}
        type="file"
      />

      {/* ========================================================================= */}
      {/* 1. TOP NAVBAR (Clean, Premium Aesthetic, Matching Login & Manual)          */}
      {/* ========================================================================= */}
      <header
        className="h-12 shrink-0 px-4 flex items-center justify-between z-30 relative select-none transition-colors border-b"
        style={{
          background: "var(--panel-background)",
          borderColor: "var(--border)",
        }}
      >
        {/* Left: Brand Logo & File Path & Run Trigger */}
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="flex items-center gap-2 group transition-opacity opacity-90 hover:opacity-100"
            title="VoidLAB Home"
          >
            <Brand compact />
          </Link>

          <div className="h-4 w-px" style={{ background: "var(--border)" }} />

          {/* Active File Path Tag */}
          <div
            className="flex items-center gap-2 px-2.5 py-1 rounded-md text-xs font-sans transition-colors"
            style={{
              background: "var(--surface-soft)",
              border: "1px solid var(--border)",
              color: "var(--muted)",
            }}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
            <span className="font-medium font-sans" style={{ color: "var(--text-strong)" }}>
              {formatWorkspacePath(activeFile.path)}
            </span>
            <span style={{ color: "var(--border)" }}>/</span>
            <span className="font-mono text-[11px]" style={{ color: "var(--muted)" }}>{currentLanguage.label}</span>
          </div>

          {/* Action Run Pill Button */}
          <button
            onClick={() => void handleRun()}
            disabled={loading || (!currentLanguage.runnable && !currentLanguage.previewable) || Boolean(interactiveSession)}
            className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-md shadow-sm active:scale-[0.98] transition-all disabled:opacity-40 ml-1 cursor-pointer font-sans"
            style={{
              background: "var(--action-background)",
              color: "var(--action-foreground)",
            }}
            title="Execute script (Ctrl+Enter)"
            type="button"
          >
            {loading ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Play className="w-3.5 h-3.5 fill-current" />
            )}
            <span>Run</span>
          </button>

          {/* Save Trigger */}
          <button
            onClick={handleSave}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-md transition-colors cursor-pointer font-sans"
            style={{
              background: "var(--surface-soft)",
              border: "1px solid var(--border)",
              color: "var(--text)",
            }}
            title="Save file (Ctrl+S)"
            type="button"
          >
            <Save className="w-3.5 h-3.5 stroke-current" />
            <span className="hidden sm:inline">Save</span>
          </button>

          {/* Status Message */}
          <span
            className="text-[11px] font-sans pl-1 truncate max-w-[140px]"
            style={{ color: "var(--muted)" }}
          >
            {statusMessage}
          </span>
        </div>

        {/* Right: Minimal Text Buttons (Manual, GitHub, Collab, AI Guide) & Switcher */}
        <div className="flex items-center gap-2.5">
          <nav className="flex items-center gap-1 text-xs font-medium font-sans">
            <Link
              href="/editor/manual"
              className="px-2.5 py-1 rounded-md transition-colors hover:text-[var(--text-strong)] hover:bg-[var(--surface-soft)]"
              style={{ color: "var(--muted)" }}
            >
              Manual
            </Link>
            <a
              href="https://github.com/Voxion-Labs/VoidLAB"
              target="_blank"
              rel="noreferrer"
              className="px-2.5 py-1 rounded-md transition-colors hover:text-[var(--text-strong)] hover:bg-[var(--surface-soft)] flex items-center gap-1"
              style={{ color: "var(--muted)" }}
            >
              GitHub
              <ExternalLink size={10} style={{ opacity: 0.7 }} />
            </a>
            <Link
              href="/editor/collaboration"
              className="px-2.5 py-1 rounded-md transition-colors hover:text-[var(--text-strong)] hover:bg-[var(--surface-soft)] flex items-center gap-1.5"
              style={{ color: "var(--muted)" }}
            >
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: "var(--accent)" }} />
              Collab
            </Link>
            <Link
              href="/editor/ai"
              className="px-2.5 py-1 rounded-md transition-colors hover:text-[var(--text-strong)] hover:bg-[var(--surface-soft)]"
              style={{ color: "var(--muted)" }}
            >
              AI Guide
            </Link>
          </nav>

          <div className="h-4 w-px" style={{ background: "var(--border)" }} />

          {/* Dual Theme Switcher (Light / Dark) */}
          <ThemeSwitcher />

          {/* Settings Trigger */}
          <button
            onClick={() => setIsSettingsOpen(true)}
            className="p-1.5 rounded-md transition-colors hover:bg-[var(--surface-soft)] cursor-pointer"
            style={{ color: "var(--muted)" }}
            title="Workspace Settings (Language, Region, Shortcuts)"
            type="button"
          >
            <Settings size={15} />
          </button>

          {/* User Profile Avatar */}
          <Link
            href="/editor/profile"
            className="h-6 w-6 rounded-md flex items-center justify-center text-[10px] font-semibold transition-all hover:scale-105"
            style={{
              background: "var(--surface-soft)",
              border: "1px solid var(--border)",
              color: "var(--text-strong)",
            }}
            title="Profile & Activity"
          >
            {firstName.charAt(0).toUpperCase()}
          </Link>
        </div>
      </header>

      {/* ========================================================================= */}
      {/* 2. MAIN WORKSPACE (3-Column Flex: Left, Middle Editor, Right Output)       */}
      {/* ========================================================================= */}
      <div
        className="flex-1 flex flex-col lg:flex-row overflow-y-auto lg:overflow-hidden min-h-[640px] relative transition-colors"
        style={{ background: "var(--background-main)" }}
      >
        {/* ── Left Column: File Explorer Sidebar ── */}
        <FileExplorer
          activeFileId={activeFile.id}
          cwd={workspace.terminal.cwd}
          currentLanguageLabel={currentLanguage.label}
          draftLanguage={draftLanguage}
          draftName={draftName}
          files={workspace.files}
          folders={workspace.folders}
          onCreateFile={handleCreateFile}
          onCreateFolder={handleCreateFolder}
          onDeleteFile={handleDeleteFile}
          onDeleteFolder={handleDeleteFolder}
          onDraftLanguageChange={setDraftLanguage}
          onDraftNameChange={setDraftName}
          onDuplicateFile={handleDuplicateFile}
          onImportFiles={() => fileImportRef.current?.click()}
          onImportFolder={() => folderImportRef.current?.click()}
          onMoveFile={handleMoveFile}
          onMoveFolder={handleMoveFolder}
          onOpenSettings={() => setIsSettingsOpen(true)}
          onRenameFile={handleRenameFile}
          onRenameFolder={handleRenameFolder}
          onSelectFile={handleSelectFile}
          width={explorerWidth}
        />

        {/* ── Divider 1: Left Resizable Splitter (between Explorer & Editor) ── */}
        <div
          onMouseDown={() => {
            activeDragRef.current = "left";
            document.body.style.cursor = "col-resize";
            document.body.style.userSelect = "none";
          }}
          className="w-1 hover:w-1.5 cursor-col-resize transition-all duration-100 z-20 flex flex-col items-center justify-center group shrink-0"
          style={{ background: "var(--border)" }}
          title="Drag to resize sidebar"
        >
          <div
            className="h-6 w-[1.5px] rounded-full group-hover:scale-125 transition-transform"
            style={{ background: "var(--muted)" }}
          />
        </div>

        {/* ── Middle Column: Main Code Editor (Takes Majority Width) ── */}
        <div
          className="flex-1 min-w-[320px] flex flex-col h-full overflow-hidden relative"
          style={{ background: "var(--background-main)" }}
        >
          <EditorTabs
            activeFileId={activeFile.id}
            files={workspace.files.map((file) => ({ id: file.id, name: file.name, path: file.path }))}
            languageLabel={currentLanguage.label}
            onCloseFile={handleDeleteFile}
            onDownload={handleDownload}
            onInsertBoilerplate={handleInsertBoilerplate}
            onSelectFile={handleSelectFile}
          />

          <div className="flex-1 h-full min-h-0 relative">
            <MonacoEditor
              language={currentLanguage.monacoLanguage}
              onChange={handleCodeChange}
              path={activeFile.path}
              theme={editorTheme}
              value={activeFile.content}
            />
          </div>
        </div>

        {/* ── Divider 2: Right Resizable Splitter (between Editor & Output) ── */}
        <div
          onMouseDown={() => {
            activeDragRef.current = "right";
            document.body.style.cursor = "col-resize";
            document.body.style.userSelect = "none";
          }}
          className="w-1 hover:w-1.5 cursor-col-resize transition-all duration-100 z-20 flex flex-col items-center justify-center group shrink-0"
          style={{ background: "var(--border)" }}
          title="Drag to resize output terminal"
        >
          <div
            className="h-6 w-[1.5px] rounded-full group-hover:scale-125 transition-transform"
            style={{ background: "var(--muted)" }}
          />
        </div>

        {/* ── Right Column: Output Panel (Terminal, Output, Ports Tabs) ── */}
        <aside
          style={{
            width: `${outputWidth}px`,
            background: "var(--panel-background)",
            borderLeft: "1px solid var(--border)",
          }}
          className="shrink-0 flex flex-col h-full overflow-hidden relative"
        >
          <TerminalBox
            activeFilePath={activeFile.path}
            commandHistory={workspace.terminal.history}
            commandInput={commandInput}
            cwd={workspace.terminal.cwd}
            error={error}
            execution={execution}
            interactiveSession={{
              active: Boolean(interactiveSession),
              helperText:
                interactiveSession?.helperText ??
                "VoidLAB will request stdin here before sending the execution payload.",
              promptLabel: interactiveSession?.promptLabel ?? "stdin",
            }}
            loading={loading}
            onClearOutput={() => {
              setTranscript([]);
              resetExecutionState();
            }}
            onCommandChange={setCommandInput}
            onCommandRun={handleCommandRun}
            onInteractiveInputChange={setPendingInteractiveInput}
            onResetBufferedInput={() => {
              setPendingInteractiveInput("");
              setStdin("");
            }}
            onResetSplit={() => setOutputWidth(520)}
            onRun={() => void handleRun()}
            pendingInteractiveInput={pendingInteractiveInput}
            stdin={stdin}
            transcript={transcript}
          />
        </aside>
      </div>

      {/* ========================================================================= */}
      {/* 3. WORKSPACE SETTINGS MODAL (Language, Region, Shortcuts)                 */}
      {/* ========================================================================= */}
      {isSettingsOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 font-sans"
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsSettingsOpen(false);
          }}
        >
          <div
            className="w-full max-w-md rounded-xl shadow-2xl p-5 space-y-4 font-sans transition-colors"
            style={{
              background: "var(--panel-background)",
              border: "1px solid var(--border-strong)",
              color: "var(--text)",
            }}
          >
            {/* Modal Header */}
            <div
              className="flex items-center justify-between pb-3"
              style={{ borderBottom: "1px solid var(--border)" }}
            >
              <div className="flex items-center gap-2">
                <Settings size={16} style={{ color: "var(--accent)" }} />
                <h3 className="font-semibold text-sm" style={{ color: "var(--text-strong)" }}>
                  Workspace Settings
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsSettingsOpen(false)}
                className="p-1 rounded transition-colors hover:bg-[var(--surface-soft)] cursor-pointer"
                style={{ color: "var(--muted)" }}
              >
                <X size={15} />
              </button>
            </div>

            <div className="space-y-4 text-xs font-sans">
              {/* Language Runtime Selection */}
              <div className="space-y-1.5">
                <label className="font-medium block text-[11px]" style={{ color: "var(--text-strong)" }}>
                  Active Language Runtime
                </label>
                <select
                  className="w-full rounded-md px-3 py-2 outline-none font-sans text-xs cursor-pointer transition-colors"
                  style={{
                    background: "var(--input-background)",
                    border: "1px solid var(--border)",
                    color: "var(--text)",
                  }}
                  value={currentLanguage.id}
                  onChange={(e) => {
                    const nextLangId = e.target.value;
                    const nextLang = getLanguageById(nextLangId);
                    if (workspace && activeFile && nextLang) {
                      const nextFiles = workspace.files.map((f) =>
                        f.id === activeFile.id
                          ? { ...f, languageId: nextLang.id, name: `${f.name.split(".")[0]}${nextLang.extension}` }
                          : f,
                      );
                      persist({ ...workspace, files: nextFiles });
                      setStatusMessage(`Switched language to ${nextLang.label}`);
                    }
                  }}
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
              </div>

              {/* Execution Region Selection */}
              <div className="space-y-1.5">
                <label className="font-medium block text-[11px]" style={{ color: "var(--text-strong)" }}>
                  Execution Sandbox Region
                </label>
                <select
                  className="w-full rounded-md px-3 py-2 outline-none font-sans text-xs cursor-pointer transition-colors"
                  style={{
                    background: "var(--input-background)",
                    border: "1px solid var(--border)",
                    color: "var(--text)",
                  }}
                  value={profile.region || "Local Sandbox"}
                  onChange={(e) => {
                    void saveProfile({ region: e.target.value });
                    setStatusMessage(`Region updated to ${e.target.value}`);
                  }}
                >
                  <option value="Local Sandbox">Local Client Sandbox (0ms latency)</option>
                  <option value="US East (N. Virginia)">US East (N. Virginia)</option>
                  <option value="EU Central (Frankfurt)">EU Central (Frankfurt)</option>
                  <option value="AP South (Mumbai)">AP South (Mumbai)</option>
                </select>
              </div>

              {/* Keyboard Shortcuts Summary */}
              <div
                className="space-y-1.5 pt-2"
                style={{ borderTop: "1px solid var(--border)" }}
              >
                <span className="font-medium block text-[11px]" style={{ color: "var(--muted)" }}>
                  Shortcuts Cheatsheet
                </span>
                <div className="grid grid-cols-2 gap-1.5 text-[11px] font-sans">
                  <div
                    className="flex justify-between p-2 rounded-md"
                    style={{ background: "var(--surface-soft)", border: "1px solid var(--border)" }}
                  >
                    <span style={{ color: "var(--muted)" }}>Run script:</span>
                    <kbd className="font-mono text-[10px] font-semibold" style={{ color: "var(--text-strong)" }}>Ctrl+Enter</kbd>
                  </div>
                  <div
                    className="flex justify-between p-2 rounded-md"
                    style={{ background: "var(--surface-soft)", border: "1px solid var(--border)" }}
                  >
                    <span style={{ color: "var(--muted)" }}>Save workspace:</span>
                    <kbd className="font-mono text-[10px] font-semibold" style={{ color: "var(--text-strong)" }}>Ctrl+S</kbd>
                  </div>
                  <div
                    className="flex justify-between p-2 rounded-md"
                    style={{ background: "var(--surface-soft)", border: "1px solid var(--border)" }}
                  >
                    <span style={{ color: "var(--muted)" }}>New file:</span>
                    <kbd className="font-mono text-[10px] font-semibold" style={{ color: "var(--text-strong)" }}>Ctrl+Shift+N</kbd>
                  </div>
                  <div
                    className="flex justify-between p-2 rounded-md"
                    style={{ background: "var(--surface-soft)", border: "1px solid var(--border)" }}
                  >
                    <span style={{ color: "var(--muted)" }}>Close modal:</span>
                    <kbd className="font-mono text-[10px] font-semibold" style={{ color: "var(--text-strong)" }}>Escape</kbd>
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Actions */}
            <div
              className="flex items-center justify-end gap-2 pt-3"
              style={{ borderTop: "1px solid var(--border)" }}
            >
              <button
                type="button"
                onClick={() => setIsSettingsOpen(false)}
                className="px-4 py-1.5 text-xs rounded-md font-semibold transition-opacity hover:opacity-90 shadow-sm cursor-pointer"
                style={{
                  background: "var(--action-background)",
                  color: "var(--action-foreground)",
                }}
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
