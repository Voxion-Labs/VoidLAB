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
    <div className="h-8 border-b border-white/10 bg-[#000000] flex items-center justify-between px-1 shrink-0 select-none font-mono text-xs overflow-x-auto scrollbar-thin">
      {/* ── Left: Tab List ── */}
      <div className="flex items-center gap-0.5 h-full">
        {files.map((file) => {
          const isActive = file.id === activeFileId;
          return (
            <div
              key={file.id}
              onClick={() => onSelectFile(file.id)}
              className={`h-full px-2.5 flex items-center gap-2 border-r border-white/10 text-xs cursor-pointer transition-colors duration-100 ${
                isActive
                  ? "border-t border-zinc-200 bg-[#0e0e11] text-zinc-100 font-medium"
                  : "text-zinc-500 hover:text-zinc-300 hover:bg-[#09090b]"
              }`}
            >
              <FileCode2 size={13} className={isActive ? "text-zinc-300" : "text-zinc-600"} />
              <span className="truncate text-[11px] max-w-[140px]">{file.name}</span>
              <button
                className="hover:bg-zinc-800 rounded p-0.5 text-zinc-500 hover:text-zinc-200 transition-colors ml-0.5"
                onClick={(e) => {
                  e.stopPropagation();
                  onCloseFile(file.id);
                }}
                title={`Close ${file.name}`}
                type="button"
              >
                <X size={11} />
              </button>
            </div>
          );
        })}
      </div>

      {/* ── Right: Quick Editor Actions & Encoding ── */}
      <div className="flex items-center gap-1.5 text-[10px] text-zinc-500 font-mono px-2 shrink-0">
        {onInsertBoilerplate && (
          <button
            onClick={onInsertBoilerplate}
            className="px-1.5 py-0.5 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/80 rounded transition-colors flex items-center gap-1"
            title="Insert fresh boilerplate for active language"
            type="button"
          >
            <Sparkles size={11} />
            <span className="hidden sm:inline">Boilerplate</span>
          </button>
        )}
        {onDownload && (
          <button
            onClick={onDownload}
            className="px-1.5 py-0.5 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/80 rounded transition-colors flex items-center gap-1"
            title="Download active file"
            type="button"
          >
            <Download size={11} />
            <span className="hidden sm:inline">Export</span>
          </button>
        )}
        <span className="text-zinc-700">|</span>
        <span className="text-zinc-500">{languageLabel || "Plain"}</span>
        <span className="text-zinc-700">|</span>
        <span className="text-zinc-600">UTF-8</span>
      </div>
    </div>
  );
}
