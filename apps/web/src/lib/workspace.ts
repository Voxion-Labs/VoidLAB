import { DEFAULT_LANGUAGE, LanguageOption, getLanguageByExtension, getLanguageById } from "@/lib/languages";

export const workspaceStorageKey = "voidlab-workspace";
const workspaceVfsRoot = "workspace";
const workspaceMetaPath = ".voidlab/workspace.json";

export type ProjectFile = {
  content: string;
  id: string;
  languageId: string;
  name: string;
  path: string;
};

export type GitHubState = {
  branch: string;
  repoUrl: string;
  visibility: "private" | "public";
};

export type TerminalHistoryEntry = {
  command: string;
  createdAt: string;
  cwd: string;
  id: string;
  output: string;
  status: "error" | "info" | "success";
};

export type TerminalState = {
  cwd: string;
  history: TerminalHistoryEntry[];
};

export type WorkspaceState = {
  activeFileId: string;
  files: ProjectFile[];
  folders: string[];
  gitState: GitHubState;
  terminal: TerminalState;
};

export type WorkspaceCommandResult = {
  clearHistory?: boolean;
  cwd: string;
  openFileId?: string;
  output: string;
  status: "error" | "info" | "success";
  workspace: WorkspaceState;
};

type WorkspaceStorageBackend = "indexeddb" | "opfs";

type WorkspaceVfsNodeKind = "directory" | "file";

type WorkspaceVfsStats = {
  isDirectory: () => boolean;
  isFile: () => boolean;
  mode: number;
  mtimeMs: number;
  size: number;
  type: WorkspaceVfsNodeKind;
};

type FileSystemSyncAccessHandleLike = {
  close: () => void;
  flush: () => void;
  getSize: () => number;
  read: (buffer: BufferSource, options?: { at?: number }) => number;
  truncate: (size: number) => void;
  write: (buffer: BufferSource, options?: { at?: number }) => number;
};

type FileSystemFileHandleWithAccess = FileSystemFileHandle & {
  createSyncAccessHandle?: () => Promise<FileSystemSyncAccessHandleLike>;
};

type WorkspaceFileDescriptor = {
  close: () => Promise<void>;
  path: string;
  read: (buffer: Uint8Array, offset?: number, length?: number, position?: number) => Promise<number>;
  stat: () => Promise<WorkspaceVfsStats>;
  truncate: (size: number) => Promise<void>;
  write: (buffer: Uint8Array, offset?: number, length?: number, position?: number) => Promise<number>;
};

type WorkspaceVfsPromises = {
  mkdir: (path: string, options?: { recursive?: boolean }) => Promise<void>;
  readdir: (path: string) => Promise<string[]>;
  readFile: (path: string, options?: BufferEncoding | { encoding?: BufferEncoding | null }) => Promise<string | Uint8Array>;
  rmdir: (path: string, options?: { recursive?: boolean }) => Promise<void>;
  stat: (path: string) => Promise<WorkspaceVfsStats>;
  unlink: (path: string) => Promise<void>;
  writeFile: (path: string, data: string | ArrayBuffer | Uint8Array) => Promise<void>;
};

export type WorkspaceVfs = {
  backend: WorkspaceStorageBackend;
  clear: () => Promise<void>;
  close: (fd: WorkspaceFileDescriptor) => Promise<void>;
  exportWorkspace: () => Promise<WorkspaceState>;
  importWorkspace: (workspace: WorkspaceState) => Promise<void>;
  mkdir: (path: string) => Promise<void>;
  open: (path: string, flags?: "r" | "r+" | "w" | "w+" | "a" | "a+") => Promise<WorkspaceFileDescriptor>;
  promises: WorkspaceVfsPromises;
  readBinary: (path: string) => Promise<Uint8Array>;
  readText: (path: string) => Promise<string>;
  remove: (path: string, options?: { recursive?: boolean }) => Promise<void>;
  stat: (path: string) => Promise<WorkspaceVfsStats>;
  writeBinary: (path: string, data: Uint8Array | ArrayBuffer) => Promise<void>;
  writeText: (path: string, value: string) => Promise<void>;
};

export const defaultGitState: GitHubState = {
  branch: "main",
  repoUrl: "",
  visibility: "public",
};

export const defaultTerminalState: TerminalState = {
  cwd: "",
  history: [],
};

export const createFileId = () =>
  `file-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const createHistoryId = () =>
  `terminal-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const createSafeName = (value: string) =>
  value.trim().replace(/\s+/g, "-").replace(/[^\w./-]/g, "");

const splitPath = (value: string) =>
  value
    .replaceAll("\\", "/")
    .split("/")
    .map((segment) => segment.trim())
    .filter(Boolean);

export const normalizeWorkspacePath = (value: string) => {
  const parts: string[] = [];

  splitPath(value).forEach((segment) => {
    if (segment === ".") return;
    if (segment === "..") {
      parts.pop();
      return;
    }

    parts.push(segment);
  });

  return parts.join("/");
};

export const formatWorkspacePath = (value: string) => {
  const normalized = normalizeWorkspacePath(value);
  return normalized ? `/${normalized}` : "/";
};

export const getWorkspaceParentPath = (value: string) => {
  const normalized = normalizeWorkspacePath(value);

  if (!normalized) return "";

  const segments = normalized.split("/");
  segments.pop();
  return segments.join("/");
};

export const getWorkspaceBaseName = (value: string) => {
  const normalized = normalizeWorkspacePath(value);
  return normalized.split("/").pop() ?? "";
};

export const joinWorkspacePath = (...parts: string[]) =>
  normalizeWorkspacePath(parts.filter(Boolean).join("/"));

export const resolveWorkspacePath = (cwd: string, target: string) => {
  const trimmed = target.trim();

  if (!trimmed) return normalizeWorkspacePath(cwd);
  if (trimmed.startsWith("/")) return normalizeWorkspacePath(trimmed);

  return joinWorkspacePath(cwd, trimmed);
};

export const withExtension = (baseName: string, extension: string) => {
  const safeBase = createSafeName(baseName) || "untitled";
  return safeBase.includes(".") ? safeBase : `${safeBase}.${extension}`;
};

export const replaceExtension = (name: string, extension: string) => {
  const index = name.lastIndexOf(".");
  const base = index > 0 ? name.slice(0, index) : name;
  return `${base}.${extension}`;
};

const makeUniquePath = (desiredPath: string, existingPaths: string[]) => {
  const normalized = normalizeWorkspacePath(desiredPath);
  const existing = new Set(existingPaths.map((item) => normalizeWorkspacePath(item)));

  if (!existing.has(normalized)) return normalized;

  const baseName = getWorkspaceBaseName(normalized);
  const parentPath = getWorkspaceParentPath(normalized);
  const dotIndex = baseName.lastIndexOf(".");
  const stem = dotIndex > 0 ? baseName.slice(0, dotIndex) : baseName;
  const extension = dotIndex > 0 ? baseName.slice(dotIndex) : "";

  let counter = 2;
  let nextPath = normalized;

  while (existing.has(nextPath)) {
    nextPath = joinWorkspacePath(parentPath, `${stem}-${counter}${extension}`);
    counter += 1;
  }

  return nextPath;
};

const ensureFolderChain = (folders: string[], value: string) => {
  const normalized = normalizeWorkspacePath(value);

  if (!normalized) return folders;

  const nextFolders = new Set(folders.map((item) => normalizeWorkspacePath(item)).filter(Boolean));
  const segments = normalized.split("/");

  for (let index = 1; index <= segments.length; index += 1) {
    nextFolders.add(segments.slice(0, index).join("/"));
  }

  return Array.from(nextFolders).sort((left, right) => left.localeCompare(right));
};

const dedupeFiles = (files: ProjectFile[]) => {
  const seen = new Set<string>();

  return files
    .map((file) => {
      const normalizedPath = makeUniquePath(file.path || file.name, Array.from(seen));
      seen.add(normalizedPath);

      return {
        ...file,
        languageId: getLanguageById(file.languageId).id,
        name: getWorkspaceBaseName(normalizedPath),
        path: normalizedPath,
      };
    })
    .sort((left, right) => left.path.localeCompare(right.path));
};

const normalizeFolders = (folders: string[], files: ProjectFile[]) => {
  const nextFolders = folders.reduce<string[]>(
    (allFolders, folder) => ensureFolderChain(allFolders, folder),
    [],
  );

  return files.reduce<string[]>(
    (allFolders, file) => ensureFolderChain(allFolders, getWorkspaceParentPath(file.path)),
    nextFolders,
  );
};

export const buildStarterFile = (
  language: LanguageOption,
  value = "main",
  cwd = "",
): ProjectFile => {
  const suggestedName = withExtension(getWorkspaceBaseName(value) || value, language.extension);
  const path = resolveWorkspacePath(cwd, joinWorkspacePath(getWorkspaceParentPath(value), suggestedName));

  return {
    content: language.template,
    id: createFileId(),
    languageId: language.id,
    name: getWorkspaceBaseName(path),
    path,
  };
};

const createDefaultWorkspace = (): WorkspaceState => {
  const starterFile = buildStarterFile(DEFAULT_LANGUAGE);

  return {
    activeFileId: starterFile.id,
    files: [starterFile],
    folders: [],
    gitState: defaultGitState,
    terminal: defaultTerminalState,
  };
};

export const createFolderPath = (
  desiredPath: string,
  existingFolders: string[],
  existingFiles: ProjectFile[],
  cwd = "",
) => {
  const normalized = resolveWorkspacePath(cwd, desiredPath);

  if (!normalized) return "";

  const occupied = [
    ...existingFolders,
    ...existingFiles.map((file) => file.path),
  ];

  return makeUniquePath(normalized, occupied);
};

export const createWorkspaceFile = (
  desiredPath: string,
  languageId: string,
  existingFiles: ProjectFile[],
  cwd = "",
) => {
  const language = getLanguageById(languageId);
  const targetPath = resolveWorkspacePath(cwd, desiredPath);
  const nextPath = makeUniquePath(
    withExtension(targetPath || "main", language.extension),
    existingFiles.map((file) => file.path),
  );

  return {
    content: language.template,
    id: createFileId(),
    languageId: language.id,
    name: getWorkspaceBaseName(nextPath),
    path: nextPath,
  } satisfies ProjectFile;
};

export const normalizeWorkspaceState = (workspace: WorkspaceState): WorkspaceState => {
  const files = dedupeFiles(workspace.files.length ? workspace.files : [buildStarterFile(DEFAULT_LANGUAGE)]);
  const folders = normalizeFolders(workspace.folders ?? [], files);
  const activeFileId = files.some((file) => file.id === workspace.activeFileId)
    ? workspace.activeFileId
    : files[0].id;

  return {
    activeFileId,
    files,
    folders,
    gitState: workspace.gitState ?? defaultGitState,
    terminal: {
      cwd: normalizeWorkspacePath(workspace.terminal?.cwd ?? ""),
      history: Array.isArray(workspace.terminal?.history) ? workspace.terminal.history.slice(-60) : [],
    },
  };
};

export const fromLegacyWorkspace = (parsed: {
  drafts?: Record<string, string>;
  files?: ProjectFile[];
  language?: string;
}): WorkspaceState => {
  const draftEntries = Object.entries(parsed.drafts ?? {});
  const files =
    draftEntries.length > 0
      ? draftEntries.map(([languageId, content], index) => {
          const language = getLanguageById(languageId);
          const path = withExtension(index === 0 ? "main" : language.label.toLowerCase(), language.extension);

          return {
            content,
            id: createFileId(),
            languageId: language.id,
            name: path,
            path,
          };
        })
      : [buildStarterFile(DEFAULT_LANGUAGE)];

  const activeFile = files.find((file) => file.languageId === parsed.language) ?? files[0];

  return normalizeWorkspaceState({
    activeFileId: activeFile.id,
    files,
    folders: [],
    gitState: defaultGitState,
    terminal: defaultTerminalState,
  });
};

export const readWorkspace = (): WorkspaceState => {
  const raw = window.localStorage.getItem(workspaceStorageKey);

  if (!raw) {
    return createDefaultWorkspace();
  }

  try {
    const parsed = JSON.parse(raw) as WorkspaceState & {
      drafts?: Record<string, string>;
      files?: Array<ProjectFile & { path?: string }>;
      folders?: string[];
      language?: string;
      terminal?: TerminalState;
    };

    if ("drafts" in parsed) {
      return fromLegacyWorkspace(parsed);
    }

    const files =
      parsed.files?.map((file) => {
        const path = normalizeWorkspacePath(file.path || file.name);

        return {
          ...file,
          languageId: getLanguageById(file.languageId).id,
          name: getWorkspaceBaseName(path) || file.name,
          path,
        };
      }) ?? [];

    return normalizeWorkspaceState({
      activeFileId: parsed.activeFileId,
      files,
      folders: parsed.folders ?? [],
      gitState: parsed.gitState ?? defaultGitState,
      terminal: parsed.terminal ?? defaultTerminalState,
    });
  } catch {
    return createDefaultWorkspace();
  }
};

export const persistWorkspace = (workspace: WorkspaceState) => {
  const normalized = normalizeWorkspaceState(workspace);
  window.localStorage.setItem(workspaceStorageKey, JSON.stringify(normalized));
  void persistWorkspaceToVfs(normalized);
};

const textEncoder = () => new TextEncoder();
const textDecoder = () => new TextDecoder();

const toBytes = (value: string | ArrayBuffer | Uint8Array): Uint8Array<ArrayBuffer> => {
  if (typeof value === "string") return textEncoder().encode(value);
  if (value instanceof Uint8Array) return new Uint8Array(value);
  return new Uint8Array(value.slice(0));
};

const createStats = (type: WorkspaceVfsNodeKind, size = 0, mtimeMs = Date.now()): WorkspaceVfsStats => ({
  isDirectory: () => type === "directory",
  isFile: () => type === "file",
  mode: type === "directory" ? 0o040777 : 0o100666,
  mtimeMs,
  size,
  type,
});

const normalizeVfsPath = (value: string) => normalizeWorkspacePath(value.replace(/^\/+/, ""));

const getVfsParentPath = (value: string) => getWorkspaceParentPath(normalizeVfsPath(value));

const assertBrowserStorage = () => {
  if (typeof window === "undefined") {
    throw new Error("VoidLAB VFS is only available in the browser.");
  }
};

const supportsOpfs = () =>
  typeof navigator !== "undefined" &&
  Boolean(navigator.storage?.getDirectory);

const openIdb = () =>
  new Promise<IDBDatabase>((resolve, reject) => {
    assertBrowserStorage();
    const request = indexedDB.open("voidlab-vfs", 1);

    request.onupgradeneeded = () => {
      const db = request.result;

      if (!db.objectStoreNames.contains("nodes")) {
        const store = db.createObjectStore("nodes", { keyPath: "path" });
        store.createIndex("byParent", "parent", { unique: false });
      }
    };
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });

const idbRequest = <T>(request: IDBRequest<T>) =>
  new Promise<T>((resolve, reject) => {
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });

const idbTransactionDone = (transaction: IDBTransaction) =>
  new Promise<void>((resolve, reject) => {
    transaction.onabort = () => reject(transaction.error);
    transaction.onerror = () => reject(transaction.error);
    transaction.oncomplete = () => resolve();
  });

class IndexedDbVfs implements WorkspaceVfs {
  backend = "indexeddb" as const;
  private dbPromise = openIdb();

  get promises(): WorkspaceVfsPromises {
    return {
      mkdir: (path, options) => this.mkdirRecursive(path, Boolean(options?.recursive)),
      readdir: (path) => this.readdir(path),
      readFile: async (path, options) => {
        const data = await this.readBinary(path);
        const encoding = typeof options === "string" ? options : options?.encoding;
        return encoding === "utf8" || encoding === "utf-8" ? textDecoder().decode(data) : data;
      },
      rmdir: (path, options) => this.remove(path, { recursive: options?.recursive }),
      stat: (path) => this.stat(path),
      unlink: (path) => this.remove(path),
      writeFile: (path, data) => this.writeBinary(path, toBytes(data)),
    };
  }

  async clear() {
    const db = await this.dbPromise;
    const transaction = db.transaction("nodes", "readwrite");
    transaction.objectStore("nodes").clear();
    await idbTransactionDone(transaction);
  }

  async mkdir(path: string) {
    await this.mkdirRecursive(path, true);
  }

  private async mkdirRecursive(path: string, recursive: boolean) {
    const normalized = normalizeVfsPath(path);
    const db = await this.dbPromise;
    const transaction = db.transaction("nodes", "readwrite");
    const store = transaction.objectStore("nodes");
    const segments = normalized.split("/").filter(Boolean);
    const paths = recursive
      ? segments.map((_, index) => segments.slice(0, index + 1).join("/"))
      : normalized
        ? [normalized]
        : [];

    for (const folderPath of paths) {
      store.put({
        data: new Uint8Array(),
        kind: "directory",
        mtimeMs: Date.now(),
        parent: getVfsParentPath(folderPath),
        path: folderPath,
      });
    }

    await idbTransactionDone(transaction);
  }

  async writeText(path: string, value: string) {
    await this.writeBinary(path, textEncoder().encode(value));
  }

  async writeBinary(path: string, data: Uint8Array | ArrayBuffer) {
    const normalized = normalizeVfsPath(path);

    if (!normalized) throw new Error("Cannot write to VFS root.");

    const db = await this.dbPromise;
    const parent = getVfsParentPath(normalized);
    const transaction = db.transaction("nodes", "readwrite");
    const store = transaction.objectStore("nodes");

    for (const folder of parent ? parent.split("/").map((_, index, all) => all.slice(0, index + 1).join("/")) : []) {
      store.put({
        data: new Uint8Array(),
        kind: "directory",
        mtimeMs: Date.now(),
        parent: getVfsParentPath(folder),
        path: folder,
      });
    }

    const bytes = toBytes(data);
    store.put({
      data: bytes,
      kind: "file",
      mtimeMs: Date.now(),
      parent,
      path: normalized,
      size: bytes.byteLength,
    });
    await idbTransactionDone(transaction);
  }

  async readText(path: string) {
    return textDecoder().decode(await this.readBinary(path));
  }

  async readBinary(path: string) {
    const node = await this.getNode(path);

    if (!node || node.kind !== "file") {
      throw new Error(`ENOENT: ${formatWorkspacePath(path)} is not a file`);
    }

    return toBytes(node.data ?? new Uint8Array());
  }

  async readdir(path: string) {
    const db = await this.dbPromise;
    const parent = normalizeVfsPath(path);
    const transaction = db.transaction("nodes", "readonly");
    const index = transaction.objectStore("nodes").index("byParent");
    const request = index.getAll(parent);
    const nodes = await idbRequest<Array<{ path: string }>>(request);
    await idbTransactionDone(transaction);

    return nodes.map((node) => getWorkspaceBaseName(node.path)).sort((left, right) => left.localeCompare(right));
  }

  async stat(path: string) {
    const normalized = normalizeVfsPath(path);

    if (!normalized) return createStats("directory");

    const node = await this.getNode(normalized);

    if (!node) throw new Error(`ENOENT: ${formatWorkspacePath(path)} does not exist`);

    return createStats(node.kind, node.kind === "file" ? node.data?.byteLength ?? node.size ?? 0 : 0, node.mtimeMs);
  }

  async remove(path: string, options?: { recursive?: boolean }) {
    const normalized = normalizeVfsPath(path);
    const db = await this.dbPromise;
    const transaction = db.transaction("nodes", "readwrite");
    const store = transaction.objectStore("nodes");

    if (!normalized) {
      store.clear();
      await idbTransactionDone(transaction);
      return;
    }

    if (options?.recursive) {
      const request = store.getAllKeys();
      const keys = await idbRequest<IDBValidKey[]>(request);
      keys
        .map(String)
        .filter((key) => key === normalized || key.startsWith(`${normalized}/`))
        .forEach((key) => store.delete(key));
    } else {
      store.delete(normalized);
    }

    await idbTransactionDone(transaction);
  }

  async open(path: string, flags: "r" | "r+" | "w" | "w+" | "a" | "a+" = "r") {
    const normalized = normalizeVfsPath(path);
    let cursor = flags.startsWith("a") ? (await this.safeReadBinary(normalized)).byteLength : 0;

    if (flags.startsWith("w")) {
      await this.writeBinary(normalized, new Uint8Array());
    }

    return {
      close: async () => {},
      path: normalized,
      read: async (buffer, offset = 0, length = buffer.byteLength - offset, position = cursor) => {
        const data = await this.readBinary(normalized);
        const chunk = data.slice(position, position + length);
        buffer.set(chunk, offset);
        cursor = position + chunk.byteLength;
        return chunk.byteLength;
      },
      stat: () => this.stat(normalized),
      truncate: async (size) => {
        const data = await this.safeReadBinary(normalized);
        await this.writeBinary(normalized, data.slice(0, size));
      },
      write: async (buffer, offset = 0, length = buffer.byteLength - offset, position = cursor) => {
        const current = await this.safeReadBinary(normalized);
        const next = new Uint8Array(Math.max(current.byteLength, position + length));
        next.set(current);
        next.set(buffer.slice(offset, offset + length), position);
        await this.writeBinary(normalized, next);
        cursor = position + length;
        return length;
      },
    } satisfies WorkspaceFileDescriptor;
  }

  async close(fd: WorkspaceFileDescriptor) {
    await fd.close();
  }

  async importWorkspace(workspace: WorkspaceState) {
    await replaceVfsTree(this, workspace);
  }

  async exportWorkspace() {
    return exportVfsTree(this);
  }

  private async safeReadBinary(path: string) {
    try {
      return await this.readBinary(path);
    } catch {
      return new Uint8Array();
    }
  }

  private async getNode(path: string) {
    const db = await this.dbPromise;
    const transaction = db.transaction("nodes", "readonly");
    const request = transaction.objectStore("nodes").get(normalizeVfsPath(path));
    const node = await idbRequest<{
      data?: Uint8Array;
      kind: WorkspaceVfsNodeKind;
      mtimeMs: number;
      path: string;
      size?: number;
    } | undefined>(request);
    await idbTransactionDone(transaction);
    return node;
  }
}

class OpfsVfs implements WorkspaceVfs {
  backend = "opfs" as const;
  private rootPromise = navigator.storage.getDirectory().then((root) =>
    root.getDirectoryHandle(workspaceVfsRoot, { create: true }),
  );

  get promises(): WorkspaceVfsPromises {
    return {
      mkdir: async (path, options) => {
        if (options?.recursive) await this.mkdir(path);
        else await this.getDirectoryHandle(path, true);
      },
      readdir: (path) => this.readdir(path),
      readFile: async (path, options) => {
        const data = await this.readBinary(path);
        const encoding = typeof options === "string" ? options : options?.encoding;
        return encoding === "utf8" || encoding === "utf-8" ? textDecoder().decode(data) : data;
      },
      rmdir: (path, options) => this.remove(path, { recursive: options?.recursive }),
      stat: (path) => this.stat(path),
      unlink: (path) => this.remove(path),
      writeFile: (path, data) => this.writeBinary(path, toBytes(data)),
    };
  }

  async clear() {
    const root = await navigator.storage.getDirectory();
    try {
      await root.removeEntry(workspaceVfsRoot, { recursive: true });
    } catch {
      // No existing OPFS tree yet.
    }
    this.rootPromise = root.getDirectoryHandle(workspaceVfsRoot, { create: true });
  }

  async mkdir(path: string) {
    await this.getDirectoryHandle(path, true);
  }

  async writeText(path: string, value: string) {
    await this.writeBinary(path, textEncoder().encode(value));
  }

  async writeBinary(path: string, data: Uint8Array | ArrayBuffer) {
    const fileHandle = await this.getFileHandle(path, true);
    const bytes = toBytes(data);
    const accessHandle = await (fileHandle as FileSystemFileHandleWithAccess).createSyncAccessHandle?.();

    if (accessHandle) {
      accessHandle.truncate(0);
      accessHandle.write(bytes as BufferSource, { at: 0 });
      accessHandle.flush();
      accessHandle.close();
      return;
    }

    const writable = await fileHandle.createWritable();
    await writable.write(bytes as FileSystemWriteChunkType);
    await writable.close();
  }

  async readText(path: string) {
    return textDecoder().decode(await this.readBinary(path));
  }

  async readBinary(path: string) {
    const fileHandle = await this.getFileHandle(path, false);
    const accessHandle = await (fileHandle as FileSystemFileHandleWithAccess).createSyncAccessHandle?.();

    if (accessHandle) {
      const size = accessHandle.getSize();
      const bytes = new Uint8Array(size);
      accessHandle.read(bytes, { at: 0 });
      accessHandle.close();
      return bytes;
    }

    const file = await fileHandle.getFile();
    return toBytes(await file.arrayBuffer());
  }

  async readdir(path: string) {
    const directory = await this.getDirectoryHandle(path, false);
    const items: string[] = [];

    const entries = (directory as FileSystemDirectoryHandle & {
      entries: () => AsyncIterable<[string, FileSystemHandle]>;
    }).entries();

    for await (const [name] of entries) {
      items.push(name);
    }

    return items.sort((left, right) => left.localeCompare(right));
  }

  async stat(path: string) {
    const normalized = normalizeVfsPath(path);

    if (!normalized) return createStats("directory");

    try {
      const fileHandle = await this.getFileHandle(normalized, false);
      const file = await fileHandle.getFile();
      return createStats("file", file.size, file.lastModified);
    } catch {
      await this.getDirectoryHandle(normalized, false);
      return createStats("directory");
    }
  }

  async remove(path: string, options?: { recursive?: boolean }) {
    const normalized = normalizeVfsPath(path);

    if (!normalized) {
      await this.clear();
      return;
    }

    const parent = await this.getDirectoryHandle(getVfsParentPath(normalized), false);
    await parent.removeEntry(getWorkspaceBaseName(normalized), { recursive: Boolean(options?.recursive) });
  }

  async open(path: string, flags: "r" | "r+" | "w" | "w+" | "a" | "a+" = "r") {
    const normalized = normalizeVfsPath(path);
    const fileHandle = await this.getFileHandle(normalized, flags !== "r");
    const accessHandle = await (fileHandle as FileSystemFileHandleWithAccess).createSyncAccessHandle?.();

    if (accessHandle) {
      if (flags.startsWith("w")) accessHandle.truncate(0);

      let cursor = flags.startsWith("a") ? accessHandle.getSize() : 0;

      return {
        close: async () => accessHandle.close(),
        path: normalized,
        read: async (buffer, offset = 0, length = buffer.byteLength - offset, position = cursor) => {
          const temp = new Uint8Array(length);
          const bytesRead = accessHandle.read(temp, { at: position });
          buffer.set(temp.slice(0, bytesRead), offset);
          cursor = position + bytesRead;
          return bytesRead;
        },
        stat: async () => createStats("file", accessHandle.getSize()),
        truncate: async (size) => accessHandle.truncate(size),
        write: async (buffer, offset = 0, length = buffer.byteLength - offset, position = cursor) => {
          const bytesWritten = accessHandle.write(buffer.slice(offset, offset + length), { at: position });
          accessHandle.flush();
          cursor = position + bytesWritten;
          return bytesWritten;
        },
      } satisfies WorkspaceFileDescriptor;
    }

    return new IndexedBackedFileDescriptor(normalized, this, flags);
  }

  async close(fd: WorkspaceFileDescriptor) {
    await fd.close();
  }

  async importWorkspace(workspace: WorkspaceState) {
    await replaceVfsTree(this, workspace);
  }

  async exportWorkspace() {
    return exportVfsTree(this);
  }

  private async getDirectoryHandle(path: string, create: boolean) {
    let directory = await this.rootPromise;
    const normalized = normalizeVfsPath(path);

    if (!normalized) return directory;

    for (const segment of normalized.split("/")) {
      directory = await directory.getDirectoryHandle(segment, { create });
    }

    return directory;
  }

  private async getFileHandle(path: string, create: boolean) {
    const normalized = normalizeVfsPath(path);
    const parent = await this.getDirectoryHandle(getVfsParentPath(normalized), create);
    return parent.getFileHandle(getWorkspaceBaseName(normalized), { create });
  }
}

class IndexedBackedFileDescriptor implements WorkspaceFileDescriptor {
  private cursor = 0;

  constructor(
    public path: string,
    private vfs: WorkspaceVfs,
    flags: "r" | "r+" | "w" | "w+" | "a" | "a+",
  ) {
    if (flags.startsWith("w")) void this.vfs.writeBinary(path, new Uint8Array());
  }

  async close() {}

  async read(buffer: Uint8Array, offset = 0, length = buffer.byteLength - offset, position = this.cursor) {
    const data = await this.vfs.readBinary(this.path);
    const chunk = data.slice(position, position + length);
    buffer.set(chunk, offset);
    this.cursor = position + chunk.byteLength;
    return chunk.byteLength;
  }

  async stat() {
    return this.vfs.stat(this.path);
  }

  async truncate(size: number) {
    const data = await this.vfs.readBinary(this.path);
    await this.vfs.writeBinary(this.path, data.slice(0, size));
  }

  async write(buffer: Uint8Array, offset = 0, length = buffer.byteLength - offset, position = this.cursor) {
    let current = new Uint8Array();

    try {
      current = toBytes(await this.vfs.readBinary(this.path));
    } catch {
      // New file.
    }

    const next = new Uint8Array(Math.max(current.byteLength, position + length));
    next.set(current);
    next.set(buffer.slice(offset, offset + length), position);
    await this.vfs.writeBinary(this.path, next);
    this.cursor = position + length;
    return length;
  }
}

const replaceVfsTree = async (vfs: WorkspaceVfs, workspace: WorkspaceState) => {
  const normalized = normalizeWorkspaceState(workspace);
  await vfs.clear();
  await vfs.mkdir(".voidlab");
  await vfs.writeText(workspaceMetaPath, JSON.stringify(normalized, null, 2));

  for (const folder of normalized.folders) {
    await vfs.mkdir(folder);
  }

  for (const file of normalized.files) {
    await vfs.writeText(file.path, file.content);
  }
};

const exportVfsTree = async (vfs: WorkspaceVfs): Promise<WorkspaceState> => {
  try {
    const meta = JSON.parse(await vfs.readText(workspaceMetaPath)) as WorkspaceState;
    const files = await collectVfsFiles(vfs);

    return normalizeWorkspaceState({
      ...meta,
      files: files.length ? files : meta.files,
      folders: Array.from(
        new Set([
          ...meta.folders,
          ...files.flatMap((file) => {
            const folders: string[] = [];
            const parts = getWorkspaceParentPath(file.path).split("/").filter(Boolean);
            parts.forEach((_, index) => folders.push(parts.slice(0, index + 1).join("/")));
            return folders;
          }),
        ]),
      ),
    });
  } catch {
    return readWorkspace();
  }
};

const collectVfsFiles = async (vfs: WorkspaceVfs, folder = ""): Promise<ProjectFile[]> => {
  const names = await vfs.promises.readdir(folder).catch(() => []);
  const files: ProjectFile[] = [];

  for (const name of names) {
    const path = joinWorkspacePath(folder, name);

    if (path === ".voidlab" || path.startsWith(".git")) continue;

    const stats = await vfs.stat(path).catch(() => null);

    if (!stats) continue;

    if (stats.isDirectory()) {
      files.push(...await collectVfsFiles(vfs, path));
    } else {
      files.push({
        content: await vfs.readText(path),
        id: createFileId(),
        languageId: getLanguageByExtension(path).id,
        name: getWorkspaceBaseName(path),
        path,
      });
    }
  }

  return files;
};

let workspaceVfsPromise: Promise<WorkspaceVfs> | null = null;

export const createWorkspaceVfs = async (): Promise<WorkspaceVfs> => {
  assertBrowserStorage();
  return supportsOpfs() ? new OpfsVfs() : new IndexedDbVfs();
};

export const getWorkspaceVfs = () => {
  if (!workspaceVfsPromise) {
    workspaceVfsPromise = createWorkspaceVfs();
  }

  return workspaceVfsPromise;
};

export const mountWorkspaceVfs = async (seedWorkspace = readWorkspace()) => {
  const vfs = await getWorkspaceVfs();

  try {
    const workspace = await vfs.exportWorkspace();
    window.localStorage.setItem(workspaceStorageKey, JSON.stringify(normalizeWorkspaceState(workspace)));
    return { backend: vfs.backend, vfs, workspace };
  } catch {
    await vfs.importWorkspace(seedWorkspace);
    return { backend: vfs.backend, vfs, workspace: normalizeWorkspaceState(seedWorkspace) };
  }
};

export const persistWorkspaceToVfs = async (workspace: WorkspaceState) => {
  if (typeof window === "undefined") return;

  try {
    const vfs = await getWorkspaceVfs();
    await vfs.importWorkspace(workspace);
  } catch {
    // localStorage remains the synchronous recovery mirror.
  }
};

export const workspaceFs = {
  promises: new Proxy({} as WorkspaceVfsPromises, {
    get: (_target, property: keyof WorkspaceVfsPromises) =>
      async (...args: never[]) => {
        const vfs = await getWorkspaceVfs();
        const fn = vfs.promises[property] as (...innerArgs: never[]) => unknown;
        return fn(...args);
      },
  }),
};

const findFileByPath = (workspace: WorkspaceState, value: string) => {
  const path = resolveWorkspacePath(workspace.terminal.cwd, value);
  return workspace.files.find((file) => file.path === path);
};

const folderExists = (workspace: WorkspaceState, value: string) => {
  const target = resolveWorkspacePath(workspace.terminal.cwd, value);

  return target === "" || workspace.folders.includes(target);
};

const listDirectory = (workspace: WorkspaceState, value?: string) => {
  const target = resolveWorkspacePath(workspace.terminal.cwd, value ?? "");

  if (target && !folderExists(workspace, target)) {
    return {
      output: `ls: cannot access '${value}': no such directory`,
      status: "error" as const,
    };
  }

  const folderNames = workspace.folders
    .filter((folder) => getWorkspaceParentPath(folder) === target)
    .map((folder) => `${getWorkspaceBaseName(folder)}/`);

  const fileNames = workspace.files
    .filter((file) => getWorkspaceParentPath(file.path) === target)
    .map((file) => file.name);

  const items = [...folderNames, ...fileNames].sort((left, right) => left.localeCompare(right));

  return {
    output: items.length ? items.join("\n") : "(empty)",
    status: "success" as const,
  };
};

const renderTree = (workspace: WorkspaceState, folder = "", depth = 0): string[] => {
  const prefix = depth > 0 ? `${"  ".repeat(depth - 1)}- ` : "";
  const folderLines = workspace.folders
    .filter((item) => getWorkspaceParentPath(item) === folder)
    .flatMap((item) => [
      `${prefix}${getWorkspaceBaseName(item)}/`,
      ...renderTree(workspace, item, depth + 1),
    ]);

  const fileLines = workspace.files
    .filter((item) => getWorkspaceParentPath(item.path) === folder)
    .map((item) => `${prefix}${item.name}`);

  return [...folderLines, ...fileLines];
};

const tokenizeCommand = (value: string) =>
  Array.from(value.matchAll(/"([^"]*)"|'([^']*)'|`([^`]*)`|([^\s]+)/g)).map(
    (match) => match[1] ?? match[2] ?? match[3] ?? match[4] ?? "",
  );

const createTerminalEntry = (
  command: string,
  cwd: string,
  output: string,
  status: TerminalHistoryEntry["status"],
): TerminalHistoryEntry => ({
  command,
  createdAt: new Date().toISOString(),
  cwd,
  id: createHistoryId(),
  output,
  status,
});

export const appendTerminalHistory = (
  workspace: WorkspaceState,
  command: string,
  output: string,
  status: TerminalHistoryEntry["status"],
  cwd = workspace.terminal.cwd,
) => ({
  ...workspace,
  terminal: {
    cwd,
    history: [...workspace.terminal.history, createTerminalEntry(command, cwd, output, status)].slice(-60),
  },
});

export const executeWorkspaceCommand = (
  workspace: WorkspaceState,
  rawCommand: string,
): WorkspaceCommandResult => {
  const trimmed = rawCommand.trim();

  if (!trimmed) {
    return {
      cwd: workspace.terminal.cwd,
      output: "Type a workspace command such as ls, tree, mkdir src, touch src/main.py, open src/main.py, or pwd.",
      status: "info",
      workspace,
    };
  }

  const [command, ...args] = tokenizeCommand(trimmed);

  switch (command) {
    case "help":
      return {
        cwd: workspace.terminal.cwd,
        output:
          "Available commands:\nhelp\npwd\nls [path]\ntree [path]\ncd <path>\nmkdir <path>\ntouch <path>\nopen <path>\ncat <path>\nrm <path>\nclear",
        status: "info",
        workspace,
      };
    case "pwd":
      return {
        cwd: workspace.terminal.cwd,
        output: formatWorkspacePath(workspace.terminal.cwd),
        status: "success",
        workspace,
      };
    case "ls": {
      const result = listDirectory(workspace, args[0]);
      return {
        cwd: workspace.terminal.cwd,
        output: result.output,
        status: result.status,
        workspace,
      };
    }
    case "tree": {
      const target = resolveWorkspacePath(workspace.terminal.cwd, args[0] ?? "");

      if (target && !folderExists(workspace, target)) {
        return {
          cwd: workspace.terminal.cwd,
          output: `tree: '${args[0]}' does not exist`,
          status: "error",
          workspace,
        };
      }

      const lines = renderTree(workspace, target);
      return {
        cwd: workspace.terminal.cwd,
        output: lines.length ? lines.join("\n") : "(empty)",
        status: "success",
        workspace,
      };
    }
    case "cd": {
      const target = resolveWorkspacePath(workspace.terminal.cwd, args[0] ?? "");

      if (!folderExists(workspace, target)) {
        return {
          cwd: workspace.terminal.cwd,
          output: `cd: ${args[0] ?? ""}: no such directory`,
          status: "error",
          workspace,
        };
      }

      return {
        cwd: target,
        output: `Moved to ${formatWorkspacePath(target)}`,
        status: "success",
        workspace: {
          ...workspace,
          terminal: {
            ...workspace.terminal,
            cwd: target,
          },
        },
      };
    }
    case "mkdir": {
      if (!args[0]) {
        return {
          cwd: workspace.terminal.cwd,
          output: "mkdir: folder path is required",
          status: "error",
          workspace,
        };
      }

      const folderPath = createFolderPath(args[0], workspace.folders, workspace.files, workspace.terminal.cwd);
      const nextWorkspace = normalizeWorkspaceState({
        ...workspace,
        folders: ensureFolderChain(workspace.folders, folderPath),
      });

      return {
        cwd: nextWorkspace.terminal.cwd,
        output: `Created folder ${formatWorkspacePath(folderPath)}`,
        status: "success",
        workspace: nextWorkspace,
      };
    }
    case "touch": {
      if (!args[0]) {
        return {
          cwd: workspace.terminal.cwd,
          output: "touch: file path is required",
          status: "error",
          workspace,
        };
      }

      const targetPath = resolveWorkspacePath(workspace.terminal.cwd, args[0]);
      const language = getLanguageByExtension(targetPath);
      const nextFile = createWorkspaceFile(targetPath, language.id, workspace.files, "");
      const nextWorkspace = normalizeWorkspaceState({
        ...workspace,
        activeFileId: nextFile.id,
        files: [...workspace.files, nextFile],
        folders: ensureFolderChain(workspace.folders, getWorkspaceParentPath(nextFile.path)),
      });

      return {
        cwd: nextWorkspace.terminal.cwd,
        openFileId: nextFile.id,
        output: `Created file ${formatWorkspacePath(nextFile.path)}`,
        status: "success",
        workspace: nextWorkspace,
      };
    }
    case "open": {
      const file = findFileByPath(workspace, args[0] ?? "");

      if (!file) {
        return {
          cwd: workspace.terminal.cwd,
          output: `open: ${args[0] ?? ""}: file not found`,
          status: "error",
          workspace,
        };
      }

      return {
        cwd: workspace.terminal.cwd,
        openFileId: file.id,
        output: `Opened ${formatWorkspacePath(file.path)}`,
        status: "success",
        workspace: {
          ...workspace,
          activeFileId: file.id,
        },
      };
    }
    case "cat": {
      const file = findFileByPath(workspace, args[0] ?? "");

      if (!file) {
        return {
          cwd: workspace.terminal.cwd,
          output: `cat: ${args[0] ?? ""}: file not found`,
          status: "error",
          workspace,
        };
      }

      return {
        cwd: workspace.terminal.cwd,
        output: file.content || "(empty file)",
        status: "success",
        workspace,
      };
    }
    case "rm": {
      if (!args[0]) {
        return {
          cwd: workspace.terminal.cwd,
          output: "rm: target path is required",
          status: "error",
          workspace,
        };
      }

      const targetPath = resolveWorkspacePath(workspace.terminal.cwd, args[0]);
      const nextFiles = workspace.files.filter(
        (file) => file.path !== targetPath && !file.path.startsWith(`${targetPath}/`),
      );
      const nextFolders = workspace.folders.filter(
        (folder) => folder !== targetPath && !folder.startsWith(`${targetPath}/`),
      );

      if (nextFiles.length === workspace.files.length && nextFolders.length === workspace.folders.length) {
        return {
          cwd: workspace.terminal.cwd,
          output: `rm: ${args[0]}: target not found`,
          status: "error",
          workspace,
        };
      }

      const fallbackFile = nextFiles[0] ?? buildStarterFile(DEFAULT_LANGUAGE);
      const normalizedFiles = nextFiles.length ? nextFiles : [fallbackFile];
      const nextWorkspace = normalizeWorkspaceState({
        ...workspace,
        activeFileId: normalizedFiles.some((file) => file.id === workspace.activeFileId)
          ? workspace.activeFileId
          : normalizedFiles[0].id,
        files: normalizedFiles,
        folders: nextFolders,
      });

      return {
        cwd: nextWorkspace.terminal.cwd,
        output: `Removed ${formatWorkspacePath(targetPath)}`,
        status: "success",
        workspace: nextWorkspace,
      };
    }
    case "clear":
      return {
        clearHistory: true,
        cwd: workspace.terminal.cwd,
        output: "Terminal history cleared.",
        status: "info",
        workspace: {
          ...workspace,
          terminal: {
            ...workspace.terminal,
            history: [],
          },
        },
      };
    default:
      return {
        cwd: workspace.terminal.cwd,
        output: `Unknown command "${command}". Run "help" to see supported workspace commands.`,
        status: "error",
        workspace,
      };
  }
};
