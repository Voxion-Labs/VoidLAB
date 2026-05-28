"use client";

import Link from "next/link";
import { BookOpenText, Bot, Github, UserRound, Users2 } from "lucide-react";

const tools = [
  {
    description: "Operator handbook, command sheet and execution guide.",
    href: "/editor/manual",
    icon: BookOpenText,
    label: "Manual",
  },
  {
    description: "Git command reference and publish tools.",
    href: "/editor/github",
    icon: Github,
    label: "GitHub",
  },
  {
    description: "Create rooms, invite teammates, sync workspaces.",
    href: "/editor/collaboration",
    icon: Users2,
    label: "Collab",
  },
  {
    description: "Instant guide for workflow and debugging help.",
    href: "/editor/ai",
    icon: Bot,
    label: "AI Guide",
  },
  {
    description: "Profile, social links and recent activity.",
    href: "/editor/profile",
    icon: UserRound,
    label: "Profile",
  },
];

export default function ToolLauncherBar() {
  return (
    <section
      className="panel rounded-sm p-3"
    >
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="text-xs font-semibold uppercase tracking-widest theme-muted">Feature hub</div>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-5">
        {tools.map((tool) => {
          const Icon = tool.icon;

          return (
            <Link
              className="group flex items-center gap-3 rounded-sm p-3 transition hover:opacity-80"
              href={tool.href}
              key={tool.href}
              style={{
                background: "var(--control-background)",
                border: "1px solid var(--border)",
              }}
            >
              <div
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-sm"
                style={{
                  background: "var(--accent-soft)",
                  border: "1px solid var(--border-strong)",
                }}
              >
                <Icon size={14} style={{ color: "var(--accent)" }} />
              </div>
              <div className="min-w-0">
                <div className="text-xs font-semibold theme-text-strong truncate">{tool.label}</div>
                <div
                  className="mt-0.5 text-xs leading-4 theme-muted truncate hidden sm:block"
                  style={{ fontSize: "10px" }}
                >
                  {tool.description}
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
