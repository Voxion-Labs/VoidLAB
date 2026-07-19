"use client";

import { useMemo, useState } from "react";
import { Check, Copy, Github, GitBranch, UploadCloud } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  defaultGitState,
  persistWorkspace,
  readWorkspace,
  type GitHubState,
  type WorkspaceState,
} from "@/lib/workspace";

const readInitialWorkspace = () => {
  if (typeof window === "undefined") return null;
  return readWorkspace();
};

const gitCommandGroups = [
  {
    title: "Initialize",
    commands: ["git init", "git status", "git branch -M main"],
  },
  {
    title: "Stage and commit",
    commands: ["git add .", "git diff --staged", 'git commit -m "Ship VoidLAB workspace"'],
  },
  {
    title: "Remote",
    commands: ["git remote -v", "git remote add origin <repo-url>", "git push -u origin main"],
  },
  {
    title: "Daily workflow",
    commands: ["git pull --rebase", "git checkout -b feature/local-work", "git log --oneline --decorate"],
  },
];

export default function GitHubWorkspacePanel() {
  const [workspace, setWorkspace] = useState<WorkspaceState | null>(() => readInitialWorkspace());
  const [gitState, setGitState] = useState<GitHubState>(() => readInitialWorkspace()?.gitState ?? defaultGitState);
  const [copied, setCopied] = useState("");
  const [status, setStatus] = useState("GitHub actions are local command helpers in this backend-less build.");

  const activeFile = useMemo(
    () => workspace?.files.find((file) => file.id === workspace.activeFileId) ?? workspace?.files[0] ?? null,
    [workspace],
  );

  const allCommands = useMemo(
    () =>
      [
        "git init",
        `git checkout -B ${gitState.branch || "main"}`,
        "git add .",
        'git commit -m "Ship the latest VoidLAB update"',
        gitState.repoUrl ? `git remote add origin ${gitState.repoUrl}` : "git remote add origin <repo-url>",
        `git push -u origin ${gitState.branch || "main"}`,
      ].join("\n"),
    [gitState.branch, gitState.repoUrl],
  );

  const persistGitState = (nextGitState: GitHubState) => {
    if (!workspace) return;
    const nextWorkspace = { ...workspace, gitState: nextGitState };
    setWorkspace(nextWorkspace);
    setGitState(nextGitState);
    persistWorkspace(nextWorkspace);
  };

  const copy = async (label: string, value: string) => {
    await navigator.clipboard.writeText(value);
    setCopied(label);
    window.setTimeout(() => setCopied(""), 1600);
  };

  const fakePush = () => {
    setStatus("Fake push complete. No network call was made. Use the copied commands in your own terminal when ready.");
  };

  if (!workspace || !activeFile) return null;

  return (
    <section className="panel rounded-[6px] p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm font-semibold theme-text-strong">
          <Github size={16} />
          GitHub command center
        </div>
        <Button onClick={fakePush} type="button">
          <UploadCloud size={15} />
          Fake push
        </Button>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="theme-surface rounded-[6px] p-4 text-sm theme-muted">
          <div className="text-xs uppercase tracking-[0.18em]">Active file</div>
          <div className="mt-2 font-medium theme-text-strong">{activeFile.path}</div>
          <div className="mt-2">Workspace files: {workspace.files.length}</div>
        </div>
        <div className="theme-surface rounded-[6px] p-4 text-sm theme-muted">
          <div className="text-xs uppercase tracking-[0.18em]">Mode</div>
          <div className="mt-2 font-medium theme-text-strong">Command reference only</div>
          <div className="mt-2">No OAuth, no backend push endpoint, no hidden network action.</div>
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="mb-2 block text-sm theme-muted">Repository URL</span>
          <input className="theme-input w-full rounded-[6px] px-4 py-3 text-sm outline-none" onChange={(event) => persistGitState({ ...gitState, repoUrl: event.target.value })} placeholder="https://github.com/user/repo.git" value={gitState.repoUrl} />
        </label>
        <label className="block">
          <span className="mb-2 block text-sm theme-muted">Branch</span>
          <div className="relative">
            <GitBranch className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 theme-muted" size={15} />
            <input className="theme-input w-full rounded-[6px] py-3 pl-11 pr-4 text-sm outline-none" onChange={(event) => persistGitState({ ...gitState, branch: event.target.value })} placeholder="main" value={gitState.branch} />
          </div>
        </label>
      </div>

      <div className="theme-surface mt-4 rounded-[6px] px-4 py-3 text-sm theme-muted">{status}</div>

      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        {gitCommandGroups.map((group) => (
          <div className="theme-surface rounded-[6px] p-4" key={group.title}>
            <div className="mb-3 text-sm font-semibold theme-text-strong">{group.title}</div>
            <pre className="whitespace-pre-wrap break-words text-xs leading-6 theme-muted">{group.commands.join("\n")}</pre>
            <div className="mt-3">
              <Button onClick={() => void copy(group.title, group.commands.join("\n"))} tone="secondary" type="button">
                {copied === group.title ? <Check size={15} /> : <Copy size={15} />}
                {copied === group.title ? "Copied" : "Copy"}
              </Button>
            </div>
          </div>
        ))}
      </div>

      <div className="theme-surface mt-4 rounded-[6px] p-4">
        <div className="mb-3 text-sm font-semibold theme-text-strong">Workspace publish recipe</div>
        <pre className="whitespace-pre-wrap break-words text-xs leading-6 theme-muted">{allCommands}</pre>
        <div className="mt-4">
          <Button onClick={() => void copy("all", allCommands)} tone="secondary" type="button">
            {copied === "all" ? <Check size={15} /> : <Copy size={15} />}
            {copied === "all" ? "Copied recipe" : "Copy full recipe"}
          </Button>
        </div>
      </div>
    </section>
  );
}
