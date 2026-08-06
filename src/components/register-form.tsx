"use client";

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { assertSupabase, isSupabaseConfigured } from "@/lib/supabase/client";
import { ensureProfile } from "@/lib/data";
import { useToast } from "@/components/unlumen-ui/toast";
import { cn } from "@/lib/utils";
import { DEPARTMENTS, YEARS, LANGUAGE_OPTIONS, PROJECT_TYPES } from "@/lib/constants";

const STEPS = [
  { n: 1, title: "Personal details",    subtitle: "Your name and contact information" },
  { n: 2, title: "Academic details",    subtitle: "Department, year, section and gender" },
  { n: 3, title: "Skills & project",    subtitle: "Languages, LinkedIn and project type" },
  { n: 4, title: "Account & review",    subtitle: "Set a password and confirm your details" },
];

type FormState = {
  name: string; registerNo: string; email: string; phone: string;
  department: string; year: string; section: string; gender: string;
  languages: string[]; linkedin: string; projectType: string;
  password: string; confirm: string;
};

const INITIAL: FormState = {
  name: "", registerNo: "", email: "", phone: "",
  department: "", year: "", section: "", gender: "",
  languages: [], linkedin: "", projectType: "",
  password: "", confirm: "",
};

// ── Shared input class for dark panel ──
const inputCls =
  "w-full rounded-xl border border-[rgba(201,162,39,0.25)] bg-[#0d1a35] px-3.5 py-2.5 text-sm text-white outline-none transition-all placeholder:text-[#4e6080] focus:border-[#c9a227] focus:shadow-[0_0_0_3px_rgba(201,162,39,0.15)]";

const selectCls =
  "w-full appearance-none rounded-xl border border-[rgba(201,162,39,0.25)] bg-[#0d1a35] px-3.5 py-2.5 text-sm text-white outline-none transition-all focus:border-[#c9a227] focus:shadow-[0_0_0_3px_rgba(201,162,39,0.15)] [&>option]:bg-[#0d1220] [&>option]:text-white";

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
    set("languages", form.languages.includes(lang)
      ? form.languages.filter((l) => l !== lang)
      : [...form.languages, lang]);

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

  function back() { setStep((s) => Math.max(s - 1, 0)); }

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
      {/* ── Header: title + progress ── */}
      <div className="mb-8">
        <p className="font-caveat text-2xl text-[#c9a227]">Smart India Hackathon 2026</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-white sm:text-3xl">
          {STEPS[step].title}
        </h1>
        <p className="mt-1 text-sm text-[#8fa0c0]">{STEPS[step].subtitle}</p>

        <div className="mt-5 flex items-center gap-3">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[#1a2845]">
            <div
              className="h-full rounded-full bg-[#c9a227] transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
          <span className="text-xs font-semibold tabular-nums text-[#8fa0c0]">
            {step + 1} / {STEPS.length}
          </span>
        </div>
      </div>

      {!configured && (
        <div className="mb-6 rounded-xl border border-yellow-500/40 bg-yellow-500/10 px-5 py-3 text-sm text-yellow-300">
          Supabase isn&apos;t configured yet — add <code className="font-mono">VITE_SUPABASE_URL</code> and{" "}
          <code className="font-mono">VITE_SUPABASE_ANON_KEY</code> to <code className="font-mono">.env.local</code>.
        </div>
      )}

      <form onSubmit={submit} className="flex grow flex-col">
        <article className="divide-y divide-[rgba(201,162,39,0.15)]">
          <section className="py-8">
            {/* ── Section header ── */}
            <div className="mb-5 flex items-baseline justify-between gap-3">
              <h2 className="text-lg font-semibold tracking-tight text-white">
                Section {STEPS[step].n} of {STEPS.length}
              </h2>
              <span className="text-[11px] font-semibold uppercase tracking-widest text-[#c9a227]">
                Required <span className="text-red-400">*</span>
              </span>
            </div>

            {/* ── Step 0: Personal ── */}
            {step === 0 && (
              <div className="flex flex-col gap-4">
                <Field label="Name (Full Name in Capital)" hint="Eg. NAVEEN K">
                  <input
                    value={form.name}
                    onChange={(e) => set("name", e.target.value.toUpperCase())}
                    placeholder="Eg. NAVEEN K"
                    className={cn(inputCls, "uppercase")}
                    required
                  />
                </Field>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Register No" hint="Eg. 711522CS001">
                    <input
                      value={form.registerNo}
                      onChange={(e) => set("registerNo", e.target.value)}
                      placeholder="Eg. 711522CS001"
                      className={inputCls}
                      required
                    />
                  </Field>
                  <Field label="Phone No">
                    <input
                      type="tel"
                      value={form.phone}
                      onChange={(e) => set("phone", e.target.value)}
                      placeholder="98765 00001"
                      className={inputCls}
                      required
                    />
                  </Field>
                </div>
                <Field label="Email" hint="We'll use this email to verify your account, so kindly use this mail id for further login process.">
                  <input
                    type="email"
                    value={form.email}
                    onChange={(e) => set("email", e.target.value)}
                    placeholder="you@college.edu"
                    className={inputCls}
                    required
                  />
                </Field>
              </div>
            )}

            {/* ── Step 1: Academic ── */}
            {step === 1 && (
              <div className="flex flex-col gap-4">
                <Field label="Department">
                  <select
                    value={form.department}
                    onChange={(e) => set("department", e.target.value)}
                    className={selectCls}
                    required
                  >
                    <option value="">Choose</option>
                    {DEPARTMENTS.map((d) => <option key={d} value={d}>{d}</option>)}
                  </select>
                </Field>
                <div className="grid gap-4 sm:grid-cols-3">
                  <Field label="Year">
                    <select
                      value={form.year}
                      onChange={(e) => set("year", e.target.value)}
                      className={selectCls}
                      required
                    >
                      <option value="">Choose</option>
                      {YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
                    </select>
                  </Field>
                  <Field label="Section">
                    <input
                      value={form.section}
                      onChange={(e) => set("section", e.target.value.toUpperCase())}
                      placeholder="Eg. A"
                      className={cn(inputCls, "uppercase")}
                      required
                    />
                  </Field>
                  <Field label="Gender">
                    <select
                      value={form.gender}
                      onChange={(e) => set("gender", e.target.value)}
                      className={selectCls}
                      required
                    >
                      <option value="">Choose</option>
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                    </select>
                  </Field>
                </div>
              </div>
            )}

            {/* ── Step 2: Skills ── */}
            {step === 2 && (
              <div className="flex flex-col gap-4">
                <Field label="Languages known">
                  <div className="flex flex-wrap gap-2 pt-1">
                    {LANGUAGE_OPTIONS.map((lang) => (
                      <button
                        key={lang}
                        type="button"
                        onClick={() => toggleLanguage(lang)}
                        className={cn(
                          "rounded-full border px-4 py-1.5 text-sm font-medium transition-all",
                          form.languages.includes(lang)
                            ? "border-[#c9a227] bg-[rgba(201,162,39,0.15)] text-[#e8c058]"
                            : "border-[rgba(201,162,39,0.20)] text-[#8fa0c0] hover:border-[#c9a227] hover:text-white"
                        )}
                      >
                        {lang}
                      </button>
                    ))}
                  </div>
                </Field>
                <Field label="LinkedIn profile URL">
                  <input
                    type="url"
                    value={form.linkedin}
                    onChange={(e) => set("linkedin", e.target.value)}
                    placeholder="https://www.linkedin.com/in/you"
                    className={inputCls}
                    required
                  />
                </Field>
                <Field label="Select project type">
                  <div className="flex flex-wrap gap-2 pt-1">
                    {PROJECT_TYPES.map((pt) => (
                      <button
                        key={pt}
                        type="button"
                        onClick={() => set("projectType", pt)}
                        className={cn(
                          "rounded-xl border px-4 py-2.5 text-sm font-semibold transition-all",
                          form.projectType === pt
                            ? "border-[#c9a227] bg-[rgba(201,162,39,0.15)] text-[#e8c058]"
                            : "border-[rgba(201,162,39,0.20)] text-[#8fa0c0] hover:border-[#c9a227] hover:text-white"
                        )}
                      >
                        {pt === "Both" ? "Both (Hardware and Software)" : pt}
                      </button>
                    ))}
                  </div>
                </Field>
              </div>
            )}

            {/* ── Step 3: Review ── */}
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
                  <Field label="Password">
                    <input
                      type="password"
                      value={form.password}
                      onChange={(e) => set("password", e.target.value)}
                      placeholder="At least 6 characters"
                      className={inputCls}
                      required
                    />
                  </Field>
                  <Field label="Confirm password">
                    <input
                      type="password"
                      value={form.confirm}
                      onChange={(e) => set("confirm", e.target.value)}
                      placeholder="Repeat password"
                      className={inputCls}
                      required
                    />
                  </Field>
                </div>
              </div>
            )}
          </section>
        </article>

        {/* ── Nav buttons ── */}
        <div className="mt-8 flex items-center justify-between border-t border-[rgba(201,162,39,0.15)] pt-6">
          <button
            type="button"
            onClick={back}
            disabled={step === 0 || busy}
            className="rounded-lg px-4 py-2 text-sm font-semibold text-[#8fa0c0] transition-colors hover:text-white disabled:pointer-events-none disabled:opacity-40"
          >
            Back
          </button>
          {step < STEPS.length - 1 ? (
            <button
              type="button"
              onClick={next}
              className="rounded-lg bg-[#c9a227] px-6 py-2 text-sm font-bold text-[#06090f] transition-colors hover:bg-[#e8c058]"
            >
              Next
            </button>
          ) : (
            <button
              type="submit"
              disabled={busy}
              className="inline-flex items-center gap-2 rounded-lg bg-[#c9a227] px-6 py-2 text-sm font-bold text-[#06090f] transition-colors hover:bg-[#e8c058] disabled:pointer-events-none disabled:opacity-50"
            >
              {busy && <span className="size-3.5 animate-spin rounded-full border-2 border-[#06090f] border-t-transparent" />}
              Submit registration
            </button>
          )}
        </div>
      </form>
    </div>
  );
}

// ── Field wrapper ──
function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <span className="mb-1.5 block text-sm font-medium text-[#c9a227]">
        {label} <span className="text-red-400">*</span>
      </span>
      {children}
      {hint && <span className="mt-1.5 block text-xs text-[#6a80a0]">{hint}</span>}
    </div>
  );
}

// ── Review row (step 4) ──
function ReviewRow({ label, value, link }: { label: string; value: string; link?: boolean }) {
  if (!value) return null;
  return (
    <div className="rounded-lg border border-[rgba(201,162,39,0.20)] bg-[#0d1a35] px-3.5 py-2.5">
      <p className="text-[10px] font-bold uppercase tracking-widest text-[#8fa0c0]">{label}</p>
      {link ? (
        <a href={value} target="_blank" rel="noopener noreferrer" className="text-sm font-semibold text-[#c9a227] hover:underline">
          {value}
        </a>
      ) : (
        <p className="truncate text-sm font-semibold text-white">{value}</p>
      )}
    </div>
  );
}
