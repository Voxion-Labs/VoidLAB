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

      <main className="login-hero">
        <div className="login-hero-inner">

          {/* ── Left: headline + copy ── */}
          <div>
            <span className="login-eyebrow">Local-first browser IDE</span>

            <h1 className="login-h1">
              Code anywhere,<br />
              <span>stay in control.</span>
            </h1>

            <p className="login-body-text">
              VoidLAB is a sleek browser-native coding workspace — Monaco editor,
              multi-language execution, collaboration rooms, GitHub workflow,
              and an AI guide. Everything runs entirely in your browser.
            </p>

            <div className="login-pills">
              {[
                "Local storage",
                "Browser runtime",
                "Multi-language",
                "Room codes",
                "Git workflow",
                "AI guide",
              ].map((label) => (
                <span key={label} className="login-pill">{label}</span>
              ))}
            </div>
          </div>

          {/* ── Right: login card ── */}
          <LoginForm authError={searchParams?.authError} />
        </div>
      </main>
    </div>
  );
}
