"use client";

import { Download, FileCode2, Sparkles, X } from "lucide-react";

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
  onInsertBoilerplate?: () => void;
  onDownload?: () => void;
  languageLabel?: string;
};

export default function EditorTabs({
  activeFileId,
  files,
  onCloseFile,
  onSelectFile,
  onInsertBoilerplate,
  onDownload,
  languageLabel,
}: EditorTabsProps) {
  return (
    <div
      className="h-9 flex items-center justify-between px-1 shrink-0 select-none font-sans text-xs overflow-x-auto scrollbar-thin transition-colors"
      style={{
        background: "var(--surface-soft)",
        borderBottom: "1px solid var(--border)",
      }}
    >
      {/* ── Left: Tab List ── */}
      <div className="flex items-center gap-0.5 h-full">
        {files.map((file) => {
          const isActive = file.id === activeFileId;
          return (
            <div
              key={file.id}
              onClick={() => onSelectFile(file.id)}
              className={`h-full px-3 flex items-center gap-2 text-xs cursor-pointer transition-colors duration-100 ${
                isActive ? "font-semibold" : "opacity-75 hover:opacity-100 hover:bg-[var(--control-hover)]"
              }`}
              style={{
                background: isActive ? "var(--panel-background)" : "transparent",
                borderRight: "1px solid var(--border)",
                borderTop: isActive ? "2px solid var(--accent)" : "2px solid transparent",
                color: isActive ? "var(--text-strong)" : "var(--muted)",
              }}
            >
              <FileCode2 size={13} style={{ color: isActive ? "var(--accent)" : "var(--muted)" }} />
              <span className="truncate max-w-[150px]">{file.name}</span>
              <button
                className="rounded p-0.5 opacity-50 hover:opacity-100 hover:bg-[var(--control-hover)] transition-all ml-0.5"
                onClick={(e) => {
                  e.stopPropagation();
                  onCloseFile(file.id);
                }}
                title={`Close ${file.name}`}
                type="button"
              >
                <X size={12} />
              </button>
            </div>
          );
        })}
      </div>

      {/* ── Right: Quick Editor Actions & Encoding ── */}
      <div className="flex items-center gap-2 text-xs font-sans px-2 shrink-0" style={{ color: "var(--muted)" }}>
        {onInsertBoilerplate && (
          <button
            onClick={onInsertBoilerplate}
            className="px-2 py-0.5 hover:text-[var(--text-strong)] hover:bg-[var(--control-hover)] rounded transition-colors flex items-center gap-1.5"
            title="Insert fresh boilerplate for active language"
            type="button"
          >
            <Sparkles size={12} />
            <span className="hidden sm:inline">Boilerplate</span>
          </button>
        )}
        {onDownload && (
          <button
            onClick={onDownload}
            className="px-2 py-0.5 hover:text-[var(--text-strong)] hover:bg-[var(--control-hover)] rounded transition-colors flex items-center gap-1.5"
            title="Download active file"
            type="button"
          >
            <Download size={12} />
            <span className="hidden sm:inline">Export</span>
          </button>
        )}
        <span className="opacity-30">|</span>
        <span className="font-mono text-[11px]">{languageLabel || "Plain"}</span>
        <span className="opacity-30">|</span>
        <span className="font-mono text-[11px]">UTF-8</span>
      </div>
    </div>
  );
}
