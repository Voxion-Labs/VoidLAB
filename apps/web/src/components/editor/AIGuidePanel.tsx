"use client";

import { useState } from "react";
import { Bot, ChevronRight, Sparkles, Zap } from "lucide-react";
import { useUser } from "@/context/UserContext";

/* ─── Fixed Q&A Knowledge Base ─────────────────────────────── */
const QA: Array<{ q: string; tags: string[]; a: string }> = [
  {
    q: "How do I run input/output programs correctly?",
    tags: ["input", "output", "run", "stdin", "io", "scanf", "cin"],
    a: `**Running I/O Programs in VoidLAB**

When your program reads from stdin (e.g. \`input()\` in Python, \`scanf\` in C, \`cin\` in C++, \`Scanner\` in Java), VoidLAB will automatically detect this and pause before running.

**Step-by-step:**
1. Click **Run** on your file.
2. VoidLAB will detect stdin usage and open the **Input capture panel** in the Output tab.
3. Type your input values — one value per line (just like you'd type them in a terminal).
4. Click **Run program** to execute with your stdin piped in.

**Pro tips:**
— If your program reads 3 numbers on separate lines, enter each on its own line.
— Multi-value lines (e.g. "1 2 3" space-separated) go on one line.
— You can clear input and re-enter using the **Clear input** button.
— The Output tab shows a live stream of stdout, stderr, and exit status.`,
  },
  {
    q: "What workspace commands are supported?",
    tags: ["commands", "terminal", "ls", "mkdir", "touch", "cd", "open", "tree", "rm", "help"],
    a: `**Supported Workspace Commands**

VoidLAB has a built-in terminal emulator in the **Terminal** tab. These commands are supported:

| Command | Description |
|---------|-------------|
| \`ls\` | List files and folders in current directory |
| \`ls -la\` | List with sizes and paths |
| \`tree\` | Show full folder tree |
| \`mkdir <name>\` | Create a new folder |
| \`touch <path>\` | Create a new empty file |
| \`open <path>\` | Open a file in the editor |
| \`rm <name>\` | Remove a file |
| \`rmdir <name>\` | Remove a folder and its contents |
| \`cd <dir>\` | Change working directory |
| \`pwd\` | Print current directory |
| \`clear\` | Clear terminal history |
| \`help\` | Show all available commands |

**Note:** These are VoidLAB workspace commands, not a real system shell. They operate on your in-browser file tree stored in OPFS/IndexedDB.`,
  },
  {
    q: "How should I organize multiple files and folders?",
    tags: ["organize", "folder", "structure", "project", "files", "multi"],
    a: `**Organizing Your Workspace**

VoidLAB supports a full virtual file system. Here's a recommended structure:

\`\`\`
src/
  main.py          ← Entry point
  utils.py         ← Helper functions
  models/
    user.py
    data.py
tests/
  test_main.py
\`\`\`

**How to set it up:**
1. Use the **File Explorer** on the left of the editor.
2. Type the path like \`src/main\` in the filename input and click **Create file** — VoidLAB auto-creates parent folders.
3. Click **Create folder** to make an empty folder.
4. Use **Import folder** to upload an entire project from your computer (drag-and-drop coming soon).
5. Use the **Move** option (⋮ menu on each file) to reorganize files into different folders.

**Tip:** Use the Terminal tab and run \`tree\` to see your full project structure at any time.`,
  },
  {
    q: "How do I use the collaboration feature?",
    tags: ["collab", "collaborate", "room", "share", "team", "chat", "join", "code"],
    a: `**Using VoidLAB Collaboration**

VoidLAB's collaboration runs entirely in-browser — no account linking needed.

**To start a room:**
1. Go to **Collaboration** from the Feature Hub.
2. Give your room a name and click **Create Room**.
3. A **6-character room code** is generated (e.g. \`XK7R2M\`).
4. Share this code with your teammates.

**To join a room:**
1. Go to Collaboration → enter the room code in the "Join room" field.
2. Click **Join Room**.

**Features available:**
— 💬 **Live chat** — send messages visible to everyone in the room instantly.
— 📁 **Push workspace** — share your current files with the room.
— ⬇️ **Pull workspace** — load the latest files someone else pushed.
— 👥 **Participant list** — see who's currently in the room.

**Note:** Collaboration works across tabs in the same browser. For cross-device collab, a backend is required (coming soon).`,
  },
  {
    q: "How do I push code to GitHub?",
    tags: ["github", "push", "git", "commit", "repo", "repository", "branch"],
    a: `**Pushing to GitHub from VoidLAB**

VoidLAB's GitHub section gives you a full reference of git commands plus a workspace-aware command generator.

**Quick flow:**
1. Go to **GitHub** from the Feature Hub.
2. Enter your repository URL and branch name.
3. Use the **Copy commands** button to copy a ready-to-run git sequence.
4. Paste and run in your local terminal (or any git-capable shell).

**Common commands generated:**
\`\`\`bash
git init
git add .
git commit -m "Initial commit from VoidLAB"
git remote add origin https://github.com/user/repo.git
git push -u origin main
\`\`\`

**The GitHub section also shows:**
— Full git command reference grouped by category.
— Syntax and description for each command.
— Copy button for any individual command.

**Note:** Direct browser-to-GitHub push requires a personal access token and server-side proxy (coming soon). For now, copy the generated commands and run them locally.`,
  },
  {
    q: "How do I debug my program?",
    tags: ["debug", "error", "fix", "bug", "stderr", "exception", "traceback"],
    a: `**Debugging in VoidLAB**

VoidLAB streams full output including stdout, stderr, and compile errors in the **Output** tab.

**Debugging workflow:**
1. **Read the error carefully** — VoidLAB shows the exact line number and error type in most languages.
2. **Check stderr** — runtime errors (Python tracebacks, Java exceptions, segfaults) appear in red in the Output stream.
3. **Check compile output** — for C/C++/Java/Go, compilation errors appear before the program runs.
4. **Add print statements** — the simplest debugger. Add \`print(variable)\` or \`console.log(x)\` to trace values.
5. **Check stdin** — many bugs in competitive programming come from wrong input format. Re-read the input capture panel.
6. **Use the boilerplate** — click **Boilerplate** in the toolbar to reset to a clean template for the current language.

**Common pitfalls:**
— Off-by-one errors in loops.
— Reading wrong number of input values.
— Integer overflow (use \`long long\` in C++ for large numbers).
— Forgetting to flush output (\`sys.stdout.flush()\` in Python).`,
  },
  {
    q: "What languages does VoidLAB support?",
    tags: ["language", "languages", "python", "java", "c++", "javascript", "support", "run"],
    a: `**Supported Languages in VoidLAB**

VoidLAB supports 50+ languages across multiple runtimes. Here are the major ones:

**Fully runnable (compile & execute):**
Python · C · C++ · Java · JavaScript (Node.js) · TypeScript · Go · Rust · Ruby · PHP · C# · Kotlin · Swift · R · Lua · Perl · Haskell · Scala · Dart

**Preview mode (browser rendering):**
HTML · CSS · Markdown

**Editor only (syntax highlighting, no execution):**
SQL · Bash/Shell · YAML · TOML · JSON · XML · and many more.

**To switch language:**
— Use the language dropdown in the editor toolbar.
— Or type a filename with the extension (e.g. \`main.rs\`) in the File Explorer — VoidLAB auto-detects.

**Boilerplate:**
Every runnable language has a built-in template. Click **Boilerplate** in the toolbar to load it.`,
  },
  {
    q: "How do I save and download my work?",
    tags: ["save", "download", "export", "backup", "local", "file"],
    a: `**Saving and Downloading Your Work**

VoidLAB automatically saves your workspace to your browser's local storage (OPFS/IndexedDB) as you type.

**Manual save:** Press \`Ctrl/Cmd + S\` or click the **Save** button in the toolbar. This forces a write to your browser storage.

**Download a file:** Click the **Export** button in the toolbar — this downloads the currently active file to your computer.

**Import files:** 
— Click **Import files** in the File Explorer to pick individual files from your computer.
— Click **Import folder** to upload an entire folder (preserves directory structure).

**⚠️ Important:** VoidLAB stores your workspace in-browser. Clearing browser data or using a different browser will not show your previous workspace. Use **Export** regularly to back up important files to your computer.

**Keyboard shortcuts:**
| Shortcut | Action |
|----------|--------|
| Ctrl/Cmd + S | Save workspace |
| Ctrl/Cmd + Enter | Run active file |
| Ctrl/Cmd + Shift + N | Create new file |
| Escape | Close mobile sidebar |`,
  },
];

const FALLBACK = `**VoidLAB AI Guide**

I'm a static guide focused on VoidLAB's own features. Try one of the suggested prompts on the right, or ask me about:

— Running and debugging programs
— Workspace commands (ls, mkdir, touch, open…)
— Organizing files and folders
— Using the collaboration room
— Pushing code to GitHub
— Saving and exporting your work
— Supported languages

I'll give you a detailed, accurate answer instantly — no network required.`;

function findAnswer(query: string): string {
  const q = query.toLowerCase();
  const scored = QA.map((item) => {
    let score = 0;
    if (item.q.toLowerCase().includes(q)) score += 10;
    if (q.includes(item.q.toLowerCase())) score += 8;
    for (const tag of item.tags) {
      if (q.includes(tag)) score += 3;
    }
    return { score, a: item.a };
  }).filter((x) => x.score > 0);

  if (!scored.length) return FALLBACK;
  scored.sort((a, b) => b.score - a.score);
  return scored[0].a;
}

/* ─── Simple markdown-like renderer ─────────────────────── */
function RenderAnswer({ text }: { text: string }) {
  const lines = text.split("\n");
  return (
    <div className="space-y-2 text-sm leading-7">
      {lines.map((line, i) => {
        if (line.startsWith("**") && line.endsWith("**") && line.length > 4) {
          return (
            <div key={i} className="font-semibold theme-text-strong mt-3 first:mt-0">
              {line.slice(2, -2)}
            </div>
          );
        }
        if (line.startsWith("| ")) {
          return (
            <div key={i} className="font-mono text-xs theme-muted px-2">
              {line}
            </div>
          );
        }
        if (line.startsWith("```") || line === "```") return null;
        if (line.startsWith("— ") || line.startsWith("- ")) {
          return (
            <div key={i} className="flex gap-2 theme-text">
              <span style={{ color: "var(--accent)" }} className="shrink-0 mt-1">▸</span>
              <span>{line.slice(2)}</span>
            </div>
          );
        }
        if (line.startsWith("|--")) return null;
        if (!line.trim()) return <div key={i} className="h-1" />;
        // Inline bold: **text**
        const parts = line.split(/\*\*(.*?)\*\*/g);
        return (
          <div key={i} className="theme-text">
            {parts.map((part, j) =>
              j % 2 === 1 ? <strong key={j} className="theme-text-strong">{part}</strong> : part
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function AIGuidePanel() {
  const { profile } = useUser();
  const [selectedQ, setSelectedQ] = useState<string | null>(null);
  const [customInput, setCustomInput] = useState("");
  const [answer, setAnswer] = useState<string | null>(null);
  const [history, setHistory] = useState<Array<{ q: string; a: string }>>([]);

  const ask = (question: string) => {
    const trimmed = question.trim();
    if (!trimmed) return;
    const found = findAnswer(trimmed);
    const entry = { q: trimmed, a: found };
    setHistory((prev) => [...prev, entry]);
    setAnswer(found);
    setSelectedQ(trimmed);
    setCustomInput("");
  };

  const currentAnswer = answer ?? null;

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_300px]">
      {/* ── Left: answer pane ─────────────────────────── */}
      <section
        className="rounded-sm p-5"
        style={{ background: "var(--surface-soft)", border: "1px solid var(--border)" }}
      >
        {/* Header */}
        <div className="flex items-center gap-3 pb-4" style={{ borderBottom: "1px solid var(--border)" }}>
          <div
            className="flex h-10 w-10 items-center justify-center rounded-sm"
            style={{ background: "var(--accent-soft)", border: "1px solid var(--border-strong)" }}
          >
            <Bot size={18} style={{ color: "var(--accent)" }} />
          </div>
          <div>
            <div className="text-sm font-semibold theme-text-strong">VoidLAB Guide</div>
            <div className="text-xs theme-muted">
              Static knowledge base · instant answers · no backend
            </div>
          </div>
          <div className="ml-auto">
            <Zap size={14} style={{ color: "var(--accent)" }} />
          </div>
        </div>

        {/* Answer / Welcome */}
        <div className="mt-5 scrollbar-thin max-h-[460px] overflow-y-auto pr-1">
          {currentAnswer ? (
            <div>
              {selectedQ && (
                <div
                  className="mb-4 rounded-sm px-3 py-2 text-sm font-medium"
                  style={{ background: "var(--accent-soft)", color: "var(--accent)", border: "1px solid var(--border-strong)" }}
                >
                  Q: {selectedQ}
                </div>
              )}
              <div
                className="rounded-sm p-4"
                style={{ background: "var(--panel-background)", border: "1px solid var(--border)" }}
              >
                <RenderAnswer text={currentAnswer} />
              </div>
            </div>
          ) : (
            <div
              className="rounded-sm p-5 text-sm leading-7"
              style={{ background: "var(--surface-elevated)", border: "1px solid var(--border-strong)" }}
            >
              <div className="font-semibold theme-text-strong mb-2">
                👋 Hey {profile?.name?.split(" ")[0] ?? "there"}!
              </div>
              <RenderAnswer text={FALLBACK} />
            </div>
          )}
        </div>

        {/* History pills */}
        {history.length > 1 && (
          <div className="mt-4" style={{ borderTop: "1px solid var(--border)", paddingTop: "12px" }}>
            <div className="text-xs font-semibold uppercase tracking-widest theme-muted mb-2">Recent</div>
            <div className="flex flex-wrap gap-2">
              {history.slice(-4).map((h, i) => (
                <button
                  key={i}
                  className="rounded-sm px-3 py-1 text-xs transition hover:opacity-80"
                  style={{
                    background: "var(--control-background)",
                    border: "1px solid var(--border)",
                    color: "var(--text)",
                  }}
                  onClick={() => { setAnswer(h.a); setSelectedQ(h.q); }}
                  type="button"
                >
                  {h.q.length > 40 ? h.q.slice(0, 40) + "…" : h.q}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Custom question input */}
        <div
          className="mt-4 rounded-sm p-3"
          style={{ background: "var(--panel-background)", border: "1px solid var(--border)" }}
        >
          <input
            className="w-full bg-transparent text-sm outline-none theme-text placeholder:theme-muted"
            style={{ caretColor: "var(--accent)" }}
            onChange={(e) => setCustomInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") ask(customInput); }}
            placeholder="Ask anything about VoidLAB… press Enter"
            value={customInput}
          />
          <div className="mt-2 flex justify-end">
            <button
              className="inline-flex items-center gap-1.5 rounded-sm px-3 py-1.5 text-xs font-semibold transition hover:opacity-90"
              style={{
                background: "var(--action-background)",
                color: "var(--action-foreground)",
              }}
              onClick={() => ask(customInput)}
              type="button"
            >
              Ask
              <ChevronRight size={13} />
            </button>
          </div>
        </div>
      </section>

      {/* ── Right: suggested prompts ───────────────────── */}
      <section
        className="rounded-sm p-5"
        style={{ background: "var(--surface-soft)", border: "1px solid var(--border)" }}
      >
        <div className="flex items-center gap-2 text-sm font-semibold theme-text-strong mb-4">
          <Sparkles size={15} style={{ color: "var(--accent)" }} />
          Suggested prompts
        </div>

        <div className="space-y-2">
          {QA.map((item) => (
            <button
              className="w-full rounded-sm px-3 py-3 text-left text-sm transition hover:opacity-80"
              style={{
                background: selectedQ === item.q ? "var(--accent-soft)" : "var(--control-background)",
                border: selectedQ === item.q ? "1px solid var(--accent)" : "1px solid var(--border)",
                color: selectedQ === item.q ? "var(--accent)" : "var(--text)",
              }}
              key={item.q}
              onClick={() => ask(item.q)}
              type="button"
            >
              <span className="flex items-start gap-2">
                <ChevronRight size={13} className="mt-0.5 shrink-0" style={{ color: "var(--accent)" }} />
                {item.q}
              </span>
            </button>
          ))}
        </div>

        <div
          className="mt-5 rounded-sm p-4 text-xs leading-6 theme-muted"
          style={{ background: "var(--surface-elevated)", border: "1px solid var(--border)" }}
        >
          All answers are pre-written and available offline. No API calls, no rate limits — instant every time.
        </div>
      </section>
    </div>
  );
}
