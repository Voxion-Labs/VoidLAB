"use client";

import { ChangeEvent, FormEvent, useState } from "react";
import { ArrowRight, AtSign, Eye, EyeOff, Lock, Mail, MapPin, User2 } from "lucide-react";
import { useUser } from "@/context/UserContext";

type FormState = {
  email: string;
  name: string;
  password: string;
  region: string;
  username: string;
};

type LoginFormProps = {
  authError?: string;
};

// ── Floating-label input ──────────────────────────────────────
function Field({
  icon,
  label,
  value,
  onChange,
  type = "text",
  rightElement,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  onChange: (e: ChangeEvent<HTMLInputElement>) => void;
  type?: string;
  rightElement?: React.ReactNode;
}) {
  return (
    <div className="lf-wrap relative">
      <span className="lf-icon">{icon}</span>
      <input
        type={type}
        value={value}
        onChange={onChange}
        placeholder=" "
        className="lf-input"
      />
      <label className="lf-label">{label}</label>
      {rightElement ? (
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm z-10">
          {rightElement}
        </span>
      ) : null}
    </div>
  );
}

// ── Main form ─────────────────────────────────────────────────
export default function LoginForm({ authError = "" }: LoginFormProps) {
  const { profile, saveProfile } = useUser();
  const [showPassword, setShowPassword] = useState(false);

  const [form, setForm] = useState<FormState>(() => ({
    email:    profile?.email    ?? "",
    name:     profile?.name     ?? "",
    password: profile?.password ?? "",
    region:   profile?.region   ?? "",
    username: profile?.username ?? "",
  }));

  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const set = (field: keyof FormState) => (e: ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [field]: e.target.value }));

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");

    if (!form.name.trim() || !form.username.trim() || !form.email.trim()) {
      setError("Name, username, and email are required.");
      return;
    }

    setSubmitting(true);
    await saveProfile({
      email:    form.email.trim(),
      id:       profile?.id ?? `local-${Date.now()}`,
      name:     form.name.trim(),
      password: form.password,
      region:   form.region.trim() || "Global",
      username: form.username.trim().replace(/^@/, ""),
    });
    window.location.href = "/editor";
  };

  return (
    <div className="login-card">
      <div className="flex items-center justify-between mb-2">
        <p className="login-card-label m-0">Local workspace</p>
        <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full">
          Private Session
        </span>
      </div>
      <h2 className="login-card-title">Sign in to VoidLAB</h2>
      <p className="login-card-subtitle">
        Enter your local developer profile credentials to access your workspace.
      </p>

      <form onSubmit={(e) => void handleSubmit(e)}>
        <div className="grid gap-0 sm:grid-cols-2 sm:gap-x-3">
          <Field 
            icon={<User2 size={14} />} 
            label="Full name" 
            value={form.name} 
            onChange={set("name")} 
          />
          <Field 
            icon={<AtSign size={14} />} 
            label="Username" 
            value={form.username} 
            onChange={set("username")} 
          />
          <Field 
            icon={<Mail size={14} />} 
            label="Email address" 
            value={form.email} 
            onChange={set("email")} 
            type="email" 
          />
          <Field 
            icon={<Lock size={14} />} 
            label="Password" 
            value={form.password} 
            onChange={set("password")} 
            type={showPassword ? "text" : "password"}
            rightElement={
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="text-muted-foreground hover:text-foreground transition-colors p-1"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            }
          />
          <div className="sm:col-span-2">
            <Field 
              icon={<MapPin size={14} />} 
              label="Region / Location" 
              value={form.region} 
              onChange={set("region")} 
            />
          </div>
        </div>

        <div className="login-action-bar">
          <p className="login-action-note">
            Saved securely in your browser session.
          </p>
          <button
            type="submit"
            disabled={submitting}
            className="login-submit-btn"
          >
            {submitting ? "Entering..." : "Launch IDE"}
            <ArrowRight size={14} />
          </button>
        </div>

        {(error || authError) && (
          <div className="login-error">{error || authError}</div>
        )}
      </form>
    </div>
  );
}
