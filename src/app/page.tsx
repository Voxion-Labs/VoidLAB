import LoginForm from "@/components/auth/LoginForm";
import Navbar from "@/components/layout/Navbar";

export default function LoginPage({
  searchParams,
}: {
  searchParams?: { authError?: string };
}) {
  return (
    <main className="hero-grid relative min-h-screen overflow-hidden px-4 pb-8 pt-6 sm:px-6 lg:px-10">
      <div className="relative z-10 mx-auto flex min-h-[calc(100vh-2rem)] w-full max-w-7xl flex-col">
        <Navbar />

        <section className="grid flex-1 items-center gap-10 py-10 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="max-w-2xl">
            <div className="theme-chip mb-6 inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs uppercase tracking-[0.18em]">
              Local-first browser IDE
            </div>
            <h1 className="display-font theme-text-strong text-5xl font-bold leading-tight sm:text-6xl lg:text-7xl">
              Build inside <span className="accent-text">VoidLAB</span>.
            </h1>
            <p className="theme-muted mt-6 max-w-xl text-lg leading-8">
              A sleek client-side coding workspace with local files, browser runtimes,
              collaboration tools, Git command guidance, and a professional red-accent interface.
            </p>

            <div className="mt-8 grid max-w-xl gap-3 sm:grid-cols-2">
              {["Local storage", "Browser runtime", "Room codes", "Git workflow"].map((item) => (
                <div className="theme-surface rounded-[6px] px-4 py-3 text-sm theme-text" key={item}>
                  {item}
                </div>
              ))}
            </div>
          </div>

          <LoginForm authError={searchParams?.authError} />
        </section>
      </div>
    </main>
  );
}
