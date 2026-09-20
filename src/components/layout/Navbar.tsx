import { ArrowUpRight, ShieldCheck } from "lucide-react";
import Brand from "@/components/layout/Brand";
import SessionControls from "@/components/layout/SessionControls";
import ThemeSwitcher from "@/components/layout/ThemeSwitcher";

export default function Navbar() {
  return (
    <header className="glass flex items-center justify-between gap-4 rounded-[6px] px-5 py-4">
      <Brand />
      <div className="flex items-center gap-3">
        <ThemeSwitcher />
        <div className="theme-surface hidden items-center gap-3 rounded-[6px] px-4 py-2 text-sm theme-muted sm:flex">
          <ShieldCheck size={16} className="accent-text" />
          Stable, responsive, keyboard-first
          <ArrowUpRight size={15} className="accent-text" />
        </div>
        <SessionControls showEditorLink />
      </div>
    </header>
  );
}
