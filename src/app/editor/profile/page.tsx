import ProfilePanel from "@/components/editor/ProfilePanel";
import ToolPageShell from "@/components/editor/ToolPageShell";

export default function ProfilePage() {
  return (
    <ToolPageShell
      description="Review the user profile, personal bio, social links, and recent VoidLAB activities collected across the workspace."
      title="Profile and activity"
    >
      <ProfilePanel />
    </ToolPageShell>
  );
}
