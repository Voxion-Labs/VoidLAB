

const ROUTER_VERSION = "2026.05-client-wasm-router";

const RuntimeState = Object.freeze({
  ERROR: "ERROR",
  LOADING: "LOADING",
  READY: "READY",
  RUNNING: "RUNNING",
});

const STATUS_ACCEPTED = 3;
const STATUS_COMPILATION_ERROR = 6;
const STATUS_RUNTIME_ERROR = 11;
const STATUS_UNSUPPORTED = 15;

const DEFAULT_TIMEOUT_MS = 5000;
const STDIN_HEADER_BYTES = 32;
const STDIN_BUFFER_BYTES = 64 * 1024;
const STDIN_STATE = 0;
const STDIN_SEQUENCE = 1;
const STDIN_RESPONSE_BYTES = 2;
const STDIN_CAPACITY = 3;
const STDIN_IDLE = 0;
const STDIN_WAITING = 1;
const STDIN_RESPONSE_READY = 2;
const STDIN_CANCELLED = 3;

const CDN = Object.freeze({
  cheerpjLoader: "https://cjrtnc.leaningtech.com/4.3/loader.js",
  pyodideBase: "https://cdn.jsdelivr.net/pyodide/v0.26.4/full/",
  pyodideLoader: "https://cdn.jsdelivr.net/pyodide/v0.26.4/full/pyodide.js",
  quickjsEsm: "https://esm.sh/quickjs-emscripten@0.31.0",
});

const LANGUAGE_ALIASES = Object.freeze({
  bash: "bash",
  c: "c",
  cpp: "cpp",
  csharp: "csharp",
  go: "go",
  java: "java",
  javascript: "javascript",
  kotlin: "kotlin",
  lua: "lua",
  php: "php",
  powershell: "powershell",
  python: "python",
  ruby: "ruby",
  rust: "rust",
  swift: "swift",
  typescript: "typescript",
});

const runtimeRegistry = new Map();
const scriptLoadCache = new Map();
const moduleLoadCache = new Map();

let activeRun = null;

class RuntimeConfigurationError extends Error {
  constructor(message) {
    super(message);
    this.name = "RuntimeConfigurationError";
  }
}

class RuntimeCompilationError extends Error {
  constructor(message) {
    super(message);
    this.name = "RuntimeCompilationError";
  }
}

const normalizeText = (value) => {
  if (typeof value === "string") return value;
  if (value === null || value === undefined) return "";

  try {
    return String(value);
  } catch {
    return "[unprintable]";
  }
};

const normalizeLanguageId = (language) => LANGUAGE_ALIASES[language?.id] || "javascript";

const nowSeconds = (startedAt) => ((performance.now() - startedAt) / 1000).toFixed(3);

const postProtocolMessage = (message) => {
  self.postMessage(message);
};

const postState = (requestId, languageId, state, detail = "") => {
  postProtocolMessage({
    detail,
    languageId,
    requestId,
    state,
    type: "lifecycle",
    version: ROUTER_VERSION,
  });
};

const createExecution = ({
  compileOutput = "",
  exitCode,
  message = "",
  requestId,
  statusDescription,
  statusId,
  stderr,
  stdout,
  successful,
  timedOut = false,
  time,
}) => ({
  compileOutput,
  exitCode,
  exitSignal: null,
  memory: null,
  message,
  output: stdout,
  processing: false,
  status: {
    description: statusDescription,
    id: statusId,
    successful,
  },
  stderr,
  stdout,
  time,
  timedOut,
  token: requestId,
});

const createStreamWriter = (requestId) => {
  let stdout = "";
  let stderr = "";

  const write = (stream, value, appendNewline = false) => {
    const text = `${normalizeText(value)}${appendNewline ? "\n" : ""}`;
    if (!text) return;

    if (stream === "stdout") {
      stdout += text;
    } else {
      stderr += text;
    }

    postProtocolMessage({
      requestId,
      stream,
      text,
      type: "stream",
    });
  };

  return {
    get stderr() {
      return stderr;
    },
    get stdout() {
      return stdout;
    },
    stderrLine(value) {
      write("stderr", value, true);
    },
    stdoutLine(value) {
      write("stdout", value, true);
    },
    write,
  };
};

const createStdinReader = (stdin) => {
  const normalized = normalizeText(stdin).replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const lines = normalized.length ? normalized.split("\n") : [];
  let cursor = 0;

  return {
    all: normalized,
    hasNext() {
      return cursor < lines.length;
    },
    readLine() {
      if (cursor >= lines.length) return "";
      const nextLine = lines[cursor];
      cursor += 1;
      return nextLine;
    },
  };
};

const createSynchronousStdin = ({ initialStdin, requestId, sharedBuffer }) => {
  const buffered = createStdinReader(initialStdin);
  const decoder = new TextDecoder();
  let sequence = 0;

  if (!(sharedBuffer instanceof SharedArrayBuffer)) {
    throw new RuntimeConfigurationError(
      "SharedArrayBuffer is unavailable. Serve VoidLAB with COOP/COEP headers to enable blocking stdin.",
    );
  }

  const control = new Int32Array(sharedBuffer, 0, STDIN_HEADER_BYTES / Int32Array.BYTES_PER_ELEMENT);
  const bytes = new Uint8Array(sharedBuffer, STDIN_HEADER_BYTES);

  Atomics.store(control, STDIN_CAPACITY, Math.min(bytes.byteLength, STDIN_BUFFER_BYTES));
  Atomics.store(control, STDIN_STATE, STDIN_IDLE);

  return {
    readLine(prompt = "stdin") {
      if (buffered.hasNext()) return buffered.readLine();

      sequence += 1;
      bytes.fill(0);
      Atomics.store(control, STDIN_RESPONSE_BYTES, 0);
      Atomics.store(control, STDIN_SEQUENCE, sequence);
      Atomics.store(control, STDIN_STATE, STDIN_WAITING);

      postProtocolMessage({
        capacity: Atomics.load(control, STDIN_CAPACITY),
        prompt,
        requestId,
        sequence,
        type: "stdin-request",
      });

      const waitResult = Atomics.wait(control, STDIN_STATE, STDIN_WAITING);
      const state = Atomics.load(control, STDIN_STATE);

      if (state === STDIN_CANCELLED) {
        throw Object.assign(new Error("Execution cancelled while waiting for stdin."), {
          cancelled: true,
        });
      }

      if (state !== STDIN_RESPONSE_READY) {
        throw new Error(`Unexpected stdin wake state: ${state} (${waitResult}).`);
      }

      const responseLength = Atomics.load(control, STDIN_RESPONSE_BYTES);
      const response = decoder.decode(bytes.slice(0, Math.max(0, responseLength)));
      Atomics.store(control, STDIN_STATE, STDIN_IDLE);
      Atomics.store(control, STDIN_RESPONSE_BYTES, 0);

      return response.replace(/\r\n/g, "\n").replace(/\r/g, "\n").replace(/\n$/, "");
    },
  };
};

const loadClassicScript = (url) => {
  if (!scriptLoadCache.has(url)) {
    scriptLoadCache.set(
      url,
      new Promise((resolve, reject) => {
        try {
          importScripts(url);
          resolve();
        } catch (error) {
          reject(error);
        }
      }),
    );
  }

  return scriptLoadCache.get(url);
};

const loadEsmModule = (url) => {
  if (!moduleLoadCache.has(url)) {
    moduleLoadCache.set(url, import(/* webpackIgnore: true */ url));
  }

  return moduleLoadCache.get(url);
};

const stripTypeScriptSyntax = (source) =>
  source
    .replace(/^\s*import\s+type\s+[^;]+;?\s*$/gm, "")
    .replace(/^\s*export\s+type\s+[^;]+;?\s*$/gm, "")
    .replace(/^\s*type\s+\w+\s*=\s*[^;]+;?\s*$/gm, "")
    .replace(/^\s*interface\s+\w+(?:\s+extends\s+[^{]+)?\s*\{[\s\S]*?\}\s*$/gm, "")
    .replace(/\s+as\s+[A-Za-z_$][\w$<>,\s[\].|&?]*(?=;|\)|,|\n|$)/g, "")
    .replace(/:\s*[A-Za-z_$][\w$<>,\s[\].|&?]*(?=\s*[,)=;{])/g, "");

const assertNoModuleSyntax = (source) => {
  if (/^\s*import\s/m.test(source) || /^\s*export\s/m.test(source)) {
    throw new RuntimeCompilationError(
      "ES module import/export syntax is not supported inside VoidLAB's inline runtime sandbox.",
    );
  }
};

const withTimeout = (promise, timeoutMs, requestId) =>
  new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(Object.assign(new Error("Execution timed out."), { timedOut: true }));
    }, timeoutMs);

    promise
      .then((value) => {
        if (activeRun?.requestId === requestId) {
          clearTimeout(timer);
          resolve(value);
        }
      })
      .catch((error) => {
        clearTimeout(timer);
        reject(error);
      });
  });

class RuntimeSlot {
  constructor(languageId, adapter) {
    this.adapter = adapter;
    this.error = null;
    this.instance = null;
    this.languageId = languageId;
    this.loadingPromise = null;
    this.state = RuntimeState.LOADING;
  }

  async ensureReady(requestId) {
    if (this.state === RuntimeState.READY && this.instance) {
      postState(requestId, this.languageId, RuntimeState.READY);
      return this.instance;
    }

    if (this.state === RuntimeState.ERROR) {
      throw this.error;
    }

    if (!this.loadingPromise) {
      this.state = RuntimeState.LOADING;
      postState(requestId, this.languageId, RuntimeState.LOADING, this.adapter.label);
      this.loadingPromise = this.adapter
        .load()
        .then((instance) => {
          this.instance = instance;
          this.state = RuntimeState.READY;
          this.error = null;
          return instance;
        })
        .catch((error) => {
          this.error = error;
          this.state = RuntimeState.ERROR;
          this.loadingPromise = null;
          throw error;
        });
    } else {
      postState(requestId, this.languageId, RuntimeState.LOADING, "Waiting for existing runtime load.");
    }

    const instance = await this.loadingPromise;
    postState(requestId, this.languageId, RuntimeState.READY);
    return instance;
  }

  async run(context) {
    const instance = await this.ensureReady(context.requestId);
    this.state = RuntimeState.RUNNING;
    postState(context.requestId, this.languageId, RuntimeState.RUNNING);

    try {
      return await this.adapter.run(instance, context);
    } catch (error) {
      postState(context.requestId, this.languageId, RuntimeState.ERROR, error.message || normalizeText(error));
      throw error;
    } finally {
      this.state = RuntimeState.READY;
      postState(context.requestId, this.languageId, RuntimeState.READY);
    }
  }
}

const registerRuntime = (languageId, adapter) => {
  runtimeRegistry.set(languageId, new RuntimeSlot(languageId, adapter));
};

const makeUnsupportedAdapter = ({ label, packageHint }) => ({
  label,
  async load() {
    if (packageHint?.loader) {
      await Promise.resolve().then(() => packageHint.loader());
    }

    throw new RuntimeConfigurationError(
      `${label} requires a browser WASM compiler/runtime artifact that is not configured in VoidLAB. ` +
        "Add the static CDN entrypoint and implement this adapter before marking the language executable.",
    );
  },
  async run() {
    throw new RuntimeConfigurationError(`${label} runtime is unavailable.`);
  },
});

const createQuickJsAdapter = () => ({
  label: "QuickJS WASM",
  async load() {
    const quickjsModule = await loadEsmModule(CDN.quickjsEsm);
    const getQuickJS = quickjsModule.getQuickJS || quickjsModule.default?.getQuickJS;

    if (typeof getQuickJS !== "function") {
      throw new RuntimeConfigurationError("quickjs-emscripten did not expose getQuickJS().");
    }

    const QuickJS = await getQuickJS();
    return { QuickJS };
  },
  async run(instance, context) {
    const { code, languageId, requestId, startedAt, stdinReader, writer } = context;
    const source = languageId === "typescript" ? stripTypeScriptSyntax(code) : code;
    assertNoModuleSyntax(source);

    const vm = instance.QuickJS.newContext();
    const handles = [];

    const pushHandle = (handle) => {
      handles.push(handle);
      return handle;
    };

    const setGlobal = (name, handle) => {
      vm.setProp(vm.global, name, handle);
      handles.push(handle);
    };

    try {
      const stdoutFn = pushHandle(
        vm.newFunction("stdout", (...args) => {
          writer.stdoutLine(args.map((arg) => normalizeText(vm.dump(arg))).join(" "));
        }),
      );
      const stderrFn = pushHandle(
        vm.newFunction("stderr", (...args) => {
          writer.stderrLine(args.map((arg) => normalizeText(vm.dump(arg))).join(" "));
        }),
      );
      const inputFn = pushHandle(vm.newFunction("input", () => vm.newString(stdinReader.readLine())));
      const printFn = pushHandle(
        vm.newFunction("print", (...args) => {
          writer.stdoutLine(args.map((arg) => normalizeText(vm.dump(arg))).join(" "));
        }),
      );

      const consoleHandle = pushHandle(vm.newObject());
      vm.setProp(consoleHandle, "log", stdoutFn);
      vm.setProp(consoleHandle, "info", stdoutFn);
      vm.setProp(consoleHandle, "debug", stdoutFn);
      vm.setProp(consoleHandle, "warn", stderrFn);
      vm.setProp(consoleHandle, "error", stderrFn);

      setGlobal("console", consoleHandle);
      setGlobal("input", inputFn);
      setGlobal("readline", inputFn);
      setGlobal("prompt", inputFn);
      setGlobal("print", printFn);
      setGlobal("stdin", vm.newString(stdinReader.all));

      const result = vm.evalCode(`"use strict";\n${source}`);

      if (result.error) {
        const dumped = normalizeText(vm.dump(result.error));
        result.error.dispose();
        throw new RuntimeCompilationError(dumped);
      }

      result.value.dispose();

      return createExecution({
        exitCode: 0,
        requestId,
        statusDescription: "Accepted",
        statusId: STATUS_ACCEPTED,
        stderr: writer.stderr,
        stdout: writer.stdout,
        successful: true,
        time: nowSeconds(startedAt),
      });
    } finally {
      while (handles.length) {
        handles.pop()?.dispose?.();
      }
      vm.dispose();
    }
  },
});

const createPyodideAdapter = () => ({
  label: "Pyodide Python WASM",
  async load() {
    await loadClassicScript(CDN.pyodideLoader);

    if (typeof self.loadPyodide !== "function") {
      throw new RuntimeConfigurationError("Pyodide loader did not expose loadPyodide().");
    }

    const pyodide = await self.loadPyodide({
      indexURL: CDN.pyodideBase,
    });

    return { pyodide };
  },
  async run(instance, context) {
    const { code, requestId, startedAt, stdinReader, writer } = context;
    const pyodide = instance.pyodide;
    pyodide.setStdin({ stdin: () => stdinReader.readLine("python input()") });
    pyodide.setStdout({ batched: (text) => writer.stdoutLine(text) });
    pyodide.setStderr({ batched: (text) => writer.stderrLine(text) });

    await pyodide.loadPackagesFromImports(code);
    await pyodide.runPythonAsync(code);

    return createExecution({
      exitCode: 0,
      requestId,
      statusDescription: "Accepted",
      statusId: STATUS_ACCEPTED,
      stderr: writer.stderr,
      stdout: writer.stdout,
      successful: true,
      time: nowSeconds(startedAt),
    });
  },
});

const createCheerpJAdapter = () => ({
  label: "CheerpJ JVM WASM",
  async load() {
    await loadClassicScript(CDN.cheerpjLoader);

    if (typeof self.cheerpjInit !== "function") {
      throw new RuntimeConfigurationError("CheerpJ loader did not expose cheerpjInit().");
    }

    await self.cheerpjInit({
      status: "none",
      version: 17,
    });

    return {
      addStringFile: self.cheerpOSAddStringFile,
      runMain: self.cheerpjRunMain,
    };
  },
  async run(instance, context) {
    const { code, requestId } = context;

    if (typeof instance.addStringFile !== "function" || typeof instance.runMain !== "function") {
      throw new RuntimeConfigurationError("CheerpJ file or main execution APIs are unavailable.");
    }

    const sourcePath = `/files/${requestId}/Main.java`;
    await instance.addStringFile(sourcePath, code);

    throw new RuntimeConfigurationError(
      "CheerpJ executes JVM bytecode/JARs, not raw Java source. Add a client-side Java compiler artifact " +
        "to compile Main.java, then call cheerpjRunMain(className, classPath).",
    );
  },
});

const createWasmBindgenAdapter = () => ({
  label: "wasm-bindgen Rust WASM",
  async load() {
    return {
      async instantiate({ glueUrl, wasmUrl }) {
        if (!glueUrl || !wasmUrl) {
          throw new RuntimeConfigurationError(
            "Rust execution requires precompiled wasm-bindgen glueUrl and wasmUrl metadata.",
          );
        }

        const mod = await loadEsmModule(glueUrl);
        const init = mod.default || mod.init;

        if (typeof init !== "function") {
          throw new RuntimeConfigurationError("wasm-bindgen glue did not expose a default init function.");
        }

        await init(wasmUrl);
        return mod;
      },
    };
  },
  async run(instance, context) {
    const { code, requestId, startedAt, writer } = context;

    let metadata = null;
    try {
      metadata = JSON.parse(code);
    } catch {
      throw new RuntimeConfigurationError(
        "Rust source cannot be compiled in-browser without shipping a rustc WASM toolchain. " +
          "Provide JSON metadata with wasm-bindgen glueUrl, wasmUrl, and an optional exportName.",
      );
    }

    const mod = await instance.instantiate(metadata);
    const exportName = metadata.exportName || "main";

    if (typeof mod[exportName] !== "function") {
      throw new RuntimeConfigurationError(`wasm-bindgen module does not export ${exportName}().`);
    }

    const result = await mod[exportName]();
    if (result !== undefined) writer.stdoutLine(result);

    return createExecution({
      exitCode: 0,
      requestId,
      statusDescription: "Accepted",
      statusId: STATUS_ACCEPTED,
      stderr: writer.stderr,
      stdout: writer.stdout,
      successful: true,
      time: nowSeconds(startedAt),
    });
  },
});

registerRuntime("javascript", createQuickJsAdapter());
registerRuntime("typescript", createQuickJsAdapter());
registerRuntime("python", createPyodideAdapter());
registerRuntime("java", createCheerpJAdapter());
registerRuntime("rust", createWasmBindgenAdapter());

registerRuntime("c", makeUnsupportedAdapter({ label: "Clang C WASM" }));
registerRuntime("cpp", makeUnsupportedAdapter({ label: "Clang C++ WASM" }));
registerRuntime("go", makeUnsupportedAdapter({ label: "Go WASM toolchain" }));
registerRuntime("php", makeUnsupportedAdapter({ label: "PHP WASM runtime" }));
registerRuntime("ruby", makeUnsupportedAdapter({ label: "Ruby WASM runtime" }));
registerRuntime("swift", makeUnsupportedAdapter({ label: "Swift WASM toolchain" }));
registerRuntime("kotlin", makeUnsupportedAdapter({ label: "Kotlin/JVM client compiler + CheerpJ" }));
registerRuntime("bash", makeUnsupportedAdapter({ label: "POSIX shell WASM runtime" }));
registerRuntime("powershell", makeUnsupportedAdapter({ label: "PowerShell WASM runtime" }));
registerRuntime("lua", makeUnsupportedAdapter({ label: "Lua WASM runtime" }));
registerRuntime("csharp", makeUnsupportedAdapter({ label: ".NET/C# WASM runtime" }));

const executeRun = async (message) => {
  const { requestId } = message;
  const payload = message.payload || {};
  const languageId = normalizeLanguageId(payload.language);
  const runtime = runtimeRegistry.get(languageId);
  const startedAt = performance.now();
  const writer = createStreamWriter(requestId);

  activeRun = {
    languageId,
    requestId,
  };

  postProtocolMessage({ requestId, type: "started" });

  if (!runtime) {
    return createExecution({
      compileOutput: `No runtime registered for ${languageId}.`,
      exitCode: null,
      message: `No runtime registered for ${languageId}.`,
      requestId,
      statusDescription: "Unsupported language",
      statusId: STATUS_UNSUPPORTED,
      stderr: "",
      stdout: "",
      successful: false,
      time: nowSeconds(startedAt),
    });
  }

  try {
    const stdinReader = createSynchronousStdin({
      initialStdin: normalizeText(payload.stdin),
      requestId,
      sharedBuffer: payload.stdinBuffer,
    });

    return await withTimeout(
      runtime.run({
        code: normalizeText(payload.code),
        languageId,
        requestId,
        startedAt,
        stdinReader,
        writer,
      }),
      Number(payload.timeoutMs) || DEFAULT_TIMEOUT_MS,
      requestId,
    );
  } catch (error) {
    const isCompileError = error instanceof RuntimeCompilationError || error?.name === "RuntimeCompilationError";
    const isConfigError = error instanceof RuntimeConfigurationError || error?.name === "RuntimeConfigurationError";
    const timedOut = Boolean(error?.timedOut);
    const text = error instanceof Error ? error.stack || error.message : normalizeText(error);
    const messageText = error instanceof Error ? error.message : normalizeText(error);

    return createExecution({
      compileOutput: isCompileError || isConfigError ? messageText : "",
      exitCode: timedOut ? null : 1,
      message: timedOut ? "Execution timed out." : messageText,
      requestId,
      statusDescription: timedOut
        ? "Time limit exceeded"
        : isCompileError
          ? "Compilation error"
          : isConfigError
            ? "Runtime configuration error"
            : "Runtime error",
      statusId: timedOut
        ? STATUS_RUNTIME_ERROR
        : isCompileError
          ? STATUS_COMPILATION_ERROR
          : isConfigError
            ? STATUS_UNSUPPORTED
            : STATUS_RUNTIME_ERROR,
      stderr: isCompileError || isConfigError ? writer.stderr : writer.stderr || text,
      stdout: writer.stdout,
      successful: false,
      timedOut,
      time: nowSeconds(startedAt),
    });
  } finally {
    if (activeRun?.requestId === requestId) {
      activeRun = null;
    }
  }
};

self.onmessage = async (event) => {
  const message = event.data;

  if (!message || message.type !== "run" || !message.requestId) {
    return;
  }

  const execution = await executeRun(message);

  postProtocolMessage({
    execution,
    requestId: message.requestId,
    type: "result",
  });
};
