"use client";

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { animate, stagger, type JSAnimation } from "animejs";
import { supabase } from "@/lib/supabase/client";
import { useAnime } from "@/hooks/use-anime";
import { CollegeBrand } from "@/components/college-brand";
import { RuixenGradientFooter } from "@/components/ui/ruixen-gradient-footer";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/unlumen-ui/button";

const NAV_LINKS = [
  { label: "Apply", href: "/register" },
  { label: "Timeline", href: "#timeline" },
  { label: "Features", href: "#features" },
  { label: "How it works", href: "#how" },
  { label: "Rules", href: "#rules" },
  { label: "FAQ", href: "#faq" },
];

const DEPARTMENTS = [
  "Electrical and Electronics Engineering",
  "Electronics and Communication Engineering",
  "Computer Science Engineering",
  "Information Technology",
  "Instrumentation and Control Engineering",
  "Mechanical Engineering",
  "Civil Engineering",
  "Biomedical Engineering",
  "Mechatronics",
  "Artificial Intelligence and Data Science",
];

const FEATURES = [
  {
    title: "Smart team matching",
    body: "Search students by department, year, section or language and invite the people who complete your squad.",
    icon: "spark",
  },
  {
    title: "Automatic rule checks",
    body: "Server-side validation enforces the 6-member, 2-female, 2-department rules — bad teams are blocked, not just warned.",
    icon: "shield",
  },
  {
    title: "Invites & join requests",
    body: "Send invites, accept requests, and track every pending decision in one clean inbox per team.",
    icon: "inbox",
  },
  {
    title: "Live team health",
    body: "Every team shows a competition-ready badge with member count, gender balance and department spread at a glance.",
    icon: "pulse",
  },
];

const STEPS = [
  { n: "01", title: "Apply via the registration form", body: "Fill in your details — name, register no, department, year, languages, LinkedIn and project type — and create your account." },
  { n: "02", title: "Find or build your team", body: "Your team will be formed by Your mentor based on skills shortly the date will be announed later " },
  { n: "03", title: "Compete together", body: "Keep your squad rule-valid, accept join requests, and walk into SIH 2026 ready." },
];

const RULES = [
  { icon: "👥", title: "6 members max", body: "Teams can hold at most six members." },
  { icon: "♀", title: "2 female members", body: "Every team needs at least two female members." },
  { icon: "🏛", title: "2 departments", body: "Every team must span at least two departments." },
];

const QUOTES = [
  { text: "I built my whole team in one evening — the stack filter found exactly the backend and ML folks I needed.", name: "Ananya S.", role: "CSE · Team Leader" },
  { text: "The rule checks caught a 7th member invite before I even sent it. Saved us an embarrassing correction on day one.", name: "Rahul M.", role: "ECE · Member" },
  { text: "Joining a team used to mean group-chat roulette. Now it's browse, request, accept — done.", name: "Divya K.", role: "IT · Member" },
];

const FAQS = [
  { q: "What are the official team rules?", a: "Each team must have at most 6 members, at least 2 female members, and members from at least 2 different departments. Violations are blocked automatically by the backend." },
  { q: "How do I join an existing team?", a: "Open the Teams tab, pick a team, and send a join request. The team leader sees it under My Team and can accept or reject it." },
  { q: "How do I become a team leader?", a: "If you're not already in a team, use My Team to create one — you become the leader automatically and can invite members or accept requests." },
  { q: "How does teammate matching work?", a: "Every profile carries a department, year, section and preferred languages. Find Members lets you search and filter across all of them." },
  { q: "Who can use this portal?", a: "It's built for the internal SIH 2026 participant pool — students apply with their email, register number and department, then join or form teams." },
  { q: "How do I register?", a: "Hit Apply and fill in the registration form — name, register no, email, phone, department, year, section, gender, languages, LinkedIn and project type. Your email is used to log in." },
];

const ICONS: Record<string, React.ReactNode> = {
  spark: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3z" />
      <path d="M19 15l.9 2.1L22 18l-2.1.9L19 21l-.9-2.1L16 18l2.1-.9L19 15z" />
    </svg>
  ),
  shield: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3l7 3v5c0 4.5-3 8.5-7 10-4-1.5-7-5.5-7-10V6l7-3z" />
      <path d="M9 12l2 2 4-4" />
    </svg>
  ),
  inbox: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 12l3-6h12l3 6v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-5z" />
      <path d="M3 12h5l2 3h4l2-3h5" />
    </svg>
  ),
  pulse: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 12h4l2-6 4 12 2-6h6" />
    </svg>
  ),
};

export default function LandingPage() {
  const navigate = useNavigate();

  useEffect(() => {
    supabase?.auth.getSession().then(({ data }) => {
      if (data.session) navigate("/dashboard", { replace: true });
    });
  }, [navigate]);

  const heroRef = useAnime<HTMLDivElement>((el) => {
    const anims: JSAnimation[] = [];
    anims.push(
      animate(el.querySelectorAll(".reveal"), {
        translateY: [26, 0],
        opacity: [0, 1],
        duration: 750,
        ease: "outExpo",
        delay: stagger(110),
      })
    );
    return () => anims.forEach((a) => a.revert());
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <div className="bg-[#36429b] text-white">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-5 py-2 text-[11px] font-medium">
          <span className="flex items-center gap-1.5">
            <span className="hidden size-1.5 rounded-full bg-accent sm:inline-block" />
            Sri Manakula Vinayagar Engineering College
          </span>
          <div className="flex items-center gap-4">
            <span className="hidden sm:inline">Smart India Hackathon 2026 · Internal</span>
            <a
              href="https://smvec.ac.in"
              target="_blank"
              rel="noopener noreferrer"
              className="underline-offset-2 hover:underline"
            >
              smvec.ac.in ↗
            </a>
          </div>
        </div>
      </div>

      <header className="sticky top-0 z-40 border-b border-border bg-background/85 backdrop-blur">
        <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between gap-3 px-5">
          <a href="/" className="flex items-center">
            <CollegeBrand />
          </a>

          <nav className="hidden items-center gap-1 lg:flex">
            {NAV_LINKS.map((l) => (
              <a
                key={l.href}
                href={l.href}
                className="rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
              >
                {l.label}
              </a>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Button variant="ghost" className="hidden sm:inline-flex" onClick={() => navigate("/login")}>
              Log in
            </Button>
            <Button onClick={() => navigate("/register")}>Apply Now</Button>
          </div>
        </div>
      </header>

      <main>
        <section className="relative overflow-hidden">
          <div className="mx-auto w-full max-w-7xl px-5 pb-16 pt-16 sm:pt-24">
            <div ref={heroRef} className="mx-auto flex max-w-3xl flex-col items-center gap-6 text-center">
              <span className="reveal inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
                <span className="size-1.5 rounded-full bg-success animate-pulse" />
                Smart India Hackathon 2026 · SMVEC Internal
              </span>

              <h1 className="reveal text-4xl font-bold leading-[1.08] tracking-tight text-foreground sm:text-6xl">
                Build your winning SIH team,
                <br />
                <span className="text-gradient">not your stress.</span>
              </h1>

              <p className="reveal max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">
                Apply once, match with teammates by department and language, form balanced
                teams, and keep every squad competition-ready with automatic rule checks.
              </p>

              <div className="reveal flex flex-wrap items-center justify-center gap-3">
                <Button onClick={() => navigate("/register")} className="px-6 py-2.5">
                  Apply Now
                </Button>
                <Button variant="outline" className="px-6 py-2.5" onClick={() => navigate("/login")}>
                  Log in
                </Button>
              </div>
            </div>
          </div>
        </section>

        <section className="border-y border-border bg-muted/40 py-6">
          <div className="mb-4 text-center text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Across every department
          </div>
          <div className="marquee">
            <div className="marquee-track">
              <div className="marquee-group">
                {DEPARTMENTS.map((d) => (
                  <span key={d} className="flex items-center gap-3 whitespace-nowrap">
                    <span className="size-1.5 rounded-full bg-accent/70" />
                    <span className="text-sm font-semibold text-muted-foreground/70">{d}</span>
                  </span>
                ))}
              </div>
              <div className="marquee-group" aria-hidden="true">
                {DEPARTMENTS.map((d) => (
                  <span key={d} className="flex items-center gap-3 whitespace-nowrap">
                    <span className="size-1.5 rounded-full bg-accent/70" />
                    <span className="text-sm font-semibold text-muted-foreground/70">{d}</span>
                  </span>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section id="features" className="mx-auto w-full max-w-7xl px-5 py-20 sm:py-28">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Everything around your team, in one place
            </h2>
            <p className="mt-3 text-muted-foreground">
              Real-time rule checks, invites, and matching — Folio-style polish for the SIH 2026 team pool.
            </p>
          </div>

          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {FEATURES.map((f) => (
              <div
                key={f.title}
                className="rounded-xl border border-border bg-card p-6 transition-shadow hover:shadow-[0_10px_30px_-12px_rgba(16,24,40,0.18)]"
              >
                <span className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  {ICONS[f.icon]}
                </span>
                <h3 className="mt-4 text-base font-bold tracking-tight">{f.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{f.body}</p>
              </div>
            ))}
          </div>
        </section>

        <section id="how" className="border-y border-border bg-muted/40">
          <div className="mx-auto w-full max-w-7xl px-5 py-20 sm:py-28">
            <div className="mx-auto max-w-2xl text-center">
              <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">How it works</h2>
              <p className="mt-3 text-muted-foreground">
                From first login to final presentation in three steps.
              </p>
            </div>

            <div className="mt-12 grid gap-4 md:grid-cols-3">
              {STEPS.map((s) => (
                <div key={s.n} className="rounded-xl border border-border bg-card p-6">
                  <span className="text-sm font-black tracking-widest text-primary">{s.n}</span>
                  <h3 className="mt-3 text-lg font-bold tracking-tight">{s.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{s.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="rules" className="mx-auto w-full max-w-7xl px-5 py-20 sm:py-28">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">Rules that can't be bent</h2>
            <p className="mt-3 text-muted-foreground">
              Enforced in the database, not just the UI — no accidental invalid teams.
            </p>
          </div>

          <div className="mt-12 grid gap-4 sm:grid-cols-3">
            {RULES.map((r) => (
              <div key={r.title} className="flex items-start gap-4 rounded-xl border border-border bg-card p-6">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted text-lg">
                  {r.icon}
                </span>
                <div>
                  <h3 className="text-base font-bold tracking-tight">{r.title}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{r.body}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="mx-auto mt-10 max-w-2xl rounded-xl border border-border bg-muted/40 px-5 py-4 text-center text-sm text-muted-foreground">
            Team rule violations are rejected by the server with a clear message — check any team's live badge for its status.
          </div>
        </section>

        <section className="border-y border-border bg-muted/40">
          <div className="mx-auto w-full max-w-7xl px-5 py-20 sm:py-24">
            <div className="mx-auto max-w-2xl text-center">
              <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">Loved by teams that ship fast</h2>
            </div>
            <div className="mt-12 grid gap-4 md:grid-cols-3">
              {QUOTES.map((t) => (
                <figure key={t.name} className="flex flex-col justify-between gap-6 rounded-xl border border-border bg-card p-6">
                  <blockquote className="text-sm leading-relaxed text-foreground/90">
                    “{t.text}”
                  </blockquote>
                  <figcaption className="flex items-center gap-3">
                    <span className="flex size-9 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                      {t.name.split(" ").map((w) => w[0]).join("")}
                    </span>
                    <div className="leading-tight">
                      <p className="text-sm font-semibold">{t.name}</p>
                      <p className="text-xs text-muted-foreground">{t.role}</p>
                    </div>
                  </figcaption>
                </figure>
              ))}
            </div>
          </div>
        </section>

        <section id="faq" className="mx-auto w-full max-w-3xl px-5 py-20 sm:py-28">
          <h2 className="text-center text-3xl font-bold tracking-tight sm:text-4xl">FAQ</h2>
          <p className="mt-3 text-center text-muted-foreground">
            Everything you need to know about forming a team.
          </p>

          <div className="mt-10 flex flex-col gap-3">
            {FAQS.map((f) => (
              <FaqItem key={f.q} q={f.q} a={f.a} />
            ))}
          </div>
        </section>

        <section className="mx-auto w-full max-w-7xl px-5 pb-20">
          <div className="relative overflow-hidden rounded-3xl bg-[#0b1120] px-6 py-16 text-center sm:py-20">
            <div className="pointer-events-none absolute inset-0">
              <div className="absolute -top-24 left-1/2 h-64 w-[600px] -translate-x-1/2 rounded-full bg-blue-500/25 blur-[110px]" />
            </div>
            <div className="relative">
              <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
                Stop scrambling for teammates.
              </h2>
              <p className="mx-auto mt-3 max-w-xl text-slate-300">
                Fill in the one-minute registration form, find your squad, and show up to SIH 2026 ready to build.
              </p>
              <Button onClick={() => navigate("/register")} className="mt-8 px-6 py-2.5">
                Apply Now
              </Button>
            </div>
          </div>
        </section>
      </main>

      <RuixenGradientFooter gradientHeight="42vh" stops={["#36429B", "#7C3AED", "#DBA328"]}>
        <div className="mx-auto w-full max-w-7xl px-5 pt-14">
          <div className="flex flex-col gap-10 pb-14 sm:flex-row sm:justify-between">
            <div className="max-w-xs">
              <div className="flex items-center gap-3">
                <img src="/logo.png" alt="Sri Manakula Vinayagar Engineering College" className="h-10 w-auto" />
              </div>
              <p className="mt-4 text-sm leading-relaxed text-white/80">
                The internal team-formation portal for Smart India Hackathon 2026, hosted by Sri
                Manakula Vinayagar Engineering College, Puducherry.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-10 sm:grid-cols-3">
              <FooterCol
                title="Product"
                links={[
                  { label: "Features", href: "#features" },
                  { label: "How it works", href: "#how" },
                  { label: "Rules", href: "#rules" },
                  { label: "FAQ", href: "#faq" },
                ]}
              />
              <FooterCol
                title="Get started"
                links={[
                  { label: "Apply now", href: "/register" },
                  { label: "Log in", href: "/login" },
                  { label: "Dashboard", href: "/dashboard" },
                ]}
              />
              <FooterCol
                title="Resources"
                links={[
                  { label: "Rules", href: "#rules" },
                  { label: "Departments", href: "#features" },
                  { label: "smvec.ac.in", href: "https://smvec.ac.in" },
                ]}
              />
            </div>
          </div>
          <div className="border-t border-white/15 py-6">
            <p className="text-xs text-white/70">
              © 2026 Sri Manakula Vinayagar Engineering College · SIH 2026 Team Builder
            </p>
          </div>
        </div>
      </RuixenGradientFooter>
    </div>
  );
}

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left text-sm font-semibold"
      >
        {q}
        <span className={`text-muted-foreground transition-transform duration-200 ${open ? "rotate-45" : ""}`}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M12 5v14M5 12h14" />
          </svg>
        </span>
      </button>
      {open && (
        <p className="px-5 pb-5 text-sm leading-relaxed text-muted-foreground">{a}</p>
      )}
    </div>
  );
}

function FooterCol({ title, links }: { title: string; links: { label: string; href: string }[] }) {
  return (
    <div>
      <h4 className="text-sm font-bold text-white">{title}</h4>
      <ul className="mt-3 flex flex-col gap-2">
        {links.map((l) => (
          <li key={l.label}>
            <a href={l.href} className="text-sm text-white/70 transition-colors hover:text-white">
              {l.label}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

