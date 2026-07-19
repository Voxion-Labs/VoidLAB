"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import Brand from "@/components/layout/Brand";
import SessionControls from "@/components/layout/SessionControls";
import ThemeSwitcher from "@/components/layout/ThemeSwitcher";

type ToolPageShellProps = {
  children: React.ReactNode;
  description: string;
  eyebrow?: string;
  title: string;
};

export default function ToolPageShell({
  children,
  description,
  eyebrow = "Workspace tools",
  title,
}: ToolPageShellProps) {
  return (
    <main className="app-shell min-h-screen px-4 py-4 sm:px-6 lg:px-8">
      <div className="mx-auto flex min-h-[calc(100vh-2rem)] max-w-7xl flex-col gap-4">
        {/* Header */}
        <header
          className="glass theme-header rounded-sm px-4 py-3"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <Link
                className="theme-button-secondary inline-flex items-center gap-2 rounded-sm px-3 py-1.5 text-xs transition"
                href="/editor"
              >
                <ArrowLeft size={14} />
                Back
              </Link>
              <Brand compact />
            </div>
            <div className="flex items-center gap-2">
              <ThemeSwitcher />
              <SessionControls />
            </div>
          </div>
        </header>

        {/* Content */}
        <section className="panel rounded-sm p-5 sm:p-7 flex-1">
          <div
            className="inline-flex items-center gap-2 rounded-sm px-3 py-1.5 text-xs font-semibold uppercase tracking-widest"
            style={{ background: "var(--accent-soft)", border: "1px solid var(--border-strong)", color: "var(--accent)" }}
          >
            {eyebrow}
          </div>
          <h1 className="display-font theme-text-strong mt-5 text-3xl font-bold sm:text-4xl">
            {title}
          </h1>
          <p className="theme-muted mt-3 max-w-3xl text-sm leading-7">{description}</p>
          <div className="mt-6">{children}</div>
        </section>
      </div>
    </main>
  );
}
