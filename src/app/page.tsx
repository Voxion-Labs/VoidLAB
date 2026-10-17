import LoginForm from "@/components/auth/LoginForm";
import Navbar from "@/components/layout/Navbar";

export default function LoginPage({
  searchParams,
}: {
  searchParams?: { authError?: string };
}) {
  return (
    <main className="login-page-bg min-h-screen flex flex-col">
      {/* Top nav */}
      <div className="px-5 pt-5 sm:px-8 sm:pt-6">
        <Navbar />
      </div>

      {/* Hero content */}
      <div className="flex flex-1 items-center justify-center px-4 py-12 sm:px-6">
        <div className="w-full max-w-6xl grid gap-14 lg:grid-cols-2 lg:items-center">

          {/* Left — headline */}
          <div className="max-w-xl">
            <div className="login-hero-badge mb-6">
              Browser-native IDE · No install · No cloud
            </div>
            <h1 className="login-hero-title">
              Build fast,<br />
              <span className="accent-text">stay local.</span>
            </h1>
            <p className="login-hero-body mt-5 max-w-md">
              VoidLAB is a sleek, client-side coding workspace with local files,
              browser runtimes, collaboration tools, and Git workflow guidance —
              all running entirely in your browser.
            </p>

            {/* Feature pills */}
            <div className="mt-8 flex flex-wrap gap-2">
              {[
                "Local storage",
                "Browser runtime",
                "Room codes",
                "Git workflow",
                "AI guide",
              ].map((f) => (
                <span key={f} className="login-feature-pill">{f}</span>
              ))}
            </div>
          </div>

          {/* Right — login card */}
          <div className="flex justify-center lg:justify-end">
            <LoginForm authError={searchParams?.authError} />
          </div>
        </div>
      </div>
    </main>
  );
}
