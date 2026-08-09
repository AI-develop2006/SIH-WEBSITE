"use client";

import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { assertSupabase, isSupabaseConfigured } from "@/lib/supabase/client";
import { ensureProfile, checkRegisterNoExists, checkEmailExists, checkPhoneExists } from "@/lib/data";
import { useToast } from "@/components/unlumen-ui/toast";
import { Button } from "@/components/unlumen-ui/button";
import { Input, Select } from "@/components/unlumen-ui/input";
import { cn } from "@/lib/utils";
import { DEPARTMENTS, YEARS, LANGUAGE_OPTIONS, PROJECT_TYPES, HARDWARE_ROLES, SOFTWARE_ROLES } from "@/lib/constants";

const STEPS = [
  { n: 1, title: "Personal details", subtitle: "Your name and contact information" },
  { n: 2, title: "Academic details", subtitle: "Department, year, section and gender" },
  { n: 3, title: "Skills & domain interest", subtitle: "Languages, LinkedIn and your domain roles" },
  { n: 4, title: "Project details", subtitle: "Project type and submission links" },
  { n: 5, title: "SIH History", subtitle: "Prior hackathon participation details" },
  { n: 6, title: "Account & review", subtitle: "Confirm details and submit" },
];

const HARDWARE_DOMAINS = [
  "IoT & Sensors",
  "Embedded Systems & Microcontrollers",
  "Circuit Design & PCB Layout",
  "Smart Automation & Industrial Control",
  "Robotics & Drones",
  "Edge AI ",
  "Others"
];

const SOFTWARE_DOMAINS = [
  "Frontend",
  "Backend",
  "AI/ML",
  "Cybersecurity / Blockchain",
  "Full Stack",
  "Cloud / DevOps",
  "Mobile App Development",
  "Others"
];

type FormState = {
  name: string;
  registerNo: string;
  email: string;
  phone: string;
  password?: string;
  confirmPassword?: string;
  department: string;
  year: string;
  section: string;
  gender: string;
  languages: string[];
  linkedin: string;
  resumeLink: string;
  domainInterests: string[];
  otherRolesText: string;
  projectType: string;
  // Project specific fields
  projectTitle: string;
  projectDescription: string;
  githubProfile: string;
  youtubeLink: string;
  hardwareDomain: string[];
  softwareDomain: string[];
  otherSoftwareText: string;
  otherHardwareText: string;
  googleDrivePpt: string;
  githubRepo: string;
  declared: boolean;
  // SIH History Questionnaire
  sihParticipant: boolean | null;
  sihNumParticipations: string;
  sihParticipationYear: string;
  sihProblemStatement: string;
  sihProjectDomain: string;
  sihProjectRole: string;
  sihPositionReached: string;
  sihNodalCenter: string;
};

const INITIAL: FormState = {
  name: "",
  registerNo: "",
  email: "",
  phone: "",
  password: "",
  confirmPassword: "",
  department: "",
  year: "",
  section: "",
  gender: "",
  languages: [],
  linkedin: "",
  resumeLink: "",
  domainInterests: [],
  otherRolesText: "",
  projectType: "",
  projectTitle: "",
  projectDescription: "",
  githubProfile: "",
  youtubeLink: "",
  hardwareDomain: [],
  softwareDomain: [],
  otherSoftwareText: "",
  otherHardwareText: "",
  googleDrivePpt: "",
  githubRepo: "",
  declared: false,
  sihParticipant: null,
  sihNumParticipations: "",
  sihParticipationYear: "",
  sihProblemStatement: "",
  sihProjectDomain: "",
  sihProjectRole: "",
  sihPositionReached: "",
  sihNodalCenter: "",
};

export function RegisterForm() {
  const navigate = useNavigate();
  const toast = useToast();
  const configured = isSupabaseConfigured();

  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [showSync, setShowSync] = useState(false);
  const [form, setForm] = useState<FormState>(INITIAL);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = 0;
    }
  }, [step]);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const toggleLanguage = (lang: string) =>
    set("languages", form.languages.includes(lang) ? form.languages.filter((l) => l !== lang) : [...form.languages, lang]);

  function validateStep(s: number): string | null {
    if (s === 0) {
      if (!form.name.trim()) return "Enter your full name";
      if (form.name.trim().length < 3) return "Name must be at least 3 characters";
      if (!form.registerNo.trim()) return "Enter your register number";
      if (!/^[a-zA-Z0-9._%+-]+@smvec\.ac\.in$/i.test(form.email.trim())) {
        return "Enter a valid SMVEC college email address (ending with @smvec.ac.in)";
      }
      if (!/^[6-9]\d{9}$/.test(form.phone.replace(/\s/g, ""))) return "Enter a valid 10-digit phone number";
    }
    if (s === 1) {
      if (!form.department) return "Select your department";
      if (!form.year) return "Select your year";
      if (!form.section.trim()) return "Enter your section";
      if (!form.gender) return "Select your gender";
      if (!form.password) return "Create a password";
      if (form.password.length < 6) return "Password must be at least 6 characters";
      if (form.password !== form.confirmPassword) return "Passwords do not match";
    }
    if (s === 2) {
      if (form.languages.length === 0) return "Select at least one language you know";
      if (form.linkedin.trim() && !/^https?:\/\/(www\.)?linkedin\.com\/in\/[\w-]{3,100}\/?$/.test(form.linkedin.trim())) {
        return "Enter a valid LinkedIn profile URL (e.g. https://www.linkedin.com/in/yourname)";
      }
      if (!form.resumeLink.trim() || !/^https?:\/\/[\w.-]/.test(form.resumeLink.trim())) {
        return "Enter a valid Resume URL (Google Drive/OneDrive link)";
      }
      if (form.domainInterests.length === 0 && !form.otherRolesText.trim()) {
        return "Select at least one domain interest role or type a custom role";
      }
    }
    if (s === 3) {
      if (!form.projectType) return "Select your project type";
      if (!form.projectTitle.trim()) return "Enter your project title";
      if (!form.projectDescription.trim()) return "Enter a brief project description";
      if (!/^https?:\/\/[\w.-]/.test(form.googleDrivePpt.trim())) return "Enter a valid Google Drive link for PPT";

      if (form.projectType === "Hardware") {
        if (form.hardwareDomain.length === 0) return "Select at least one hardware domain";
        if (form.hardwareDomain.includes("Others") && !form.otherHardwareText.trim()) {
          return "Please type your custom Hardware Domain";
        }
        if (form.githubProfile.trim() && !/^https?:\/\/[\w.-]/.test(form.githubProfile.trim())) {
          return "Enter a valid GitHub profile URL";
        }
        if (form.youtubeLink.trim() && !/^https?:\/\/[\w.-]/.test(form.youtubeLink.trim())) {
          return "Enter a valid YouTube unlisted video URL";
        }
      }
      if (form.projectType === "Software") {
        if (form.softwareDomain.length === 0) return "Select at least one software domain";
        if (form.softwareDomain.includes("Others") && !form.otherSoftwareText.trim()) {
          return "Please type your custom Software Domain";
        }
        if (!/^https?:\/\/[\w.-]/.test(form.githubProfile.trim())) {
          return "Enter a valid GitHub profile URL";
        }
        if (!/^https?:\/\/[\w.-]/.test(form.githubRepo.trim())) {
          return "Enter a valid GitHub repository URL";
        }
      }
      if (form.projectType === "Hardware & Software") {
        if (form.softwareDomain.length === 0) return "Select at least one software domain";
        if (form.softwareDomain.includes("Others") && !form.otherSoftwareText.trim()) {
          return "Please type your custom Software Domain";
        }
        if (form.hardwareDomain.length === 0) return "Select at least one hardware domain";
        if (form.hardwareDomain.includes("Others") && !form.otherHardwareText.trim()) {
          return "Please type your custom Hardware Domain";
        }
        if (!/^https?:\/\/[\w.-]/.test(form.githubProfile.trim())) {
          return "Enter a valid GitHub profile URL";
        }
        if (!/^https?:\/\/[\w.-]/.test(form.githubRepo.trim())) {
          return "Enter a valid GitHub repository URL";
        }
        if (form.youtubeLink.trim() && !/^https?:\/\/[\w.-]/.test(form.youtubeLink.trim())) {
          return "Enter a valid YouTube unlisted video URL";
        }
      }
    }
    if (s === 4) {
      if (form.sihParticipant === null) return "Please select whether you have participated in SIH before";
      if (form.sihParticipant) {
        if (!form.sihNumParticipations) return "Select the number of times you participated in SIH";
        if (!form.sihParticipationYear.trim() || isNaN(Number(form.sihParticipationYear.trim()))) {
          return "Enter a valid year of participation (e.g. 2024)";
        }
        if (!form.sihProblemStatement.trim()) {
          return "Enter the problem statement chosen during participation";
        }
        if (!form.sihProjectDomain) return "Select the project domain for your SIH participation";
        if (!form.sihProjectRole.trim()) {
          return "Enter your role in that project";
        }
        if (!form.sihPositionReached) return "Select the position you reached in SIH";
        const needsNodal = ["Shortlisted for SIH", "Finalist", "Runners", "Winners"].includes(form.sihPositionReached);
        if (needsNodal && !form.sihNodalCenter.trim()) {
          return "Enter the Nodal Center where the competition was held";
        }
      }
    }
    if (s === 5) {
      if (!form.declared) return "You must declare that the information is true and complete to submit";
    }
    return null;
  }

  async function next() {
    const err = validateStep(step);
    if (err) return toast("error", err);

    if (step === 0) {
      setBusy(true);
      try {
        const regCheck = await checkRegisterNoExists(form.registerNo.trim());
        if (regCheck.error) throw new Error(regCheck.error);
        if (regCheck.exists) {
          throw new Error(`Register number "${form.registerNo}" is already registered. If this is you, please log in.`);
        }

        const emailCheck = await checkEmailExists(form.email.trim());
        if (emailCheck.error) throw new Error(emailCheck.error);
        if (emailCheck.exists) {
          throw new Error(`Email address "${form.email}" is already registered. Please use a different email or log in.`);
        }

        const phoneCheck = await checkPhoneExists(form.phone.trim());
        if (phoneCheck.error) throw new Error(phoneCheck.error);
        if (phoneCheck.exists) {
          throw new Error(`Phone number "${form.phone}" is already registered. Please use a different phone number.`);
        }
      } catch (err) {
        toast("error", err instanceof Error ? err.message : "Validation failed");
        setBusy(false);
        return;
      }
      setBusy(false);
    }

    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  }

  function back() {
    setStep((s) => Math.max(s - 1, 0));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const err = validateStep(5);
    if (err) return toast("error", err);

    setBusy(true);
    setShowSync(true);
    try {
      const supabase = assertSupabase();
      const registerNoUpper = form.registerNo.trim().toUpperCase();

      const getFinalSoftwareDomainList = () => {
        return form.softwareDomain.map(d => d === "Others" ? `Others: ${form.otherSoftwareText.trim()}` : d);
      };
      const getFinalHardwareDomainList = () => {
        return form.hardwareDomain.map(d => d === "Others" ? `Others: ${form.otherHardwareText.trim()}` : d);
      };

      const finalSoftwareDomain = getFinalSoftwareDomainList().join(", ");
      const finalHardwareDomain = getFinalHardwareDomainList().join(", ");

      let finalDomain = "";
      let finalGithub = "";
      let finalGithubRepo = "";

      if (form.projectType === "Hardware") {
        finalDomain = finalHardwareDomain;
        finalGithub = form.githubProfile.trim();
      } else if (form.projectType === "Software") {
        finalDomain = finalSoftwareDomain;
        finalGithub = form.githubProfile.trim();
        finalGithubRepo = form.githubRepo.trim();
      } else if (form.projectType === "Hardware & Software") {
        finalDomain = `SW: ${finalSoftwareDomain} | HW: ${finalHardwareDomain}`;
        finalGithub = form.githubProfile.trim();
        finalGithubRepo = form.githubRepo.trim();
      }

      const meta = {
        name: form.name.trim().toUpperCase(),
        register_no: registerNoUpper,
        email: form.email.trim(),
        phone: form.phone.trim(),
        department: form.department,
        year: form.year,
        section: form.section.trim(),
        gender: form.gender,
        languages: form.languages,
        linkedin: form.linkedin.trim(),
        resume_link: form.resumeLink.trim(),
        domain_interests: [
          ...form.domainInterests,
          ...(form.otherRolesText.trim() ? form.otherRolesText.split(",").map(r => r.trim()).filter(Boolean) : [])
        ],
        project_type: form.projectType,
        role: "student",
        project_title: form.projectTitle.trim(),
        project_description: form.projectDescription.trim(),
        youtube_link: form.youtubeLink.trim() || null,
        google_drive_ppt: form.googleDrivePpt.trim(),
        software_domain: finalSoftwareDomain || null,
        hardware_domain: finalHardwareDomain || null,
        domain: finalDomain,
        github: finalGithub || null,
        github_repo: finalGithubRepo || null,
        // SIH Questionnaire
        sih_participant: form.sihParticipant,
        sih_num_participations: form.sihParticipant ? Number(form.sihNumParticipations) : null,
        sih_participation_year: form.sihParticipant && form.sihParticipationYear ? Number(form.sihParticipationYear) : null,
        sih_problem_statement: form.sihParticipant ? form.sihProblemStatement.trim() : null,
        sih_project_domain: form.sihParticipant ? form.sihProjectDomain : null,
        sih_project_role: form.sihParticipant ? form.sihProjectRole.trim() : null,
        sih_position_reached: form.sihParticipant ? form.sihPositionReached : null,
        sih_nodal_center: (form.sihParticipant && ["Shortlisted for SIH", "Finalist", "Runners", "Winners"].includes(form.sihPositionReached)) ? form.sihNodalCenter.trim() : null,
      };

      const { data, error } = await supabase.auth.signUp({
        email: form.email.trim(),
        password: form.password || registerNoUpper,
        options: { data: meta },
      });
      if (error) throw new Error(error.message);

      if (data.user) {
        try {
          await ensureProfile(data.user.id, meta);
        } catch (profileErr) {
          console.warn("Non-fatal profile upsert warning (handled by database trigger):", profileErr);
        }
      }

      // satisfying feedback delay
      await new Promise((resolve) => setTimeout(resolve, 2600));

      if (data.session) {
        toast("success", "Registration complete — welcome to SIH 2026!");
        navigate("/dashboard");
      } else {
        toast("info", "Check your inbox to confirm your email, then log in using your register number.");
        navigate("/login");
      }
    } catch (err) {
      setShowSync(false);
      toast("error", err instanceof Error ? err.message : "Registration failed");
    } finally {
      setBusy(false);
    }
  }

  const progress = ((step + 1) / STEPS.length) * 100;

  if (showSync) {
    return (
      <div className="flex min-h-[55vh] flex-col items-center justify-center py-10 text-center relative overflow-hidden">
        {/* Particle data streams */}
        <div aria-hidden="true" className="absolute inset-0 pointer-events-none">
          {Array.from({ length: 12 }).map((_, i) => (
            <span
              key={i}
              className="animate-packet absolute size-1.5 rounded-full bg-primary"
              style={{
                left: `${20 + i * 5 + Math.sin(i) * 5}%`,
                top: `${10 + (i * 2) % 20}%`,
                animationDelay: `${i * 0.18}s`,
                "--drift-x": `${Math.cos(i) * 30}px`,
              } as React.CSSProperties}
            />
          ))}
        </div>

        {/* Sync Status Frame */}
        <div className="flex flex-col items-center gap-1.5 max-w-sm">
          {/* Glowing check node */}
          <div className="relative flex size-20 items-center justify-center rounded-3xl border border-primary/20 bg-card shadow-2xl">
            <span className="absolute inset-0 rounded-3xl bg-primary/5 blur-lg animate-pulse" />
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-primary animate-bounce">
              <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
            </svg>
          </div>

          <h3 className="text-lg font-black text-foreground mt-6">Establishing Student Account</h3>
          <p className="text-xs text-muted-foreground leading-relaxed mt-2">
            Provisioning your credentials in the college registry. Please do not close or reload this window.
          </p>

          <div className="mt-8 flex items-center gap-6 rounded-2xl border border-border bg-card/45 px-5 py-4">
            <div className="text-left leading-tight">
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Reg No</p>
              <p className="text-sm font-black text-foreground">{form.registerNo.toUpperCase()}</p>
            </div>
            <div className="h-6 w-[1px] bg-border" />
            <div className="text-left leading-tight">
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Dept</p>
              <p className="text-sm font-black text-foreground">{form.department.split(" ").map(w => w[0]).join("") || "CSE"}</p>
            </div>
          </div>
        </div>

        {/* Holographic Database Cylinder/Bucket */}
        <div className="animate-vault-pulse mt-24 relative w-44 h-32 rounded-b-[2rem] border-2 border-primary/40 bg-card/65 backdrop-blur-lg flex flex-col items-center justify-center shadow-xl">
          <div className="absolute -top-3 w-40 h-6 rounded-full border border-primary/50 bg-[#050b18]/85 flex items-center justify-center overflow-hidden">
            <div className="w-full h-[2px] bg-gradient-to-r from-transparent via-primary to-transparent animate-pulse" />
          </div>
          <div className="absolute inset-x-0 bottom-4 flex justify-center gap-1.5 opacity-60">
            <span className="size-1 rounded-full bg-primary animate-bounce" style={{ animationDelay: "100ms" }} />
            <span className="size-1 rounded-full bg-primary animate-bounce" style={{ animationDelay: "200ms" }} />
            <span className="size-1 rounded-full bg-primary animate-bounce" style={{ animationDelay: "300ms" }} />
          </div>
          <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground mt-3">SIH Data Core</span>
          <span className="text-xs font-bold text-primary animate-pulse">Syncing Portal...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col">
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

      <form onSubmit={submit} className="flex flex-col justify-start">
        <article ref={scrollRef} className="divide-y divide-border flex flex-col pr-1">
          <section className="py-6 flex flex-col justify-start">
            <div className="mb-5 flex items-baseline justify-between gap-3">
              <h2 className="text-lg font-semibold tracking-tight">Section {STEPS[step].n} of {STEPS.length}</h2>
              <span className="text-[11px] font-semibold uppercase tracking-widest text-[#dba328]">
                Required <span className="text-danger">*</span>
              </span>
            </div>

            {/* Steps slider wrapper */}
            <div className="relative overflow-hidden w-full">
              <div
                className="flex items-start transition-transform duration-500 ease-out-expo"
                style={{
                  transform: `translateX(-${step * 100}%)`,
                }}
              >
                {/* Step 0: Personal details */}
                <div className={cn("w-full shrink-0 flex flex-col gap-4 transition-all duration-300", step !== 0 && "h-0 overflow-hidden opacity-0 pointer-events-none")}>
                  <Field label="Name (Full Name in Capital)" required hint="Eg. NAVEEN K">
                    <Input
                      value={form.name}
                      onChange={(e) => set("name", e.target.value.toUpperCase())}
                      placeholder="Eg. NAVEEN K"
                      className="uppercase"
                      required={step === 0}
                    />
                  </Field>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Register No" required hint="Eg. 24UAI123">
                      <Input
                        value={form.registerNo}
                        onChange={(e) => set("registerNo", e.target.value.toUpperCase())}
                        placeholder="Eg. 24UAI123"
                        className="uppercase"
                        required={step === 0}
                      />
                    </Field>
                    <Field label="Phone No" required>
                      <Input
                        type="tel"
                        value={form.phone}
                        onChange={(e) => set("phone", e.target.value)}
                        placeholder="9345668544"
                        required={step === 0}
                      />
                    </Field>
                  </div>
                  <Field label="College Email" required hint="We'll use this email to verify your account, so kindly use your SMVEC college email ID (ending with @smvec.ac.in) for further login process.">
                    <Input
                      type="email"
                      value={form.email}
                      onChange={(e) => set("email", e.target.value)}
                      placeholder="you@smvec.ac.in"
                      required={step === 0}
                    />
                  </Field>
                </div>

                {/* Step 1: Academic details */}
                <div className={cn("w-full shrink-0 flex flex-col gap-4 transition-all duration-300", step !== 1 && "h-0 overflow-hidden opacity-0 pointer-events-none")}>
                  <Field label="Department" required>
                    <Select value={form.department} onChange={(e) => set("department", e.target.value)} required={step === 1}>
                      <option value="" disabled>— Select Department —</option>
                      {DEPARTMENTS.map((d) => (
                        <option key={d} value={d}>
                          {d}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <div className="grid gap-4 sm:grid-cols-3">
                    <Field label="Year" required>
                      <Select value={form.year} onChange={(e) => set("year", e.target.value)} required={step === 1}>
                        <option value="" disabled>— Select Year —</option>
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
                        required={step === 1}
                      />
                    </Field>
                    <Field label="Gender" required>
                      <Select value={form.gender} onChange={(e) => set("gender", e.target.value)} required={step === 1}>
                        <option value="" disabled>— Select Gender —</option>
                        <option value="Male">Male</option>
                        <option value="Female">Female</option>
                      </Select>
                    </Field>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Password" required hint="At least 6 characters">
                      <Input
                        type="password"
                        value={form.password}
                        onChange={(e) => set("password", e.target.value)}
                        placeholder="Create a password"
                        required={step === 1}
                      />
                    </Field>
                    <Field label="Confirm Password" required>
                      <Input
                        type="password"
                        value={form.confirmPassword}
                        onChange={(e) => set("confirmPassword", e.target.value)}
                        placeholder="Confirm your password"
                        required={step === 1}
                      />
                    </Field>
                  </div>
                </div>

                {/* Step 2: Skills & Domain Interest */}
                <div className={cn("w-full shrink-0 flex flex-col gap-4 transition-all duration-300", step !== 2 && "h-0 overflow-hidden opacity-0 pointer-events-none")}>
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
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="LinkedIn profile URL (Optional)" hint="Format: https://www.linkedin.com/in/yourname">
                      <Input
                        type="url"
                        value={form.linkedin}
                        onChange={(e) => set("linkedin", e.target.value)}
                        placeholder="https://www.linkedin.com/in/yourname"
                      />
                    </Field>
                    <Field label="Resume Link" required hint="Google Drive / OneDrive shared link">
                      <Input
                        type="url"
                        value={form.resumeLink}
                        onChange={(e) => set("resumeLink", e.target.value)}
                        placeholder="https://drive.google.com/..."
                        required={step === 2}
                      />
                    </Field>
                  </div>

                  {/* Domain Interest 3-category multi-select */}
                  <Field label="Domain Interest" required hint="Select all roles that match your experience (multiple allowed)">
                    <div className="flex flex-col gap-4">
                      {/* Hardware Roles */}
                      <div>
                        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-amber-400/80 flex items-center gap-1.5">
                          <span>🔧</span> Hardware Roles
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {HARDWARE_ROLES.map((role) => (
                            <button
                              key={role}
                              type="button"
                              onClick={() => set("domainInterests", form.domainInterests.includes(role) ? form.domainInterests.filter((r) => r !== role) : [...form.domainInterests, role])}
                              className={cn(
                                "rounded-full border px-3.5 py-1.5 text-xs font-medium transition-all",
                                form.domainInterests.includes(role)
                                  ? "border-amber-500/60 bg-amber-500/15 text-amber-400 shadow-[0_0_10px_-4px_rgba(245,158,11,0.5)]"
                                  : "border-border text-muted-foreground hover:border-amber-500/40 hover:text-amber-300"
                              )}
                            >
                              {role}
                            </button>
                          ))}
                        </div>
                      </div>
                      {/* Software Roles */}
                      <div>
                        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-blue-400/80 flex items-center gap-1.5">
                          <span>💻</span> Software Roles
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {SOFTWARE_ROLES.map((role) => (
                            <button
                              key={role}
                              type="button"
                              onClick={() => set("domainInterests", form.domainInterests.includes(role) ? form.domainInterests.filter((r) => r !== role) : [...form.domainInterests, role])}
                              className={cn(
                                "rounded-full border px-3.5 py-1.5 text-xs font-medium transition-all",
                                form.domainInterests.includes(role)
                                  ? "border-blue-500/60 bg-blue-500/15 text-blue-400 shadow-[0_0_10px_-4px_rgba(59,130,246,0.5)]"
                                  : "border-border text-muted-foreground hover:border-blue-500/40 hover:text-blue-300"
                              )}
                            >
                              {role}
                            </button>
                          ))}
                        </div>
                      </div>
                      {/* Other Roles */}
                      <div>
                        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-purple-400/80 flex items-center gap-1.5">
                          <span>🎯</span> Other Roles (Optional)
                        </p>
                        <Input
                          type="text"
                          value={form.otherRolesText}
                          onChange={(e) => set("otherRolesText", e.target.value)}
                          placeholder="Type your custom roles (e.g. UI/UX Design, Technical Writer...)"
                        />
                      </div>
                    </div>
                    {form.domainInterests.length > 0 && (
                      <p className="mt-2 text-xs text-muted-foreground">
                        {form.domainInterests.length} role{form.domainInterests.length > 1 ? "s" : ""} selected
                      </p>
                    )}
                  </Field>
                </div>

                {/* Step 3: Project details (Dynamic Step) */}
                <div className={cn("w-full shrink-0 flex flex-col gap-4 transition-all duration-300", step !== 3 && "h-0 overflow-hidden opacity-0 pointer-events-none")}>
                  {/* Project type selector at top */}
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
                          {pt}
                        </button>
                      ))}
                    </div>
                  </Field>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Project Title" required>
                      <Input
                        value={form.projectTitle}
                        onChange={(e) => set("projectTitle", e.target.value)}
                        placeholder="Enter your project title"
                        required={step === 3}
                      />
                    </Field>
                    <Field label="Google Drive Link for PPT" required>
                      <Input
                        type="url"
                        value={form.googleDrivePpt}
                        onChange={(e) => set("googleDrivePpt", e.target.value)}
                        placeholder="https://drive.google.com/..."
                        required={step === 3}
                      />
                    </Field>
                  </div>

                  <Field label="Project Brief Description" required>
                    <textarea
                      value={form.projectDescription}
                      onChange={(e) => set("projectDescription", e.target.value)}
                      placeholder="Describe your project's problem statement, tech stack, and workflow..."
                      className="w-full min-h-[100px] rounded-lg border border-border bg-input px-3.5 py-2.5 text-sm text-foreground placeholder-muted-foreground outline-none transition-all focus:border-ring/50 focus:shadow-[0_0_12px_-4px_rgba(201,162,39,0.3)]"
                      required={step === 3}
                    />
                  </Field>

                  {/* Conditional hardware fields */}
                  {(form.projectType === "Hardware" || form.projectType === "Hardware & Software") && (
                    <div className="flex flex-col gap-3">
                      <Field label="Hardware Domain" required hint="Select all that apply">
                        <div className="flex flex-wrap gap-2">
                          {HARDWARE_DOMAINS.map((hd) => (
                            <button
                              key={hd}
                              type="button"
                              onClick={() => set("hardwareDomain", form.hardwareDomain.includes(hd) ? form.hardwareDomain.filter((d) => d !== hd) : [...form.hardwareDomain, hd])}
                              className={cn(
                                "rounded-full border px-3.5 py-1.5 text-xs font-medium transition-all",
                                form.hardwareDomain.includes(hd)
                                  ? "border-amber-500/60 bg-amber-500/15 text-amber-400 shadow-[0_0_10px_-4px_rgba(245,158,11,0.5)]"
                                  : "border-border text-muted-foreground hover:border-amber-500/40 hover:text-amber-300"
                              )}
                            >
                              {hd}
                            </button>
                          ))}
                        </div>
                        {form.hardwareDomain.includes("Others") && (
                          <div className="mt-2">
                            <Input
                              type="text"
                              value={form.otherHardwareText}
                              onChange={(e) => set("otherHardwareText", e.target.value)}
                              placeholder="Type custom hardware domain..."
                              required={step === 3 && form.hardwareDomain.includes("Others")}
                            />
                          </div>
                        )}
                        {form.hardwareDomain.length > 0 && (
                          <p className="mt-1 text-xs text-muted-foreground">{form.hardwareDomain.length} selected</p>
                        )}
                      </Field>
                      {form.projectType === "Hardware" && (
                        <Field label="GitHub Profile Link (Optional)" hint="Your GitHub profile must be set to Public">
                          <Input
                            type="url"
                            value={form.githubProfile}
                            onChange={(e) => set("githubProfile", e.target.value)}
                            placeholder="https://github.com/username"
                          />
                        </Field>
                      )}
                    </div>
                  )}

                  {/* Conditional software fields */}
                  {(form.projectType === "Software" || form.projectType === "Hardware & Software") && (
                    <div className="flex flex-col gap-3">
                      <Field label="Software Domain" required hint="Select all that apply">
                        <div className="flex flex-wrap gap-2">
                          {SOFTWARE_DOMAINS.map((sd) => (
                            <button
                              key={sd}
                              type="button"
                              onClick={() => set("softwareDomain", form.softwareDomain.includes(sd) ? form.softwareDomain.filter((d) => d !== sd) : [...form.softwareDomain, sd])}
                              className={cn(
                                "rounded-full border px-3.5 py-1.5 text-xs font-medium transition-all",
                                form.softwareDomain.includes(sd)
                                  ? "border-blue-500/60 bg-blue-500/15 text-blue-400 shadow-[0_0_10px_-4px_rgba(59,130,246,0.5)]"
                                  : "border-border text-muted-foreground hover:border-blue-500/40 hover:text-blue-300"
                              )}
                            >
                              {sd}
                            </button>
                          ))}
                        </div>
                        {form.softwareDomain.includes("Others") && (
                          <div className="mt-2">
                            <Input
                              type="text"
                              value={form.otherSoftwareText}
                              onChange={(e) => set("otherSoftwareText", e.target.value)}
                              placeholder="Type custom software domain..."
                              required={step === 3 && form.softwareDomain.includes("Others")}
                            />
                          </div>
                        )}
                        {form.softwareDomain.length > 0 && (
                          <p className="mt-1 text-xs text-muted-foreground">{form.softwareDomain.length} selected</p>
                        )}
                      </Field>
                      <Field label="GitHub Repository URL" required hint="⚠️ Your repository must be set to Public on GitHub">
                        <Input
                          type="url"
                          value={form.githubRepo}
                          onChange={(e) => set("githubRepo", e.target.value)}
                          placeholder="https://github.com/username/project"
                          required={step === 3 && (form.projectType === "Software" || form.projectType === "Hardware & Software")}
                        />
                      </Field>
                    </div>
                  )}

                  {/* GitHub Profile for Software and Hardware & Software (Required) */}
                  {(form.projectType === "Software" || form.projectType === "Hardware & Software") && (
                    <Field label="GitHub Profile Link" required hint="Your GitHub profile must be set to Public">
                      <Input
                        type="url"
                        value={form.githubProfile}
                        onChange={(e) => set("githubProfile", e.target.value)}
                        placeholder="https://github.com/username"
                        required={step === 3 && (form.projectType === "Software" || form.projectType === "Hardware & Software")}
                      />
                    </Field>
                  )}

                  {/* YouTube unlisted link for Hardware/Hardware & Software */}
                  {(form.projectType === "Hardware" || form.projectType === "Hardware & Software") && (
                    <Field label="YouTube Link (Unlisted video demonstration) (Optional)">
                      <Input
                        type="url"
                        value={form.youtubeLink}
                        onChange={(e) => set("youtubeLink", e.target.value)}
                        placeholder="https://youtube.com/watch?v=..."
                      />
                    </Field>
                  )}
                </div>

                {/* Step 4: SIH History Questionnaire */}
                <div className={cn("w-full shrink-0 flex flex-col gap-4 transition-all duration-300", step !== 4 && "h-0 overflow-hidden opacity-0 pointer-events-none")}>
                  <Field label="Have you participated in SIH (Smart India Hackathon) before?" required>
                    <Select
                      value={form.sihParticipant === null ? "" : form.sihParticipant ? "Yes" : "No"}
                      onChange={(e) => {
                        const val = e.target.value;
                        set("sihParticipant", val === "" ? null : val === "Yes");
                      }}
                      required={step === 4}
                    >
                      <option value="" disabled>— Select —</option>
                      <option value="No">No</option>
                      <option value="Yes">Yes</option>
                    </Select>
                  </Field>

                  {form.sihParticipant && (
                    <div className="flex flex-col gap-4 animate-page-enter">
                      <div className="grid gap-4 sm:grid-cols-2">
                        <Field label="No. of times participated" required>
                          <Select
                            value={form.sihNumParticipations}
                            onChange={(e) => set("sihNumParticipations", e.target.value)}
                            required={step === 4 && form.sihParticipant}
                          >
                            <option value="" disabled>— Select —</option>
                            <option value="1">1 time</option>
                            <option value="2">2 times</option>
                            <option value="3">3 times or more</option>
                          </Select>
                        </Field>
                        <Field label="Year of Participation" required hint="e.g. 2024">
                          <Input
                            type="number"
                            value={form.sihParticipationYear}
                            onChange={(e) => set("sihParticipationYear", e.target.value)}
                            placeholder="e.g. 2024"
                            required={step === 4 && form.sihParticipant}
                          />
                        </Field>
                      </div>

                      <Field label="Problem Statement Chosen" required hint="The title or PS code you worked on">
                        <Input
                          value={form.sihProblemStatement}
                          onChange={(e) => set("sihProblemStatement", e.target.value)}
                          placeholder="e.g. Smart Traffic Management System (SIH1450)"
                          required={step === 4 && form.sihParticipant}
                        />
                      </Field>

                      <div className="grid gap-4 sm:grid-cols-2">
                        <Field label="Project Domain" required>
                          <Select
                            value={form.sihProjectDomain}
                            onChange={(e) => set("sihProjectDomain", e.target.value)}
                            required={step === 4 && form.sihParticipant}
                          >
                            <option value="" disabled>— Select Domain —</option>
                            <option value="Software">Software</option>
                            <option value="Hardware">Hardware</option>
                            <option value="Both">Both (Hardware & Software)</option>
                          </Select>
                        </Field>
                        <Field label="Role in that Project" required>
                          <Input
                            value={form.sihProjectRole}
                            onChange={(e) => set("sihProjectRole", e.target.value)}
                            placeholder="e.g. Frontend Developer / Team Leader"
                            required={step === 4 && form.sihParticipant}
                          />
                        </Field>
                      </div>

                      <Field label="Position Reached" required>
                        <Select
                          value={form.sihPositionReached}
                          onChange={(e) => set("sihPositionReached", e.target.value)}
                          required={step === 4 && form.sihParticipant}
                        >
                          <option value="" disabled>— Select Position —</option>
                          <option value="Participated">Participated</option>
                          <option value="Shortlisted in Internal Hackathon">Shortlisted in Internal Hackathon</option>
                          <option value="Shortlisted for SIH">Shortlisted for SIH (Main Round)</option>
                          <option value="Finalist">Finalist</option>
                          <option value="Runners">Runners</option>
                          <option value="Winners">Winners</option>
                        </Select>
                      </Field>

                      {["Shortlisted for SIH", "Finalist", "Runners", "Winners"].includes(form.sihPositionReached) && (
                        <Field label="Nodal Center Name" required hint="Where the final SIH competition was hosted">
                          <Input
                            value={form.sihNodalCenter}
                            onChange={(e) => set("sihNodalCenter", e.target.value)}
                            placeholder="e.g. IIT Kharagpur / LPU Punjab"
                            required={step === 4 && form.sihParticipant}
                          />
                        </Field>
                      )}
                    </div>
                  )}
                </div>

                {/* Step 5: Review & declaration */}
                <div className={cn("w-full shrink-0 flex flex-col gap-4 transition-all duration-300", step !== 5 && "h-0 overflow-hidden opacity-0 pointer-events-none")}>
                  <ReviewRow label="Name" value={form.name} />
                  <div className="grid gap-4 sm:grid-cols-2">
                    <ReviewRow label="Register No" value={form.registerNo} />
                    <ReviewRow label="Email" value={form.email} />
                    <ReviewRow label="Phone" value={form.phone} />
                    <ReviewRow label="Department" value={form.department} />
                    <ReviewRow label="Year" value={form.year} />
                    <ReviewRow label="Section" value={form.section} />
                    <ReviewRow label="Gender" value={form.gender} />
                    <ReviewRow label="Languages known" value={form.languages.join(", ")} />
                    <ReviewRow label="Domain Interests" value={[...form.domainInterests, ...(form.otherRolesText.trim() ? [form.otherRolesText.trim()] : [])].join(", ")} />
                    <ReviewRow label="Project type" value={form.projectType} />
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <ReviewRow label="LinkedIn profile" value={form.linkedin} link />
                    <ReviewRow label="Resume Link" value={form.resumeLink} link />
                  </div>

                  {form.sihParticipant && (
                    <div className="mt-2 border-t border-border/60 pt-4 flex flex-col gap-3 text-left">
                      <p className="text-xs font-black uppercase tracking-wider text-purple-400">SIH Participation History</p>
                      <div className="grid gap-4 sm:grid-cols-2 bg-muted/20 p-3 rounded-lg border border-border/40">
                        <ReviewRow label="Times Participated" value={`${form.sihNumParticipations} time(s)`} />
                        <ReviewRow label="Year of Participation" value={form.sihParticipationYear} />
                        <ReviewRow label="Project Domain" value={form.sihProjectDomain} />
                        <ReviewRow label="Role in Project" value={form.sihProjectRole} />
                      </div>
                      <ReviewRow label="Problem Statement" value={form.sihProblemStatement} />
                      <ReviewRow label="Position Reached" value={form.sihPositionReached} />
                      {["Shortlisted for SIH", "Finalist", "Runners", "Winners"].includes(form.sihPositionReached) && form.sihNodalCenter && (
                        <ReviewRow label="Nodal Center" value={form.sihNodalCenter} />
                      )}
                    </div>
                  )}

                  {form.projectType && (
                    <div className="mt-2 border-t border-border/60 pt-4 flex flex-col gap-4">
                      <ReviewRow label="Project Title" value={form.projectTitle} />
                      <ReviewRow label="Project Description" value={form.projectDescription} />
                      <div className="grid gap-4 sm:grid-cols-2">
                        {form.hardwareDomain.length > 0 && <ReviewRow label="Hardware Domain" value={form.hardwareDomain.map(d => d === "Others" ? `Others: ${form.otherHardwareText}` : d).join(", ")} />}
                        {form.softwareDomain.length > 0 && <ReviewRow label="Software Domain" value={form.softwareDomain.map(d => d === "Others" ? `Others: ${form.otherSoftwareText}` : d).join(", ")} />}
                      </div>
                      <ReviewRow label="Google Drive PPT Link" value={form.googleDrivePpt} link />
                      {form.githubProfile && <ReviewRow label="GitHub Profile" value={form.githubProfile} link />}
                      {form.githubRepo && <ReviewRow label="GitHub Repository" value={form.githubRepo} link />}
                      {form.youtubeLink && <ReviewRow label="YouTube Unlisted Link" value={form.youtubeLink} link />}
                    </div>
                  )}

                  <div className="mt-4">
                    <label className="flex items-start gap-3 rounded-xl border border-[#dba328]/35 bg-[#dba328]/5 p-4 text-xs leading-relaxed text-foreground select-none cursor-pointer">
                      <input
                        type="checkbox"
                        checked={form.declared}
                        onChange={(e) => set("declared", e.target.checked)}
                        className="size-4 shrink-0 rounded border-border bg-card text-[#c9a227] focus:ring-[#c9a227] mt-0.5"
                      />
                      <span>
                        I hereby declare that all the information provided in this registration form is true, accurate, and complete. I understand that my Register Number and chosen password will serve as my login credentials.
                      </span>
                    </label>
                  </div>
                </div>
              </div>
            </div>
          </section>
        </article>

        <div className="mt-8 flex items-center justify-between border-t border-border pt-6">
          <Button type="button" variant="ghost" onClick={back} disabled={step === 0 || busy}>
            Back
          </Button>
          {step < STEPS.length - 1 ? (
            <Button type="button" onClick={next} loading={busy} disabled={busy}>
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
        <a href={value} target="_blank" rel="noopener noreferrer" className="text-sm font-semibold text-ring hover:underline break-all">
          {value}
        </a>
      ) : (
        <p className={cn("text-sm font-semibold", label === "Project Description" ? "whitespace-pre-wrap break-words" : "truncate")}>{value}</p>
      )}
    </div>
  );
}
