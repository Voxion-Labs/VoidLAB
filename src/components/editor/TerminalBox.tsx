/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  Clock,
  Globe,
  RotateCcw,
  Trash2,
} from "lucide-react";
import { type ExecutionDetails } from "@/hooks/useCompiler";
import { countBufferedStdinLines } from "@/lib/execution";
import { formatWorkspacePath, type TerminalHistoryEntry } from "@/lib/workspace";

type TerminalTab = "terminal" | "output" | "ports";

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
  onClearOutput?: () => void;
  onResetSplit?: () => void;
};

type RuntimeStdinPrompt = {
  capacity: number;
  prompt: string;
  requestId: string;
  sequence: number;
  sharedBuffer: SharedArrayBuffer;
};

const tabs: Array<{ id: TerminalTab; label: string }> = [
  { id: "terminal", label: "Terminal" },
  { id: "output", label: "Output" },
  { id: "ports", label: "Ports" },
];

const stdinHeaderBytes = 32;
const stdinState = 0;
const stdinResponseBytes = 2;
const stdinCapacity = 3;
const stdinWaiting = 1;
const stdinResponseReady = 2;
const stdinReadyEventName = "voidlab:stdin-response";
const stdinRequestEventName = "voidlab:stdin-request";

function TranscriptLine({ entry }: { entry: OutputTranscriptEntry }) {
  const colorMap: Record<string, string> = {
    error: "#f87171",
    timeout: "#fbbf24",
    input: "var(--accent)",
    prompt: "#fbbf24",
    success: "#10b981",
    stdout: "var(--terminal-text)",
    status: "var(--terminal-muted)",
  };

  const color = colorMap[entry.tone] ?? "var(--terminal-muted)";
  const Icon = entry.tone === "timeout" ? Clock : null;

  return (
    <div
      className="flex items-start gap-1.5 whitespace-pre-wrap break-words font-mono text-[11px] leading-5"
      style={{ color }}
    >
      {Icon && <Icon className="mt-0.5 shrink-0 opacity-80" size={11} />}
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
  onClearOutput,
  onResetSplit,
}: TerminalBoxProps) {
  const [activeTab, setActiveTab] = useState<TerminalTab>("terminal");
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

  useEffect(() => {
    if (loading || execution || error) {
      setActiveTab("output");
    }
  }, [loading, execution, error]);

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
      className="h-full flex flex-col overflow-hidden font-mono select-none transition-colors"
      style={{
        background: "var(--panel-background)",
        color: "var(--text)",
      }}
    >
      {/* ── Terminal Header: Slim Tabs & Controls ── */}
      <div
        className="h-8 px-2.5 flex items-center justify-between shrink-0 text-xs font-mono transition-colors"
        style={{
          background: "var(--surface-soft)",
          borderBottom: "1px solid var(--border)",
        }}
      >
        {/* Left: Tab Switchers */}
        <div className="flex items-center gap-3">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`pb-1 text-[11px] font-mono transition-colors duration-100 ${
                  isActive ? "font-semibold" : "opacity-70 hover:opacity-100"
                }`}
                style={{
                  color: isActive ? "var(--text-strong)" : "var(--muted)",
                  borderBottom: isActive ? "2px solid var(--accent)" : "2px solid transparent",
                }}
                type="button"
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Right: Status & Tools */}
        <div className="flex items-center gap-2">
          {/* Active Status Badge */}
          <span
            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-medium"
            style={{
              background: "var(--control-background)",
              border: "1px solid var(--border)",
              color: "var(--muted-strong)",
            }}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                loading ? "bg-amber-400 animate-ping" : "bg-emerald-500"
              }`}
            />
            {loading ? "RUNNING" : "IDLE"}
          </span>

          {/* Clear Terminal / Output */}
          {onClearOutput && (
            <button
              onClick={onClearOutput}
              className="p-1 rounded opacity-70 hover:opacity-100 hover:bg-[var(--control-hover)] transition-all"
              style={{ color: "var(--muted)" }}
              title="Clear Output"
              type="button"
            >
              <Trash2 size={12} />
            </button>
          )}

          {/* Reset Column Width */}
          {onResetSplit && (
            <button
              onClick={onResetSplit}
              className="p-1 rounded opacity-70 hover:opacity-100 hover:bg-[var(--control-hover)] transition-all"
              style={{ color: "var(--muted)" }}
              title="Reset Column Width"
              type="button"
            >
              <RotateCcw size={12} />
            </button>
          )}
        </div>
      </div>

      {/* ── Terminal Content Stream ── */}
      <div
        className="flex-1 overflow-y-auto p-2.5 space-y-1 font-mono text-[11px] leading-5 scrollbar-thin transition-colors"
        style={{
          background: "var(--terminal-bg)",
          color: "var(--terminal-text)",
        }}
      >
        {/* TAB 1: Terminal Command History */}
        {activeTab === "terminal" && (
          <div>
            <div className="opacity-60 pb-1 text-[10px]">
              VoidLAB Sandbox Shell [Local Client VFS: {formatWorkspacePath(cwd)}]
            </div>
            {commandHistory.length ? (
              commandHistory.map((entry) => (
                <div key={entry.id} className="space-y-0.5 pb-1">
                  <div className="opacity-80">
                    <span className="opacity-50">{formatWorkspacePath(entry.cwd)}</span> $ {entry.command}
                  </div>
                  <pre
                    className={`whitespace-pre-wrap break-words pl-2 text-[11px] ${
                      entry.status === "error"
                        ? "text-rose-500"
                        : entry.status === "success"
                          ? "opacity-90"
                          : "opacity-60"
                    }`}
                  >
                    {entry.output}
                  </pre>
                </div>
              ))
            ) : (
              <div className="opacity-60 text-[10px]">
                Connected to sandbox session. Type commands below (e.g. <code>ls</code>, <code>mkdir</code>, <code>touch</code>) or click Run.
              </div>
            )}
          </div>
        )}

        {/* TAB 2: Output Transcript & Execution Results */}
        {activeTab === "output" && (
          <div className="space-y-2">
            {/* Minimal Metric Strip */}
            <div
              className="flex flex-wrap items-center gap-3 text-[10px] pb-1"
              style={{ borderBottom: "1px solid var(--border)", color: "var(--muted)" }}
            >
              <span>STATUS: <strong className="theme-text-strong">{latestStatus}</strong></span>
              <span>TIME: <strong className="theme-text-strong">{execution?.time ? `${execution.time}s` : "0.00s"}</strong></span>
              <span>MEMORY: <strong className="theme-text-strong">{execution?.memory ? `${execution.memory}KB` : "0KB"}</strong></span>
              {stagedInputLines > 0 && <span>STDIN: <strong className="theme-text-strong">{stagedInputLines} lines</strong></span>}
              {execution?.exitCode !== null && execution?.exitCode !== undefined && (
                <span>EXIT: <strong className="theme-text-strong">{execution.exitCode}</strong></span>
              )}
            </div>

            {/* Execution Stream Lines */}
            {transcript.length ? (
              <div className="space-y-0.5">
                {transcript.map((entry) => (
                  <TranscriptLine entry={entry} key={entry.id} />
                ))}
                <div ref={transcriptEndRef} />
              </div>
            ) : (
              <div className="opacity-60 text-[10px]">
                [system] Run the active file to stream compiler logs, stdout, diagnostics, and metrics.
              </div>
            )}

            {/* Stdin Interactive Session Box */}
            {stdinCaptureActive && (
              <div
                className="p-2.5 rounded-[6px] space-y-2 mt-2"
                style={{
                  background: "var(--surface-soft)",
                  border: "1px solid var(--border-strong)",
                }}
              >
                <div
                  className="text-[10px] uppercase font-semibold flex items-center gap-1.5"
                  style={{ color: "var(--accent)" }}
                >
                  <span className="w-1.5 h-1.5 rounded-full animate-ping" style={{ background: "var(--accent)" }} />
                  {runtimeStdinPrompt ? "Program blocked on stdin" : "Input Required"}
                </div>
                <div className="theme-muted text-[10px]">
                  {runtimeStdinPrompt
                    ? "Enter line input to resume worker:"
                    : interactiveSession.helperText}
                </div>
                <textarea
                  ref={stdinInputRef}
                  className="w-full rounded-[6px] p-2 text-xs font-mono outline-none resize-none h-16"
                  style={{
                    background: "var(--input-background)",
                    border: "1px solid var(--border)",
                    color: "var(--text)",
                  }}
                  placeholder={runtimeStdinPrompt ? "Type stdin line and hit Enter" : "Enter stdin values..."}
                  value={runtimeStdinPrompt ? runtimeStdinInput : pendingInteractiveInput}
                  onChange={(e) =>
                    runtimeStdinPrompt
                      ? setRuntimeStdinInput(e.target.value)
                      : onInteractiveInputChange(e.target.value)
                  }
                  onKeyDown={(e) => {
                    if (runtimeStdinPrompt && e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      submitRuntimeStdin();
                    }
                  }}
                />
                <div className="flex gap-2 justify-end">
                  <button
                    onClick={runtimeStdinPrompt ? () => setRuntimeStdinInput("") : onResetBufferedInput}
                    className="px-2.5 py-1 text-[10px] rounded-[6px] transition-colors"
                    style={{
                      background: "var(--control-background)",
                      border: "1px solid var(--border)",
                      color: "var(--text)",
                    }}
                    type="button"
                  >
                    Clear
                  </button>
                  <button
                    onClick={runtimeStdinPrompt ? submitRuntimeStdin : onRun}
                    className="px-3 py-1 text-[10px] rounded-[6px] font-semibold transition-all shadow-sm"
                    style={{
                      background: "var(--action-background)",
                      color: "var(--action-foreground)",
                    }}
                    type="button"
                  >
                    {runtimeStdinPrompt ? "Send Line" : "Run With Input"}
                  </button>
                </div>
              </div>
            )}

            {/* Error Banner */}
            {error && (
              <div
                className="p-2.5 rounded-[6px] space-y-1"
                style={{
                  background: "rgba(239, 68, 68, 0.08)",
                  border: "1px solid rgba(239, 68, 68, 0.25)",
                  color: "#ef4444",
                }}
              >
                <div className="flex items-center gap-1.5 font-semibold text-[11px]">
                  <AlertTriangle size={13} />
                  {timedOut ? "Execution timed out" : "Execution error"}
                </div>
                <pre className="whitespace-pre-wrap text-[10px] leading-4">{error}</pre>
              </div>
            )}

            {/* Detailed Execution Output (if present) */}
            {execution && (
              <div className="space-y-1.5 pt-1">
                {execution.stdout && (
                  <div>
                    <div className="text-[10px] font-semibold uppercase text-emerald-500">Stdout:</div>
                    <pre className="whitespace-pre-wrap pl-2 theme-text">{execution.stdout}</pre>
                  </div>
                )}
                {execution.stderr && (
                  <div>
                    <div className="text-[10px] font-semibold uppercase text-rose-500">Stderr:</div>
                    <pre className="whitespace-pre-wrap pl-2 text-rose-400">{execution.stderr}</pre>
                  </div>
                )}
                {execution.compileOutput && (
                  <div>
                    <div className="text-[10px] font-semibold uppercase text-amber-500">Compile Output:</div>
                    <pre className="whitespace-pre-wrap pl-2 text-amber-400">{execution.compileOutput}</pre>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* TAB 3: Ports */}
        {activeTab === "ports" && (
          <div className="py-4 px-2 space-y-2 text-xs theme-muted">
            <div className="flex items-center gap-1.5 font-semibold theme-text-strong">
              <Globe size={14} style={{ color: "var(--accent)" }} />
              Forwarded Ports & Sockets
            </div>
            <div className="text-[11px] leading-5 max-w-md">
              Process-bound ports will appear here in container sessions. Browser preview runs directly in client tabs.
            </div>
            <div className="text-[10px] opacity-70 font-mono">
              Active File: {formatWorkspacePath(activeFilePath)}
            </div>
          </div>
        )}
      </div>

      {/* ── Terminal Command Input Bar (Fixed Bottom) ── */}
      <div
        className="h-8 px-2.5 flex items-center gap-2 shrink-0 font-mono text-xs transition-colors"
        style={{
          background: "var(--surface-soft)",
          borderTop: "1px solid var(--border)",
        }}
      >
        <span className="opacity-60 select-none text-xs">$</span>
        <input
          className="flex-1 bg-transparent outline-none text-xs font-mono"
          style={{ color: "var(--text)" }}
          onChange={(e) => onCommandChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              onCommandRun();
            }
          }}
          placeholder="Type workspace command (e.g. ls, mkdir src, touch app.py)..."
          value={commandInput}
        />
        <button
          onClick={onCommandRun}
          className="text-xs opacity-60 hover:opacity-100 transition-opacity p-1"
          style={{ color: "var(--text)" }}
          type="button"
          title="Run Command (Enter)"
        >
          ↵
        </button>
      </div>
    </section>
  );
}
