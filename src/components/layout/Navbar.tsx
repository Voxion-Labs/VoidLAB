import Brand from "@/components/layout/Brand";
import SessionControls from "@/components/layout/SessionControls";
import ThemeSwitcher from "@/components/layout/ThemeSwitcher";

export default function Navbar() {
  return (
    <header
      className="login-nav"
      role="banner"
    >
      <Brand />
      <div className="flex items-center gap-2">
        <ThemeSwitcher />
        <SessionControls showEditorLink />
      </div>
    </header>
  );
}
