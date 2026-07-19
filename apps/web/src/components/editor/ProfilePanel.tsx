"use client";

import { ChangeEvent, useMemo, useRef, useState } from "react";
import {
  ArrowUpRight,
  Camera,
  Github,
  Instagram,
  Linkedin,
  MapPin,
  Phone,
  RotateCcw,
  Save,
  Sparkles,
  UserCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useUser } from "@/context/UserContext";
import { readWorkspace } from "@/lib/workspace";

const normalizeUrl = (value: string) => {
  if (!value) return "";
  return /^https?:\/\//i.test(value) ? value : `https://${value}`;
};

const socialCards = [
  { key: "github", label: "GitHub", icon: Github },
  { key: "linkedin", label: "LinkedIn", icon: Linkedin },
  { key: "x", label: "X", icon: Sparkles },
  { key: "instagram", label: "Instagram", icon: Instagram },
] as const;

const readFileAsDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(new Error("VoidLAB could not read that image."));
    reader.readAsDataURL(file);
  });

export default function ProfilePanel() {
  const { activities, profile, recordActivity, saveAvatar, saveProfile } = useUser();
  const [status, setStatus] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState(() => ({
    bio: profile?.bio ?? "",
    socials: {
      github: profile?.socials.github ?? "",
      instagram: profile?.socials.instagram ?? "",
      linkedin: profile?.socials.linkedin ?? "",
      x: profile?.socials.x ?? "",
    },
  }));

  const workspaceSummary = useMemo(() => {
    if (typeof window === "undefined") {
      return { fileCount: 0, folderCount: 0 };
    }

    const workspace = readWorkspace();

    return {
      fileCount: workspace.files.length,
      folderCount: workspace.folders.length,
    };
  }, []);

  if (!profile) return null;

  const handleBioChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
    setDraft((current) => ({ ...current, bio: event.target.value }));
  };

  const handleSocialChange =
    (field: keyof typeof draft.socials) => (event: ChangeEvent<HTMLInputElement>) => {
      setDraft((current) => ({
        ...current,
        socials: {
          ...current.socials,
          [field]: event.target.value,
        },
      }));
    };

  const handleSave = () => {
    void saveProfile({
      bio: draft.bio.trim(),
      phone: profile.phone,
      region: profile.region,
      socials: {
        github: draft.socials.github.trim(),
        instagram: draft.socials.instagram.trim(),
        linkedin: draft.socials.linkedin.trim(),
        x: draft.socials.x.trim(),
      },
    })
      .then(() => {
        recordActivity({
          detail: "Refined bio or social links from the in-product profile page.",
          title: "Profile polished",
          type: "profile",
        });
        setStatus("Profile details saved inside VoidLAB.");
      })
      .catch((error) => {
        setStatus(error instanceof Error ? error.message : "Profile details could not be saved.");
      });
  };

  const handleAvatarPick = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];

    if (!file) return;

    try {
      if (!file.type.startsWith("image/")) {
        throw new Error("Please choose an image file for your DP.");
      }

      if (file.size > 2 * 1024 * 1024) {
        throw new Error("Please choose an image smaller than 2 MB.");
      }

      const avatar = await readFileAsDataUrl(file);
      saveAvatar(avatar);
      setStatus("Display picture updated for this browser.");
      recordActivity({
        detail: "Updated the profile display picture from the profile page.",
        title: "Display picture changed",
        type: "profile",
      });
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Display picture could not be updated.");
    } finally {
      if (event.target) {
        event.target.value = "";
      }
    }
  };

  const handleRemoveAvatar = () => {
    saveAvatar("");
    setStatus("Display picture removed.");
    recordActivity({
      detail: "Removed the local display picture from the profile page.",
      title: "Display picture removed",
      type: "profile",
    });
  };

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1.1fr)_380px]">
      <section className="theme-surface-strong rounded-[32px] p-6">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
          <div className="space-y-3">
            <input
              accept="image/*"
              className="hidden"
              onChange={(event) => void handleAvatarPick(event)}
              ref={fileInputRef}
              type="file"
            />
            <div className="theme-elevated flex h-28 w-28 items-center justify-center overflow-hidden rounded-[28px]">
              {profile.avatar ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img alt={profile.name} className="h-full w-full object-cover" src={profile.avatar} />
              ) : (
                <UserCircle2 className="theme-muted-strong" size={34} />
              )}
            </div>
            <div className="max-w-[220px] space-y-1">
              <div className="text-xs uppercase tracking-[0.22em] theme-muted-strong">Display picture</div>
              <div className="text-sm leading-6 theme-muted">
                Optional. Leave it empty for a clean initials-free profile, or upload one anytime.
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => fileInputRef.current?.click()} tone="secondary" type="button">
                <Camera size={15} />
                {profile.avatar ? "Change DP" : "Add DP"}
              </Button>
              {profile.avatar ? (
                <Button onClick={handleRemoveAvatar} tone="secondary" type="button">
                  <RotateCcw size={15} />
                  Remove
                </Button>
              ) : null}
            </div>
          </div>

          <div className="min-w-0 flex-1">
            <div className="theme-chip inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs uppercase tracking-[0.24em]">
              VoidLAB profile
            </div>
            <h2 className="display-font theme-text-strong mt-4 text-4xl font-semibold tracking-[-0.05em]">
              {profile.name}
            </h2>
            <div className="theme-muted mt-2 text-sm">{profile.email}</div>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <div className="theme-card rounded-[24px] p-4 text-sm theme-text">
                <div className="theme-text-strong flex items-center gap-2 font-medium">
                  <MapPin size={16} />
                  Region
                </div>
                <div className="mt-2">{profile.region || "Global"}</div>
              </div>
              <div className="theme-card rounded-[24px] p-4 text-sm theme-text">
                <div className="theme-text-strong flex items-center gap-2 font-medium">
                  <Phone size={16} />
                  Contact
                </div>
                <div className="mt-2">{profile.phone || "Not added yet"}</div>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-3">
          <div className="theme-card rounded-[24px] p-4">
            <div className="theme-muted text-xs uppercase tracking-[0.24em]">Workspace files</div>
            <div className="theme-text-strong mt-3 text-3xl font-semibold">{workspaceSummary.fileCount}</div>
          </div>
          <div className="theme-card rounded-[24px] p-4">
            <div className="theme-muted text-xs uppercase tracking-[0.24em]">Workspace folders</div>
            <div className="theme-text-strong mt-3 text-3xl font-semibold">{workspaceSummary.folderCount}</div>
          </div>
          <div className="theme-card rounded-[24px] p-4">
            <div className="theme-muted text-xs uppercase tracking-[0.24em]">Activities</div>
            <div className="theme-text-strong mt-3 text-3xl font-semibold">{activities.length}</div>
          </div>
        </div>

        <div className="mt-6 grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <div>
            <div className="theme-text-strong text-sm font-semibold">Bio</div>
            <textarea
              className="theme-input mt-3 min-h-[180px] w-full resize-none rounded-[24px] px-4 py-4 text-sm leading-7 outline-none transition"
              onChange={handleBioChange}
              placeholder="Write a sharp intro about what you build, your stack, or what your VoidLAB workspace is focused on."
              value={draft.bio}
            />
          </div>

          <div>
            <div className="theme-text-strong text-sm font-semibold">Social links</div>
            <div className="mt-3 grid gap-3">
              <input
                className="theme-input w-full rounded-2xl px-4 py-3 text-sm outline-none transition placeholder:opacity-50"
                onChange={handleSocialChange("github")}
                placeholder="GitHub URL"
                value={draft.socials.github}
              />
              <input
                className="theme-input w-full rounded-2xl px-4 py-3 text-sm outline-none transition placeholder:opacity-50"
                onChange={handleSocialChange("linkedin")}
                placeholder="LinkedIn URL"
                value={draft.socials.linkedin}
              />
              <input
                className="theme-input w-full rounded-2xl px-4 py-3 text-sm outline-none transition placeholder:opacity-50"
                onChange={handleSocialChange("x")}
                placeholder="X URL"
                value={draft.socials.x}
              />
              <input
                className="theme-input w-full rounded-2xl px-4 py-3 text-sm outline-none transition placeholder:opacity-50"
                onChange={handleSocialChange("instagram")}
                placeholder="Instagram URL"
                value={draft.socials.instagram}
              />
            </div>
            <div className="mt-4 flex items-center justify-between gap-3">
              <Button onClick={handleSave} type="button">
                <Save size={15} />
                Save profile
              </Button>
              {status ? <div className="theme-muted text-right text-sm">{status}</div> : null}
            </div>
          </div>
        </div>

        <div className="mt-6">
          <div className="theme-text-strong text-sm font-semibold">Public links</div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {socialCards.map((card) => {
              const Icon = card.icon;
              const link = normalizeUrl(profile.socials[card.key]);

              return link ? (
                <a
                  className="theme-card theme-text-strong flex items-center justify-between rounded-[24px] px-4 py-4 text-sm transition hover:-translate-y-0.5"
                  href={link}
                  key={card.key}
                  rel="noreferrer"
                  target="_blank"
                >
                  <span className="flex items-center gap-3">
                    <span className="theme-elevated theme-muted-strong flex h-10 w-10 items-center justify-center rounded-2xl">
                      <Icon size={17} />
                    </span>
                    {card.label}
                  </span>
                  <ArrowUpRight size={16} />
                </a>
              ) : (
                <div
                  className="theme-card theme-muted flex items-center justify-between rounded-[24px] border-dashed px-4 py-4 text-sm"
                  key={card.key}
                >
                  <span className="flex items-center gap-3">
                    <span className="theme-surface theme-muted flex h-10 w-10 items-center justify-center rounded-2xl">
                      <Icon size={17} />
                    </span>
                    {card.label}
                  </span>
                  Add link
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="theme-surface-strong rounded-[32px] p-6">
        <div className="theme-text-strong text-sm font-semibold">Recent activity</div>
        <div className="theme-muted mt-2 text-sm">Entries older than 7 days are cleared automatically.</div>
        <div className="mt-4 space-y-3">
          {activities.length ? (
            activities.map((activity) => (
              <div className="theme-card rounded-[22px] p-4" key={activity.id}>
                <div className="flex items-center justify-between gap-3">
                  <div className="theme-text-strong text-sm font-semibold">{activity.title}</div>
                  <div className="theme-muted text-xs uppercase tracking-[0.18em]">{activity.type}</div>
                </div>
                <div className="theme-muted mt-2 text-sm leading-6">{activity.detail}</div>
                <div className="theme-muted mt-3 text-xs">
                  {new Date(activity.createdAt).toLocaleString()}
                </div>
              </div>
            ))
          ) : (
            <div className="theme-card theme-muted rounded-[22px] p-4 text-sm">
              Activity will appear here as the user runs code, saves work, asks AI questions,
              imports files, and updates the workspace.
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
