"use client";

import Link from "next/link";
import { BookText, Command, ExternalLink, Globe2, UserCircle2 } from "lucide-react";
import { UserProfile } from "@/context/UserContext";
import { LanguageOption } from "@/lib/languages";

type SidebarProps = {
  currentLanguage: LanguageOption;
  isOpen: boolean;
  profile: UserProfile;
  shortcutItems: Array<{ key: string; label: string }>;
};

const normalizeUrl = (value: string) => {
  if (!value) return "";
  return /^https?:\/\//i.test(value) ? value : `https://${value}`;
};

export default function Sidebar({
  currentLanguage,
  isOpen,
  profile,
  shortcutItems,
}: SidebarProps) {
  const socialLinks = [
    { label: "GitHub", href: normalizeUrl(profile.socials.github) },
    { label: "LinkedIn", href: normalizeUrl(profile.socials.linkedin) },
    { label: "X", href: normalizeUrl(profile.socials.x) },
    { label: "Instagram", href: normalizeUrl(profile.socials.instagram) },
  ].filter((item) => item.href);

  return (
    <aside
      className={`${
        isOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
      } fixed inset-y-0 left-0 z-20 w-[290px] p-4 transition-transform duration-300 lg:static lg:block lg:w-[300px] lg:p-4`}
      style={{
        borderRight: "1px solid var(--border)",
        background: "var(--panel-background)",
        backdropFilter: "blur(18px)",
      }}
    >
      <div className="scrollbar-thin flex h-full flex-col gap-4 overflow-y-auto pt-20 lg:pt-0">
        <div
          className="rounded-[6px] p-5"
          style={{ background: "var(--surface-soft)", border: "1px solid var(--border)", boxShadow: "var(--shadow)" }}
        >
          <div className="flex items-center gap-3">
            <div
              className="flex h-12 w-12 items-center justify-center rounded-[6px]"
              style={{ border: "1px solid var(--border)", background: "var(--control-background)" }}
            >
              {profile.avatar ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img alt={profile.name} className="h-full w-full rounded-[6px] object-cover" src={profile.avatar} />
              ) : (
                <UserCircle2 className="accent-text" size={22} />
              )}
            </div>
            <div className="min-w-0">
              <div className="truncate text-sm font-medium theme-text-strong">{profile.name}</div>
              <div className="truncate text-xs theme-muted">{profile.email}</div>
            </div>
          </div>
          <div
            className="mt-4 rounded-[6px] p-4 text-sm leading-6 theme-text"
            style={{ border: "1px solid var(--border)", background: "var(--control-background)" }}
          >
            {profile.bio || "Add a bio from your profile setup to personalize this workspace."}
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link
              className="inline-flex items-center gap-2 rounded-full px-3 py-2 text-xs theme-text-strong transition hover:opacity-80"
              href="/editor/profile"
              style={{ border: "1px solid var(--border)", background: "var(--control-background)" }}
            >
              Open profile
            </Link>
            {socialLinks.map((item) => (
              <a
                className="inline-flex items-center gap-2 rounded-full px-3 py-2 text-xs theme-text-strong transition hover:opacity-80"
                href={item.href}
                key={item.label}
                rel="noreferrer"
                target="_blank"
                style={{ border: "1px solid var(--border)", background: "var(--control-background)" }}
              >
                {item.label}
                <ExternalLink size={12} />
              </a>
            ))}
          </div>
        </div>

        <div
          className="rounded-[6px] p-5"
          style={{ background: "var(--surface-soft)", border: "1px solid var(--border)", boxShadow: "var(--shadow)" }}
        >
          <div className="flex items-center gap-2 text-sm font-semibold theme-text-strong">
            <BookText size={16} />
            Language card
          </div>
          <div
            className="mt-4 rounded-[6px] p-4"
            style={{ border: "1px solid var(--border)", background: "var(--control-background)" }}
          >
            <div className="display-font text-xl font-semibold theme-text-strong">{currentLanguage.label}</div>
            <div className="mt-2 text-sm leading-6 theme-muted">{currentLanguage.description}</div>
            <div className="mt-4 flex flex-wrap gap-2 text-xs uppercase tracking-[0.18em] theme-text">
              <span
                className="rounded-full px-3 py-1"
                style={{ border: "1px solid var(--border)" }}
              >
                {currentLanguage.category}
              </span>
              <span
                className="rounded-full px-3 py-1"
                style={{ border: "1px solid var(--border)" }}
              >
                {currentLanguage.runnable ? "Runnable" : "Editor only"}
              </span>
            </div>
          </div>
        </div>

        <div
          className="rounded-[6px] p-5"
          style={{ background: "var(--surface-soft)", border: "1px solid var(--border)", boxShadow: "var(--shadow)" }}
        >
          <div className="flex items-center gap-2 text-sm font-semibold theme-text-strong">
            <Command size={16} />
            Shortcuts
          </div>
          <div className="mt-4 space-y-3">
            {shortcutItems.map((item) => (
              <div
                className="flex items-center justify-between rounded-[6px] px-4 py-3 text-sm"
                key={item.key}
                style={{ border: "1px solid var(--border)", background: "var(--control-background)" }}
              >
                <span className="theme-text">{item.label}</span>
                <span
                  className="rounded-full px-2 py-1 text-xs theme-text-strong"
                  style={{ border: "1px solid var(--border)" }}
                >
                  {item.key}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div
          className="rounded-[6px] p-5"
          style={{ background: "var(--surface-soft)", border: "1px solid var(--border)", boxShadow: "var(--shadow)" }}
        >
          <div className="flex items-center gap-2 text-sm font-semibold theme-text-strong">
            <Globe2 size={16} />
            Region
          </div>
          <div className="mt-3 text-sm leading-6 theme-text">
            Personalized workspace currently configured for{" "}
            <span className="font-medium theme-text-strong">{profile.region}</span>.
          </div>
        </div>
      </div>
    </aside>
  );
}
