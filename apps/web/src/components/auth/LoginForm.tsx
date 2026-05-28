"use client";

import { ChangeEvent, FormEvent, useMemo, useState } from "react";
import { ArrowRight, Globe2, Mail, Phone, User2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useUser } from "@/context/UserContext";
import { apiBaseUrl } from "@/lib/api";
import { storeSessionToken } from "@/lib/session";

const emptyForm = {
  email: "",
  name: "",
  phone: "",
  region: "",
};

type LoginFormProps = {
  authError?: string;
};

export default function LoginForm({ authError = "" }: LoginFormProps) {
  const { isReady, profile, refreshProfile } = useUser();
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const completion = useMemo(() => {
    const values = [form.name, form.email, form.phone, form.region];
    return Math.round((values.filter((value) => value.trim()).length / values.length) * 100);
  }, [form]);

  const handleField =
    (field: keyof typeof emptyForm) => (event: ChangeEvent<HTMLInputElement>) => {
      setForm((current) => ({ ...current, [field]: event.target.value }));
    };

  const handleManualLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");

    if (!form.name.trim() || !form.email.trim() || !form.phone.trim() || !form.region.trim()) {
      setError("Please fill in your name, email, phone, and region.");
      return;
    }

    setSubmitting(true);

    try {
      const response = await fetch(`${apiBaseUrl}/api/auth/manual-login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          email: form.email.trim(),
          name: form.name.trim(),
          phone: form.phone.trim(),
          region: form.region.trim(),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "VoidLAB could not enter your workspace.");
      }

      if (data.token) {
        storeSessionToken(String(data.token));
      }

      await refreshProfile();
      window.location.href = "/editor";
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : "VoidLAB could not enter your workspace.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="glass w-full max-w-xl rounded-sm p-6 sm:p-8">
      {/* Header */}
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <div className="display-font text-3xl font-bold tracking-tight theme-text-strong">
            Enter VoidLAB
          </div>
          <p className="mt-2 text-sm leading-6 theme-muted">
            Create or access your workspace with a simple one-step form. No passwords, no friction.
          </p>
        </div>
        <div
          className="shrink-0 rounded-sm px-3 py-2 text-right"
          style={{
            background: "var(--accent-soft)",
            border: "1px solid var(--border-strong)",
          }}
        >
          <div className="text-xs font-semibold uppercase tracking-widest accent-text">
            Access
          </div>
          <div className="display-font text-xl font-bold theme-text-strong">{completion}%</div>
        </div>
      </div>

      {/* Form */}
      <form className="space-y-4" onSubmit={(event) => void handleManualLogin(event)}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            icon={<User2 size={15} />}
            label="Full name"
            onChange={handleField("name")}
            placeholder="Your name"
            value={form.name}
          />
          <Input
            icon={<Mail size={15} />}
            label="Email"
            onChange={handleField("email")}
            placeholder="you@example.com"
            type="email"
            value={form.email}
          />
          <Input
            icon={<Phone size={15} />}
            label="Phone number"
            onChange={handleField("phone")}
            placeholder="+91 98765 43210"
            value={form.phone}
          />
          <Input
            icon={<Globe2 size={15} />}
            label="Region"
            onChange={handleField("region")}
            placeholder="Kolkata, India"
            value={form.region}
          />
        </div>

        <div
          className="flex flex-wrap items-center justify-between gap-3 rounded-sm p-4"
          style={{
            background: "var(--surface-soft)",
            border: "1px solid var(--border)",
          }}
        >
          <div className="text-sm theme-muted leading-6">
            Your workspace is stored securely and privately. No external logins required.
          </div>
          <Button className="min-w-[180px]" disabled={submitting} type="submit">
            {submitting ? "Entering..." : "Enter VoidLAB"}
            <ArrowRight size={15} />
          </Button>
        </div>
      </form>

      {/* Error */}
      {error || authError ? (
        <div
          className="mt-4 rounded-sm px-4 py-3 text-sm"
          style={{
            background: "rgba(225, 29, 72, 0.08)",
            border: "1px solid rgba(225, 29, 72, 0.28)",
            color: "var(--accent)",
          }}
        >
          {error || authError}
        </div>
      ) : null}

      {/* Already signed in */}
      {isReady && profile ? (
        <div
          className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-sm px-4 py-3 text-sm"
          style={{
            background: "var(--accent-soft)",
            border: "1px solid var(--border-strong)",
          }}
        >
          <span className="theme-text">Signed in as <strong>{profile.name}</strong>. Your workspace is ready.</span>
          <a
            className="inline-flex items-center justify-center gap-2 rounded-sm px-4 py-2 text-sm font-semibold transition hover:opacity-90"
            href="/editor"
            style={{
              background: "var(--action-background)",
              color: "var(--action-foreground)",
              boxShadow: "var(--action-shadow)",
            }}
          >
            Open editor
          </a>
        </div>
      ) : null}

      {/* Copyright */}
      <div className="mt-8 text-center text-xs theme-muted" style={{ letterSpacing: "0.03em" }}>
        © 2025 Voxion Labs. All rights reserved.
      </div>
    </section>
  );
}
