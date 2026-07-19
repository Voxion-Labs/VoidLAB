"use client";

import { ChangeEvent, FormEvent, useMemo, useState } from "react";
import { ArrowRight, Mail, MapPin, Phone, User2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useUser } from "@/context/UserContext";

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
  const { profile, saveProfile } = useUser();
  const [form, setForm] = useState(() => ({
    email: profile?.email ?? "",
    name: profile?.name ?? "",
    phone: profile?.phone ?? "",
    region: profile?.region ?? "",
  }));
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

  const handleLocalEntry = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");

    if (!form.name.trim() || !form.email.trim()) {
      setError("Name and email are required to open the local workspace.");
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
    <section className="glass w-full max-w-xl rounded-[6px] p-6 sm:p-8">
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <div className="display-font text-3xl font-semibold theme-text-strong">
            Enter VoidLAB
          </div>
          <p className="mt-2 text-sm leading-6 theme-muted">
            Create a local profile and open your browser-native IDE. No cloud account,
            OAuth, database, or backend session is required.
          </p>
        </div>
        <div className="theme-chip px-3 py-2 text-right">
          <div className="text-xs uppercase tracking-[0.18em]">Local</div>
          <div className="text-xl font-semibold">{completion}%</div>
        </div>
      </div>

      <form className="space-y-4" onSubmit={(event) => void handleLocalEntry(event)}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Input icon={<User2 size={16} />} label="Full name" onChange={handleField("name")} placeholder="Alex" value={form.name} />
          <Input icon={<Mail size={16} />} label="Email" onChange={handleField("email")} placeholder="you@local.dev" type="email" value={form.email} />
          <Input icon={<Phone size={16} />} label="Phone" onChange={handleField("phone")} placeholder="Optional" value={form.phone} />
          <Input icon={<MapPin size={16} />} label="Region" onChange={handleField("region")} placeholder="Kolkata, India" value={form.region} />
        </div>

        <div className="theme-surface flex flex-wrap items-center justify-between gap-3 rounded-[6px] p-5">
          <div>
            <div className="text-sm font-semibold theme-text-strong">Local-first workspace</div>
            <div className="mt-1 text-sm leading-6 theme-muted">
              Your profile, files, rooms, and settings stay inside this browser.
            </div>
          </div>
          <Button className="min-w-[170px]" disabled={submitting} type="submit">
            {submitting ? "Opening..." : "Open IDE"}
            <ArrowRight size={16} />
          </Button>
        </div>
      </form>

      {error || authError ? (
        <div className="mt-4 rounded-[6px] border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm accent-text">
          {error || authError}
        </div>
      ) : null}
    </section>
  );
}
