import { Suspense } from "react";
import CollaborationPanel from "@/components/editor/CollaborationPanel";
import ToolPageShell from "@/components/editor/ToolPageShell";

export default function CollaborationPage() {
  return (
    <ToolPageShell
      description="Create shareable collaboration rooms, invite teammates, exchange room messages, and push or pull workspace snapshots during live teamwork."
      title="Collaboration rooms"
    >
      <Suspense
        fallback={
          <div className="theme-surface rounded-[6px] p-5 text-sm theme-muted">
            Loading collaboration room...
          </div>
        }
      >
        <CollaborationPanel />
      </Suspense>
    </ToolPageShell>
  );
}
