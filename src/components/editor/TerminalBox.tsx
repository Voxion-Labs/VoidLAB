"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  Clock,
  Globe,
  Play,
  RotateCcw,
  TerminalSquare,
} from "lucide-react";
import { type ExecutionDetails } from "@/hooks/useCompiler";
import { countBufferedStdinLines } from "@/lib/execution";
import { formatWorkspacePath, type TerminalHistoryEntry } from "@/lib/workspace";

type TerminalTab = "output" | "terminal" | "ports";

export type OutputTranscriptEntry = {
  id: string;
  text: string;
  tone: "error" | "input" | "prompt" | "status" | "stdout" | "success" | "timeout";
};

type InteractiveSessionState = {
  active: boolean;
  helperText: string;
  promptLabel: string;
};

type TerminalBoxProps = {
  activeFilePath: string;
  commandHistory: TerminalHistoryEntry[];
  commandInput: string;
  cwd: string;
  error: string;
  execution: ExecutionDetails | null;
  interactiveSession: InteractiveSessionState;
  loading: boolean;
  onCommandChange: (value: string) => void;
  onCommandRun: () => void;
  onInteractiveInputChange: (value: string) => void;
  onResetBufferedInput: () => void;
  onRun: () => void;
  pendingInteractiveInput: string;
  stdin: string;
  transcript: OutputTranscriptEntry[];
};

type RuntimeStdinPrompt = {
  capacity: number;
  prompt: string;
  requestId: string;
  sequence: number;
  sharedBuffer: SharedArrayBuffer;
};

type OutputSectionProps = {
  label: string;
  tone?: "danger" | "default" | "success";
  value: string;
};

const tabs: Array<{ id: TerminalTab; label: string }> = [
  { id: "output", label: "Output" },
  { id: "terminal", label: "Terminal" },
  { id: "ports", label: "Ports" },
];

/* ── Button styles using CSS vars ─────────────────────────── */
const terminalButtonBase =
  "inline-flex items-center justify-center gap-2 rounded-sm border px-4 py-2 text-sm font-medium transition outline-none disabled:cursor-not-allowed disabled:opacity-50";

const stdinHeaderBytes = 32;
const stdinState = 0;
const stdinResponseBytes = 2;
const stdinCapacity = 3;
const stdinWaiting = 1;
const stdinResponseReady = 2;
const stdinReadyEventName = "voidlab:stdin-response";
const stdinRequestEventName = "voidlab:stdin-request";

function OutputSection({ label, tone = "default", value }: OutputSectionProps) {
  if (!value) return null;

  const style =
    tone === "danger"
      ? { background: "rgba(225,29,72,0.06)", border: "1px solid rgba(225,29,72,0.25)", color: "var(--text)" }
      : tone === "success"
        ? { background: "rgba(16,185,129,0.06)", border: "1px solid rgba(16,185,129,0.25)", color: "var(--text)" }
        : { background: "var(--surface-soft)", border: "1px solid var(--border)", color: "var(--text)" };

  return (
    <div className="rounded-sm p-4" style={style}>
      <div className="mb-2 text-xs uppercase tracking-widest theme-muted">{label}</div>
      <pre className="whitespace-pre-wrap break-words font-mono text-sm leading-7 theme-text">{value}</pre>
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div
      className="rounded-sm p-3"
      style={{ background: "var(--surface-soft)", border: "1px solid var(--border)" }}
    >
      <div className="text-xs uppercase tracking-widest theme-muted">{label}</div>
      <div className="mt-2 text-sm font-semibold theme-text-strong">{value}</div>
    </div>
  );
}

function TranscriptLine({ entry }: { entry: OutputTranscriptEntry }) {
  const colorMap: Record<string, string> = {
    error: "#f43f5e",
    timeout: "#f59e0b",
    input: "var(--accent)",
    prompt: "#f59e0b",
    success: "#10b981",
    stdout: "var(--text)",
    status: "var(--muted)",
  };

  const color = colorMap[entry.tone] ?? "var(--muted)";
  const Icon = entry.tone === "timeout" ? Clock : null;

  return (
    <div
      className="flex items-start gap-2 whitespace-pre-wrap break-words font-mono text-sm leading-7"
      style={{ color }}
    >
      {Icon && <Icon className="mt-1 shrink-0 opacity-80" size={13} />}
      <span>{entry.text}</span>
    </div>
  );
}

export default function TerminalBox({
  activeFilePath,
  commandHistory,
  commandInput,
  cwd,
  error,
  execution,
  interactiveSession,
  loading,
  onCommandChange,
  onCommandRun,
  onInteractiveInputChange,
  onResetBufferedInput,
  onRun,
  pendingInteractiveInput,
  stdin,
  transcript,
}: TerminalBoxProps) {
  const [activeTab, setActiveTab] = useState<TerminalTab>("output");
  const [runtimeStdinInput, setRuntimeStdinInput] = useState("");
  const [runtimeStdinPrompt, setRuntimeStdinPrompt] = useState<RuntimeStdinPrompt | null>(null);
  const transcriptEndRef = useRef<HTMLDivElement>(null);
  const stdinInputRef = useRef<HTMLTextAreaElement>(null);
  const timedOut = execution?.timedOut || error.includes("timed out");
  const stdinCaptureActive = interactiveSession.active || Boolean(runtimeStdinPrompt);
  const stagedInputLines = useMemo(
    () =>
      countBufferedStdinLines(
        runtimeStdinPrompt ? runtimeStdinInput : interactiveSession.active ? pendingInteractiveInput : stdin,
      ),
    [interactiveSession.active, pendingInteractiveInput, runtimeStdinInput, runtimeStdinPrompt, stdin],
  );

  const latestStatus =
    runtimeStdinPrompt
      ? "Input required"
      : execution?.status.description ?? (interactiveSession.active ? "Input required" : loading ? "Running" : "Idle");

  const submitRuntimeStdin = () => {
    if (!runtimeStdinPrompt) return;

    const control = new Int32Array(
      runtimeStdinPrompt.sharedBuffer,
      0,
      stdinHeaderBytes / Int32Array.BYTES_PER_ELEMENT,
    );
    const data = new Uint8Array(runtimeStdinPrompt.sharedBuffer, stdinHeaderBytes);

    if (Atomics.load(control, stdinState) !== stdinWaiting) {
      setRuntimeStdinPrompt(null);
      setRuntimeStdinInput("");
      return;
    }

    const encodedInput = new TextEncoder().encode(`${runtimeStdinInput}\n`);
    const capacity = Math.min(Atomics.load(control, stdinCapacity), data.byteLength, runtimeStdinPrompt.capacity);
    const byteLength = Math.min(encodedInput.byteLength, capacity);

    data.fill(0);
    data.set(encodedInput.slice(0, byteLength), 0);
    Atomics.store(control, stdinResponseBytes, byteLength);
    Atomics.store(control, stdinState, stdinResponseReady);
    Atomics.notify(control, stdinState, 1);

    window.dispatchEvent(
      new CustomEvent(stdinReadyEventName, {
        detail: {
          requestId: runtimeStdinPrompt.requestId,
          sequence: runtimeStdinPrompt.sequence,
        },
      }),
    );
    setRuntimeStdinPrompt(null);
    setRuntimeStdinInput("");
  };

  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [transcript]);

  useEffect(() => {
    if (stdinCaptureActive) {
      const timer = setTimeout(() => stdinInputRef.current?.focus(), 80);
      return () => clearTimeout(timer);
    }
  }, [stdinCaptureActive]);

  useEffect(() => {
    const handleRuntimeStdinRequest = (event: Event) => {
      const detail = (event as CustomEvent<RuntimeStdinPrompt>).detail;
      if (!detail?.sharedBuffer) return;
      setActiveTab("output");
      setRuntimeStdinInput("");
      setRuntimeStdinPrompt(detail);
    };

    window.addEventListener(stdinRequestEventName, handleRuntimeStdinRequest);
    return () => window.removeEventListener(stdinRequestEventName, handleRuntimeStdinRequest);
  }, []);

  return (
    <section
      className="overflow-hidden rounded-sm panel"
    >
      {/* ── Header ─────────────────────────────────────────── */}
      <div
        className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
        style={{ borderBottom: "1px solid var(--border)" }}
      >
        <div className="flex items-center gap-3">
          <TerminalSquare size={15} style={{ color: "var(--accent)" }} />
          <span className="text-sm font-semibold theme-text-strong">Unified console</span>
          <span className="hidden text-xs uppercase tracking-widest theme-muted sm:block">
            {latestStatus}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Tab switcher */}
          <div
            className="inline-flex rounded-sm p-0.5"
            style={{ background: "var(--control-background)", border: "1px solid var(--border)" }}
          >
            {tabs.map((tab) => (
              <button
                className="rounded-sm px-3 py-1.5 text-xs font-medium uppercase tracking-widest transition"
                style={
                  activeTab === tab.id
                    ? {
                        background: "var(--action-background)",
                        color: "var(--action-foreground)",
                      }
                    : { color: "var(--muted)" }
                }
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                type="button"
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Run button */}
          <button
            className={terminalButtonBase}
            style={{
              background: "var(--action-background)",
              borderColor: "var(--action-background)",
              color: "var(--action-foreground)",
              boxShadow: "var(--action-shadow)",
            }}
            disabled={loading && !runtimeStdinPrompt}
            onClick={runtimeStdinPrompt ? submitRuntimeStdin : onRun}
            type="button"
          >
            <Play size={14} />
            {runtimeStdinPrompt
              ? "Send input"
              : loading
                ? "Running"
                : interactiveSession.active
                  ? "Run with input"
                  : "Run"}
          </button>
        </div>
      </div>

      {/* ── Output tab ─────────────────────────────────────── */}
      {activeTab === "output" ? (
        <div className="p-4">
          {/* Metrics */}
          <div className="grid gap-2 md:grid-cols-4">
            <MetricCard label="Status" value={latestStatus} />
            <MetricCard
              label="Input lines"
              value={stagedInputLines ? `${stagedInputLines} line${stagedInputLines === 1 ? "" : "s"}` : "none"}
            />
            <MetricCard label="Time" value={execution?.time ? `${execution.time} sec` : loading ? "running" : "n/a"} />
            <MetricCard
              label="Memory"
              value={
                execution?.memory !== null && execution?.memory !== undefined
                  ? `${execution.memory} KB`
                  : "n/a"
              }
            />
          </div>

          {/* Transcript */}
          <div
            className="mt-3 rounded-sm p-4"
            style={{ background: "var(--terminal-bg)", border: "1px solid var(--border)" }}
          >
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div className="text-xs uppercase tracking-widest theme-muted">Execution stream</div>
              <div className="truncate text-xs theme-muted">{formatWorkspacePath(activeFilePath)}</div>
            </div>

            <div className="scrollbar-thin h-[240px] space-y-3 overflow-y-auto pr-2">
              {transcript.length ? (
                <>
                  {transcript.map((entry) => <TranscriptLine entry={entry} key={entry.id} />)}
                  <div ref={transcriptEndRef} />
                </>
              ) : (
                <div className="font-mono text-sm leading-7 theme-muted">
                  [system] Run the active file and VoidLAB will stream status, stdin prompts, stdout, and diagnostics here.
                </div>
              )}
            </div>

            {/* stdin capture */}
            {stdinCaptureActive ? (
              <div
                className="mt-4 rounded-sm p-4"
                style={{
                  background: "var(--accent-soft)",
                  border: "1px solid var(--border-strong)",
                }}
              >
                <div className="flex items-center gap-2 text-xs uppercase tracking-widest mb-2" style={{ color: "var(--accent)" }}>
                  <span className="relative flex h-2 w-2">
                    <span
                      className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-75"
                      style={{ background: "var(--accent)" }}
                    />
                    <span
                      className="relative inline-flex h-2 w-2 rounded-full"
                      style={{ background: "var(--accent)" }}
                    />
                  </span>
                  Input required
                </div>
                <div className="text-sm leading-6 theme-text mb-3">
                  {runtimeStdinPrompt
                    ? "The running program is blocked on stdin. Press Enter to resume execution."
                    : interactiveSession.helperText}
                </div>
                <div
                  className="rounded-sm px-3 py-2 font-mono text-sm mb-3"
                  style={{
                    background: "var(--panel-background)",
                    border: "1px solid var(--border)",
                    color: "var(--accent)",
                  }}
                >
                  {runtimeStdinPrompt?.prompt ?? interactiveSession.promptLabel}
                </div>
                <textarea
                  className="min-h-[100px] w-full resize-y rounded-sm px-4 py-3 font-mono text-sm outline-none transition"
                  style={{
                    background: "var(--input-background)",
                    border: "1px solid var(--border)",
                    color: "var(--text)",
                    caretColor: "var(--accent)",
                  }}
                  onChange={(event) =>
                    runtimeStdinPrompt
                      ? setRuntimeStdinInput(event.target.value)
                      : onInteractiveInputChange(event.target.value)
                  }
                  onKeyDown={(event) => {
                    if (runtimeStdinPrompt && event.key === "Enter" && !event.shiftKey) {
                      event.preventDefault();
                      submitRuntimeStdin();
                    }
                  }}
                  placeholder={
                    runtimeStdinPrompt
                      ? "Type one stdin line and press Enter."
                      : "Enter stdin exactly as your program expects it.\nUse a new line for each value."
                  }
                  ref={stdinInputRef}
                  spellCheck={false}
                  value={runtimeStdinPrompt ? runtimeStdinInput : pendingInteractiveInput}
                />
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    className={terminalButtonBase}
                    style={{
                      background: "var(--control-background)",
                      borderColor: "var(--border)",
                      color: "var(--text)",
                    }}
                    onClick={runtimeStdinPrompt ? () => setRuntimeStdinInput("") : onResetBufferedInput}
                    type="button"
                  >
                    <RotateCcw size={14} />
                    Clear input
                  </button>
                  <button
                    className={terminalButtonBase}
                    style={{
                      background: "var(--action-background)",
                      borderColor: "var(--action-background)",
                      color: "var(--action-foreground)",
                    }}
                    disabled={runtimeStdinPrompt ? false : !pendingInteractiveInput.length || loading}
                    onClick={runtimeStdinPrompt ? submitRuntimeStdin : onRun}
                    type="button"
                  >
                    <Play size={14} />
                    {runtimeStdinPrompt ? "Send line" : "Run program"}
                  </button>
                </div>
              </div>
            ) : null}
          </div>

          <div className="mt-3 space-y-3">
            {error ? (
              <div
                className="rounded-sm p-4"
                style={
                  timedOut
                    ? { background: "rgba(245,158,11,0.07)", border: "1px solid rgba(245,158,11,0.28)", color: "#f59e0b" }
                    : { background: "rgba(225,29,72,0.07)", border: "1px solid rgba(225,29,72,0.28)", color: "#f43f5e" }
                }
              >
                <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
                  {timedOut ? <Clock size={15} /> : <AlertTriangle size={15} />}
                  {timedOut ? "Execution timed out" : "Execution gateway error"}
                </div>
                <pre className="whitespace-pre-wrap break-words font-mono text-sm leading-7">{error}</pre>
              </div>
            ) : null}

            {execution ? (
              <>
                <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
                  <MetricCard label="Runtime status" value={execution.status.description} />
                  <MetricCard label="Exit code" value={execution.exitCode !== null ? String(execution.exitCode) : "n/a"} />
                  <MetricCard label="Exit signal" value={execution.exitSignal !== null ? String(execution.exitSignal) : "n/a"} />
                  <MetricCard label="Token" value={execution.token ?? "n/a"} />
                </div>
                <OutputSection label="Stdout" tone="success" value={execution.stdout} />
                <OutputSection label="Stderr" tone="danger" value={execution.stderr} />
                <OutputSection label="Compile output" tone="danger" value={execution.compileOutput} />
                <OutputSection label="Runtime message" value={execution.message} />
                {!execution.stdout && !execution.stderr && !execution.compileOutput && !execution.message ? (
                  <div
                    className="rounded-sm p-4 text-sm leading-7 theme-muted"
                    style={{ background: "var(--surface-soft)", border: "1px solid var(--border)" }}
                  >
                    The program finished without producing visible output.
                  </div>
                ) : null}
              </>
            ) : null}
          </div>
        </div>
      ) : null}

      {/* ── Terminal tab ────────────────────────────────────── */}
      {activeTab === "terminal" ? (
        <div className="p-4">
          <div
            className="rounded-sm p-4"
            style={{ background: "var(--terminal-bg)", border: "1px solid var(--border)" }}
          >
            <div className="mb-2 text-xs uppercase tracking-widest theme-muted">Workspace terminal</div>
            <div className="mb-3 text-xs theme-muted">Current directory {formatWorkspacePath(cwd)}</div>

            <div className="scrollbar-thin h-[280px] space-y-4 overflow-y-auto pr-2 font-mono text-sm leading-7">
              {commandHistory.length ? (
                commandHistory.map((entry) => (
                  <div key={entry.id}>
                    <div style={{ color: "var(--accent)" }}>
                      {formatWorkspacePath(entry.cwd)} $ {entry.command}
                    </div>
                    <pre
                      className="mt-1 whitespace-pre-wrap break-words"
                      style={{
                        color:
                          entry.status === "error"
                            ? "#f43f5e"
                            : entry.status === "success"
                              ? "var(--text)"
                              : "var(--muted)",
                      }}
                    >
                      {entry.output}
                    </pre>
                  </div>
                ))
              ) : (
                <div className="theme-muted">
                  Run commands like <code className="theme-text-strong">ls</code>,{" "}
                  <code className="theme-text-strong">tree</code>,{" "}
                  <code className="theme-text-strong">mkdir src</code>,{" "}
                  <code className="theme-text-strong">touch src/main.py</code>, or{" "}
                  <code className="theme-text-strong">help</code>.
                </div>
              )}
            </div>

            <div className="mt-4 flex flex-col gap-2 lg:flex-row">
              <input
                className="flex-1 rounded-sm px-4 py-2.5 font-mono text-sm outline-none transition"
                style={{
                  background: "var(--input-background)",
                  border: "1px solid var(--border)",
                  color: "var(--text)",
                  caretColor: "var(--accent)",
                }}
                onChange={(event) => onCommandChange(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    onCommandRun();
                  }
                }}
                placeholder="touch src/main.py"
                value={commandInput}
              />
              <button
                className={terminalButtonBase}
                style={{
                  background: "var(--control-background)",
                  borderColor: "var(--border)",
                  color: "var(--text)",
                }}
                onClick={onCommandRun}
                type="button"
              >
                Run command
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* ── Ports tab ───────────────────────────────────────── */}
      {activeTab === "ports" ? (
        <div className="p-4">
          <div
            className="flex min-h-[300px] flex-col items-start justify-center rounded-sm p-6"
            style={{ background: "var(--terminal-bg)", border: "1px solid var(--border)" }}
          >
            <div className="flex items-center gap-2 text-sm font-semibold theme-text-strong">
              <Globe size={15} style={{ color: "var(--accent)" }} />
              Ports
            </div>
            <div className="mt-3 max-w-xl text-sm leading-7 theme-muted">
              Runtime-exposed ports will appear here once VoidLAB adds forwarded process sessions.
              For now, browser-preview files still open directly in a new tab from the editor toolbar.
            </div>
            <div
              className="mt-5 rounded-sm px-4 py-2.5 text-sm theme-muted"
              style={{ background: "var(--surface-soft)", border: "1px solid var(--border)" }}
            >
              Active file: {formatWorkspacePath(activeFilePath)}
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
