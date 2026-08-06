"use client";

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { assertSupabase, isSupabaseConfigured } from "@/lib/supabase/client";
import { ensureProfile } from "@/lib/data";
import { useToast } from "@/components/unlumen-ui/toast";
import { Button } from "@/components/unlumen-ui/button";
import { Input, Select } from "@/components/unlumen-ui/input";
import { cn } from "@/lib/utils";
import { DEPARTMENTS, YEARS, LANGUAGE_OPTIONS, PROJECT_TYPES } from "@/lib/constants";

const STEPS = [
  { n: 1, title: "Personal details", subtitle: "Your name and contact information" },
  { n: 2, title: "Academic details", subtitle: "Department, year, section and gender" },
  { n: 3, title: "Skills & project", subtitle: "Languages, LinkedIn and project type" },
  { n: 4, title: "Account & review", subtitle: "Set a password and confirm your details" },
];

type FormState = {
  name: string;
  registerNo: string;
  email: string;
  phone: string;
  department: string;
  year: string;
  section: string;
  gender: string;
  languages: string[];
  linkedin: string;
  projectType: string;
  password: string;
  confirm: string;
};

const INITIAL: FormState = {
  name: "",
  registerNo: "",
  email: "",
  phone: "",
  department: "",
  year: "",
  section: "",
  gender: "",
  languages: [],
  linkedin: "",
  projectType: "",
  password: "",
  confirm: "",
};

export function RegisterForm() {
  const navigate = useNavigate();
  const toast = useToast();
  const configured = isSupabaseConfigured();

  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState<FormState>(INITIAL);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const toggleLanguage = (lang: string) =>
    set("languages", form.languages.includes(lang) ? form.languages.filter((l) => l !== lang) : [...form.languages, lang]);

  function validateStep(s: number): string | null {
    if (s === 0) {
      if (!form.name.trim()) return "Enter your full name";
      if (form.name.trim().length < 3) return "Name must be at least 3 characters";
      if (!form.registerNo.trim()) return "Enter your register number";
      if (!/^\S+@\S+\.\S+$/.test(form.email.trim())) return "Enter a valid email address";
      if (!/^[6-9]\d{9}$/.test(form.phone.replace(/\s/g, ""))) return "Enter a valid 10-digit phone number";
    }
    if (s === 1) {
      if (!form.department) return "Select your department";
      if (!form.year) return "Select your year";
      if (!form.section.trim()) return "Enter your section";
      if (!form.gender) return "Select your gender";
    }
    if (s === 2) {
      if (form.languages.length === 0) return "Select at least one language you know";
      if (!/^https?:\/\/[\w.-]/.test(form.linkedin.trim())) return "Enter a valid LinkedIn profile URL";
      if (!form.projectType) return "Select your project type";
    }
    if (s === 3) {
      if (form.password.length < 6) return "Password must be at least 6 characters";
      if (form.password !== form.confirm) return "Passwords do not match";
    }
    return null;
  }

  function next() {
    const err = validateStep(step);
    if (err) return toast("error", err);
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  }

  function back() {
    setStep((s) => Math.max(s - 1, 0));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const err = validateStep(3);
    if (err) return toast("error", err);

    setBusy(true);
    try {
      const supabase = assertSupabase();
      const meta = {
        name: form.name.trim().toUpperCase(),
        register_no: form.registerNo.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        department: form.department,
        year: form.year,
        section: form.section.trim(),
        gender: form.gender,
        languages: form.languages,
        linkedin: form.linkedin.trim(),
        project_type: form.projectType,
        role: "student",
      };

      const { data, error } = await supabase.auth.signUp({
        email: form.email.trim(),
        password: form.password,
        options: { data: meta },
      });
      if (error) throw new Error(error.message);

      if (data.user) await ensureProfile(data.user.id, meta);

      if (data.session) {
        toast("success", "Registration complete — welcome to SIH 2026!");
        navigate("/dashboard");
      } else {
        toast("info", "Check your inbox to confirm your email, then log in.");
        navigate("/login");
      }
    } catch (err) {
      toast("error", err instanceof Error ? err.message : "Registration failed");
    } finally {
      setBusy(false);
    }
  }

  const progress = ((step + 1) / STEPS.length) * 100;

  return (
    <div className="flex min-h-[60vh] flex-col">
      <div className="mb-8">
        <p className="font-caveat text-2xl text-[#dba328]">Smart India Hackathon 2026</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">{STEPS[step].title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{STEPS[step].subtitle}</p>

        <div className="mt-5 flex items-center gap-3">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
          <span className="text-xs font-semibold tabular-nums text-muted-foreground">
            {step + 1} / {STEPS.length}
          </span>
        </div>
      </div>

      {!configured && (
        <div className="mb-6 rounded-xl border border-warning/40 bg-warning/10 px-5 py-3 text-sm text-warning">
          Supabase isn&apos;t configured yet — add <code className="font-mono">VITE_SUPABASE_URL</code> and{" "}
          <code className="font-mono">VITE_SUPABASE_ANON_KEY</code> to <code className="font-mono">.env.local</code>.
        </div>
      )}

      <form onSubmit={submit} className="flex grow flex-col">
        <article className="divide-y divide-border">
          <section className="py-8">
            <div className="mb-5 flex items-baseline justify-between gap-3">
              <h2 className="text-lg font-semibold tracking-tight">Section {STEPS[step].n} of {STEPS.length}</h2>
              <span className="text-[11px] font-semibold uppercase tracking-widest text-[#dba328]">
                Required <span className="text-danger">*</span>
              </span>
            </div>

            {step === 0 && (
              <div className="flex flex-col gap-4">
                <Field label="Name (Full Name in Capital)" required hint="Eg. NAVEEN K">
                  <Input
                    value={form.name}
                    onChange={(e) => set("name", e.target.value.toUpperCase())}
                    placeholder="Eg. NAVEEN K"
                    className="uppercase"
                    required
                  />
                </Field>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Register No" required hint="Eg. 711522CS001">
                    <Input
                      value={form.registerNo}
                      onChange={(e) => set("registerNo", e.target.value)}
                      placeholder="Eg. 711522CS001"
                      required
                    />
                  </Field>
                  <Field label="Phone No" required>
                    <Input
                      type="tel"
                      value={form.phone}
                      onChange={(e) => set("phone", e.target.value)}
                      placeholder="98765 00001"
                      required
                    />
                  </Field>
                </div>
                <Field label="Email" required hint="We'll use this email to verify your account, so kindly use this mail id for further login process.">
                  <Input
                    type="email"
                    value={form.email}
                    onChange={(e) => set("email", e.target.value)}
                    placeholder="you@college.edu"
                    required
                  />
                </Field>
              </div>
            )}

            {step === 1 && (
              <div className="flex flex-col gap-4">
                <Field label="Department" required>
                  <Select value={form.department} onChange={(e) => set("department", e.target.value)} required>
                    <option value="">Choose</option>
                    {DEPARTMENTS.map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </Select>
                </Field>
                <div className="grid gap-4 sm:grid-cols-3">
                  <Field label="Year" required>
                    <Select value={form.year} onChange={(e) => set("year", e.target.value)} required>
                      <option value="">Choose</option>
                      {YEARS.map((y) => (
                        <option key={y} value={y}>
                          {y}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <Field label="Section" required>
                    <Input
                      value={form.section}
                      onChange={(e) => set("section", e.target.value.toUpperCase())}
                      placeholder="Eg. A"
                      className="uppercase"
                      required
                    />
                  </Field>
                  <Field label="Gender" required>
                    <Select value={form.gender} onChange={(e) => set("gender", e.target.value)} required>
                      <option value="">Choose</option>
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                    </Select>
                  </Field>
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="flex flex-col gap-4">
                <Field label="Language known" required>
                  <div className="flex flex-wrap gap-2">
                    {LANGUAGE_OPTIONS.map((lang) => (
                      <button
                        key={lang}
                        type="button"
                        onClick={() => toggleLanguage(lang)}
                        className={cn(
                          "rounded-full border px-4 py-1.5 text-sm font-medium transition-all",
                          form.languages.includes(lang)
                            ? "border-ring/60 bg-ring/15 text-ring shadow-[0_0_12px_-4px_var(--ring)]"
                            : "border-border text-muted-foreground hover:border-ring/40 hover:text-foreground"
                        )}
                      >
                        {lang}
                      </button>
                    ))}
                  </div>
                </Field>
                <Field label="LinkedIn profile URL" required>
                  <Input
                    type="url"
                    value={form.linkedin}
                    onChange={(e) => set("linkedin", e.target.value)}
                    placeholder="https://www.linkedin.com/in/you"
                    required
                  />
                </Field>
                <Field label="Select project type" required>
                  <div className="flex flex-wrap gap-2">
                    {PROJECT_TYPES.map((pt) => (
                      <button
                        key={pt}
                        type="button"
                        onClick={() => set("projectType", pt)}
                        className={cn(
                          "rounded-xl border px-4 py-2.5 text-sm font-semibold transition-all",
                          form.projectType === pt
                            ? "border-ring/60 bg-ring/15 text-ring shadow-[0_0_12px_-4px_var(--ring)]"
                            : "border-border text-muted-foreground hover:border-ring/40 hover:text-foreground"
                        )}
                      >
                        {pt === "Both" ? "Both (Hardware and Software)" : pt}
                      </button>
                    ))}
                  </div>
                </Field>
              </div>
            )}

            {step === 3 && (
              <div className="flex flex-col gap-4">
                <ReviewRow label="Name" value={form.name} />
                <div className="grid gap-4 sm:grid-cols-2">
                  <ReviewRow label="Register No" value={form.registerNo} />
                  <ReviewRow label="Email" value={form.email} />
                  <ReviewRow label="Phone" value={form.phone} />
                  <ReviewRow label="Department" value={form.department} />
                  <ReviewRow label="Year" value={form.year} />
                  <ReviewRow label="Section" value={form.section} />
                  <ReviewRow label="Gender" value={form.gender} />
                  <ReviewRow label="Languages" value={form.languages.join(", ")} />
                  <ReviewRow label="Project type" value={form.projectType} />
                </div>
                <ReviewRow label="LinkedIn" value={form.linkedin} link />

                <div className="mt-2 grid gap-4 sm:grid-cols-2">
                  <Input
                    label="Password"
                    type="password"
                    value={form.password}
                    onChange={(e) => set("password", e.target.value)}
                    placeholder="At least 6 characters"
                    required
                  />
                  <Input
                    label="Confirm password"
                    type="password"
                    value={form.confirm}
                    onChange={(e) => set("confirm", e.target.value)}
                    placeholder="Repeat password"
                    required
                  />
                </div>
              </div>
            )}
          </section>
        </article>

        <div className="mt-8 flex items-center justify-between border-t border-border pt-6">
          <Button type="button" variant="ghost" onClick={back} disabled={step === 0 || busy}>
            Back
          </Button>
          {step < STEPS.length - 1 ? (
            <Button type="button" onClick={next}>
              Next
            </Button>
          ) : (
            <Button type="submit" loading={busy}>
              Submit registration
            </Button>
          )}
        </div>
      </form>
    </div>
  );
}

function Field({
  label,
  required,
  hint,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <span className="mb-1.5 block text-sm font-medium text-foreground">
        {label} {required && <span className="text-danger">*</span>}
      </span>
      {children}
      {hint && <span className="mt-1.5 block text-xs text-muted-foreground">{hint}</span>}
    </div>
  );
}

function ReviewRow({ label, value, link }: { label: string; value: string; link?: boolean }) {
  if (!value) return null;
  return (
    <div className="rounded-lg border border-border bg-muted/40 px-3.5 py-2.5">
      <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{label}</p>
      {link ? (
        <a href={value} target="_blank" rel="noopener noreferrer" className="text-sm font-semibold text-ring hover:underline">
          {value}
        </a>
      ) : (
        <p className="truncate text-sm font-semibold">{value}</p>
      )}
    </div>
  );
}
