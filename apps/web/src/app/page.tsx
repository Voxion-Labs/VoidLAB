import LoginForm from "@/components/auth/LoginForm";
import Navbar from "@/components/layout/Navbar";

export default function LoginPage({
  searchParams,
}: {
  searchParams?: { authError?: string };
}) {
  return (
    <main className="hero-grid relative min-h-screen overflow-hidden px-4 pb-8 pt-6 sm:px-6 lg:px-10">
      {/* Red radial gradient overlay */}
      <div className="absolute inset-0 pointer-events-none" style={{
        background: "radial-gradient(circle at top, rgba(190,18,60,0.10) 0%, transparent 38%), radial-gradient(circle at bottom right, rgba(190,18,60,0.12) 0%, transparent 28%)"
      }} />

      <div className="relative z-10 mx-auto flex min-h-[calc(100vh-2rem)] w-full max-w-7xl flex-col">
        <Navbar />

        <section className="grid flex-1 items-center gap-10 py-10 lg:grid-cols-[1.1fr_0.9fr]">
          {/* Hero copy */}
          <div className="max-w-2xl">
            <div
              className="mb-6 inline-flex items-center gap-2 rounded-sm px-4 py-1.5 text-xs font-semibold uppercase tracking-widest"
              style={{
                background: "var(--accent-soft)",
                border: "1px solid var(--border-strong)",
                color: "var(--accent)",
              }}
            >
              Premium cloud workspace
            </div>

            <h1 className="display-font theme-text-strong text-5xl font-bold sm:text-6xl lg:text-7xl" style={{ letterSpacing: "-0.04em", lineHeight: 1.05 }}>
              Build faster in the cloud with{" "}
              <span style={{ color: "var(--accent)" }}>VoidLAB</span>.
            </h1>

            <p className="theme-muted mt-6 max-w-xl text-lg leading-8">
              A polished online IDE and compiler for builders who want a clean, modern workspace.
              Write from any device, run instantly, and collaborate with your team in real time.
            </p>

            <div className="mt-8 flex flex-wrap gap-3 text-sm">
              {["Zero configuration", "50+ languages", "Live collaboration", "Git commands"].map((feat) => (
                <span
                  key={feat}
                  className="inline-flex items-center gap-1.5 rounded-sm px-3 py-1.5 font-medium"
                  style={{
                    background: "var(--surface-soft)",
                    border: "1px solid var(--border)",
                    color: "var(--text)",
                  }}
                >
                  <span style={{ color: "var(--accent)" }}>✦</span>
                  {feat}
                </span>
              ))}
            </div>
          </div>

          {/* Login form */}
          <LoginForm authError={searchParams?.authError} />
        </section>

        {/* Page footer */}
        <footer className="voidlab-footer mt-4">
          © 2025 Voxion Labs. All rights reserved.
        </footer>
      </div>
    </main>
  );
}
