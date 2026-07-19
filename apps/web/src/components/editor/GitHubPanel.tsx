`"use client";

import { useState } from "react";
import { Check, CheckCircle2, Copy, GitBranch, Github, Terminal, UploadCloud } from "lucide-react";

type GitCommand = {
  cmd: string;
  desc: string;
};

type GitCategory = {
  title: string;
  icon: string;
  commands: GitCommand[];
};

const GIT_REFERENCE: GitCategory[] = [
  {
    title: "Setup & Config",
    icon: "⚙️",
    commands: [
      { cmd: "git config --global user.name \"Your Name\"", desc: "Set your global username" },
      { cmd: "git config --global user.email \"you@example.com\"", desc: "Set your global email" },
      { cmd: "git config --list", desc: "List all config settings" },
      { cmd: "git init", desc: "Initialize a new local repository" },
      { cmd: "git clone <url>", desc: "Clone a remote repository locally" },
    ],
  },
  {
    title: "Staging & Committing",
    icon: "📦",
    commands: [
      { cmd: "git status", desc: "Show working tree status" },
      { cmd: "git add .", desc: "Stage all changes" },
      { cmd: "git add <file>", desc: "Stage a specific file" },
      { cmd: "git commit -m \"message\"", desc: "Commit with a message" },
      { cmd: "git commit --amend", desc: "Amend the last commit" },
      { cmd: "git diff", desc: "Show unstaged changes" },
      { cmd: "git diff --staged", desc: "Show staged changes" },
    ],
  },
  {
    title: "Branching",
    icon: "🌿",
    commands: [
      { cmd: "git branch", desc: "List local branches" },
      { cmd: "git branch -a", desc: "List all branches (local + remote)" },
      { cmd: "git branch <name>", desc: "Create a new branch" },
      { cmd: "git checkout <branch>", desc: "Switch to a branch" },
      { cmd: "git checkout -b <branch>", desc: "Create and switch to a new branch" },
      { cmd: "git switch <branch>", desc: "Switch branches (modern syntax)" },
      { cmd: "git merge <branch>", desc: "Merge a branch into the current branch" },
      { cmd: "git branch -d <name>", desc: "Delete a branch" },
      { cmd: "git rebase <branch>", desc: "Rebase current branch onto another" },
    ],
  },
  {
    title: "Remote & Push",
    icon: "🚀",
    commands: [
      { cmd: "git remote add origin <url>", desc: "Link local repo to a remote" },
      { cmd: "git remote -v", desc: "Show remote URLs" },
      { cmd: "git push origin <branch>", desc: "Push branch to remote" },
      { cmd: "git push -u origin main", desc: "Push and set upstream for main" },
      { cmd: "git push --force", desc: "Force push (use with caution)" },
      { cmd: "git fetch origin", desc: "Download remote changes without merging" },
      { cmd: "git pull origin <branch>", desc: "Fetch and merge remote changes" },
      { cmd: "git pull --rebase", desc: "Pull with rebase instead of merge" },
    ],
  },
  {
    title: "Inspection & History",
    icon: "🔍",
    commands: [
      { cmd: "git log --oneline", desc: "Show compact commit history" },
      { cmd: "git log --graph --all", desc: "Visual branch graph" },
      { cmd: "git show <commit>", desc: "Show a specific commit" },
      { cmd: "git blame <file>", desc: "Show who changed each line" },
      { cmd: "git stash", desc: "Stash uncommitted changes" },
      { cmd: "git stash pop", desc: "Re-apply the latest stash" },
      { cmd: "git stash list", desc: "List all stashes" },
    ],
  },
  {
    title: "Undo & Reset",
    icon: "↩️",
    commands: [
      { cmd: "git restore <file>", desc: "Discard changes in working directory" },
      { cmd: "git restore --staged <file>", desc: "Unstage a file" },
      { cmd: "git reset HEAD~1", desc: "Undo last commit, keep changes staged" },
      { cmd: "git reset --hard HEAD~1", desc: "Undo last commit, discard changes" },
      { cmd: "git revert <commit>", desc: "Create a new commit that undoes a commit" },
      { cmd: "git clean -fd", desc: "Remove untracked files and directories" },
    ],
  },
  {
    title: "Tags & Releases",
    icon: "🏷️",
    commands: [
      { cmd: "git tag v1.0.0", desc: "Create a lightweight tag" },
      { cmd: "git tag -a v1.0.0 -m \"Release\"", desc: "Create an annotated tag" },
      { cmd: "git push origin --tags", desc: "Push all tags to remote" },
      { cmd: "git tag -d v1.0.0", desc: "Delete a local tag" },
    ],
  },
];

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <button
      className="shrink-0 rounded-sm p-1.5 transition hover:opacity-70"
      style={{
        background: "var(--control-background)",
        border: "1px solid var(--border)",
        color: copied ? "var(--accent)" : "var(--muted)",
      }}
      onClick={() => void handleCopy()}
      title="Copy command"
      type="button"
    >
      {copied ? <Check size={12} /> : <Copy size={12} />}
    </button>
  );
}

export default function GitHubPanel() {

  const [repoUrl, setRepoUrl] = useState("");
  const [branch, setBranch] = useState("main");
  const [copiedAll, setCopiedAll] = useState(false);

  const quickCommands = [
    `git init`,
    `git add.`,
    `git commit - m "Initial commit from VoidLAB"`,
    repoUrl ? `git remote add origin ${ repoUrl } ` : `git remote add origin https://github.com/user/repo.git`,
`git push -u origin ${branch || "main"}`,
  ].join("\n");



const handleCopyAll = async () => {
  await navigator.clipboard.writeText(quickCommands);
  setCopiedAll(true);
  setTimeout(() => setCopiedAll(false), 2000);
};

return (
  <div className="space-y-4">
    {/* ── Push section ─────────────────────────────────────── */}
    <section
      className="rounded-sm p-5"
      style={{ background: "var(--surface-soft)", border: "1px solid var(--border)" }}
    >
      <div className="flex items-center gap-2 mb-4">
        <Github size={16} style={{ color: "var(--accent)" }} />
        <span className="text-sm font-semibold theme-text-strong">GitHub publish target</span>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="block text-xs font-semibold uppercase tracking-widest theme-muted mb-1.5">
            Repository URL
          </label>
          <input
            className="w-full rounded-sm px-3 py-2.5 text-sm outline-none theme-text"
            style={{ background: "var(--input-background)", border: "1px solid var(--border)" }}
            onChange={(e) => setRepoUrl(e.target.value)}
            placeholder="https://github.com/user/repo.git"
            value={repoUrl}
          />
        </div>
        <div>
          <label className="block text-xs font-semibold uppercase tracking-widest theme-muted mb-1.5">
            Branch
          </label>
          <div className="relative">
            <GitBranch
              size={14}
              className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
              style={{ color: "var(--muted)" }}
            />
            <input
              className="w-full rounded-sm py-2.5 pl-9 pr-3 text-sm outline-none theme-text"
              style={{ background: "var(--input-background)", border: "1px solid var(--border)" }}
              onChange={(e) => setBranch(e.target.value)}
              placeholder="main"
              value={branch}
            />
          </div>
        </div>
      </div>


    </section>

    {/* ── Quick commands ────────────────────────────────────── */}
    <section
      className="rounded-sm p-5"
      style={{ background: "var(--surface-soft)", border: "1px solid var(--border)" }}
    >
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-2">
          <Terminal size={15} style={{ color: "var(--accent)" }} />
          <span className="text-sm font-semibold theme-text-strong">Quick push sequence</span>
        </div>
        <button
          className="inline-flex items-center gap-1.5 rounded-sm px-3 py-1.5 text-xs font-semibold transition hover:opacity-80"
          style={{
            background: "var(--control-background)",
            border: "1px solid var(--border)",
            color: "var(--text)",
          }}
          onClick={() => void handleCopyAll()}
          type="button"
        >
          {copiedAll ? <Check size={12} /> : <Copy size={12} />}
          {copiedAll ? "Copied!" : "Copy all"}
        </button>
      </div>
      <pre
        className="rounded-sm p-4 text-xs leading-7 font-mono overflow-x-auto"
        style={{
          background: "var(--terminal-bg)",
          border: "1px solid var(--border)",
          color: "var(--terminal-text)",
        }}
      >
        {quickCommands}
      </pre>
      <p className="mt-2 text-xs theme-muted">
        Paste this sequence into your local terminal to push to GitHub.
      </p>
    </section>

    {/* ── Full git reference ────────────────────────────────── */}
    <section
      className="rounded-sm p-5"
      style={{ background: "var(--surface-soft)", border: "1px solid var(--border)" }}
    >
      <div className="text-sm font-semibold theme-text-strong mb-4">
        Git command reference
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {GIT_REFERENCE.map((cat) => (
          <div
            key={cat.title}
            className="rounded-sm p-4"
            style={{ background: "var(--panel-background)", border: "1px solid var(--border)" }}
          >
            <div className="flex items-center gap-2 text-sm font-semibold theme-text-strong mb-3">
              <span>{cat.icon}</span>
              {cat.title}
            </div>
            <div className="space-y-2">
              {cat.commands.map((c) => (
                <div
                  key={c.cmd}
                  className="group flex items-center justify-between gap-2 rounded-sm px-2 py-1.5 transition hover:opacity-80"
                  style={{ background: "var(--surface-soft)" }}
                >
                  <div className="min-w-0">
                    <div className="font-mono text-xs truncate" style={{ color: "var(--accent)" }}>
                      {c.cmd}
                    </div>
                    <div className="text-xs theme-muted mt-0.5">{c.desc}</div>
                  </div>
                  <CopyButton text={c.cmd} />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  </div>
);
}
