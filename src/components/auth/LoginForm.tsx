"use client";

import { ChangeEvent, FormEvent, useState } from "react";
import { ArrowRight, Mail, MapPin, Phone, User2 } from "lucide-react";
import { useUser } from "@/context/UserContext";

type LoginFormState = {
  email: string;
  name: string;
  phone: string;
  region: string;
};

type LoginFormProps = {
  authError?: string;
};

function FloatingInput({
  icon,
  label,
  value,
  onChange,
  placeholder: _placeholder,
  type = "text",
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  onChange: (e: ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <div className="login-field-wrap relative">
      <span className="login-field-icon pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 z-10">
        {icon}
      </span>
      {/* placeholder must be a single space so :not(:placeholder-shown) works */}
      <input
        type={type}
        value={value}
        onChange={onChange}
        placeholder=" "
        className="login-field peer w-full"
      />
      <label className="login-field-label">
        {label}
      </label>
    </div>
  );
}

export default function LoginForm({ authError = "" }: LoginFormProps) {
  const { profile, saveProfile } = useUser();
  const [form, setForm] = useState<LoginFormState>(() => ({
    email: profile?.email ?? "",
    name: profile?.name ?? "",
    phone: profile?.phone ?? "",
    region: profile?.region ?? "",
  }));
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleField =
    (field: keyof LoginFormState) => (event: ChangeEvent<HTMLInputElement>) => {
      setForm((curr) => ({ ...curr, [field]: event.target.value }));
    };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    if (!form.name.trim() || !form.email.trim()) {
      setError("Name and email are required to open the workspace.");
      return;
    }
    setSubmitting(true);
    await saveProfile({
      email: form.email.trim(),
      id: profile?.id ?? `local-${Date.now()}`,
      name: form.name.trim(),
      phone: form.phone.trim(),
      region: form.region.trim() || "Local",
    });
    window.location.href = "/editor";
  };

  return (
    <div className="login-card">
      {/* Card header */}
      <div className="mb-8">
        <div className="login-badge mb-5">LOCAL WORKSPACE</div>
        <h2 className="login-title">Welcome to VoidLAB</h2>
        <p className="login-subtitle">
          Set up your local profile. No account, backend, or network required.
        </p>
      </div>

      <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <FloatingInput
            icon={<User2 size={15} />}
            label="Full name"
            value={form.name}
            onChange={handleField("name")}
          />
          <FloatingInput
            icon={<Mail size={15} />}
            label="Email"
            value={form.email}
            onChange={handleField("email")}
            type="email"
          />
          <FloatingInput
            icon={<Phone size={15} />}
            label="Phone (optional)"
            value={form.phone}
            onChange={handleField("phone")}
          />
          <FloatingInput
            icon={<MapPin size={15} />}
            label="Region"
            value={form.region}
            onChange={handleField("region")}
          />
        </div>

        {/* Info row + CTA */}
        <div className="login-action-row mt-2">
          <p className="login-action-note">
            Your data lives only in this browser. No cloud sync.
          </p>
          <button
            type="submit"
            disabled={submitting}
            className="login-cta-btn"
          >
            {submitting ? "Opening…" : "Open IDE"}
            <ArrowRight size={15} />
          </button>
        </div>

        {(error || authError) && (
          <div className="login-error">
            {error || authError}
          </div>
        )}
      </form>
    </div>
  );
}
