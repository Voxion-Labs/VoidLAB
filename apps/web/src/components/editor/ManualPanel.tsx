"use client";

import Image from "next/image";
import {
  BookOpenText,
  Bot,
  Command,
  Compass,
  FolderTree,
  Github,
  Layers3,
  Palette,
  PlayCircle,
  ShieldCheck,
  TerminalSquare,
  UserCircle2,
  Users2,
  WandSparkles,
} from "lucide-react";

const contents = [
  { href: "#overview", label: "Overview" },
  { href: "#workspace-map", label: "Workspace Map" },
  { href: "#execution-flow", label: "Execution Flow" },
  { href: "#console-tabs", label: "Unified Console" },
  { href: "#commands", label: "Workspace Commands" },
  { href: "#tool-hub", label: "Tool Hub" },
  { href: "#personalization", label: "Profile and Themes" },
  { href: "#deployment", label: "Deployment Checklist" },
] as const;

const quickFacts = [
  "Browser-based IDE with multi-file workspace and live execution",
  "Unified console with Output, Terminal, and Ports tabs",
  "Inline stdin capture for interactive Judge0-backed runs",
  "Dedicated pages for GitHub, collaboration, AI guidance, profile, and the manual itself",
] as const;

const startupSteps = [
  "Sign in, land in the editor, and confirm the active file in the workspace header.",
  "Create files or folders from the explorer, or import an existing set into the local workspace.",
  "Pick the active language from the top bar, write code, then use Run or Preview.",
  "Use the unified console to inspect stdout, stderr, compile output, runtime status, and workspace commands.",
  "Open the tool pages when you need GitHub publishing, collaboration, AI help, profile edits, or this handbook.",
] as const;

const commandReference = [
  { command: "help", description: "Shows the supported workspace commands available inside the built-in terminal." },
  { command: "pwd", description: "Prints the current workspace directory." },
  { command: "ls [path]", description: "Lists files and folders in the current or targeted directory." },
  { command: "tree [path]", description: "Renders a folder tree so you can inspect project structure quickly." },
  { command: "cd <path>", description: "Moves the workspace terminal to a different folder." },
  { command: "mkdir <path>", description: "Creates a folder and preserves the full folder chain." },
  { command: "touch <path>", description: "Creates a new file, infers the language by extension, and opens it." },
  { command: "open <path>", description: "Focuses an existing file in the editor." },
  { command: "cat <path>", description: "Prints file contents into the Terminal tab." },
  { command: "rm <path>", description: "Removes a file or folder path from the local workspace model." },
  { command: "clear", description: "Clears terminal history inside the workspace command view." },
] as const;

const toolCards = [
  {
    description: "Push the active file into a new or existing repository after linking GitHub.",
    icon: Github,
    title: "GitHub Publish",
  },
  {
    description: "Create rooms, share links, sync workspace state, and exchange room messages.",
    icon: Users2,
    title: "Collaboration",
  },
  {
    description: "Ask the built-in guide about workflows, debugging strategy, supported commands, and organization.",
    icon: Bot,
    title: "AI Guide",
  },
  {
    description: "Manage your bio, optional display picture, social links, and recent activity history.",
    icon: UserCircle2,
    title: "Profile",
  },
] as const;

const personalizationNotes = [
  "Display picture uploads are optional. Leaving the avatar empty is a valid clean state and does not block profile saves.",
  "The off-white theme (Fade white) is the default, designed for higher contrast with a refined cherry-red accent.",
  "The rich black theme pairs a deep dark background with vivid red highlights for an immersive coding experience.",
  "Workspace data, terminal history, and profile-side activity are stored locally in the browser experience unless synced through dedicated flows such as collaboration or GitHub publishing.",
] as const;

const deploymentChecklist = [
  "Confirm the active file and language before running or exporting.",
  "Use Preview for browser-native documents such as HTML, CSS, Markdown, JSON, or XML when applicable.",
  "If a program needs input, let VoidLAB collect stdin inline in Output before execution rather than using a detached input box.",
  "Review stdout, stderr, compile output, memory, time, and exit metadata in the Output tab after each run.",
  "Push a clean result to GitHub from the publish page once the file and branch target are correct.",
] as const;

function SectionHeader({
  eyebrow,
  title,
}: {
  eyebrow: string;
  title: string;
}) {
  return (
    <div>
      <div className="text-xs uppercase tracking-[0.24em] accent-text" style={{ opacity: 0.8 }}>{eyebrow}</div>
      <h2 className="mt-3 text-2xl font-semibold tracking-[-0.04em] theme-text-strong">{title}</h2>
    </div>
  );
}

export default function ManualPanel() {
  return (
    <section
      className="overflow-hidden rounded-[6px] p-1"
      style={{
        background: "var(--surface-soft)",
        border: "1px solid var(--border-strong)",
        boxShadow: "var(--shadow)",
      }}
    >
      <div
        className="rounded-[6px]"
        style={{ border: "1px solid var(--border)", background: "var(--panel-background)" }}
      >
        <div className="grid xl:grid-cols-[250px_minmax(0,1fr)]">
          <aside
            className="px-5 py-6"
            style={{ borderBottom: "1px solid var(--border)", borderRight: "none" }}
          >
            <style>{`@media (min-width: 1280px) { .manual-aside-border { border-bottom: none !important; border-right: 1px solid var(--border) !important; } }`}</style>
            <div
              className="manual-aside-border rounded-[6px] p-4"
              style={{ background: "var(--accent-soft)", border: "1px solid var(--border-strong)" }}
            >
              <div className="flex items-center gap-2 text-sm font-semibold accent-text">
                <BookOpenText size={16} />
                Operator handbook
              </div>
              <div className="mt-3 text-sm leading-6 theme-text" style={{ opacity: 0.85 }}>
                An illustrated field guide for the current VoidLAB workspace, execution flow,
                tool pages, and deploy-ready habits.
              </div>
            </div>

            <div className="mt-5">
              <div className="text-xs uppercase tracking-[0.24em] theme-muted">Contents</div>
              <nav className="mt-4 space-y-2">
                {contents.map((item) => (
                  <a
                    className="flex items-center justify-between rounded-[6px] px-4 py-3 text-sm theme-text transition hover:opacity-80"
                    href={item.href}
                    key={item.href}
                    style={{
                      border: "1px solid var(--border)",
                      background: "var(--control-background)",
                    }}
                  >
                    <span>{item.label}</span>
                    <span className="theme-muted">/</span>
                  </a>
                ))}
              </nav>
            </div>

            <div
              className="mt-5 rounded-[6px] p-4"
              style={{ border: "1px solid var(--border)", background: "var(--control-background)" }}
            >
              <div className="flex items-center gap-2 text-sm font-semibold theme-text-strong">
                <ShieldCheck size={16} />
                Deploy posture
              </div>
              <div className="mt-3 text-sm leading-6 theme-muted">
                Current editor flow is centered around clean theme surfaces, a unified console,
                and buffered stdin handling so interactive runs stay predictable.
              </div>
            </div>
          </aside>

          <div className="scrollbar-thin max-h-[900px] overflow-y-auto px-5 py-6 sm:px-6 lg:px-8">
            <div className="space-y-8">
              <section
                className="rounded-[6px] p-6"
                id="overview"
                style={{ border: "1px solid var(--border)", background: "var(--surface-soft)" }}
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="max-w-3xl">
                    <div
                      className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs uppercase tracking-[0.24em] accent-text"
                      style={{ background: "var(--accent-soft)", border: "1px solid var(--border-strong)" }}
                    >
                      <Compass size={14} />
                      System overview
                    </div>
                    <h1 className="mt-5 text-4xl font-semibold tracking-[-0.05em] theme-text-strong sm:text-5xl">
                      VoidLAB Operator Handbook
                    </h1>
                    <p className="mt-4 max-w-2xl text-base leading-8 theme-muted">
                      VoidLAB is a modern browser-based coding workspace built around an editor,
                      a multi-file project model, a unified execution console, and focused tool
                      pages for publishing, collaboration, AI guidance, and profile management.
                    </p>
                  </div>

                  <div className="grid min-w-[220px] gap-3 sm:grid-cols-2 xl:w-[360px] xl:grid-cols-1">
                    <div
                      className="rounded-[6px] p-4"
                      style={{ border: "1px solid var(--border)", background: "var(--control-background)" }}
                    >
                      <div className="text-xs uppercase tracking-[0.22em] theme-muted">Editor model</div>
                      <div className="mt-3 text-lg font-semibold theme-text-strong">Multi-file local workspace</div>
                    </div>
                    <div
                      className="rounded-[6px] p-4"
                      style={{ border: "1px solid var(--border)", background: "var(--control-background)" }}
                    >
                      <div className="text-xs uppercase tracking-[0.22em] theme-muted">Runtime model</div>
                      <div className="mt-3 text-lg font-semibold theme-text-strong">Judge0-backed execution + preview</div>
                    </div>
                  </div>
                </div>

                <div className="mt-6 grid gap-3 md:grid-cols-2">
                  {quickFacts.map((fact) => (
                    <div
                      className="rounded-[6px] px-4 py-3 text-sm leading-6 theme-text"
                      key={fact}
                      style={{ border: "1px solid var(--border)", background: "var(--control-background)" }}
                    >
                      {fact}
                    </div>
                  ))}
                </div>

                <div
                  className="mt-6 rounded-[6px] p-5"
                  style={{ background: "var(--accent-soft)", border: "1px solid var(--border-strong)" }}
                >
                  <div className="flex items-center gap-2 text-sm font-semibold accent-text">
                    <WandSparkles size={16} />
                    Fast start
                  </div>
                  <div className="mt-4 space-y-3 text-sm leading-7 theme-text">
                    {startupSteps.map((step, index) => (
                      <p key={step}>
                        <span className="mr-2 accent-text">{index + 1}.</span>
                        {step}
                      </p>
                    ))}
                  </div>
                </div>
              </section>

              <section className="space-y-5" id="workspace-map">
                <SectionHeader eyebrow="Figure A" title="Workspace map" />
                <div className="grid gap-5 xl:grid-cols-[minmax(0,1.1fr)_320px]">
                  <div
                    className="overflow-hidden rounded-[6px]"
                    style={{ border: "1px solid var(--border)", background: "var(--surface-soft)" }}
                  >
                    <Image
                      alt="Technical blueprint of the VoidLAB workspace showing the editor, unified console, and tool hub."
                      className="h-auto w-full"
                      height={1024}
                      priority
                      src="/manual/workspace-blueprint.png"
                      width={1536}
                    />
                  </div>
                  <div className="space-y-4">
                    <div
                      className="rounded-[6px] p-5"
                      style={{ border: "1px solid var(--border)", background: "var(--control-background)" }}
                    >
                      <div className="flex items-center gap-2 text-sm font-semibold theme-text-strong">
                        <Layers3 size={16} />
                        Core zones
                      </div>
                      <div className="mt-4 space-y-3 text-sm leading-7 theme-muted">
                        <p><strong className="theme-text-strong">Editor:</strong> write and switch files with language-aware Monaco editing.</p>
                        <p><strong className="theme-text-strong">Unified Console:</strong> one execution surface for output, workspace terminal commands, and future ports.</p>
                        <p><strong className="theme-text-strong">Tool Hub:</strong> dedicated routes for the manual, GitHub, collaboration, AI guide, and profile.</p>
                      </div>
                    </div>

                    <div
                      className="rounded-[6px] p-5"
                      style={{ border: "1px solid var(--border)", background: "var(--control-background)" }}
                    >
                      <div className="flex items-center gap-2 text-sm font-semibold theme-text-strong">
                        <FolderTree size={16} />
                        Workspace behavior
                      </div>
                      <div className="mt-4 space-y-3 text-sm leading-7 theme-muted">
                        <p>Files are tracked inside a local workspace model, not a native filesystem shell.</p>
                        <p>Folders, file paths, and terminal history persist across sessions in the browser state.</p>
                        <p>The active file drives language selection, preview behavior, and GitHub publish targeting.</p>
                      </div>
                    </div>
                  </div>
                </div>
              </section>

              <section className="space-y-5" id="execution-flow">
                <SectionHeader eyebrow="Figure B" title="Interactive execution flow" />
                <div
                  className="overflow-hidden rounded-[6px]"
                  style={{ border: "1px solid var(--border)", background: "var(--surface-soft)" }}
                >
                  <Image
                    alt="Technical execution diagram showing Run, inline stdin capture, Judge0, and structured results."
                    className="h-auto w-full"
                    height={1024}
                    src="/manual/execution-flow.png"
                    width={1536}
                  />
                </div>

                <div className="grid gap-4 lg:grid-cols-4">
                  {["Run or Preview", "Inline stdin capture", "Judge0 submission", "Structured results"].map((title, index) => {
                    const descriptions = [
                      "Runnable files go through Judge0. Previewable browser documents open directly in a new tab.",
                      "If the active program appears input-driven, VoidLAB pauses in Output and buffers stdin lines inline.",
                      "Buffered input is encoded into the submission payload together with the active source code and language target.",
                      "Output returns with stdout, stderr, compile output, runtime messages, memory, time, and exit metadata.",
                    ];
                    return (
                      <div
                        className="rounded-[6px] p-4"
                        key={title}
                        style={{ border: "1px solid var(--border)", background: "var(--control-background)" }}
                      >
                        <div className="text-xs uppercase tracking-[0.22em] theme-muted">Step {index + 1}</div>
                        <div className="mt-3 text-base font-semibold theme-text-strong">{title}</div>
                        <div className="mt-2 text-sm leading-6 theme-muted">
                          {descriptions[index]}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>

              <section className="space-y-5" id="console-tabs">
                <SectionHeader eyebrow="Operations" title="Unified console behavior" />
                <div className="grid gap-4 lg:grid-cols-3">
                  <div
                    className="rounded-[6px] p-5"
                    style={{ background: "var(--accent-soft)", border: "1px solid var(--border-strong)" }}
                  >
                    <div className="flex items-center gap-2 text-sm font-semibold accent-text">
                      <PlayCircle size={16} />
                      Output
                    </div>
                    <div className="mt-4 text-sm leading-7 theme-text">
                      The default tab. It shows execution transcript events, inline stdin prompts,
                      runtime metrics, and all structured Judge0 results in one place.
                    </div>
                  </div>
                  <div
                    className="rounded-[6px] p-5"
                    style={{ border: "1px solid var(--border)", background: "var(--control-background)" }}
                  >
                    <div className="flex items-center gap-2 text-sm font-semibold theme-text-strong">
                      <TerminalSquare size={16} />
                      Terminal
                    </div>
                    <div className="mt-4 text-sm leading-7 theme-muted">
                      This is the local workspace command layer for commands like <code>ls</code>,
                      <code>tree</code>, <code>touch</code>, <code>open</code>, and <code>rm</code>.
                    </div>
                  </div>
                  <div
                    className="rounded-[6px] p-5"
                    style={{ border: "1px solid var(--border)", background: "var(--control-background)" }}
                  >
                    <div className="flex items-center gap-2 text-sm font-semibold theme-text-strong">
                      <Palette size={16} />
                      Ports
                    </div>
                    <div className="mt-4 text-sm leading-7 theme-muted">
                      A reserved operational area for future forwarded runtime ports. For now,
                      browser previews still open directly from the editor toolbar.
                    </div>
                  </div>
                </div>
              </section>

              <section className="space-y-5" id="commands">
                <SectionHeader eyebrow="Reference" title="Workspace command sheet" />
                <div className="grid gap-3 md:grid-cols-2">
                  {commandReference.map((item) => (
                    <div
                      className="rounded-[6px] p-4"
                      key={item.command}
                      style={{ border: "1px solid var(--border)", background: "var(--control-background)" }}
                    >
                      <div className="flex items-center gap-2 text-sm font-semibold theme-text-strong">
                        <Command size={15} />
                        <code>{item.command}</code>
                      </div>
                      <div className="mt-3 text-sm leading-6 theme-muted">{item.description}</div>
                    </div>
                  ))}
                </div>
              </section>

              <section className="space-y-5" id="tool-hub">
                <SectionHeader eyebrow="Modules" title="Tool hub reference" />
                <div className="grid gap-4 md:grid-cols-2">
                  {toolCards.map((tool) => {
                    const Icon = tool.icon;

                    return (
                      <div
                        className="rounded-[6px] p-5"
                        key={tool.title}
                        style={{ border: "1px solid var(--border)", background: "var(--control-background)" }}
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className="flex h-11 w-11 items-center justify-center rounded-[6px] accent-text"
                            style={{ background: "var(--accent-soft)", border: "1px solid var(--border-strong)" }}
                          >
                            <Icon size={18} />
                          </div>
                          <div className="text-lg font-semibold theme-text-strong">{tool.title}</div>
                        </div>
                        <div className="mt-4 text-sm leading-7 theme-muted">{tool.description}</div>
                      </div>
                    );
                  })}
                </div>
              </section>

              <section className="space-y-5" id="personalization">
                <SectionHeader eyebrow="Preferences" title="Profile and theme notes" />
                <div className="grid gap-4 lg:grid-cols-2">
                  <div
                    className="rounded-[6px] p-5"
                    style={{ border: "1px solid var(--border)", background: "var(--control-background)" }}
                  >
                    <div className="flex items-center gap-2 text-sm font-semibold theme-text-strong">
                      <UserCircle2 size={16} />
                      Profile controls
                    </div>
                    <div className="mt-4 space-y-3 text-sm leading-7 theme-muted">
                      {personalizationNotes.slice(0, 2).map((note) => (
                        <p key={note}>{note}</p>
                      ))}
                    </div>
                  </div>
                  <div
                    className="rounded-[6px] p-5"
                    style={{ border: "1px solid var(--border)", background: "var(--control-background)" }}
                  >
                    <div className="flex items-center gap-2 text-sm font-semibold theme-text-strong">
                      <Palette size={16} />
                      Theme system
                    </div>
                    <div className="mt-4 space-y-3 text-sm leading-7 theme-muted">
                      {personalizationNotes.slice(2).map((note) => (
                        <p key={note}>{note}</p>
                      ))}
                    </div>
                  </div>
                </div>
              </section>

              <section className="space-y-5" id="deployment">
                <SectionHeader eyebrow="Checklist" title="Deploy-ready habits" />
                <div
                  className="rounded-[6px] p-6"
                  style={{
                    background: "rgba(16, 185, 129, 0.06)",
                    border: "1px solid rgba(16, 185, 129, 0.25)",
                  }}
                >
                  <div className="flex items-center gap-2 text-sm font-semibold" style={{ color: "#10b981" }}>
                    <ShieldCheck size={16} />
                    Final operator pass
                  </div>
                  <div className="mt-4 space-y-3 text-sm leading-7 theme-text">
                    {deploymentChecklist.map((item, index) => (
                      <p key={item}>
                        <span className="mr-2" style={{ color: "#10b981" }}>{index + 1}.</span>
                        {item}
                      </p>
                    ))}
                  </div>
                </div>
              </section>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
