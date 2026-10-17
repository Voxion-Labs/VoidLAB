"use client";

import { ChangeEvent, useMemo, useRef, useState } from "react";
import {
  Activity,
  ArrowUpRight,
  AtSign,
  Camera,
  CheckCircle2,
  Database,
  Eye,
  EyeOff,
  FolderTree,
  Github,
  Globe,
  HardDrive,
  Instagram,
  KeyRound,
  Linkedin,
  Mail,
  MapPin,
  Save,
  Shield,
  Sparkles,
  Trash2,
  User,
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
  { key: "github", label: "GitHub", icon: Github, placeholder: "https://github.com/username" },
  { key: "linkedin", label: "LinkedIn", icon: Linkedin, placeholder: "https://linkedin.com/in/username" },
  { key: "x", label: "X / Twitter", icon: Sparkles, placeholder: "https://x.com/username" },
  { key: "instagram", label: "Instagram", icon: Instagram, placeholder: "https://instagram.com/username" },
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
  const [showPassword, setShowPassword] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState(() => ({
    bio: profile?.bio ?? "",
    email: profile?.email ?? "",
    name: profile?.name ?? "",
    password: profile?.password ?? "",
    region: profile?.region ?? "",
    socials: {
      github: profile?.socials?.github ?? "",
      instagram: profile?.socials?.instagram ?? "",
      linkedin: profile?.socials?.linkedin ?? "",
      x: profile?.socials?.x ?? "",
    },
    username: profile?.username ?? "",
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

  const handleFieldChange = (field: "bio" | "email" | "name" | "password" | "region" | "username") => (
    event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    setForm((current) => ({ ...current, [field]: event.target.value }));
  };

  const handleSocialChange = (field: keyof typeof form.socials) => (
    event: ChangeEvent<HTMLInputElement>
  ) => {
    setForm((current) => ({
      ...current,
      socials: {
        ...current.socials,
        [field]: event.target.value,
      },
    }));
  };

  const handleSave = () => {
    setStatus("");
    void saveProfile({
      bio: form.bio.trim(),
      email: form.email.trim(),
      name: form.name.trim(),
      password: form.password,
      region: form.region.trim() || "Global",
      socials: {
        github: form.socials.github.trim(),
        instagram: form.socials.instagram.trim(),
        linkedin: form.socials.linkedin.trim(),
        x: form.socials.x.trim(),
      },
      username: form.username.trim().replace(/^@/, ""),
    })
      .then(() => {
        recordActivity({
          detail: "Updated developer account profile and credentials.",
          title: "Profile saved",
          type: "profile",
        });
        setStatus("Profile changes saved successfully.");
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
        throw new Error("Please select an image file.");
      }
      if (file.size > 2 * 1024 * 1024) {
        throw new Error("Avatar image must be smaller than 2 MB.");
      }

      const avatar = await readFileAsDataUrl(file);
      saveAvatar(avatar);
      setStatus("Avatar updated successfully.");
      recordActivity({
        detail: "Updated user avatar image.",
        title: "Avatar updated",
        type: "profile",
      });
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Avatar could not be updated.");
    } finally {
      if (event.target) event.target.value = "";
    }
  };

  const handleRemoveAvatar = () => {
    saveAvatar("");
    setStatus("Avatar removed.");
    recordActivity({
      detail: "Removed custom avatar picture.",
      title: "Avatar removed",
      type: "profile",
    });
  };

  return (
    <div className="space-y-6">
      {/* ── Top Enterprise Header Card ── */}
      <div className="border border-[var(--border)] rounded-2xl bg-[var(--surface-soft)] p-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
          <div className="flex items-center gap-5">
            {/* Avatar display */}
            <div className="relative group">
              <input
                accept="image/*"
                className="hidden"
                onChange={(event) => void handleAvatarPick(event)}
                ref={fileInputRef}
                type="file"
              />
              <div className="h-20 w-20 rounded-2xl border-2 border-[var(--border)] overflow-hidden bg-[var(--background-main)] flex items-center justify-center shadow-sm">
                {profile.avatar ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img alt={profile.name} className="h-full w-full object-cover" src={profile.avatar} />
                ) : (
                  <UserCircle2 className="theme-muted" size={42} />
                )}
              </div>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="absolute -bottom-1.5 -right-1.5 h-7 w-7 rounded-full bg-[var(--action-background)] text-[var(--action-foreground)] flex items-center justify-center shadow-md hover:scale-105 transition-transform"
                title="Change Avatar"
              >
                <Camera size={13} />
              </button>
            </div>

            {/* Profile Core Details */}
            <div className="space-y-1">
              <div className="flex items-center gap-2.5 flex-wrap">
                <h2 className="display-font text-2xl font-bold theme-text-strong">
                  {profile.name || "Developer"}
                </h2>
                <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                  @{profile.username || "localdev"}
                </span>
                <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                  <CheckCircle2 size={11} />
                  Local Active
                </span>
              </div>
              <p className="text-xs sm:text-sm theme-muted">{profile.email || "No email assigned"}</p>
              <div className="flex items-center gap-3 text-xs theme-muted pt-1">
                <span className="flex items-center gap-1">
                  <MapPin size={12} className="accent-text" />
                  {profile.region || "Global"}
                </span>
                <span>•</span>
                <span className="flex items-center gap-1">
                  <Shield size={12} className="accent-text" />
                  Browser Session ID: <code className="font-mono text-[11px]">{profile.id}</code>
                </span>
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="flex items-center gap-2 self-stretch sm:self-auto justify-end">
            {profile.avatar && (
              <button
                type="button"
                onClick={handleRemoveAvatar}
                className="px-3 py-2 text-xs font-medium theme-muted hover:text-red-500 rounded-lg border border-[var(--border)] bg-[var(--background-main)] hover:border-red-500/30 transition-colors flex items-center gap-1.5"
              >
                <Trash2 size={13} />
                Remove DP
              </button>
            )}
            <Button onClick={handleSave} tone="primary" type="button" className="px-4 py-2 text-xs font-medium">
              <Save size={14} />
              Save Changes
            </Button>
          </div>
        </div>

        {status && (
          <div className="mt-4 p-3 rounded-lg text-xs font-medium bg-blue-500/10 border border-blue-500/20 text-blue-600 dark:text-blue-400 flex items-center justify-between">
            <span>{status}</span>
            <button onClick={() => setStatus("")} className="text-xs hover:underline">Dismiss</button>
          </div>
        )}
      </div>

      {/* ── Main Content Grid ── */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left Column (2 Cols): Credentials & General Settings */}
        <div className="lg:col-span-2 space-y-6">
          {/* Identity & Credentials */}
          <div className="border border-[var(--border)] rounded-2xl bg-[var(--surface-soft)] p-6 space-y-5">
            <div className="border-b border-[var(--border)] pb-3">
              <h3 className="text-base font-bold theme-text-strong flex items-center gap-2">
                <User size={16} className="accent-text" />
                Account Credentials & Identity
              </h3>
              <p className="text-xs theme-muted mt-0.5">
                Manage your credentials and local developer details used across this VoidLAB instance.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold theme-text-strong flex items-center gap-1.5">
                  <User size={12} className="theme-muted" />
                  Full Name
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={handleFieldChange("name")}
                  className="w-full px-3.5 py-2 text-sm rounded-lg border border-[var(--border)] bg-[var(--background-main)] text-[var(--text)] outline-none focus:border-[var(--accent)] transition-colors"
                  placeholder="e.g. Alex Rivera"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold theme-text-strong flex items-center gap-1.5">
                  <AtSign size={12} className="theme-muted" />
                  Username
                </label>
                <input
                  type="text"
                  value={form.username}
                  onChange={handleFieldChange("username")}
                  className="w-full px-3.5 py-2 text-sm rounded-lg border border-[var(--border)] bg-[var(--background-main)] text-[var(--text)] outline-none focus:border-[var(--accent)] transition-colors"
                  placeholder="e.g. alexrivera"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold theme-text-strong flex items-center gap-1.5">
                  <Mail size={12} className="theme-muted" />
                  Email Address
                </label>
                <input
                  type="email"
                  value={form.email}
                  onChange={handleFieldChange("email")}
                  className="w-full px-3.5 py-2 text-sm rounded-lg border border-[var(--border)] bg-[var(--background-main)] text-[var(--text)] outline-none focus:border-[var(--accent)] transition-colors"
                  placeholder="alex@voidlab.dev"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold theme-text-strong flex items-center gap-1.5">
                  <MapPin size={12} className="theme-muted" />
                  Region / Location
                </label>
                <input
                  type="text"
                  value={form.region}
                  onChange={handleFieldChange("region")}
                  className="w-full px-3.5 py-2 text-sm rounded-lg border border-[var(--border)] bg-[var(--background-main)] text-[var(--text)] outline-none focus:border-[var(--accent)] transition-colors"
                  placeholder="e.g. San Francisco, CA"
                />
              </div>

              {/* Password field with toggle */}
              <div className="sm:col-span-2 space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold theme-text-strong flex items-center gap-1.5">
                    <KeyRound size={12} className="theme-muted" />
                    Local Password / Access Key
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="text-xs text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
                  >
                    {showPassword ? <EyeOff size={11} /> : <Eye size={11} />}
                    {showPassword ? "Hide" : "Show"}
                  </button>
                </div>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={form.password}
                    onChange={handleFieldChange("password")}
                    className="w-full px-3.5 py-2 text-sm rounded-lg border border-[var(--border)] bg-[var(--background-main)] text-[var(--text)] outline-none focus:border-[var(--accent)] transition-colors"
                    placeholder="Enter local password"
                  />
                </div>
                <p className="text-[11px] theme-muted">
                  Used to authenticate this local profile session inside your browser storage.
                </p>
              </div>
            </div>
          </div>

          {/* Bio & Developer Information */}
          <div className="border border-[var(--border)] rounded-2xl bg-[var(--surface-soft)] p-6 space-y-4">
            <div className="border-b border-[var(--border)] pb-3">
              <h3 className="text-base font-bold theme-text-strong flex items-center gap-2">
                <Sparkles size={16} className="accent-text" />
                Developer Bio & Workspace Summary
              </h3>
              <p className="text-xs theme-muted mt-0.5">
                A brief description of your technical stack and project focus.
              </p>
            </div>

            <textarea
              rows={4}
              value={form.bio}
              onChange={handleFieldChange("bio")}
              className="w-full p-3.5 text-sm rounded-lg border border-[var(--border)] bg-[var(--background-main)] text-[var(--text)] outline-none focus:border-[var(--accent)] transition-colors resize-y leading-relaxed"
              placeholder="e.g. Full-stack developer building client-side distributed tools, WebAssembly runtimes, and local-first IDE integrations."
            />
          </div>

          {/* Connected Socials */}
          <div className="border border-[var(--border)] rounded-2xl bg-[var(--surface-soft)] p-6 space-y-4">
            <div className="border-b border-[var(--border)] pb-3">
              <h3 className="text-base font-bold theme-text-strong flex items-center gap-2">
                <Globe size={16} className="accent-text" />
                Connected Developer Profiles & Socials
              </h3>
              <p className="text-xs theme-muted mt-0.5">
                Link your external accounts for direct GitHub publishing and collaborative sharing.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {socialCards.map((card) => {
                const Icon = card.icon;
                const value = form.socials[card.key];
                const normalized = normalizeUrl(value);
                return (
                  <div key={card.key} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs font-semibold theme-text-strong">
                      <span className="flex items-center gap-1.5">
                        <Icon size={13} className="theme-muted" />
                        {card.label}
                      </span>
                      {normalized && (
                        <a 
                          href={normalized} 
                          target="_blank" 
                          rel="noreferrer" 
                          className="text-[11px] text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-0.5"
                        >
                          Visit <ArrowUpRight size={10} />
                        </a>
                      )}
                    </div>
                    <input
                      type="text"
                      value={value}
                      onChange={handleSocialChange(card.key)}
                      placeholder={card.placeholder}
                      className="w-full px-3 py-1.5 text-xs rounded-lg border border-[var(--border)] bg-[var(--background-main)] text-[var(--text)] outline-none focus:border-[var(--accent)] transition-colors"
                    />
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right Column (1 Col): Workspace Stats, Storage Vault & Audit Log */}
        <div className="space-y-6">
          {/* Workspace Stats Widget */}
          <div className="border border-[var(--border)] rounded-2xl bg-[var(--surface-soft)] p-5 space-y-4">
            <h3 className="text-sm font-bold theme-text-strong flex items-center gap-2">
              <HardDrive size={15} className="accent-text" />
              Workspace Inventory
            </h3>

            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-xl border border-[var(--border)] bg-[var(--background-main)]">
                <div className="flex items-center justify-between text-xs theme-muted">
                  <span>Files</span>
                  <FolderTree size={12} />
                </div>
                <div className="text-2xl font-bold theme-text-strong mt-1 font-display">
                  {workspaceSummary.fileCount}
                </div>
              </div>

              <div className="p-3 rounded-xl border border-[var(--border)] bg-[var(--background-main)]">
                <div className="flex items-center justify-between text-xs theme-muted">
                  <span>Directories</span>
                  <Database size={12} />
                </div>
                <div className="text-2xl font-bold theme-text-strong mt-1 font-display">
                  {workspaceSummary.folderCount}
                </div>
              </div>
            </div>

            <div className="p-3 rounded-xl border border-[var(--border)] bg-[var(--background-main)] space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium theme-text-strong">Storage Mode</span>
                <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">IndexedDB / Local</span>
              </div>
              <div className="w-full bg-[var(--surface-strong)] h-1.5 rounded-full overflow-hidden">
                <div className="bg-blue-600 h-full w-[24%]" />
              </div>
              <div className="flex items-center justify-between text-[11px] theme-muted">
                <span>Client Sandbox</span>
                <span>Active</span>
              </div>
            </div>
          </div>

          {/* Activity Audit Log */}
          <div className="border border-[var(--border)] rounded-2xl bg-[var(--surface-soft)] p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold theme-text-strong flex items-center gap-2">
                <Activity size={15} className="accent-text" />
                Session Audit Log
              </h3>
              <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-[var(--surface-strong)] theme-muted">
                {activities.length} Events
              </span>
            </div>

            <div className="space-y-2.5 max-h-[380px] overflow-y-auto scrollbar-thin pr-1">
              {activities.length > 0 ? (
                activities.slice(0, 10).map((activity) => (
                  <div
                    key={activity.id}
                    className="p-3 rounded-xl border border-[var(--border)] bg-[var(--background-main)] text-xs space-y-1 transition-colors hover:border-[var(--border-strong)]"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold theme-text-strong truncate">{activity.title}</span>
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[var(--surface-strong)] uppercase tracking-wider theme-muted">
                        {activity.type}
                      </span>
                    </div>
                    <p className="theme-muted text-[11px] leading-relaxed line-clamp-2">
                      {activity.detail}
                    </p>
                    <div className="text-[10px] theme-muted pt-0.5">
                      {new Date(activity.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} • {new Date(activity.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                ))
              ) : (
                <div className="p-4 text-center text-xs theme-muted border border-dashed border-[var(--border)] rounded-xl">
                  No recent activities recorded in this session.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
