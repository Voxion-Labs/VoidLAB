import { useCallback, useEffect, useRef, useState } from "react";
import { LanguageOption } from "@/lib/languages";

export type ExecutionDetails = {
  compileOutput: string;
  exitCode: number | null;
  exitSignal: number | null;
  memory: number | null;
  message: string;
  output: string;
  processing?: boolean;
  status: {
    description: string;
    id: number;
    successful: boolean;
  };
  stderr: string;
  stdout: string;
  time: string | null;
  timedOut: boolean;
  token: string | null;
};

type CompilerRunResult =
  | {
      error?: undefined;
      ok: true;
      result: ExecutionDetails;
    }
  | {
      error: string;
      ok: false;
      result?: ExecutionDetails;
      tleSuggestion?: boolean;
    };

type CompilerRequest = {
  payload: {
    code: string;
    language: {
      id: string;
      label: string;
      monacoLanguage: string;
    };
    stdin: string;
    stdinBuffer: SharedArrayBuffer;
    timeoutMs: number;
  };
  requestId: string;
  type: "run";
};

type CompilerStreamMessage = {
  requestId: string;
  stream: "stderr" | "stdout";
  text: string;
  type: "stream";
};

type CompilerStartedMessage = {
  requestId: string;
  type: "started";
};

type CompilerResultMessage = {
  execution: ExecutionDetails;
  requestId: string;
  type: "result";
};

type CompilerErrorMessage = {
  error: string;
  execution?: ExecutionDetails;
  requestId: string;
  type: "error";
};

type CompilerStdinRequestMessage = {
  capacity: number;
  prompt: string;
  requestId: string;
  sequence: number;
  type: "stdin-request";
};

type CompilerLifecycleMessage = {
  detail: string;
  languageId: string;
  requestId: string;
  state: "ERROR" | "LOADING" | "READY" | "RUNNING";
  type: "lifecycle";
};

type CompilerWorkerMessage =
  | CompilerErrorMessage
  | CompilerLifecycleMessage
  | CompilerResultMessage
  | CompilerStartedMessage
  | CompilerStdinRequestMessage
  | CompilerStreamMessage;

const STATUS_RUNTIME_ERROR = 11;
const STATUS_INTERNAL_ERROR = 12;
const STATUS_TLE = 13;

const executionTimeoutMs = 5000;
const timeoutHintMessage = "Execution timed out. Did your program enter an infinite loop or wait for input?";
const stdinBufferBytes = 64 * 1024;
const stdinHeaderBytes = 32;
const stdinReadyEventName = "voidlab:stdin-response";
const stdinRequestEventName = "voidlab:stdin-request";

const createToken = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `run-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

const createProcessingExecution = (token: string): ExecutionDetails => ({
  compileOutput: "",
  exitCode: null,
  exitSignal: null,
  memory: null,
  message: "Program is running in the browser worker sandbox.",
  output: "",
  processing: true,
  status: {
    description: "Processing",
    id: 2,
    successful: false,
  },
  stderr: "",
  stdout: "",
  time: null,
  timedOut: false,
  token,
});

const createClientErrorExecution = (
  token: string | null,
  message: string,
  statusId = STATUS_INTERNAL_ERROR,
): ExecutionDetails => ({
  compileOutput: "",
  exitCode: null,
  exitSignal: null,
  memory: null,
  message,
  output: "",
  processing: false,
  status: {
    description: "Client runtime error",
    id: statusId,
    successful: false,
  },
  stderr: message,
  stdout: "",
  time: null,
  timedOut: statusId === STATUS_TLE,
  token,
});

const isTleResult = (execution: ExecutionDetails) =>
  execution.timedOut ||
  execution.status.id === STATUS_TLE ||
  /time limit exceeded|timed out/i.test(execution.status.description) ||
  /time limit exceeded|timed out/i.test(execution.message);

const isCompilerWorkerMessage = (value: unknown): value is CompilerWorkerMessage => {
  if (!value || typeof value !== "object") return false;

  const type = (value as { type?: unknown }).type;
  return (
    type === "started" ||
    type === "stream" ||
    type === "result" ||
    type === "error" ||
    type === "stdin-request" ||
    type === "lifecycle"
  );
};

export const useCompiler = () => {
  const [execution, setExecution] = useState<ExecutionDetails | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const activeRunRef = useRef<{
    cancel: (message?: string) => void;
    requestId: string;
    scheduleTimeout: () => void;
    timeoutId: ReturnType<typeof setTimeout> | null;
    worker: Worker;
  } | null>(null);

  const disposeCompiler = useCallback((requestId?: string) => {
    const activeRun = activeRunRef.current;

    if (!activeRun) return;
    if (requestId && activeRun.requestId !== requestId) return;

    if (activeRun.timeoutId) {
      clearTimeout(activeRun.timeoutId);
    }
    activeRun.worker.terminate();
    activeRunRef.current = null;
  }, []);

  const runCode = useCallback(
    async (language: LanguageOption, code: string, stdin = ""): Promise<CompilerRunResult> => {
      activeRunRef.current?.cancel("Execution cancelled.");

      if (typeof window === "undefined") {
        const nextError = "VoidLAB's browser runtime is not available during server rendering.";
        const result = createClientErrorExecution(null, nextError);
        setExecution(result);
        setError(nextError);
        return { error: nextError, ok: false, result };
      }

      if (typeof SharedArrayBuffer === "undefined" || !window.crossOriginIsolated) {
        const nextError =
          "Blocking stdin requires SharedArrayBuffer. Serve VoidLAB with COOP/COEP headers so the page is cross-origin isolated.";
        const result = createClientErrorExecution(null, nextError);
        setExecution(result);
        setError(nextError);
        return { error: nextError, ok: false, result };
      }

      const requestId = createToken();
      const stdinPayload = typeof stdin === "string" ? stdin : "";
      const stdinBuffer = new SharedArrayBuffer(stdinHeaderBytes + stdinBufferBytes);
      const initialExecution = createProcessingExecution(requestId);

      setLoading(true);
      setError("");
      setExecution(initialExecution);

      return new Promise<CompilerRunResult>((resolve) => {
        let settled = false;
        let stdout = "";
        let stderr = "";
        let cleanupStdinListener = () => {};

        const settle = (result: CompilerRunResult) => {
          if (settled) return;
          settled = true;
          cleanupStdinListener();
          disposeCompiler(requestId);
          setLoading(false);
          resolve(result);
        };

        const cancel = (message = "Execution cancelled.") => {
          const nextExecution: ExecutionDetails = {
            ...initialExecution,
            message,
            output: stdout,
            processing: false,
            stderr,
            status: {
              description: "Cancelled",
              id: STATUS_INTERNAL_ERROR,
              successful: false,
            },
            stdout,
          };

          setExecution(nextExecution);
          setError(message);
          settle({ error: message, ok: false, result: nextExecution });
        };

        const timeoutIdRef: { current: ReturnType<typeof setTimeout> | null } = { current: null };

        const scheduleTimeout = () => {
          if (timeoutIdRef.current) {
            clearTimeout(timeoutIdRef.current);
          }

          timeoutIdRef.current = setTimeout(() => {
            timeoutIdRef.current = null;
            const timeoutExecution: ExecutionDetails = {
              ...createClientErrorExecution(requestId, timeoutHintMessage, STATUS_TLE),
              processing: false,
              stderr,
              stdout,
              output: stdout,
            };

            setExecution(timeoutExecution);
            setError(timeoutHintMessage);
            settle({
              error: timeoutHintMessage,
              ok: false,
              result: timeoutExecution,
              tleSuggestion: true,
            });
          }, executionTimeoutMs);
        };

        const pauseTimeout = () => {
          if (!timeoutIdRef.current) return;
          clearTimeout(timeoutIdRef.current);
          timeoutIdRef.current = null;
        };

        const handleStdinResponse = (event: Event) => {
          const detail = (event as CustomEvent<{ requestId?: string }>).detail;

          if (detail?.requestId === requestId && !settled) {
            scheduleTimeout();
          }
        };

        window.addEventListener(stdinReadyEventName, handleStdinResponse);
        cleanupStdinListener = () => {
          window.removeEventListener(stdinReadyEventName, handleStdinResponse);
        };

        const worker = new Worker("/voidlab-worker.js", {
          name: "voidlab-compiler",
        });

        scheduleTimeout();

        activeRunRef.current = {
          cancel,
          requestId,
          scheduleTimeout,
          get timeoutId() {
            return timeoutIdRef.current;
          },
          worker,
        };

        worker.onerror = (event) => {
          const nextError = event.message || "VoidLAB's browser worker crashed.";
          const nextExecution = createClientErrorExecution(requestId, nextError, STATUS_RUNTIME_ERROR);
          setExecution(nextExecution);
          setError(nextError);
          settle({ error: nextError, ok: false, result: nextExecution });
        };

        worker.onmessage = (event: MessageEvent<unknown>) => {
          if (!isCompilerWorkerMessage(event.data) || event.data.requestId !== requestId || settled) {
            return;
          }

          const message = event.data;

          if (message.type === "started") {
            setExecution((current) => current ?? initialExecution);
            return;
          }

          if (message.type === "lifecycle") {
            setExecution((current) =>
              current
                ? {
                    ...current,
                    message: message.detail || current.message,
                    processing: message.state === "LOADING" || message.state === "RUNNING",
                    status: {
                      ...current.status,
                      description:
                        message.state === "LOADING"
                          ? "Loading runtime"
                          : message.state === "RUNNING"
                            ? "Running"
                            : message.state === "READY"
                              ? "Runtime ready"
                              : "Runtime error",
                    },
                  }
                : current,
            );
            return;
          }

          if (message.type === "stdin-request") {
            pauseTimeout();
            setExecution((current) =>
              current
                ? {
                    ...current,
                    message: `Waiting for stdin: ${message.prompt}`,
                    processing: true,
                    status: {
                      ...current.status,
                      description: "Input required",
                    },
                  }
                : current,
            );
            window.dispatchEvent(
              new CustomEvent(stdinRequestEventName, {
                detail: {
                  capacity: message.capacity,
                  prompt: message.prompt,
                  requestId,
                  sequence: message.sequence,
                  sharedBuffer: stdinBuffer,
                },
              }),
            );
            return;
          }

          if (message.type === "stream") {
            if (message.stream === "stdout") {
              stdout += message.text;
            } else {
              stderr += message.text;
            }

            setExecution((current) => ({
              ...(current ?? initialExecution),
              output: stdout,
              processing: true,
              stderr,
              stdout,
            }));
            return;
          }

          if (message.type === "result") {
            const nextExecution = {
              ...message.execution,
              output: message.execution.stdout,
              stderr: message.execution.stderr || stderr,
              stdout: message.execution.stdout || stdout,
            };

            setExecution(nextExecution);

            if (isTleResult(nextExecution)) {
              const nextError = nextExecution.message || timeoutHintMessage;
              setError(nextError);
              settle({
                error: nextError,
                ok: false,
                result: nextExecution,
                tleSuggestion: true,
              });
              return;
            }

            if (!nextExecution.status.successful) {
              setError(nextExecution.message || nextExecution.stderr || "Execution failed.");
            }

            settle({
              ok: nextExecution.status.successful,
              result: nextExecution,
              ...(nextExecution.status.successful
                ? {}
                : { error: nextExecution.message || nextExecution.stderr || "Execution failed." }),
            } as CompilerRunResult);
            return;
          }

          const nextError = message.error || "Execution failed in the browser worker.";
          const nextExecution =
            message.execution ?? createClientErrorExecution(requestId, nextError, STATUS_RUNTIME_ERROR);
          setExecution(nextExecution);
          setError(nextError);
          settle({ error: nextError, ok: false, result: nextExecution });
        };

        const request: CompilerRequest = {
          payload: {
            code,
            language: {
              id: language.id,
              label: language.label,
              monacoLanguage: language.monacoLanguage,
            },
            stdin: stdinPayload,
            stdinBuffer,
            timeoutMs: executionTimeoutMs,
          },
          requestId,
          type: "run",
        };

        worker.postMessage(request);
      });
    },
    [disposeCompiler],
  );

  const cancelExecution = useCallback(() => {
    activeRunRef.current?.cancel("Execution cancelled.");
  }, []);

  const resetExecutionState = useCallback(() => {
    setError("");
    setExecution(null);
  }, []);

  useEffect(
    () => () => {
      activeRunRef.current?.cancel("Execution cancelled.");
    },
    [],
  );

  return { cancelExecution, error, execution, loading, resetExecutionState, runCode };
};
