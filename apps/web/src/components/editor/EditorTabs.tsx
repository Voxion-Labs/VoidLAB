"use client";

import { FileCode2, X } from "lucide-react";

type TabFile = {
  id: string;
  name: string;
  path?: string;
};

type EditorTabsProps = {
  activeFileId: string;
  files: TabFile[];
  onCloseFile: (id: string) => void;
  onSelectFile: (id: string) => void;
};

export default function EditorTabs({
  activeFileId,
  files,
  onCloseFile,
  onSelectFile,
}: EditorTabsProps) {
  return (
    <div
      className="scrollbar-thin flex gap-2 overflow-x-auto px-3 py-3"
      style={{ borderBottom: "1px solid var(--border)" }}
    >
      {files.map((file) => {
        const isActive = file.id === activeFileId;
        return (
          <button
            className="group flex items-center gap-2 rounded-[6px] px-3 py-2 text-sm transition"
            key={file.id}
            onClick={() => onSelectFile(file.id)}
            type="button"
            style={{
              background: isActive ? "var(--accent-soft)" : "var(--control-background)",
              border: isActive
                ? "1px solid var(--border-strong)"
                : "1px solid var(--border)",
              color: isActive ? "var(--accent)" : "var(--text)",
            }}
          >
            <FileCode2 size={14} />
            <span>{file.name}</span>
            <span
              className="rounded-full p-1 opacity-60 transition hover:opacity-100"
              onClick={(event) => {
                event.stopPropagation();
                onCloseFile(file.id);
              }}
              title={file.path || file.name}
              style={{ color: "var(--muted)" }}
            >
              <X size={12} />
            </span>
          </button>
        );
      })}
    </div>
  );
}
