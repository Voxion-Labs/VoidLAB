"use client";

import { ChangeEvent, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Download, FileCode2, Loader2, Menu, Play, Save, Sparkles } from "lucide-react";
import EditorTabs from "@/components/editor/EditorTabs";
import FileExplorer from "@/components/editor/FileExplorer";
import MonacoEditor from "@/components/editor/MonacoEditor";
import Sidebar from "@/components/editor/Sidebar";
import TerminalBox, { type OutputTranscriptEntry } from "@/components/editor/TerminalBox";
import ToolLauncherBar from "@/components/editor/ToolLauncherBar";
import Brand from "@/components/layout/Brand";
import SessionControls from "@/components/layout/SessionControls";
import ThemeSwitcher from "@/components/layout/ThemeSwitcher";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/context/ThemeContext";
import { useUser } from "@/context/UserContext";
import { useCompiler } from "@/hooks/useCompiler";
import {
  analyzeInteractiveExecution,
  countBufferedStdinLines,
} from "@/lib/execution";
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
  replaceExtension,
  type ProjectFile,
  type WorkspaceState,
} from "@/lib/workspace";
import { useRouter } from "next/navigation";

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

const formatTranscriptInput = (value: string) =>
  value
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split("\n")
    .map((line) => `> ${line.length ? line : "[blank line]"}`)
    .join("\n");
const stdinCaptureMessage = "Input required for execution. Please enter values below:";

export default function EditorPage() {
  const router = useRouter();
  const { editorTheme } = useTheme();
  const { isReady, profile, recordActivity } = useUser();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [workspace, setWorkspace] = useState<WorkspaceState | null>(() =>
    typeof window === "undefined" ? null : readWorkspace(),
  );
  const [draftName, setDraftName] = useState("src/main");
  const [statusMessage, setStatusMessage] = useState("Workspace initialized.");
  const [stdin, setStdin] = useState("");
  const [pendingInteractiveInput, setPendingInteractiveInput] = useState("");
  const [interactiveSession, setInteractiveSession] = useState<InteractiveSession | null>(null);
  const [transcript, setTranscript] = useState<OutputTranscriptEntry[]>([]);
  const [consoleTabResetToken, setConsoleTabResetToken] = useState(0);
  const [commandInput, setCommandInput] = useState("");
  const { error, execution, loading, runCode, cancelExecution, resetExecutionState } = useCompiler();
  const fileImportRef = useRef<HTMLInputElement>(null);
  const folderImportRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    folderImportRef.current?.setAttribute("webkitdirectory", "");
    folderImportRef.current?.setAttribute("directory", "");
  }, []);

  // Cancel any in-flight execution when the page unmounts
  useEffect(() => () => { cancelExecution(); }, [cancelExecution]);

  useEffect(() => {
    if (!isReady) return;

    if (!profile) {
      router.replace("/");
    }
  }, [isReady, profile, router]);

  const persist = (nextWorkspace: WorkspaceState) => {
    const normalized = normalizeWorkspaceState(nextWorkspace);
    setWorkspace(normalized);
    persistWorkspace(normalized);
  };

  const activeFile = workspace?.files.find((file) => file.id === workspace.activeFileId) ?? workspace?.files[0];
  const currentLanguage = getLanguageById(activeFile?.languageId ?? DEFAULT_LANGUAGE.id);
  const [draftLanguage, setDraftLanguage] = useState(
    workspace?.files.find((file) => file.id === workspace.activeFileId)?.languageId ?? DEFAULT_LANGUAGE.id,
  );

  const handleSelectFile = (id: string) => {
    if (!workspace) return;
    clearInteractiveCapture();

    const nextWorkspace = {
      ...workspace,
      activeFileId: id,
    };

    persist(nextWorkspace);
    setDraftLanguage(nextWorkspace.files.find((file) => file.id === id)?.languageId ?? DEFAULT_LANGUAGE.id);
  };

  const handleCreateFile = () => {
    if (!workspace) return;

    const nextFile = createWorkspaceFile(
      draftName || "main",
      draftLanguage,
      workspace.files,
      workspace.terminal.cwd,
    );

    const nextWorkspace = {
      ...workspace,
      activeFileId: nextFile.id,
      files: [...workspace.files, nextFile],
      folders: workspace.folders.includes(getWorkspaceParentPath(nextFile.path))
        ? workspace.folders
        : [
            ...workspace.folders,
            ...(() => {
              const parentPath = getWorkspaceParentPath(nextFile.path);
              return parentPath ? [parentPath] : [];
            })(),
          ],
    };

    persist(nextWorkspace);
    setDraftName(`src/module-${nextWorkspace.files.length + 1}`);
    setStatusMessage(`${formatWorkspacePath(nextFile.path)} created.`);
    recordActivity({
      detail: `Created ${formatWorkspacePath(nextFile.path)} in the workspace explorer.`,
      title: "File created",
      type: "workspace",
    });
  };

  const handleCreateFolder = (folderName: string) => {
    if (!workspace) return;

    const nextFolderPath = createFolderPath(folderName, workspace.folders, workspace.files, workspace.terminal.cwd);

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

    if (workspace.files.length === 1) {
      setStatusMessage("At least one file must stay open.");
      return;
    }

    const targetFile = workspace.files.find((file) => file.id === id);
    const nextFiles = workspace.files.filter((file) => file.id !== id);
    const nextActiveFileId =
      workspace.activeFileId === id ? nextFiles[Math.max(0, nextFiles.length - 1)].id : workspace.activeFileId;

    persist({
      ...workspace,
      activeFileId: nextActiveFileId,
      files: nextFiles,
    });

    if (targetFile) {
      setStatusMessage(`${formatWorkspacePath(targetFile.path)} removed.`);
      recordActivity({
        detail: `Removed ${formatWorkspacePath(targetFile.path)} from the workspace.`,
        title: "File removed",
        type: "workspace",
      });
    }
  };

  const handleDeleteFolder = (path: string) => {
    if (!workspace) return;

    const nextFiles = workspace.files.filter(
      (file) => file.path !== path && !file.path.startsWith(`${path}/`),
    );
    const nextFolders = workspace.folders.filter(
      (folder) => folder !== path && !folder.startsWith(`${path}/`),
    );
    const fallbackFile = nextFiles[0] ?? workspace.files[0];

    persist({
      ...workspace,
      activeFileId: nextFiles.some((file) => file.id === workspace.activeFileId)
        ? workspace.activeFileId
        : fallbackFile.id,
      files: nextFiles,
      folders: nextFolders,
    });

    setStatusMessage(`${formatWorkspacePath(path)} removed.`);
    recordActivity({
      detail: `Removed folder ${formatWorkspacePath(path)} and its nested entries.`,
      title: "Folder removed",
      type: "workspace",
    });
  };

  const handleLanguageChange = (nextLanguageId: string) => {
    if (!workspace || !activeFile) return;
    clearInteractiveCapture();

    const selectedLanguage = getLanguageById(nextLanguageId);
    const nextFiles = workspace.files.map((file) =>
      file.id === activeFile.id
        ? {
            ...file,
            languageId: selectedLanguage.id,
            name: replaceExtension(file.name, selectedLanguage.extension),
            path: normalizeWorkspacePath(
              `${getWorkspaceParentPath(file.path) ? `${getWorkspaceParentPath(file.path)}/` : ""}${replaceExtension(file.name, selectedLanguage.extension)}`,
            ),
          }
        : file,
    );

    persist({
      ...workspace,
      files: nextFiles,
    });
    setStatusMessage(`${selectedLanguage.label} ready.`);
  };

  const handleCodeChange = (value: string) => {
    if (!workspace || !activeFile) return;
    clearInteractiveCapture();

    persist({
      ...workspace,
      files: workspace.files.map((file) =>
        file.id === activeFile.id ? { ...file, content: value } : file,
      ),
    });
  };

  const handleSave = () => {
    if (!workspace || !activeFile) return;

    persist(workspace);
    setStatusMessage("Workspace saved locally.");
    recordActivity({
      detail: `Saved the workspace while focused on ${formatWorkspacePath(activeFile.path)}.`,
      title: "Workspace saved",
      type: "save",
    });
  };

  const pushTranscriptEntries = (...entries: OutputTranscriptEntry[]) => {
    setTranscript((current) => [...current, ...entries]);
  };

  const clearInteractiveCapture = () => {
    setInteractiveSession(null);
    setPendingInteractiveInput("");
    setStdin("");
    resetExecutionState();
  };

  const focusOutputPane = () => {
    setConsoleTabResetToken((current) => current + 1);
  };

  const resetInteractiveInput = () => {
    setPendingInteractiveInput("");

    if (!interactiveSession) {
      setStatusMessage("Input cleared.");
      return;
    }

    setTranscript([
      createTranscriptEntry("status", `[system] ${stdinCaptureMessage}`),
      createTranscriptEntry("prompt", `[voidlab] ${interactiveSession.helperText}`),
      createTranscriptEntry("prompt", `${interactiveSession.promptLabel}:`),
    ]);
    setStatusMessage("Input cleared. Enter stdin in the Output panel, then click Run.");
  };

  const runWithStdin = async (
    stdinPayload: string,
    options?: {
      preserveTranscript?: boolean;
      transcriptInput?: string;
    },
  ) => {
    if (!workspace || !activeFile) return;

    const normalizedPayload = typeof stdinPayload === "string" ? stdinPayload : "";
    const bufferedLineCount = countBufferedStdinLines(normalizedPayload);

    focusOutputPane();
    setInteractiveSession(null);
    setPendingInteractiveInput("");
    setStdin(normalizedPayload);
    const nextEntries = [
      createTranscriptEntry(
        "status",
        `[system] Running ${currentLanguage.label} on ${formatWorkspacePath(activeFile.path)}.`,
      ),
      ...(bufferedLineCount && options?.transcriptInput
        ? [createTranscriptEntry("input", `[stdin]\n${formatTranscriptInput(options.transcriptInput)}`)]
        : []),
    ];

    setTranscript((current) => (options?.preserveTranscript ? [...current, ...nextEntries] : nextEntries));

    const result = await runCode(currentLanguage, activeFile.content, normalizedPayload);
    const status = result.result?.status.description ?? (result.ok ? "Success" : "Failed");
    const timedOut = Boolean(("tleSuggestion" in result && result.tleSuggestion) || result.result?.timedOut);

    setPendingInteractiveInput("");
    setStdin("");

    if (result.error) {
      if (timedOut) {
        pushTranscriptEntries(
          createTranscriptEntry(
            "timeout",
            `[timeout] ${result.error}`,
          ),
        );
      } else {
        pushTranscriptEntries(createTranscriptEntry("error", `[gateway] ${result.error}`));
      }
    }

    if (result.result?.compileOutput) {
      pushTranscriptEntries(createTranscriptEntry("error", result.result.compileOutput));
    }

    if (result.result?.stderr) {
      pushTranscriptEntries(createTranscriptEntry("error", result.result.stderr));
    }

    if (result.result?.stdout) {
      pushTranscriptEntries(createTranscriptEntry("stdout", result.result.stdout));
    }

    if (result.result?.message) {
      if (result.result.message !== result.error) {
        pushTranscriptEntries(createTranscriptEntry(timedOut ? "timeout" : "status", result.result.message));
      }
    }

    if (
      !timedOut &&
      !result.result?.stdout &&
      !result.result?.stderr &&
      !result.result?.compileOutput &&
      !result.result?.message
    ) {
      pushTranscriptEntries(createTranscriptEntry("status", "[system] Program finished without visible output."));
    }

    pushTranscriptEntries(
      createTranscriptEntry(
        timedOut ? "timeout" : result.ok ? "success" : "error",
        `[result] ${currentLanguage.label} finished with ${status}.`,
      ),
    );

    setStatusMessage(
      timedOut
        ? "Execution timed out. Provide stdin values and run again."
        : result.ok
        ? `${currentLanguage.label} completed successfully.`
        : `${currentLanguage.label} finished with ${status}.`,
    );
    recordActivity({
      detail: `Ran ${formatWorkspacePath(activeFile.path)} with status ${status}.`,
      title: result.ok ? "Program executed" : "Program run needs attention",
      type: "run",
    });
  };

  const startInteractiveRun = () => {
    if (!activeFile) return;

    const plan = analyzeInteractiveExecution(currentLanguage.id, activeFile.content);
    const nextSession: InteractiveSession = {
      helperText: plan.summary,
      promptLabel: plan.prompts[0] ?? "stdin",
    };

    focusOutputPane();
    setInteractiveSession(nextSession);
    setPendingInteractiveInput("");
    setStdin("");
    resetExecutionState();
    setTranscript([
      createTranscriptEntry(
        "status",
        `[system] ${stdinCaptureMessage}`,
      ),
      createTranscriptEntry("prompt", `[voidlab] ${plan.summary}`),
      createTranscriptEntry("prompt", `${nextSession.promptLabel}:`),
    ]);
    setStatusMessage("Input required before execution. Finish stdin capture in the Output tab.");
  };

  const handleRun = async () => {
    if (!workspace || !activeFile) return;

    if (currentLanguage.previewable) {
      try {
        openPreview(workspace.files, activeFile.id);
        setStatusMessage(`${currentLanguage.label} preview opened in a new tab.`);
        recordActivity({
          detail: `Opened a live preview for ${formatWorkspacePath(activeFile.path)}.`,
          title: "Preview opened",
          type: "run",
        });
      } catch (previewError) {
        setStatusMessage(
          previewError instanceof Error ? previewError.message : "Preview could not be opened.",
        );
      }
      return;
    }

    if (!currentLanguage.runnable) {
      setStatusMessage(`${currentLanguage.label} is editor-only in this release.`);
      return;
    }

    if (interactiveSession) {
      const interactiveInput = pendingInteractiveInput.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

      if (!interactiveInput.length) {
        setStatusMessage("This program expects input. Enter stdin in the Output panel, then click Run.");
        return;
      }

      setStatusMessage(`Running ${currentLanguage.label} with provided stdin...`);
      await runWithStdin(interactiveInput, {
        preserveTranscript: true,
        transcriptInput: interactiveInput,
      });
      return;
    }

    const interactivePlan = analyzeInteractiveExecution(currentLanguage.id, activeFile.content);

    if (interactivePlan.requiresInput) {
      startInteractiveRun();
      return;
    }

    setStatusMessage(`Running ${currentLanguage.label}...`);
    await runWithStdin("");
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
    setStatusMessage("Current file downloaded.");
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
    recordActivity({
      detail: `Inserted fresh ${currentLanguage.label} boilerplate into ${formatWorkspacePath(activeFile.path)}.`,
      title: "Boilerplate inserted",
      type: "workspace",
    });
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
    importedFiles.forEach((file) => {
      existingByPath.set(file.path, file);
    });

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
    setStatusMessage(`${importedFiles.length} file${importedFiles.length > 1 ? "s" : ""} imported.`);
    recordActivity({
      detail: `Imported ${importedFiles.length} file${importedFiles.length > 1 ? "s" : ""} into the workspace.`,
      title: "Files imported",
      type: "workspace",
    });
  };

  const handleImportFiles = async (event: ChangeEvent<HTMLInputElement>) => {
    await importWorkspaceFiles(event.target.files, false);
    event.target.value = "";
  };

  const handleImportFolder = async (event: ChangeEvent<HTMLInputElement>) => {
    await importWorkspaceFiles(event.target.files, true);
    event.target.value = "";
  };

  const handleCommandRun = () => {
    if (!workspace || !commandInput.trim()) return;

    const trimmed = commandInput.trim();
    const result = executeWorkspaceCommand(workspace, trimmed);
    const nextWorkspace = result.clearHistory
      ? result.workspace
      : appendTerminalHistory(result.workspace, trimmed, result.output, result.status, result.cwd);

    persist(nextWorkspace);

    if (result.openFileId) {
      setStatusMessage(`Opened ${formatWorkspacePath(nextWorkspace.files.find((file) => file.id === result.openFileId)?.path ?? "")}.`);
    } else {
      setStatusMessage(result.output.split("\n")[0] || "Command completed.");
    }

    setCommandInput("");
    recordActivity({
      detail: `Ran workspace command "${trimmed}" in ${formatWorkspacePath(result.cwd)}.`,
      title: "Workspace command",
      type: "command",
    });
  };

  /* ── Move file to a different folder ─────────────────────── */
  const handleMoveFile = (fileId: string, targetFolder: string) => {
    if (!workspace) return;

    const file = workspace.files.find((f) => f.id === fileId);
    if (!file) return;

    const baseName = getWorkspaceBaseName(file.path);
    const newPath = targetFolder ? `${targetFolder}/${baseName}` : baseName;

    const nextFiles = workspace.files.map((f) =>
      f.id === fileId ? { ...f, path: newPath, name: baseName } : f
    );

    const nextFolders = new Set(workspace.folders);
    if (targetFolder) nextFolders.add(targetFolder);

    persist({ ...workspace, files: nextFiles, folders: Array.from(nextFolders) });
    setStatusMessage(`Moved ${baseName} to ${targetFolder || "root"}.`);
  };

  /* ── Move folder to a different parent ─────────────────────── */
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

  /* ── Rename file ─────────────────────────────────────── */
  const handleRenameFile = (fileId: string, newName: string) => {
    if (!workspace) return;
    
    const file = workspace.files.find((f) => f.id === fileId);
    if (!file) return;

    const parentPath = getWorkspaceParentPath(file.path);
    const newPath = parentPath ? `${parentPath}/${newName}` : newName;

    const nextFiles = workspace.files.map((f) =>
      f.id === fileId ? { ...f, name: newName, path: newPath } : f
    );

    persist({ ...workspace, files: nextFiles });
    setStatusMessage(`Renamed to ${newName}.`);
  };

  /* ── Rename folder ─────────────────────────────────────── */
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

  useShortcuts({
    onEscape: () => setIsSidebarOpen(false),
    onNewFile: handleCreateFile,
    onRun: handleRun,
    onSave: handleSave,
  });

  if (!profile || !workspace || !activeFile) return null;

  const firstName = profile.name.trim().split(/\s+/)[0] || "Builder";
  const interactivePromptLabel = interactiveSession?.promptLabel ?? "stdin";

  return (
    <main className="app-shell min-h-screen theme-text">
      <input
        className="hidden"
        multiple
        onChange={(event) => void handleImportFiles(event)}
        ref={fileImportRef}
        type="file"
      />
      <input
        className="hidden"
        multiple
        onChange={(event) => void handleImportFolder(event)}
        ref={folderImportRef}
        type="file"
      />
      <div className="flex min-h-screen flex-col">
        <header className="theme-header sticky top-0 z-30" style={{ borderBottom: "1px solid var(--border)" }}>
          <div className="flex flex-wrap items-center justify-between gap-4 px-4 py-3 sm:px-6">
            <div className="flex items-center gap-3">
              <button
                className="theme-button-secondary rounded-sm p-2 lg:hidden"
                onClick={() => setIsSidebarOpen((value) => !value)}
                type="button"
              >
                <Menu size={16} />
              </button>
              <div className="space-y-0.5">
                <Brand compact />
                <div className="theme-muted text-xs">
                  Hi {firstName}, your cloud workspace is ready.
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <ThemeSwitcher />
              <div className="theme-chip hidden rounded-sm px-3 py-1.5 text-xs sm:flex sm:items-center sm:gap-1.5">
                <Sparkles size={12} />
                {profile.region || "Global"}
              </div>
              <Link
                className="theme-button-secondary inline-flex items-center gap-2 rounded-sm px-3 py-1.5 text-xs transition"
                href="/editor/profile"
              >
                Profile
              </Link>
              <SessionControls />
            </div>
          </div>
        </header>

        <div className="flex flex-1 overflow-hidden">
          <Sidebar
            currentLanguage={currentLanguage}
            isOpen={isSidebarOpen}
            profile={profile}
            shortcutItems={[
              { key: "Ctrl/Cmd + Enter", label: "Run current file" },
              { key: "Ctrl/Cmd + S", label: "Save workspace locally" },
              { key: "Ctrl/Cmd + Shift + N", label: "Create a new project file" },
              { key: "Esc", label: "Close mobile side panels" },
            ]}
          />

          <section className="flex min-w-0 flex-1 flex-col overflow-y-auto px-4 py-4 sm:px-6">
            <div className="flex flex-col gap-4">
              <ToolLauncherBar />

              <section className="panel overflow-hidden rounded-sm">
                <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3" style={{ borderBottom: "1px solid var(--border)" }}>
                  <div>
                    <div className="theme-text-strong text-xs font-semibold uppercase tracking-widest">VoidLAB workspace</div>
                    <div className="theme-muted text-xs mt-0.5">
                      {formatWorkspacePath(activeFile.path)} · {currentLanguage.label}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <select
                      className="theme-select rounded-sm px-3 py-1.5 text-xs outline-none transition"
                      onChange={(event) => handleLanguageChange(event.target.value)}
                      value={currentLanguage.id}
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
                    <Button onClick={handleSave} tone="secondary" type="button">
                      <Save size={14} />
                      Save
                    </Button>
                    <Button onClick={handleDownload} tone="secondary" type="button">
                      <Download size={14} />
                      Export
                    </Button>
                    <Button onClick={handleInsertBoilerplate} tone="secondary" type="button">
                      <FileCode2 size={14} />
                      Boilerplate
                    </Button>
                    <Button
                      disabled={loading || (!currentLanguage.runnable && !currentLanguage.previewable) || Boolean(interactiveSession)}
                      onClick={() => void handleRun()}
                      type="button"
                    >
                      {loading ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
                      {loading ? "Running" : currentLanguage.previewable ? "Preview" : "Run"}
                    </Button>
                  </div>
                </div>

                <EditorTabs
                  activeFileId={activeFile.id}
                  files={workspace.files.map((file) => ({ id: file.id, name: file.name, path: file.path }))}
                  onCloseFile={handleDeleteFile}
                  onSelectFile={handleSelectFile}
                />

                <div className="grid min-h-[520px] md:grid-cols-[260px_minmax(0,1fr)]">
                  <FileExplorer
                    activeFileId={activeFile.id}
                    cwd={workspace.terminal.cwd}
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
                    onRenameFile={handleRenameFile}
                    onRenameFolder={handleRenameFolder}
                    onSelectFile={handleSelectFile}
                  />
                  <div className="min-h-[420px]">
                    <MonacoEditor
                      language={currentLanguage.monacoLanguage}
                      onChange={handleCodeChange}
                      path={activeFile.path}
                      theme={editorTheme}
                      value={activeFile.content}
                    />
                  </div>
                </div>

                <div
                  className="theme-muted flex flex-wrap items-center justify-between gap-2 px-4 py-2 text-xs"
                  style={{ borderTop: "1px solid var(--border)" }}
                >
                  <span>{statusMessage}</span>
                  <span>
                    {currentLanguage.runtimeLabel ??
                      (currentLanguage.previewable ? "Browser preview available" : "No runtime available")}
                  </span>
                </div>
              </section>

              <TerminalBox
                key={consoleTabResetToken}
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
                  promptLabel: interactivePromptLabel,
                }}
                loading={loading}
                onCommandChange={setCommandInput}
                onCommandRun={handleCommandRun}
                onInteractiveInputChange={setPendingInteractiveInput}
                onResetBufferedInput={resetInteractiveInput}
                onRun={() => void handleRun()}
                pendingInteractiveInput={pendingInteractiveInput}
                stdin={stdin}
                transcript={transcript}
              />
            </div>
          </section>
        </div>
      </div>
      <footer className="voidlab-footer">
        © 2025 Voxion Labs. All rights reserved.
      </footer>
    </main>
  );
}
