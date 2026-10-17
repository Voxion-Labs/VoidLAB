import ProfilePanel from "@/components/editor/ProfilePanel";
import ToolPageShell from "@/components/editor/ToolPageShell";

export default function ProfilePage() {
  return (
    <ToolPageShell
      eyebrow="Account Settings"
      title="Developer Profile & Identity"
      description="Manage your local authentication credentials, profile identity, connected services, and session audit activity."
    >
      <ProfilePanel />
    </ToolPageShell>
  );
}
