import ManualPanel from "@/components/editor/ManualPanel";
import ToolPageShell from "@/components/editor/ToolPageShell";

export default function ManualPage() {
  return (
    <ToolPageShell
      description="Read the illustrated operator handbook for the current VoidLAB release: workspace anatomy, unified console behavior, inline stdin flow, tool pages, commands, and deploy-ready habits."
      eyebrow="Illustrated handbook"
      title="VoidLAB operator manual"
    >
      <ManualPanel />
    </ToolPageShell>
  );
}
