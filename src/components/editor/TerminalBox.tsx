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
    input: "#60a5fa",
    prompt: "#fbbf24",
    success: "#34d399",
    stdout: "#e4e4e7",
    status: "#71717a",
  };

  const color = colorMap[entry.tone] ?? "#a1a1aa";
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

  // When execution starts or produces output, automatically switch to Output if there's error or execution
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
    <section className="h-full flex flex-col bg-[#000000] border-t border-white/10 overflow-hidden font-mono select-none">
      {/* ── Terminal Header: Slim Tabs & Controls ── */}
      <div className="h-7 px-2.5 border-b border-white/10 bg-[#0e0e11] flex items-center justify-between shrink-0 text-xs font-mono">
        {/* Left: Tab Switchers */}
        <div className="flex items-center gap-3">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`pb-0.5 text-[11px] font-mono transition-colors duration-100 ${
                activeTab === tab.id
                  ? "font-semibold text-zinc-100 border-b border-zinc-100"
                  : "text-zinc-500 hover:text-zinc-300"
              }`}
              type="button"
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Right: Status & Tools */}
        <div className="flex items-center gap-2">
          {/* Active Status Badge */}
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-medium bg-zinc-900 text-zinc-400 border border-white/10">
            <span
              className={`w-1 h-1 rounded-full ${
                loading ? "bg-amber-400 animate-ping" : "bg-emerald-500"
              }`}
            />
            {loading ? "RUNNING" : "IDLE"}
          </span>

          {/* Clear Terminal / Output */}
          {onClearOutput && (
            <button
              onClick={onClearOutput}
              className="p-1 hover:bg-zinc-800 rounded text-zinc-500 hover:text-zinc-200 transition-colors"
              title="Clear Terminal / Output"
              type="button"
            >
              <Trash2 size={11} />
            </button>
          )}

          {/* Reset 75/25 Split */}
          {onResetSplit && (
            <button
              onClick={onResetSplit}
              className="p-1 hover:bg-zinc-800 rounded text-zinc-500 hover:text-zinc-200 transition-colors"
              title="Reset 75/25 Split"
              type="button"
            >
              <RotateCcw size={11} />
            </button>
          )}
        </div>
      </div>

      {/* ── Terminal Content Stream ── */}
      <div className="flex-1 overflow-y-auto p-2.5 space-y-1 font-mono text-[11px] leading-5 text-zinc-300 bg-[#000000] scrollbar-thin">
        {/* TAB 1: Terminal Command History */}
        {activeTab === "terminal" && (
          <div>
            <div className="text-zinc-600 pb-1">
              VoidLAB Sandbox Shell [Local Client VFS: {formatWorkspacePath(cwd)}]
            </div>
            {commandHistory.length ? (
              commandHistory.map((entry) => (
                <div key={entry.id} className="space-y-0.5 pb-1">
                  <div className="text-zinc-400">
                    <span className="text-zinc-600">{formatWorkspacePath(entry.cwd)}</span> $ {entry.command}
                  </div>
                  <pre
                    className={`whitespace-pre-wrap break-words pl-2 text-[11px] ${
                      entry.status === "error"
                        ? "text-rose-400"
                        : entry.status === "success"
                          ? "text-zinc-300"
                          : "text-zinc-500"
                    }`}
                  >
                    {entry.output}
                  </pre>
                </div>
              ))
            ) : (
              <div className="text-zinc-600">
                Connected to container session. Type commands below (e.g. <code>ls</code>, <code>mkdir</code>, <code>touch</code>) or click Run.
              </div>
            )}
          </div>
        )}

        {/* TAB 2: Output Transcript & Execution Results */}
        {activeTab === "output" && (
          <div className="space-y-2">
            {/* Minimal Metric Strip */}
            <div className="flex items-center gap-3 text-[10px] text-zinc-500 border-b border-white/5 pb-1">
              <span>STATUS: <strong className="text-zinc-300">{latestStatus}</strong></span>
              <span>TIME: <strong className="text-zinc-300">{execution?.time ? `${execution.time}s` : "0.00s"}</strong></span>
              <span>MEMORY: <strong className="text-zinc-300">{execution?.memory ? `${execution.memory}KB` : "0KB"}</strong></span>
              {stagedInputLines > 0 && <span>STDIN: <strong className="text-zinc-300">{stagedInputLines} lines</strong></span>}
              {execution?.exitCode !== null && execution?.exitCode !== undefined && (
                <span>EXIT: <strong className="text-zinc-300">{execution.exitCode}</strong></span>
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
              <div className="text-zinc-600">
                [system] Run the active file to stream compiler logs, stdout, diagnostics, and metrics.
              </div>
            )}

            {/* Stdin Interactive Session Box */}
            {stdinCaptureActive && (
              <div className="p-2 rounded bg-zinc-900/80 border border-white/10 space-y-2 mt-2">
                <div className="text-[10px] uppercase font-semibold text-amber-400 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping" />
                  {runtimeStdinPrompt ? "Program blocked on stdin" : "Input Required"}
                </div>
                <div className="text-zinc-400 text-[10px]">
                  {runtimeStdinPrompt
                    ? "Enter line input to resume worker:"
                    : interactiveSession.helperText}
                </div>
                <textarea
                  ref={stdinInputRef}
                  className="w-full bg-[#000000] border border-white/10 rounded p-1.5 text-zinc-100 font-mono text-[11px] outline-none focus:border-zinc-500 resize-none h-16"
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
                    className="px-2 py-0.5 text-[10px] rounded border border-white/10 text-zinc-400 hover:text-white"
                    type="button"
                  >
                    Clear
                  </button>
                  <button
                    onClick={runtimeStdinPrompt ? submitRuntimeStdin : onRun}
                    className="px-2.5 py-0.5 text-[10px] rounded bg-zinc-100 hover:bg-white text-zinc-950 font-medium"
                    type="button"
                  >
                    {runtimeStdinPrompt ? "Send Line" : "Run With Input"}
                  </button>
                </div>
              </div>
            )}

            {/* Error Banner */}
            {error && (
              <div className="p-2 rounded bg-rose-950/40 border border-rose-800/40 text-rose-300 space-y-1">
                <div className="flex items-center gap-1.5 font-semibold text-[11px]">
                  <AlertTriangle size={12} />
                  {timedOut ? "Execution timed out" : "Execution error"}
                </div>
                <pre className="whitespace-pre-wrap text-[10px] leading-4">{error}</pre>
              </div>
            )}

            {/* Detailed Execution Output (if present) */}
            {execution && (
              <div className="space-y-1 pt-1">
                {execution.stdout && (
                  <div>
                    <div className="text-[10px] text-emerald-500 font-semibold uppercase">Stdout:</div>
                    <pre className="text-zinc-200 whitespace-pre-wrap pl-2">{execution.stdout}</pre>
                  </div>
                )}
                {execution.stderr && (
                  <div>
                    <div className="text-[10px] text-rose-400 font-semibold uppercase">Stderr:</div>
                    <pre className="text-rose-300 whitespace-pre-wrap pl-2">{execution.stderr}</pre>
                  </div>
                )}
                {execution.compileOutput && (
                  <div>
                    <div className="text-[10px] text-amber-400 font-semibold uppercase">Compile Output:</div>
                    <pre className="text-amber-200 whitespace-pre-wrap pl-2">{execution.compileOutput}</pre>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* TAB 3: Ports */}
        {activeTab === "ports" && (
          <div className="py-4 px-2 space-y-2 text-zinc-500 text-xs">
            <div className="flex items-center gap-1.5 text-zinc-300 font-semibold">
              <Globe size={13} />
              Forwarded Ports & Sockets
            </div>
            <div className="text-[11px] leading-5 text-zinc-500 max-w-md">
              Process-bound ports will be forwarded here in multi-node containers. Local client sandbox uses browser preview directly.
            </div>
            <div className="text-[10px] text-zinc-600 font-mono">
              Active File: {formatWorkspacePath(activeFilePath)}
            </div>
          </div>
        )}
      </div>

      {/* ── Terminal Command / Stdin Input Bar (Fixed Bottom) ── */}
      <div className="h-8 px-2.5 border-t border-white/10 bg-[#09090b] flex items-center gap-2 shrink-0 font-mono text-xs">
        <span className="text-zinc-500 select-none text-xs">$</span>
        <input
          className="flex-1 bg-transparent text-zinc-100 placeholder:text-zinc-700 outline-none text-xs font-mono"
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
          className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors p-1"
          type="button"
          title="Run Command (Enter)"
        >
          ↵
        </button>
      </div>
    </section>
  );
}
