import { useEffect } from "react";

type ShortcutHandlers = {
  onEscape?: () => void;
  onNewFile?: () => void;
  onRun: () => void;
  onSave?: () => void;
};

export const useShortcuts = ({
  onEscape,
  onNewFile,
  onRun,
  onSave,
}: ShortcutHandlers) => {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
        event.preventDefault();
        onRun();
      }

      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        onSave?.();
      }

      if (
        (event.ctrlKey || event.metaKey) &&
        event.shiftKey &&
        event.key.toLowerCase() === "n"
      ) {
        event.preventDefault();
        onNewFile?.();
      }

      if (event.key === "Escape") {
        onEscape?.();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onEscape, onNewFile, onRun, onSave]);
};
