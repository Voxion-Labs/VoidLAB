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
import { useUser } from "@/context/UserContext";
import { useCompiler } from "@/hooks/useCompiler";
import { useShortcuts } from "@/hooks/useShortcuts";
import { DEFAULT_LANGUAGE, getLanguageByExtension, getLanguageById, languageGroups } from "@/lib/languages";
import { openPreview } from "@/lib/preview";
import {
  appendTerminalHistory,
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

  // Resizable split-pane state (Default 75% editor, 25% terminal)
  const [editorHeightPercent, setEditorHeightPercent] = useState(75);
  const isDraggingRef = useRef(false);

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

  // Mouse drag handler for vertical resizer
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDraggingRef.current) return;
      const totalHeight = window.innerHeight - 40; // minus 40px top navbar
      const relativeY = e.clientY - 40;
      let percent = (relativeY / totalHeight) * 100;
      if (percent < 15) percent = 15;
      if (percent > 85) percent = 85;
      setEditorHeightPercent(percent);
    };

    const handleMouseUp = () => {
      if (isDraggingRef.current) {
        isDraggingRef.current = false;
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

  const handleCreateFile = () => {
    if (!workspace) return;
    const nextFile = createWorkspaceFile(
      draftName || "main",
      draftLanguage,
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
    setStatusMessage(`Created ${formatWorkspacePath(nextFile.path)}.`);
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
    if (workspace.files.length <= 1) {
      setStatusMessage("Cannot delete the last remaining file.");
      return;
    }
    const nextFiles = workspace.files.filter((f) => f.id !== id);
    const nextActiveId = id === workspace.activeFileId ? nextFiles[0].id : workspace.activeFileId;
    persist({ ...workspace, activeFileId: nextActiveId, files: nextFiles });
    setStatusMessage("File deleted.");
  };

  const handleDeleteFolder = (path: string) => {
    if (!workspace) return;
    const nextFolders = workspace.folders.filter((f) => f !== path && !f.startsWith(`${path}/`));
    const nextFiles = workspace.files.filter((f) => !f.path.startsWith(`${path}/`));
    if (!nextFiles.length) {
      setStatusMessage("Cannot delete folder containing all files.");
      return;
    }
    const nextActiveId = nextFiles.some((f) => f.id === workspace.activeFileId)
      ? workspace.activeFileId
      : nextFiles[0].id;
    persist({ ...workspace, activeFileId: nextActiveId, files: nextFiles, folders: nextFolders });
    setStatusMessage(`Deleted folder ${getWorkspaceBaseName(path)}.`);
  };

  const handleMoveFile = (fileId: string, targetFolder: string) => {
    if (!workspace) return;
    const file = workspace.files.find((f) => f.id === fileId);
    if (!file) return;
    const baseName = getWorkspaceBaseName(file.path);
    const newPath = targetFolder ? `${targetFolder}/${baseName}` : baseName;
    const nextFiles = workspace.files.map((f) =>
      f.id === fileId ? { ...f, path: newPath, name: baseName } : f,
    );
    const nextFolders = new Set(workspace.folders);
    if (targetFolder) nextFolders.add(targetFolder);
    persist({ ...workspace, files: nextFiles, folders: Array.from(nextFolders) });
    setStatusMessage(`Moved ${baseName} to ${targetFolder || "root"}.`);
  };

  const handleMoveFolder = (srcPath: string, targetFolder: string) => {
    if (!workspace) return;
    const folderName = getWorkspaceBaseName(srcPath);
    const newFolderPath = targetFolder ? `${targetFolder}/${folderName}` : folderName;
    const nextFolders = workspace.folders
      .filter((f) => f !== srcPath && !f.startsWith(`${srcPath}/`))
      .concat([newFolderPath]);
    const nextFiles = workspace.files.map((file) => {
      if (file.path === srcPath || file.path.startsWith(`${srcPath}/`)) {
        const relative = file.path.slice(srcPath.length);
        return { ...file, path: `${newFolderPath}${relative}` };
      }
      return file;
    });
    persist({ ...workspace, files: nextFiles, folders: nextFolders });
    setStatusMessage(`Moved folder ${folderName}.`);
  };

  const handleRenameFile = (fileId: string, newName: string) => {
    if (!workspace) return;
    const file = workspace.files.find((f) => f.id === fileId);
    if (!file) return;
    const parentPath = getWorkspaceParentPath(file.path);
    const newPath = parentPath ? `${parentPath}/${newName}` : newName;
    const nextFiles = workspace.files.map((f) =>
      f.id === fileId ? { ...f, name: newName, path: newPath } : f,
    );
    persist({ ...workspace, files: nextFiles });
    setStatusMessage(`Renamed to ${newName}.`);
  };

  const handleRenameFolder = (oldPath: string, newName: string) => {
    if (!workspace) return;
    const parentPath = getWorkspaceParentPath(oldPath);
    const newPath = parentPath ? `${parentPath}/${newName}` : newName;
    const nextFolders = workspace.folders.map((f) => {
      if (f === oldPath) return newPath;
      if (f.startsWith(`${oldPath}/`)) {
        return `${newPath}${f.slice(oldPath.length)}`;
      }
      return f;
    });
    const nextFiles = workspace.files.map((file) => {
      if (file.path === oldPath || file.path.startsWith(`${oldPath}/`)) {
        return { ...file, path: `${newPath}${file.path.slice(oldPath.length)}` };
      }
      return file;
    });
    persist({ ...workspace, files: nextFiles, folders: nextFolders });
    setStatusMessage(`Renamed folder to ${newName}.`);
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
    onNewFile: handleCreateFile,
    onRun: handleRun,
    onSave: handleSave,
  });

  if (!profile || !workspace || !activeFile) return null;

  const firstName = profile.name.trim().split(/\s+/)[0] || "User";

  return (
    <main className="h-screen w-screen overflow-hidden bg-[#000000] text-[#f4f4f5] flex flex-col font-sans select-none antialiased">
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
      {/* 1. TOP NAVBAR (Slim, Glassmorphism, 40px Height)                          */}
      {/* ========================================================================= */}
      <header className="h-10 shrink-0 bg-black/85 backdrop-blur-md border-b border-white/10 px-3 flex items-center justify-between z-30 relative select-none">
        {/* Left: Brand Logo & Monochrome Run/Save Controls */}
        <div className="flex items-center gap-3">
          <Link href="/" className="flex items-center gap-2 group transition-opacity duration-100 opacity-90 hover:opacity-100">
            <svg width="18" height="18" viewBox="0 0 128 128" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-zinc-100 group-hover:text-white">
              <path d="M18 10 L54 110 L64 90 L36 10 Z" fill="currentColor" />
              <path d="M110 10 L74 110 L64 90 L92 10 Z" fill="currentColor" />
              <path d="M80 8 L44 122" stroke="currentColor" strokeWidth="8" strokeLinecap="round" />
            </svg>
            <span className="font-semibold text-xs tracking-tight text-zinc-100 font-mono">
              VoidLAB
            </span>
          </Link>

          <div className="h-3 w-px bg-zinc-800" />

          {/* Monochrome Run Pill Button */}
          <button
            onClick={() => void handleRun()}
            disabled={loading || (!currentLanguage.runnable && !currentLanguage.previewable) || Boolean(interactiveSession)}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-medium rounded bg-zinc-100 hover:bg-white text-zinc-950 active:scale-[0.98] transition-all duration-100 shadow-sm disabled:opacity-40"
            title="Execute script (Ctrl+Enter)"
            type="button"
          >
            {loading ? (
              <Loader2 className="w-2.5 h-2.5 animate-spin text-zinc-950" />
            ) : (
              <Play className="w-2.5 h-2.5 fill-current" />
            )}
            <span className="font-mono font-semibold">Run</span>
          </button>

          {/* Monochrome Save Trigger */}
          <button
            onClick={handleSave}
            className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium rounded text-zinc-400 hover:text-zinc-100 hover:bg-zinc-900 border border-transparent hover:border-white/10 transition-colors duration-100"
            title="Save file (Ctrl+S)"
            type="button"
          >
            <Save className="w-3 h-3 stroke-current" />
            <span className="hidden sm:inline">Save</span>
          </button>

          {/* Status Message */}
          <span className="text-[10px] text-zinc-500 font-mono pl-1.5 truncate max-w-[140px]">
            {statusMessage}
          </span>
        </div>

        {/* Center: Active Path & Engine (JetBrains Mono) */}
        <div className="hidden md:flex items-center gap-2 px-2.5 py-0.5 rounded border border-white/10 bg-zinc-900/60 text-[10px] text-zinc-400 font-mono">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500/80" />
          <span className="text-zinc-200">{formatWorkspacePath(activeFile.path)}</span>
          <span className="text-zinc-600">/</span>
          <span className="text-zinc-400">{currentLanguage.label}</span>
        </div>

        {/* Right: Minimalist Text-Links & Settings Icon */}
        <div className="flex items-center gap-3">
          <nav className="flex items-center gap-3.5 text-xs text-zinc-400 font-medium">
            <Link href="/editor/manual" className="hover:text-zinc-100 transition-colors duration-100">
              Manual
            </Link>
            <a
              href="https://github.com/Voxion-Labs/VoidLAB"
              target="_blank"
              rel="noreferrer"
              className="hover:text-zinc-100 transition-colors duration-100 flex items-center gap-1"
            >
              GitHub
              <ExternalLink size={10} className="text-zinc-500" />
            </a>
            <Link href="/editor/collaboration" className="hover:text-zinc-100 transition-colors duration-100 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-zinc-500" />
              Collab
            </Link>
            <Link href="/editor/ai" className="hover:text-zinc-100 transition-colors duration-100">
              AI Guide
            </Link>
          </nav>

          <div className="h-3 w-px bg-zinc-800" />

          {/* Settings Trigger */}
          <button
            onClick={() => setIsSettingsOpen(true)}
            className="p-1 rounded text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/80 transition-colors duration-100"
            title="Workspace Settings (Language, Region, Shortcuts)"
            type="button"
          >
            <Settings size={14} />
          </button>

          {/* User Profile Avatar */}
          <Link
            href="/editor/profile"
            className="h-5 w-5 rounded bg-zinc-800 border border-white/10 flex items-center justify-center text-[10px] font-semibold text-zinc-300 hover:border-zinc-500 transition-colors duration-100"
            title="Profile & Activity"
          >
            {firstName.charAt(0).toUpperCase()}
          </Link>
        </div>
      </header>

      {/* ========================================================================= */}
      {/* 2. MAIN BODY (Ultra-Slim Sidebar + Split-Pane Workspace)                  */}
      {/* ========================================================================= */}
      <div className="flex-1 flex overflow-hidden min-h-0 relative bg-[#000000]">
        {/* ── Left: Ultra-Slim File Explorer ── */}
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
          onImportFiles={() => fileImportRef.current?.click()}
          onImportFolder={() => folderImportRef.current?.click()}
          onMoveFile={handleMoveFile}
          onMoveFolder={handleMoveFolder}
          onOpenSettings={() => setIsSettingsOpen(true)}
          onRenameFile={handleRenameFile}
          onRenameFolder={handleRenameFolder}
          onSelectFile={handleSelectFile}
        />

        {/* ── Right: Split-Pane Workspace ── */}
        <div className="flex-1 flex flex-col h-full min-w-0 overflow-hidden relative bg-[#000000]">
          {/* Top Pane: Monaco Code Editor */}
          <section
            style={{ height: `${editorHeightPercent}%` }}
            className="flex flex-col min-h-[140px] overflow-hidden bg-[#000000] relative"
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
                theme="vs-dark"
                value={activeFile.content}
              />
            </div>
          </section>

          {/* Resizable Divider Drag Handle */}
          <div
            onMouseDown={() => {
              isDraggingRef.current = true;
              document.body.style.cursor = "row-resize";
              document.body.style.userSelect = "none";
            }}
            onDoubleClick={() => setEditorHeightPercent(75)}
            className="h-1 bg-zinc-900 hover:bg-zinc-600 active:bg-zinc-400 cursor-row-resize transition-all duration-100 z-20 flex items-center justify-center group shrink-0"
            title="Drag up/down to resize terminal (Double click to reset 75/25 split)"
          >
            <div className="w-6 h-[1.5px] rounded-full bg-zinc-700 group-hover:bg-zinc-300 transition-colors" />
          </div>

          {/* Bottom Pane: Fixed Anchored Terminal */}
          <section
            style={{ height: `${100 - editorHeightPercent}%` }}
            className="min-h-[90px] overflow-hidden relative"
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
              onResetSplit={() => setEditorHeightPercent(75)}
              onRun={() => void handleRun()}
              pendingInteractiveInput={pendingInteractiveInput}
              stdin={stdin}
              transcript={transcript}
            />
          </section>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 3. WORKSPACE SETTINGS MODAL (Language, Region, Shortcuts)                 */}
      {/* ========================================================================= */}
      {isSettingsOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsSettingsOpen(false);
          }}
        >
          <div className="w-full max-w-md bg-[#09090b] border border-white/10 rounded-lg shadow-2xl p-5 space-y-4 text-zinc-200 font-sans">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2">
                <Settings size={16} className="text-zinc-300" />
                <h3 className="font-semibold text-sm text-zinc-100">Workspace Settings</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsSettingsOpen(false)}
                className="text-zinc-400 hover:text-white p-1 rounded hover:bg-zinc-800 transition-colors"
              >
                <X size={15} />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              {/* Language Runtime Selection */}
              <div className="space-y-1.5">
                <label className="font-medium text-zinc-300 block text-[11px]">Active Language Runtime</label>
                <select
                  className="w-full bg-[#000000] border border-white/10 rounded px-3 py-2 text-zinc-200 outline-none focus:border-zinc-500 font-mono text-xs cursor-pointer"
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
                <label className="font-medium text-zinc-300 block text-[11px]">Execution Sandbox Region</label>
                <select
                  className="w-full bg-[#000000] border border-white/10 rounded px-3 py-2 text-zinc-200 outline-none focus:border-zinc-500 font-mono text-xs cursor-pointer"
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
              <div className="space-y-1.5 pt-2 border-t border-white/10">
                <span className="font-medium text-zinc-400 block text-[11px]">Shortcuts Cheatsheet</span>
                <div className="grid grid-cols-2 gap-1.5 text-[10px] font-mono text-zinc-400">
                  <div className="flex justify-between bg-zinc-950 p-1.5 rounded border border-white/5">
                    <span>Run script:</span>
                    <kbd className="text-zinc-200">Ctrl+Enter</kbd>
                  </div>
                  <div className="flex justify-between bg-zinc-950 p-1.5 rounded border border-white/5">
                    <span>Save workspace:</span>
                    <kbd className="text-zinc-200">Ctrl+S</kbd>
                  </div>
                  <div className="flex justify-between bg-zinc-950 p-1.5 rounded border border-white/5">
                    <span>New file:</span>
                    <kbd className="text-zinc-200">Ctrl+Shift+N</kbd>
                  </div>
                  <div className="flex justify-between bg-zinc-950 p-1.5 rounded border border-white/5">
                    <span>Close modal:</span>
                    <kbd className="text-zinc-200">Escape</kbd>
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-2 pt-3 border-t border-white/10">
              <button
                type="button"
                onClick={() => setIsSettingsOpen(false)}
                className="px-3 py-1.5 text-xs rounded bg-zinc-100 hover:bg-white text-zinc-950 font-medium transition-colors"
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
