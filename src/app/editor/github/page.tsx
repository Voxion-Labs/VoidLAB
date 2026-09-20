import GitHubWorkspacePanel from "@/components/editor/GitHubWorkspacePanel";
import ToolPageShell from "@/components/editor/ToolPageShell";

export default function GitHubPage() {
  return (
    <ToolPageShell
      description="Connect GitHub, choose a repository target, and push the active code file directly from VoidLAB. Manual git commands are still available as a fallback."
      title="GitHub publishing"
    >
      <GitHubWorkspacePanel />
    </ToolPageShell>
  );
}
