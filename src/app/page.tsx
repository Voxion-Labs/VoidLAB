import Link from "next/link";
import { 
  ArrowRight, 
  Cpu, 
  FolderGit2, 
  Laptop2, 
  Layers, 
  Lock, 
  Sparkles, 
  Terminal, 
  Users2, 
  Zap 
} from "lucide-react";
import LoginForm from "@/components/auth/LoginForm";
import Navbar from "@/components/layout/Navbar";

export default function LoginPage({
  searchParams,
}: {
  searchParams?: { authError?: string };
}) {
  return (
    <div className="login-page">
      <Navbar />

      {/* ── Hero Section (Top) ── */}
      <main className="login-hero">
        <div className="login-hero-inner">

          {/* Left: Headline & Key Highlights */}
          <div>
            <div className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wider text-accent bg-accent/10 border border-accent/20 mb-4">
              <Sparkles size={12} className="accent-text" />
              <span>Next-Gen Browser IDE</span>
            </div>

            <h1 className="login-h1">
              Build inside<br />
              <span>VoidLAB.</span>
            </h1>

            <p className="login-body-text">
              A sleek client-side coding workspace with local files, browser runtimes,
              real-time collaboration tools, Git command guidance, and an integrated AI guide.
              Zero cloud lock-in.
            </p>

            <div className="login-pills">
              {[
                { label: "Client-side WASM", icon: Zap },
                { label: "Monaco Editor", icon: Terminal },
                { label: "Git Workflow", icon: FolderGit2 },
                { label: "Room Codes", icon: Users2 },
                { label: "AI Guide", icon: Sparkles },
                { label: "Local Vault", icon: Lock },
              ].map((item) => {
                const Icon = item.icon;
                return (
                  <span key={item.label} className="login-pill flex items-center gap-1.5">
                    <Icon size={13} className="accent-text" />
                    <span>{item.label}</span>
                  </span>
                );
              })}
            </div>

            {/* Quick metrics / trust bar */}
            <div className="mt-10 grid grid-cols-3 gap-4 border-t border-[var(--border)] pt-6">
              <div>
                <div className="text-xl font-bold theme-text-strong font-display">15+</div>
                <div className="text-xs theme-muted mt-0.5">Languages Supported</div>
              </div>
              <div>
                <div className="text-xl font-bold theme-text-strong font-display">0 ms</div>
                <div className="text-xs theme-muted mt-0.5">Server Cold Start</div>
              </div>
              <div>
                <div className="text-xl font-bold theme-text-strong font-display">100%</div>
                <div className="text-xs theme-muted mt-0.5">Private & Client-Side</div>
              </div>
            </div>
          </div>

          {/* Right: Login Card */}
          <div className="w-full">
            <LoginForm authError={searchParams?.authError} />
          </div>
        </div>
      </main>

      {/* ── Feature Showcase Section (Scrollable) ── */}
      <section className="border-t border-[var(--border)] bg-[var(--surface-soft)] py-20 px-6 sm:px-10">
        <div className="max-w-6xl mx-auto">
          {/* Section Header */}
          <div className="text-center max-w-2xl mx-auto mb-16">
            <div className="text-xs font-bold uppercase tracking-widest accent-text mb-2">
              Capabilities
            </div>
            <h2 className="display-font text-3xl sm:text-4xl font-extrabold theme-text-strong tracking-tight">
              A complete cloud IDE, running natively in your browser
            </h2>
            <p className="theme-muted text-sm sm:text-base mt-3 leading-relaxed">
              Engineered with modern web primitives, WebAssembly execution, and a responsive Flutter-inspired clean UI.
            </p>
          </div>

          {/* Showcase Feature 1: Workspace Home */}
          <div className="grid lg:grid-cols-2 gap-10 items-center mb-20">
            <div className="space-y-4">
              <div className="h-10 w-10 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-600 dark:text-blue-400">
                <Laptop2 size={22} />
              </div>
              <h3 className="display-font text-2xl font-bold theme-text-strong">
                Personalized Workspace & Monaco Editor
              </h3>
              <p className="theme-muted text-sm leading-relaxed">
                Enjoy a desktop-grade code editor powered by Monaco with multi-file management, syntax highlighting, autocomplete, keyboard shortcuts, and customized editor themes.
              </p>
              <ul className="space-y-2 text-xs sm:text-sm theme-muted pt-2">
                <li className="flex items-center gap-2">
                  <div className="h-1.5 w-1.5 rounded-full bg-blue-600" />
                  Full multi-tab workspace management
                </li>
                <li className="flex items-center gap-2">
                  <div className="h-1.5 w-1.5 rounded-full bg-blue-600" />
                  Real-time autosave with zero latency
                </li>
                <li className="flex items-center gap-2">
                  <div className="h-1.5 w-1.5 rounded-full bg-blue-600" />
                  Code templates and language boilerplate generator
                </li>
              </ul>
            </div>
            <div className="relative rounded-2xl overflow-hidden border border-[var(--border)] shadow-xl bg-[var(--background-main)] group">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img 
                src="/showcase/demo-workspace-home.png" 
                alt="VoidLAB Workspace Home" 
                className="w-full h-auto object-cover transition-transform duration-500 group-hover:scale-[1.02]"
              />
            </div>
          </div>

          {/* Showcase Feature 2: Terminal & Execution Flow */}
          <div className="grid lg:grid-cols-2 gap-10 items-center mb-20 lg:grid-flow-dense">
            <div className="lg:col-start-2 space-y-4">
              <div className="h-10 w-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                <Terminal size={22} />
              </div>
              <h3 className="display-font text-2xl font-bold theme-text-strong">
                Unified Console & Inline Stdin Execution
              </h3>
              <p className="theme-muted text-sm leading-relaxed">
                Run interactive programs with inline terminal input. View compilation stats, standard output, standard error, and execution metrics without leaving your editor.
              </p>
              <ul className="space-y-2 text-xs sm:text-sm theme-muted pt-2">
                <li className="flex items-center gap-2">
                  <div className="h-1.5 w-1.5 rounded-full bg-emerald-600" />
                  Interactive stdin input capture for Python, C++, Java & more
                </li>
                <li className="flex items-center gap-2">
                  <div className="h-1.5 w-1.5 rounded-full bg-emerald-600" />
                  Unified Output, Terminal, and Ports panels
                </li>
                <li className="flex items-center gap-2">
                  <div className="h-1.5 w-1.5 rounded-full bg-emerald-600" />
                  Detailed runtime feedback with memory and execution timers
                </li>
              </ul>
            </div>
            <div className="lg:col-start-1 relative rounded-2xl overflow-hidden border border-[var(--border)] shadow-xl bg-[var(--background-main)] group">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img 
                src="/showcase/demo-terminal-legacy.png" 
                alt="VoidLAB Execution & Console" 
                className="w-full h-auto object-cover transition-transform duration-500 group-hover:scale-[1.02]"
              />
            </div>
          </div>

          {/* Showcase Feature 3: Team Collaboration & Git Integration */}
          <div className="grid lg:grid-cols-2 gap-10 items-center">
            <div className="space-y-4">
              <div className="h-10 w-10 rounded-xl bg-purple-500/10 flex items-center justify-center text-purple-600 dark:text-purple-400">
                <Users2 size={22} />
              </div>
              <h3 className="display-font text-2xl font-bold theme-text-strong">
                Live Collaboration & Direct GitHub Publishing
              </h3>
              <p className="theme-muted text-sm leading-relaxed">
                Collaborate in real time using private room codes. When you are ready, connect your GitHub account to publish files and repositories directly from the interface.
              </p>
              <ul className="space-y-2 text-xs sm:text-sm theme-muted pt-2">
                <li className="flex items-center gap-2">
                  <div className="h-1.5 w-1.5 rounded-full bg-purple-600" />
                  Room codes for instant pair programming
                </li>
                <li className="flex items-center gap-2">
                  <div className="h-1.5 w-1.5 rounded-full bg-purple-600" />
                  Seamless GitHub repository sync and staging
                </li>
                <li className="flex items-center gap-2">
                  <div className="h-1.5 w-1.5 rounded-full bg-purple-600" />
                  Built-in AI Assistant for continuous guidance
                </li>
              </ul>
            </div>
            <div className="relative rounded-2xl overflow-hidden border border-[var(--border)] shadow-xl bg-[var(--background-main)] group">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img 
                src="/showcase/demo-collaboration.png" 
                alt="VoidLAB Collaboration & GitHub" 
                className="w-full h-auto object-cover transition-transform duration-500 group-hover:scale-[1.02]"
              />
            </div>
          </div>
        </div>
      </section>

      {/* ── Feature Cards Grid ── */}
      <section className="py-20 px-6 sm:px-10 border-t border-[var(--border)] bg-[var(--background-main)]">
        <div className="max-w-6xl mx-auto">
          <div className="text-center max-w-xl mx-auto mb-14">
            <h2 className="display-font text-2xl sm:text-3xl font-bold theme-text-strong">
              Built for speed, simplicity & privacy
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            <div className="p-6 rounded-2xl border border-[var(--border)] bg-[var(--surface-soft)] space-y-3">
              <Cpu className="text-blue-600 dark:text-blue-400" size={24} />
              <h4 className="text-lg font-bold theme-text-strong">Local-First Architecture</h4>
              <p className="text-xs sm:text-sm theme-muted leading-relaxed">
                Your code, workspace folders, and settings remain stored inside your browser. No unexpected sync delays or cloud leaks.
              </p>
            </div>
            <div className="p-6 rounded-2xl border border-[var(--border)] bg-[var(--surface-soft)] space-y-3">
              <Layers className="text-purple-600 dark:text-purple-400" size={24} />
              <h4 className="text-lg font-bold theme-text-strong">AI Code Assistant</h4>
              <p className="text-xs sm:text-sm theme-muted leading-relaxed">
                Need debugging advice or architectural recommendations? The integrated AI guide answers questions right alongside your editor.
              </p>
            </div>
            <div className="p-6 rounded-2xl border border-[var(--border)] bg-[var(--surface-soft)] space-y-3">
              <FolderGit2 className="text-emerald-600 dark:text-emerald-400" size={24} />
              <h4 className="text-lg font-bold theme-text-strong">Git & Publishing Tools</h4>
              <p className="text-xs sm:text-sm theme-muted leading-relaxed">
                Connect and export your projects directly to GitHub with zero complex CLI configuration required.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Sleek Enterprise Footer with Copyright Mark ── */}
      <footer className="border-t border-[var(--border)] bg-[var(--surface-soft)] py-12 px-6 sm:px-10">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <svg
              width="24"
              height="24"
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
            <span className="font-display font-bold theme-text-strong tracking-tight">VoidLAB</span>
            <span className="text-xs theme-muted">· Local-first Browser IDE</span>
          </div>

          <div className="flex flex-wrap items-center gap-6 text-xs font-medium theme-muted">
            <Link href="/editor" className="hover:text-[var(--text-strong)] transition-colors">
              Open Editor
            </Link>
            <Link href="/editor/manual" className="hover:text-[var(--text-strong)] transition-colors">
              Manual & Guides
            </Link>
            <Link href="/editor/profile" className="hover:text-[var(--text-strong)] transition-colors">
              Profile
            </Link>
            <a 
              href="https://github.com/Voxion-Labs/VoidLAB" 
              target="_blank" 
              rel="noreferrer"
              className="hover:text-[var(--text-strong)] transition-colors"
            >
              GitHub Repository
            </a>
          </div>

          <div className="text-xs theme-muted text-center md:text-right">
            © 2026 Voxion Labs. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}
