"use client";

import { useMemo, useState } from "react";
import { Bot, SendHorizontal, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useUser } from "@/context/UserContext";
import { getLanguageById } from "@/lib/languages";
import { formatWorkspacePath, readWorkspace } from "@/lib/workspace";

type ChatMessage = {
  content: string;
  role: "assistant" | "user";
};

const promptAnswers = [
  {
    prompt: "How do I run input-output programs correctly?",
    answer:
      "Use the Output panel. If a program reaches input(), readline(), cin, scanf, or similar stdin calls, VoidLAB pauses the worker and asks for the next line. Type the value and press Enter. Keep each value on its own line for predictable behavior.",
  },
  {
    prompt: "How should I organize files and folders?",
    answer:
      "Keep source code in src/, examples in examples/, notes in docs/, and generated artifacts in build/. Use the explorer to create files or folders, then keep filenames short and language-specific such as main.py, app.ts, or solver.cpp.",
  },
  {
    prompt: "What does local-first mean in VoidLAB?",
    answer:
      "Your workspace is stored in this browser through OPFS or IndexedDB fallback. There is no cloud database requirement for files, profile, terminal history, themes, or local collaboration snapshots.",
  },
  {
    prompt: "How do I debug a failing run?",
    answer:
      "Read stderr first, then check compile output, then confirm stdin. If the run waits forever, provide the exact input line it expects. For unsupported WASM toolchains, VoidLAB will show a runtime configuration message instead of pretending the language ran.",
  },
];

const fallbackAnswer =
  "This local guide uses fixed product answers. Pick one of the suggested prompts for precise VoidLAB help without calling any AI backend.";

export default function AIGuidePanel() {
  const { profile, recordActivity } = useUser();
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: "assistant",
      content: "I am the local VoidLAB guide. Choose a prompt and I will answer instantly, without a backend request.",
    },
  ]);
  const [input, setInput] = useState("");

  const context = useMemo(() => {
    if (typeof window === "undefined") return "";

    const workspace = readWorkspace();
    const activeFile =
      workspace.files.find((file) => file.id === workspace.activeFileId) ?? workspace.files[0];
    const language = activeFile ? getLanguageById(activeFile.languageId) : undefined;

    return activeFile
      ? `${formatWorkspacePath(activeFile.path)} · ${language?.label ?? "Unknown"} · ${workspace.files.length} files`
      : "No active file";
  }, []);

  const sendMessage = (content: string) => {
    const trimmed = content.trim();
    if (!trimmed) return;

    const match = promptAnswers.find((item) => item.prompt.toLowerCase() === trimmed.toLowerCase());
    const answer = match?.answer ?? fallbackAnswer;

    setMessages((current) => [
      ...current,
      { content: trimmed, role: "user" },
      { content: answer, role: "assistant" },
    ]);
    setInput("");
    recordActivity({
      detail: `Asked the local guide about "${trimmed.slice(0, 70)}".`,
      title: "Local guide used",
      type: "ai",
    });
  };

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
      <section className="panel rounded-[6px] p-5">
        <div className="flex items-center gap-3 pb-4" style={{ borderBottom: "1px solid var(--border)" }}>
          <div className="theme-chip flex h-10 w-10 items-center justify-center rounded-[6px]">
            <Bot size={18} />
          </div>
          <div>
            <div className="text-sm font-semibold theme-text-strong">Local AI guide</div>
            <div className="text-sm theme-muted">
              Fixed responses for {profile?.name ?? "your"} workspace. Context: {context}.
            </div>
          </div>
        </div>

        <div className="scrollbar-thin mt-5 h-[420px] space-y-4 overflow-y-auto pr-2">
          {messages.map((message, index) => (
            <div
              className={`max-w-[88%] rounded-[6px] px-4 py-3 text-sm leading-7 ${
                message.role === "assistant"
                  ? "theme-surface theme-text"
                  : "ml-auto bg-[var(--accent)] text-[var(--action-foreground)]"
              }`}
              key={`${message.role}-${index}`}
            >
              {message.content}
            </div>
          ))}
        </div>

        <div className="theme-surface mt-5 rounded-[6px] p-3">
          <textarea
            className="min-h-[110px] w-full resize-none bg-transparent text-sm leading-7 theme-text outline-none placeholder:theme-muted"
            onChange={(event) => setInput(event.target.value)}
            placeholder="Type one of the suggested prompts..."
            value={input}
          />
          <div className="mt-3 flex justify-end">
            <Button onClick={() => sendMessage(input)} type="button">
              <SendHorizontal size={15} />
              Ask guide
            </Button>
          </div>
        </div>
      </section>

      <section className="panel rounded-[6px] p-5">
        <div className="flex items-center gap-2 text-sm font-semibold theme-text-strong">
          <Sparkles size={16} />
          Fixed prompts
        </div>
        <div className="mt-4 space-y-3">
          {promptAnswers.map((item) => (
            <button
              className="theme-surface w-full rounded-[6px] px-4 py-3 text-left text-sm theme-text transition hover:opacity-80"
              key={item.prompt}
              onClick={() => sendMessage(item.prompt)}
              type="button"
            >
              {item.prompt}
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
