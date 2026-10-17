"use client";

import Link from "next/link";
import { ArrowRight, Search } from "lucide-react";
import Brand from "@/components/layout/Brand";
import SessionControls from "@/components/layout/SessionControls";
import ThemeSwitcher from "@/components/layout/ThemeSwitcher";

export default function Navbar() {
  return (
    <>
      {/* ── Top Announcement Banner (like Flutter's banner) ── */}
      <aside aria-label="Announcement" className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 text-white text-xs py-2 px-4 text-center font-medium flex items-center justify-center gap-1.5 transition-all">
        <span>VoidLAB 2.0 is here! Client-side runtime and WebAssembly compiler are now active.</span>
        <Link href="/editor" className="inline-flex items-center gap-1 underline underline-offset-2 hover:opacity-90 font-semibold ml-1">
          Explore IDE <ArrowRight size={12} />
        </Link>
      </aside>

      {/* ── Main Flutter-style Navbar ── */}
      <header
        className="login-nav border-b border-[var(--border)] bg-[var(--background-main)] sticky top-0 z-50 px-6 sm:px-10 h-16 flex items-center justify-between transition-colors"
        role="banner"
      >
        <div className="flex items-center gap-8">
          <Brand />
          
          {/* Desktop Navigation Links (matching Flutter.dev) */}
          <nav className="hidden lg:flex items-center gap-6 text-sm font-medium text-[var(--muted-strong)]">
            <Link href="#features" className="hover:text-[var(--text-strong)] transition-colors">
              Development
            </Link>
            <Link href="#capabilities" className="hover:text-[var(--text-strong)] transition-colors">
              Ecosystem
            </Link>
            <Link href="#showcase" className="hover:text-[var(--text-strong)] transition-colors">
              Why VoidLAB
            </Link>
            <Link href="#showcase" className="hover:text-[var(--text-strong)] transition-colors">
              Showcase
            </Link>
            <Link href="/editor/manual" className="hover:text-[var(--text-strong)] transition-colors">
              Docs
            </Link>
          </nav>
        </div>

        {/* Right Action Tray */}
        <div className="flex items-center gap-3">
          <Link
            href="/editor"
            className="p-2 text-[var(--muted)] hover:text-[var(--text-strong)] rounded-full hover:bg-[var(--surface-soft)] transition-colors hidden sm:inline-flex"
            title="Search workspace"
          >
            <Search size={16} />
          </Link>
          
          <ThemeSwitcher />
          
          <SessionControls showEditorLink={false} />

          <Link
            href="#login-section"
            className="rounded-full bg-[#0468d7] hover:bg-[#0357b8] text-white text-xs sm:text-sm font-semibold px-5 py-2 shadow-sm transition-all hover:shadow"
          >
            Get started
          </Link>
        </div>
      </header>
    </>
  );
}
