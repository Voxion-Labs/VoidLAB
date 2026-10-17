import Link from "next/link";
import { 
  CheckCircle2, 
  Cpu, 
  FolderGit2, 
  Globe2, 
  Laptop2, 
  Monitor, 
  Smartphone, 
  Sparkles, 
  Terminal 
} from "lucide-react";
import LoginForm from "@/components/auth/LoginForm";
import Navbar from "@/components/layout/Navbar";

export default function LoginPage({
  searchParams,
}: {
  searchParams?: { authError?: string };
}) {
  return (
    <div className="login-page selection:bg-sky-500 selection:text-white">
      <Navbar />

      {/* ── Main Hero Section (Faithful to Flutter.dev Layout) ── */}
      <section className="relative overflow-hidden pt-12 pb-20 sm:pt-16 sm:pb-28 px-6 sm:px-10 lg:px-14">
        {/* Subtle Cyan/Sky Angular Graphic Wash (Matching the Flutter Screenshot) */}
        <div 
          className="absolute right-0 top-0 w-full lg:w-1/2 h-full pointer-events-none opacity-30 dark:opacity-20 z-0"
          style={{
            background: "linear-gradient(135deg, #38bdf8 0%, #0284c7 50%, #0369a1 100%)",
            clipPath: "polygon(100% 0, 15% 0, 100% 85%)",
          }}
        />

        <div className="max-w-7xl mx-auto grid lg:grid-cols-12 gap-12 lg:gap-8 items-center relative z-10">
          
          {/* Left Column: Headline copy strictly matching Flutter.dev design */}
          <div className="lg:col-span-7 space-y-6">
            {/* Category tag */}
            <div className="text-[#0284c7] font-semibold text-base sm:text-lg tracking-normal">
              Development
            </div>

            {/* Giant Display Headline */}
            <h1 className="text-5xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight text-[var(--text-strong)] leading-[1.08] font-display">
              Reach users on<br />
              every screen
            </h1>

            {/* Subtitle description */}
            <p className="text-lg sm:text-xl text-[var(--muted)] leading-relaxed max-w-xl font-normal">
              Deploy to multiple devices from a single codebase: mobile, web, desktop, and embedded devices.
            </p>

            {/* Action Buttons (Flutter Pill Style) */}
            <div className="flex flex-wrap items-center gap-4 pt-2">
              <a
                href="#showcase"
                className="rounded-full border-2 border-[#0284c7] text-[#0284c7] hover:bg-[#0284c7]/5 px-7 py-3 text-sm font-semibold transition-all inline-flex items-center gap-2"
              >
                See the target platforms
              </a>
              <a
                href="#login-section"
                className="rounded-full bg-[#0468d7] hover:bg-[#0357b8] text-white px-7 py-3 text-sm font-semibold shadow-md transition-all inline-flex items-center gap-2"
              >
                Sign in to IDE
              </a>
            </div>

            {/* Platform Badges Row */}
            <div className="pt-6 flex flex-wrap items-center gap-3 text-xs text-[var(--muted)]">
              <span className="font-semibold text-[var(--text-strong)]">Supported Runtimes:</span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[var(--surface-soft)] border border-[var(--border)]">
                <Globe2 size={13} className="text-blue-500" /> Web (HTML/JS/TS)
              </span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[var(--surface-soft)] border border-[var(--border)]">
                <Terminal size={13} className="text-emerald-500" /> Python / C++ / Java
              </span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[var(--surface-soft)] border border-[var(--border)]">
                <Cpu size={13} className="text-purple-500" /> WebAssembly (WASM)
              </span>
            </div>
          </div>

          {/* Right Column: Sleek Flutter-inspired Login Card */}
          <div id="login-section" className="lg:col-span-5 w-full">
            <div className="relative">
              {/* Soft decorative background glow */}
              <div className="absolute -inset-1 rounded-3xl bg-gradient-to-r from-sky-400/20 to-blue-600/20 blur-xl opacity-70 pointer-events-none" />
              
              <div className="relative">
                <LoginForm authError={searchParams?.authError} />
              </div>
            </div>
          </div>

        </div>
      </section>

      {/* ── Multi-Screen Target Platforms Showcase (Flutter Reference Gallery) ── */}
      <section id="showcase" className="border-t border-[var(--border)] bg-[var(--surface-soft)] py-20 px-6 sm:px-10">
        <div className="max-w-6xl mx-auto">
          {/* Section Header */}
          <div className="text-center max-w-2xl mx-auto mb-16">
            <div className="text-sm font-bold uppercase tracking-widest text-[#0284c7] mb-2">
              Cross-Platform Ecosystem
            </div>
            <h2 className="display-font text-3xl sm:text-4xl font-extrabold text-[var(--text-strong)] tracking-tight">
              One unified workspace for every screen
            </h2>
            <p className="text-[var(--muted)] text-base mt-3 leading-relaxed">
              From desktop browser compilation to mobile live-previews and collaborative terminals.
            </p>
          </div>

          {/* Device Mockup Collage Presentation */}
          <div className="grid md:grid-cols-3 gap-8 mb-16">
            {/* Desktop Screen */}
            <div className="border border-[var(--border)] bg-[var(--background-main)] rounded-2xl p-5 shadow-sm space-y-4 hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#0284c7]">
                  <Monitor size={15} /> Desktop IDE
                </span>
                <span className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                  Monaco Engine
                </span>
              </div>
              <div className="rounded-xl overflow-hidden border border-[var(--border)] aspect-[16/10] bg-slate-950 flex items-center justify-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img 
                  src="/showcase/demo-workspace-home.png" 
                  alt="Desktop IDE" 
                  className="w-full h-full object-cover"
                />
              </div>
              <h3 className="font-bold text-base text-[var(--text-strong)]">Full-Featured Workspace</h3>
              <p className="text-xs text-[var(--muted)] leading-relaxed">
                Multi-tab editing, auto-completion, keyboard shortcuts, and file explorer running in-browser.
              </p>
            </div>

            {/* Terminal / Tablet Screen */}
            <div className="border border-[var(--border)] bg-[var(--background-main)] rounded-2xl p-5 shadow-sm space-y-4 hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                  <Terminal size={15} /> Interactive Console
                </span>
                <span className="text-[11px] font-medium text-blue-600 dark:text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded-full">
                  Stdin Capture
                </span>
              </div>
              <div className="rounded-xl overflow-hidden border border-[var(--border)] aspect-[16/10] bg-slate-950 flex items-center justify-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img 
                  src="/showcase/demo-terminal-legacy.png" 
                  alt="Terminal & Execution" 
                  className="w-full h-full object-cover"
                />
              </div>
              <h3 className="font-bold text-base text-[var(--text-strong)]">Unified Execution Output</h3>
              <p className="text-xs text-[var(--muted)] leading-relaxed">
                Live stdin input routing, memory profiling, execution timing, and compiler logs.
              </p>
            </div>

            {/* Mobile / Collaboration Screen */}
            <div className="border border-[var(--border)] bg-[var(--background-main)] rounded-2xl p-5 shadow-sm space-y-4 hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-purple-600 dark:text-purple-400">
                  <Smartphone size={15} /> Mobile & Team
                </span>
                <span className="text-[11px] font-medium text-purple-600 dark:text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded-full">
                  Live Rooms
                </span>
              </div>
              <div className="rounded-xl overflow-hidden border border-[var(--border)] aspect-[16/10] bg-slate-950 flex items-center justify-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img 
                  src="/showcase/demo-collaboration.png" 
                  alt="Collaboration & Mobile" 
                  className="w-full h-full object-cover"
                />
              </div>
              <h3 className="font-bold text-base text-[var(--text-strong)]">Pair Programming & Sync</h3>
              <p className="text-xs text-[var(--muted)] leading-relaxed">
                Generate instant room codes, invite teammates, and pair program in real time from any device.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Feature Highlights (Flutter Clean Pill Style) ── */}
      <section id="capabilities" className="py-20 px-6 sm:px-10 border-t border-[var(--border)] bg-[var(--background-main)]">
        <div className="max-w-6xl mx-auto">
          <div className="grid md:grid-cols-3 gap-8">
            <div className="space-y-3">
              <div className="h-10 w-10 rounded-full bg-blue-500/10 flex items-center justify-center text-[#0284c7]">
                <Laptop2 size={20} />
              </div>
              <h3 className="text-lg font-bold text-[var(--text-strong)]">Fast, client-side runtime</h3>
              <p className="text-sm text-[var(--muted)] leading-relaxed">
                Code execution executes via WebAssembly with sub-millisecond response. Zero cloud cold starts.
              </p>
              <div className="pt-1 flex items-center gap-1.5 text-xs font-semibold text-[#0284c7]">
                <CheckCircle2 size={13} /> Browser sandboxed
              </div>
            </div>

            <div className="space-y-3">
              <div className="h-10 w-10 rounded-full bg-purple-500/10 flex items-center justify-center text-purple-600 dark:text-purple-400">
                <FolderGit2 size={20} />
              </div>
              <h3 className="text-lg font-bold text-[var(--text-strong)]">Seamless GitHub publishing</h3>
              <p className="text-sm text-[var(--muted)] leading-relaxed">
                Connect your account and publish directly to GitHub repositories without touching git CLI credentials.
              </p>
              <div className="pt-1 flex items-center gap-1.5 text-xs font-semibold text-purple-600 dark:text-purple-400">
                <CheckCircle2 size={13} /> Direct sync
              </div>
            </div>

            <div className="space-y-3">
              <div className="h-10 w-10 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                <Sparkles size={20} />
              </div>
              <h3 className="text-lg font-bold text-[var(--text-strong)]">AI Guide & Smart Walkthroughs</h3>
              <p className="text-sm text-[var(--muted)] leading-relaxed">
                Get architecture guidance, debugging direction, and input-output routing support directly in your workflow.
              </p>
              <div className="pt-1 flex items-center gap-1.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 size={13} /> Built-in intelligence
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Sleek Enterprise Footer with Copyright Mark ── */}
      <footer className="border-t border-[var(--border)] bg-[var(--surface-soft)] py-12 px-6 sm:px-10">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <svg
              width="26"
              height="26"
              viewBox="0 0 128 128"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              className="brand-logo-fill flex-shrink-0"
              aria-hidden="true"
            >
              <path d="M18 10 L54 110 L64 90 L36 10 Z" fill="currentColor" />
              <path d="M110 10 L74 110 L64 90 L92 10 Z" fill="currentColor" />
              <path d="M80 8 L44 122" stroke="currentColor" strokeWidth="7" strokeLinecap="round" />
            </svg>
            <span className="font-display font-bold text-[var(--text-strong)] tracking-tight text-lg">VoidLAB</span>
            <span className="text-xs text-[var(--muted)]">· Build apps for any screen</span>
          </div>

          <div className="flex flex-wrap items-center gap-6 text-xs font-medium text-[var(--muted)]">
            <Link href="/editor" className="hover:text-[var(--text-strong)] transition-colors">
              Development
            </Link>
            <Link href="#capabilities" className="hover:text-[var(--text-strong)] transition-colors">
              Ecosystem
            </Link>
            <Link href="/editor/manual" className="hover:text-[var(--text-strong)] transition-colors">
              Documentation
            </Link>
            <Link href="/editor/profile" className="hover:text-[var(--text-strong)] transition-colors">
              Account Profile
            </Link>
            <a 
              href="https://github.com/Voxion-Labs/VoidLAB" 
              target="_blank" 
              rel="noreferrer"
              className="hover:text-[var(--text-strong)] transition-colors"
            >
              GitHub
            </a>
          </div>

          <div className="text-xs text-[var(--muted)] text-center md:text-right font-medium">
            © 2026 Voxion Labs. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}
