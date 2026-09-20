import AIGuidePanel from "@/components/editor/AIGuidePanel";
import ToolPageShell from "@/components/editor/ToolPageShell";

export default function AIPage() {
  return (
    <ToolPageShell
      description="Use the built-in basic real-time model for product walkthroughs, debugging direction, input-output help, and faster onboarding inside VoidLAB."
      title="AI guide"
    >
      <AIGuidePanel />
    </ToolPageShell>
  );
}
