"use client";

import Link from "next/link";
import { LogOut, UserCircle2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useUser } from "@/context/UserContext";

type SessionControlsProps = {
  showEditorLink?: boolean;
};

export default function SessionControls({ showEditorLink = false }: SessionControlsProps) {
  const router = useRouter();
  const { isReady, logout, profile } = useUser();

  if (!isReady) {
    return <div className="text-sm theme-muted">Checking session…</div>;
  }

  if (!profile) {
    return null;
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div
        className="inline-flex items-center gap-3 rounded-[6px] px-3 py-2 text-sm"
        style={{ border: "1px solid var(--border)", background: "var(--control-background)" }}
      >
        <span
          className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-[6px]"
          style={{ border: "1px solid var(--border)", background: "var(--surface-soft)" }}
        >
          {profile.avatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img alt={profile.name} className="h-full w-full object-cover" src={profile.avatar} />
          ) : (
            <UserCircle2 size={18} className="accent-text" />
          )}
        </span>
        <span className="min-w-0">
          <span className="block truncate text-sm font-medium theme-text-strong">{profile.name}</span>
          <span className="block truncate text-xs theme-muted">
            {profile.email || "Email not shared by provider"}
          </span>
        </span>
      </div>
      {showEditorLink ? (
        <Link
          className="theme-button-secondary inline-flex items-center gap-2 rounded-[6px] px-4 py-2 text-sm transition"
          href="/editor"
        >
          Open editor
        </Link>
      ) : null}
      <Button
        onClick={() => {
          void logout().then(() => router.push("/"));
        }}
        tone="secondary"
        type="button"
      >
        <LogOut size={15} />
        Logout
      </Button>
    </div>
  );
}
