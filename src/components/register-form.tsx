"use client";

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { assertSupabase, isSupabaseConfigured } from "@/lib/supabase/client";
import { ensureProfile } from "@/lib/data";
import { useToast } from "@/components/unlumen-ui/toast";
import { cn } from "@/lib/utils";
import {
  DEPARTMENTS, YEARS, LANGUAGE_OPTIONS,
  HARDWARE_DOMAINS, SOFTWARE_DOMAINS,
} from "@/lib/constants";

// ── Shared style tokens ────────────────────────────────────────────────────────
const inputCls =
  "w-full rounded-xl border border-[rgba(201,162,39,0.25)] bg-[#0d1a35] px-3.5 py-2.5 text-sm text-white outline-none transition-all placeholder:text-[#4e6080] focus:border-[#c9a227] focus:shadow-[0_0_0_3px_rgba(201,162,39,0.15)]";
const selectCls =
  "w-full appearance-none rounded-xl border border-[rgba(201,162,39,0.25)] bg-[#0d1a35] px-3.5 py-2.5 text-sm text-white outline-none transition-all focus:border-[#c9a227] focus:shadow-[0_0_0_3px_rgba(201,162,39,0.15)] [&>option]:bg-[#0d1220] [&>option]:text-white";
const textareaCls =
  "w-full rounded-xl border border-[rgba(201,162,39,0.25)] bg-[#0d1a35] px-3.5 py-2.5 text-sm text-white outline-none transition-all resize-none placeholder:text-[#4e6080] focus:border-[#c9a227] focus:shadow-[0_0_0_3px_rgba(201,162,39,0.15)]";

type ProjectType = "Hardware" | "Software" | "Both" | "";

// ── Form state ────────────────────────────────────────────────────────────────
type FormState = {
  // Step 1 — Personal
  name: string; registerNo: string; phone: string; email: string;
  // Step 2 — Academic
  department: string; year: string; section: string; gender: string;
  // Step 3 — Skills & project type
  languages: string[]; linkedin: string; projectType: ProjectType;
  // Step 4 — Project (dynamic)
  projectTitle: string; projectDesc: string;
  githubProfile: string;   // Hardware / Software profile URL
  githubRepo: string;      // Software / Both repo URL
  youtube: string;         // Hardware / Both optional
  hwDomain: string;        // Hardware / Both
  swDomain: string;        // Software / Both
  driveLink: string;       // all types
  // Step 5 — Declaration
  declared: boolean;
};

const INIT: FormState = {
  name: "", registerNo: "", phone: "", email: "",
  department: "", year: "", section: "", gender: "",
  languages: [], linkedin: "", projectType: "",
  projectTitle: "", projectDesc: "",
  githubProfile: "", githubRepo: "", youtube: "",
  hwDomain: "", swDomain: "", driveLink: "",
  declared: false,
};

// ── Step labels (step 4 title changes per project type) ───────────────────────
function getSteps(pt: ProjectType) {
  const projectLabel =
    pt === "Hardware" ? "Hardware project"
    : pt === "Software" ? "Software project"
    : pt === "Both" ? "Hardware & Software project"
    : "Project details";
  return [
    { n: 1, title: "Personal details",   subtitle: "Your name and contact information" },
    { n: 2, title: "Academic details",   subtitle: "Department, year, section and gender" },
    { n: 3, title: "Skills & project",   subtitle: "Languages, LinkedIn and project type" },
    { n: 4, title: projectLabel,         subtitle: "Project title, description and links" },
    { n: 5, title: "Account & review",   subtitle: "Review your details and declare" },
  ];
}

// ── Validation ────────────────────────────────────────────────────────────────
function validate(step: number, f: FormState): string | null {
  const url = (v: string) => /^https?:\/\/[\w.-]/.test(v.trim());
  if (step === 0) {
    if (!f.name.trim() || f.name.trim().length < 3) return "Enter your full name (min 3 chars)";
    if (!f.registerNo.trim()) return "Enter your register number";
    if (!/^[6-9]\d{9}$/.test(f.phone.replace(/\s/g, ""))) return "Enter a valid 10-digit phone number";
    if (!/^\S+@\S+\.\S+$/.test(f.email.trim())) return "Enter a valid email address";
  }
  if (step === 1) {
    if (!f.department) return "Select your department";
    if (!f.year) return "Select your year";
    if (!f.section.trim()) return "Enter your section";
    if (!f.gender) return "Select your gender";
  }
  if (step === 2) {
    if (f.languages.length === 0) return "Select at least one language";
    if (!url(f.linkedin)) return "Enter a valid LinkedIn URL (https://...)";
    if (!f.projectType) return "Select a project type to continue";
  }
  if (step === 3) {
    if (!f.projectTitle.trim()) return "Enter your project title";
    if (f.projectDesc.trim().length < 10) return "Enter a project description (min 10 chars)";
    if (f.projectType === "Hardware") {
      if (!f.hwDomain) return "Select a hardware domain";
      if (!url(f.driveLink)) return "Enter a valid Google Drive PPT link";
    }
    if (f.projectType === "Software") {
      if (!url(f.githubProfile)) return "Enter a valid GitHub profile URL";
      if (!f.swDomain) return "Select a software domain";
      if (!url(f.driveLink)) return "Enter a valid Google Drive PPT link";
      if (!url(f.githubRepo)) return "Enter a valid GitHub repository URL";
    }
    if (f.projectType === "Both") {
      if (!f.swDomain) return "Select a software domain";
      if (!f.hwDomain) return "Select a hardware domain";
      if (!url(f.githubRepo)) return "Enter a valid GitHub repository URL";
      if (!url(f.driveLink)) return "Enter a valid Google Drive PPT link";
    }
  }
  if (step === 4) {
    if (!f.declared) return "Please check the declaration checkbox to submit";
  }
  return null;
}

// ── Main component ────────────────────────────────────────────────────────────
export function RegisterForm() {
  const navigate = useNavigate();
  const toast = useToast();
  const configured = isSupabaseConfigured();

  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState<FormState>(INIT);

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const toggleLang = (lang: string) =>
    set("languages", form.languages.includes(lang)
      ? form.languages.filter((l) => l !== lang)
      : [...form.languages, lang]);

  const steps = getSteps(form.projectType);
  const progress = ((step + 1) / steps.length) * 100;

  function next() {
    const err = validate(step, form);
    if (err) return toast("error", err);
    setStep((s) => Math.min(s + 1, steps.length - 1));
  }
  function back() { setStep((s) => Math.max(s - 1, 0)); }

  // ── Submit — passwordless: Register No is the password ──────────────────────
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const err = validate(4, form);
    if (err) return toast("error", err);
    setBusy(true);
    try {
      const supabase = assertSupabase();
      const password = form.registerNo.trim().toUpperCase();

      // Build domain string
      const domain =
        form.projectType === "Both"
          ? `${form.swDomain} & ${form.hwDomain}`
          : form.projectType === "Hardware" ? form.hwDomain
          : form.swDomain;

      // GitHub field mapping
      const github =
        form.projectType === "Both" ? form.githubRepo
        : form.projectType === "Software" ? form.githubProfile || form.githubRepo
        : form.githubProfile;

      const meta = {
        name: form.name.trim().toUpperCase(),
        register_no: form.registerNo.trim().toUpperCase(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        department: form.department,
        year: form.year,
        section: form.section.trim().toUpperCase(),
        gender: form.gender,
        languages: form.languages,
        linkedin: form.linkedin.trim(),
        project_type: form.projectType,
        domain,
        github: github ?? null,
        youtube: form.youtube.trim() || null,
        drive_link: form.driveLink.trim(),
        project_title: form.projectTitle.trim(),
        project_desc: form.projectDesc.trim(),
        role: "student",
      };

      const { data, error } = await supabase.auth.signUp({
        email: form.email.trim(),
        password,
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

  return (
    <div className="flex min-h-[60vh] flex-col">
      {/* ── Header + progress ── */}
      <div className="mb-8">
        <p className="font-caveat text-2xl text-[#c9a227]">Smart India Hackathon 2026</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-white sm:text-3xl">
          {steps[step].title}
        </h1>
        <p className="mt-1 text-sm text-[#8fa0c0]">{steps[step].subtitle}</p>
        <div className="mt-5 flex items-center gap-3">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[#1a2845]">
            <div className="h-full rounded-full bg-[#c9a227] transition-all duration-500"
              style={{ width: `${progress}%` }} />
          </div>
          <span className="shrink-0 text-xs font-semibold tabular-nums text-[#8fa0c0]">
            {step + 1} / {steps.length}
          </span>
        </div>
      </div>

      {!configured && (
        <div className="mb-6 rounded-xl border border-yellow-500/40 bg-yellow-500/10 px-5 py-3 text-sm text-yellow-300">
          Supabase isn&apos;t configured — add <code className="font-mono">VITE_SUPABASE_URL</code> and{" "}
          <code className="font-mono">VITE_SUPABASE_ANON_KEY</code> to <code className="font-mono">.env.local</code>.
        </div>
      )}

      <form onSubmit={submit} className="flex grow flex-col">
        <div className="divide-y divide-[rgba(201,162,39,0.12)]">
          <div className="py-8">
            {/* Section heading */}
            <div className="mb-6 flex items-baseline justify-between gap-3">
              <h2 className="text-lg font-semibold tracking-tight text-white">
                Section {steps[step].n} of {steps.length}
              </h2>
              <span className="text-[11px] font-semibold uppercase tracking-widest text-[#c9a227]">
                Required <span className="text-red-400">*</span>
              </span>
            </div>

            {/* ── Step 1: Personal ── */}
            {step === 0 && (
              <div className="flex flex-col gap-5">
                <Field label="Name (Full Name in Capital)" hint="Eg. NAVEEN K">
                  <input value={form.name}
                    onChange={(e) => set("name", e.target.value.toUpperCase())}
                    placeholder="Eg. NAVEEN K" className={cn(inputCls, "uppercase")} required />
                </Field>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Register No" hint="Eg. 711522CS001">
                    <input value={form.registerNo}
                      onChange={(e) => set("registerNo", e.target.value.toUpperCase())}
                      placeholder="Eg. 711522CS001" className={inputCls} required />
                  </Field>
                  <Field label="Phone No">
                    <input type="tel" value={form.phone}
                      onChange={(e) => set("phone", e.target.value)}
                      placeholder="98765 00001" className={inputCls} required />
                  </Field>
                </div>
                <Field label="Email"
                  hint="We'll use this email to verify your account. Your Register No will be your login password.">
                  <input type="email" value={form.email}
                    onChange={(e) => set("email", e.target.value)}
                    placeholder="you@college.edu" className={inputCls} required />
                </Field>
              </div>
            )}

            {/* ── Step 2: Academic ── */}
            {step === 1 && (
              <div className="flex flex-col gap-5">
                <Field label="Department">
                  <select value={form.department}
                    onChange={(e) => set("department", e.target.value)}
                    className={selectCls} required>
                    <option value="">Choose department</option>
                    {DEPARTMENTS.map((d) => <option key={d} value={d}>{d}</option>)}
                  </select>
                </Field>
                <div className="grid gap-4 sm:grid-cols-3">
                  <Field label="Year">
                    <select value={form.year} onChange={(e) => set("year", e.target.value)}
                      className={selectCls} required>
                      <option value="">Choose</option>
                      {YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
                    </select>
                  </Field>
                  <Field label="Section">
                    <input value={form.section}
                      onChange={(e) => set("section", e.target.value.toUpperCase())}
                      placeholder="Eg. A" className={cn(inputCls, "uppercase")} required />
                  </Field>
                  <Field label="Gender">
                    <select value={form.gender} onChange={(e) => set("gender", e.target.value)}
                      className={selectCls} required>
                      <option value="">Choose</option>
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                    </select>
                  </Field>
                </div>
              </div>
            )}

            {/* ── Step 3: Skills & project type ── */}
            {step === 2 && (
              <div className="flex flex-col gap-6">
                <Field label="Language Known">
                  <div className="flex flex-wrap gap-2 pt-1">
                    {LANGUAGE_OPTIONS.map((lang) => (
                      <button key={lang} type="button" onClick={() => toggleLang(lang)}
                        className={cn("rounded-full border px-4 py-1.5 text-sm font-medium transition-all",
                          form.languages.includes(lang)
                            ? "border-[#c9a227] bg-[rgba(201,162,39,0.15)] text-[#e8c058]"
                            : "border-[rgba(201,162,39,0.20)] text-[#8fa0c0] hover:border-[#c9a227] hover:text-white")}>
                        {lang}
                      </button>
                    ))}
                  </div>
                </Field>
                <Field label="LinkedIn Profile URL">
                  <input type="url" value={form.linkedin}
                    onChange={(e) => set("linkedin", e.target.value)}
                    placeholder="https://www.linkedin.com/in/you"
                    className={inputCls} required />
                </Field>
                <Field label="Select Project Type">
                  <div className="flex flex-wrap gap-3 pt-1">
                    {(["Hardware", "Software", "Both"] as const).map((pt) => (
                      <button key={pt} type="button"
                        onClick={() => { set("projectType", pt); set("hwDomain", ""); set("swDomain", ""); }}
                        className={cn(
                          "rounded-xl border px-5 py-3 text-sm font-bold transition-all",
                          form.projectType === pt
                            ? "border-[#c9a227] bg-[rgba(201,162,39,0.18)] text-[#e8c058] shadow-[0_0_16px_-4px_rgba(201,162,39,0.40)]"
                            : "border-[rgba(201,162,39,0.20)] text-[#8fa0c0] hover:border-[#c9a227] hover:text-white")}>
                        {pt === "Both" ? "Both (Hardware & Software)" : pt}
                      </button>
                    ))}
                  </div>
                  {form.projectType && (
                    <p className="mt-2 text-xs text-[#6a80a0]">
                      {form.projectType === "Hardware" && "Next step will collect your hardware project details."}
                      {form.projectType === "Software" && "Next step will collect your software project details."}
                      {form.projectType === "Both" && "Next step will collect both hardware & software project details."}
                    </p>
                  )}
                </Field>
              </div>
            )}

            {/* ── Step 4: Dynamic project fields ── */}
            {step === 3 && (
              <div className="flex flex-col gap-5">
                {/* Common to all project types */}
                <Field label="Project Title">
                  <input value={form.projectTitle}
                    onChange={(e) => set("projectTitle", e.target.value)}
                    placeholder="Enter your project title" className={inputCls} required />
                </Field>
                <Field label="Project Brief Description">
                  <textarea value={form.projectDesc}
                    onChange={(e) => set("projectDesc", e.target.value)}
                    placeholder="Briefly describe your project idea..."
                    rows={4} className={textareaCls} required />
                </Field>

                {/* ── Hardware-specific ── */}
                {(form.projectType === "Hardware" || form.projectType === "Both") && (
                  <Field label="Hardware Domain">
                    <select value={form.hwDomain}
                      onChange={(e) => set("hwDomain", e.target.value)}
                      className={selectCls} required>
                      <option value="">Choose hardware domain</option>
                      {HARDWARE_DOMAINS.map((d) => <option key={d} value={d}>{d}</option>)}
                    </select>
                  </Field>
                )}

                {/* ── Software-specific ── */}
                {(form.projectType === "Software" || form.projectType === "Both") && (
                  <Field label="Software Domain">
                    <select value={form.swDomain}
                      onChange={(e) => set("swDomain", e.target.value)}
                      className={selectCls} required>
                      <option value="">Choose software domain</option>
                      {SOFTWARE_DOMAINS.map((d) => <option key={d} value={d}>{d}</option>)}
                    </select>
                  </Field>
                )}

                {/* GitHub Profile — Hardware & Software */}
                {(form.projectType === "Hardware" || form.projectType === "Software") && (
                  <Field label={`GitHub Profile URL${form.projectType === "Software" ? "" : " (Optional)"}`}
                    hint="Your personal GitHub profile">
                    <input type="url" value={form.githubProfile}
                      onChange={(e) => set("githubProfile", e.target.value)}
                      placeholder="https://github.com/username"
                      className={inputCls}
                      required={form.projectType === "Software"} />
                  </Field>
                )}

                {/* GitHub Repo — Software & Both */}
                {(form.projectType === "Software" || form.projectType === "Both") && (
                  <Field label="GitHub Repository URL"
                    hint="Repository that demonstrates your domain">
                    <input type="url" value={form.githubRepo}
                      onChange={(e) => set("githubRepo", e.target.value)}
                      placeholder="https://github.com/username/repo"
                      className={inputCls} required />
                  </Field>
                )}

                {/* YouTube — Hardware & Both (optional) */}
                {(form.projectType === "Hardware" || form.projectType === "Both") && (
                  <Field label="YouTube Demo Link (Optional)" hint="Unlisted video link">
                    <input type="url" value={form.youtube}
                      onChange={(e) => set("youtube", e.target.value)}
                      placeholder="https://youtu.be/..." className={inputCls} />
                  </Field>
                )}

                {/* Google Drive PPT — all types */}
                <Field label="Google Drive Link for PPT"
                  hint="Share the file as publicly accessible">
                  <input type="url" value={form.driveLink}
                    onChange={(e) => set("driveLink", e.target.value)}
                    placeholder="https://drive.google.com/..."
                    className={inputCls} required />
                </Field>
              </div>
            )}

            {/* ── Step 5: Review + Declaration ── */}
            {step === 4 && (
              <div className="flex flex-col gap-5">
                {/* Common fields summary */}
                <p className="text-xs font-bold uppercase tracking-widest text-[#c9a227]">Personal & Academic</p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <ReviewRow label="Name" value={form.name} />
                  <ReviewRow label="Register No" value={form.registerNo} />
                  <ReviewRow label="Email" value={form.email} />
                  <ReviewRow label="Phone" value={form.phone} />
                  <ReviewRow label="Department" value={form.department} />
                  <ReviewRow label="Year" value={form.year} />
                  <ReviewRow label="Section" value={form.section} />
                  <ReviewRow label="Gender" value={form.gender} />
                  <ReviewRow label="Languages" value={form.languages.join(", ")} />
                  <ReviewRow label="Project Type" value={form.projectType} />
                </div>
                <ReviewRow label="LinkedIn" value={form.linkedin} link />

                {/* Project details summary */}
                <p className="mt-2 text-xs font-bold uppercase tracking-widest text-[#c9a227]">Project Details</p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <ReviewRow label="Project Title" value={form.projectTitle} />
                  {form.swDomain && <ReviewRow label="Software Domain" value={form.swDomain} />}
                  {form.hwDomain && <ReviewRow label="Hardware Domain" value={form.hwDomain} />}
                  {form.githubProfile && <ReviewRow label="GitHub Profile" value={form.githubProfile} link />}
                  {form.githubRepo && <ReviewRow label="GitHub Repo" value={form.githubRepo} link />}
                  {form.youtube && <ReviewRow label="YouTube" value={form.youtube} link />}
                  {form.driveLink && <ReviewRow label="Drive PPT" value={form.driveLink} link />}
                </div>
                {form.projectDesc && (
                  <div className="rounded-lg border border-[rgba(201,162,39,0.20)] bg-[#0d1a35] px-3.5 py-3">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-[#8fa0c0]">Project Description</p>
                    <p className="mt-1 text-sm text-white">{form.projectDesc}</p>
                  </div>
                )}

                {/* Password notice */}
                <div className="rounded-xl border border-[rgba(201,162,39,0.30)] bg-[rgba(201,162,39,0.07)] px-4 py-3">
                  <p className="text-sm text-[#e8c058] font-semibold">🔑 Login password</p>
                  <p className="mt-1 text-xs text-[#8fa0c0]">
                    Your login password will be automatically set to your{" "}
                    <span className="font-bold text-white">Register Number</span>{" "}
                    (<code className="rounded bg-[#0d1a35] px-1 py-0.5 font-mono text-[#c9a227]">
                      {form.registerNo.toUpperCase() || "e.g. 711522CS001"}
                    </code>).
                    Keep it safe.
                  </p>
                </div>

                {/* Declaration checkbox */}
                <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-[rgba(201,162,39,0.25)] bg-[#0d1a35] p-4">
                  <input type="checkbox" checked={form.declared}
                    onChange={(e) => set("declared", e.target.checked)}
                    className="mt-0.5 size-4 shrink-0 accent-[#c9a227] cursor-pointer" />
                  <span className="text-sm leading-relaxed text-[#c0cce0]">
                    I hereby declare that all the information provided in this registration form is{" "}
                    <strong className="text-white">true, accurate, and complete</strong>. I understand that my{" "}
                    <strong className="text-[#c9a227]">Register Number</strong> will serve as my login password.
                  </span>
                </label>
              </div>
            )}

          </div>{/* end inner section */}
        </div>{/* end article */}

        {/* ── Navigation buttons ── */}
        <div className="mt-8 flex items-center justify-between border-t border-[rgba(201,162,39,0.15)] pt-6">
          <button type="button" onClick={back} disabled={step === 0 || busy}
            className="rounded-lg px-4 py-2 text-sm font-semibold text-[#8fa0c0] transition-colors hover:text-white disabled:pointer-events-none disabled:opacity-40">
            Back
          </button>
          {step < steps.length - 1 ? (
            <button type="button" onClick={next}
              className="rounded-lg bg-[#c9a227] px-6 py-2 text-sm font-bold text-[#06090f] transition-colors hover:bg-[#e8c058]">
              Next
            </button>
          ) : (
            <button type="submit" disabled={busy || !form.declared}
              className="inline-flex items-center gap-2 rounded-lg bg-[#c9a227] px-6 py-2 text-sm font-bold text-[#06090f] transition-colors hover:bg-[#e8c058] disabled:pointer-events-none disabled:opacity-50">
              {busy && <span className="size-3.5 animate-spin rounded-full border-2 border-[#06090f] border-t-transparent" />}
              Submit Registration
            </button>
          )}
        </div>
      </form>
    </div>
  );
}

// ── Field wrapper ─────────────────────────────────────────────────────────────
function Field({ label, hint, children }: {
  label: string; hint?: string; children: React.ReactNode;
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

// ── Review row ────────────────────────────────────────────────────────────────
function ReviewRow({ label, value, link }: { label: string; value: string; link?: boolean }) {
  if (!value) return null;
  return (
    <div className="rounded-lg border border-[rgba(201,162,39,0.20)] bg-[#0d1a35] px-3.5 py-2.5">
      <p className="text-[10px] font-bold uppercase tracking-widest text-[#8fa0c0]">{label}</p>
      {link ? (
        <a href={value} target="_blank" rel="noopener noreferrer"
          className="block truncate text-sm font-semibold text-[#c9a227] hover:underline">
          {value}
        </a>
      ) : (
        <p className="truncate text-sm font-semibold text-white">{value}</p>
      )}
    </div>
  );
}
