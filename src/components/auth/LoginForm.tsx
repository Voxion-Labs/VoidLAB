"use client";

import { ChangeEvent, FormEvent, useState } from "react";
import { ArrowRight, Mail, MapPin, Phone, User2 } from "lucide-react";
import { useUser } from "@/context/UserContext";

type FormState = {
  email: string;
  name: string;
  phone: string;
  region: string;
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
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  onChange: (e: ChangeEvent<HTMLInputElement>) => void;
  type?: string;
}) {
  return (
    <div className="lf-wrap">
      <span className="lf-icon">{icon}</span>
      {/*
        placeholder=" " (single space) is required so :not(:placeholder-shown)
        triggers as soon as the user types anything — floats the label up.
      */}
      <input
        type={type}
        value={value}
        onChange={onChange}
        placeholder=" "
        className="lf-input"
      />
      <label className="lf-label">{label}</label>
    </div>
  );
}

// ── Main form ─────────────────────────────────────────────────
export default function LoginForm({ authError = "" }: LoginFormProps) {
  const { profile, saveProfile } = useUser();

  const [form, setForm] = useState<FormState>(() => ({
    email:  profile?.email  ?? "",
    name:   profile?.name   ?? "",
    phone:  profile?.phone  ?? "",
    region: profile?.region ?? "",
  }));

  const [error,     setError]     = useState("");
  const [submitting, setSubmitting] = useState(false);

  const set = (field: keyof FormState) => (e: ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [field]: e.target.value }));

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");

    if (!form.name.trim() || !form.email.trim()) {
      setError("Name and email are required.");
      return;
    }

    setSubmitting(true);
    await saveProfile({
      email:  form.email.trim(),
      id:     profile?.id ?? `local-${Date.now()}`,
      name:   form.name.trim(),
      phone:  form.phone.trim(),
      region: form.region.trim() || "Local",
    });
    window.location.href = "/editor";
  };

  return (
    <div className="login-card">
      <p className="login-card-label">Local workspace</p>
      <h2 className="login-card-title">Enter VoidLAB</h2>
      <p className="login-card-subtitle">
        Create a local profile — no account, OAuth, or backend needed.
      </p>

      <form onSubmit={(e) => void handleSubmit(e)}>
        <div className="grid gap-0 sm:grid-cols-2 sm:gap-x-3">
          <Field icon={<User2 size={14} />} label="Full name"       value={form.name}   onChange={set("name")}   />
          <Field icon={<Mail   size={14} />} label="Email"           value={form.email}  onChange={set("email")}  type="email" />
          <Field icon={<Phone  size={14} />} label="Phone (optional)" value={form.phone}  onChange={set("phone")}  />
          <Field icon={<MapPin size={14} />} label="Region"          value={form.region} onChange={set("region")} />
        </div>

        <div className="login-action-bar">
          <p className="login-action-note">
            Your data stays in this browser only.
          </p>
          <button
            type="submit"
            disabled={submitting}
            className="login-submit-btn"
          >
            {submitting ? "Opening…" : "Open IDE"}
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
