"use client";

import { useEffect, useState, memo } from "react";
import { useNavigate } from "react-router-dom";
import { animate, stagger, type JSAnimation } from "animejs";
import { supabase } from "@/lib/supabase/client";
import { useAnime } from "@/hooks/use-anime";
import { CollegeBrand } from "@/components/college-brand";
import { RuixenGradientFooter } from "@/components/ui/ruixen-gradient-footer";
import { Button } from "@/components/unlumen-ui/button";
import { ThemeToggle } from "@/components/theme-toggle";

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

const TIMELINE = [
  {
    date: "6 Aug 2026",
    label: "Portal opens",
    description: "Registration portal goes live. Create your account and fill in your profile.",
    status: "done",
    step: "01",
  },
  {
    date: "15 Aug 2026",
    label: "Registration deadline",
    description: "Last day to submit your registration form. No entries accepted after midnight.",
    status: "active",
    step: "02",
  },
  {
    date: "TBA",
    label: "Team formation",
    description: "Teams will be formed by your mentor based on skills and preferences. Date will be announced soon.",
    status: "upcoming",
    step: "03",
  },
  {
    date: "TBA",
    label: "Internal hackathon",
    description: "Present your solution to the evaluation panel. Top teams proceed to the national SIH round.",
    status: "upcoming",
    step: "04",
  },
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
  { n: "02", title: "Find or build your team", body: "Your team will be formed by your mentor based on skills. Date will be announced later." },
  { n: "03", title: "Compete together", body: "Keep your squad rule-valid, accept join requests, and walk into SIH 2026 ready to build." },
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

  // ── Hero entrance animation ──
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

  // ── Scroll-reveal IntersectionObserver ──
  useEffect(() => {
    const targets = document.querySelectorAll<HTMLElement>(
      ".scroll-reveal, .scroll-reveal-group, .scroll-reveal-left"
    );
    if (!targets.length) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("in-view");
            observer.unobserve(entry.target);
          }
        });
      },
      {
        threshold: 0.08,
        // Pre-trigger 80px before element enters viewport — no pop-in during fast scroll
        rootMargin: "0px 0px -80px 0px",
      }
    );

    targets.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  return (
    <div className="min-h-screen bg-white dark:bg-[#06090f] transition-colors duration-300">
      {/* SMVEC gold top accent bar */}
      <div className="h-1 w-full bg-gradient-to-r from-transparent via-[#c9a227] to-transparent" />

      {/* ── Header — dark navy blue ── */}
      <header className="sticky top-0 z-40 border-b border-[rgba(201,162,39,0.25)] bg-[#0b1631] shadow-lg backdrop-blur">
        <div className="mx-auto flex h-[4.5rem] w-full max-w-7xl items-center justify-between gap-3 px-5">
          <a href="/" className="flex items-center">
            <CollegeBrand />
          </a>

          <nav className="hidden items-center gap-1 lg:flex">
            {NAV_LINKS.map((l) => (
              <a
                key={l.href}
                href={l.href}
                className="rounded-lg px-3 py-2 text-sm font-medium text-white/70 transition-colors hover:text-[#e8c058]"
              >
                {l.label}
              </a>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Button variant="ghost" className="hidden sm:inline-flex text-white/70 hover:text-[#e8c058] hover:bg-white/5" onClick={() => navigate("/login")}>
              Log in
            </Button>
            <Button onClick={() => navigate("/register")} className="bg-[#c9a227] text-[#06090f] hover:bg-[#e8c058] font-bold border-0">
              Apply Now
            </Button>
          </div>
        </div>
      </header>

      <main>
        {/* ── Hero ── */}
        <section className="relative overflow-hidden bg-[#06090f] min-h-[calc(100vh-4.5rem)] flex items-center">
          {/* SMVEC campus background image — full viewport fill */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0"
            style={{
              backgroundImage: "url('/SMVEC Background.jpeg')",
              backgroundSize: "cover",
              backgroundPosition: "center center",
              backgroundRepeat: "no-repeat",
              backgroundAttachment: "scroll",
            }}
          />
          {/* Dark overlay — lighter at top so sky shows, darker at bottom for text */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                "linear-gradient(to bottom, rgba(6,9,15,0.45) 0%, rgba(6,9,15,0.60) 40%, rgba(6,9,15,0.85) 80%, rgba(6,9,15,0.96) 100%)",
            }}
          />
          {/* Subtle gold glow centre */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute left-1/2 top-1/3 h-[500px] w-[700px] -translate-x-1/2 -translate-y-1/2 rounded-full blur-[140px]"
            style={{ background: "rgba(201,162,39,0.08)" }}
          />
          <div className="bg-grid absolute inset-0 pointer-events-none" />

          <div className="relative w-full mx-auto max-w-7xl px-5 py-24 sm:py-32">
            <div ref={heroRef} className="mx-auto flex max-w-3xl flex-col items-center gap-6 text-center">
              <span className="reveal inline-flex items-center gap-2 rounded-full border border-[rgba(201,162,39,0.50)] bg-[rgba(6,9,15,0.60)] px-4 py-1.5 text-sm font-semibold text-[#e8c058] backdrop-blur-sm">
                <span className="size-2 rounded-full bg-[#c9a227] animate-pulse" />
                Build your winning SIH team — not your stress
              </span>

              <h1 className="reveal text-4xl font-bold leading-[1.08] tracking-tight text-white sm:text-6xl"
                style={{ textShadow: "0 2px 24px rgba(0,0,0,0.6)" }}>
                Smart India Hackathon 2026
                <br />
                <span className="text-gradient">SMVEC Internal</span>
              </h1>

              <p className="reveal max-w-xl text-base leading-relaxed text-white/80 sm:text-lg"
                style={{ textShadow: "0 1px 8px rgba(0,0,0,0.5)" }}>
                Apply once, match with teammates by department and language, form balanced
                teams, and keep every squad competition-ready with automatic rule checks.
              </p>

              <div className="reveal flex flex-wrap items-center justify-center gap-3">
                <Button onClick={() => navigate("/register")} className="bg-[#c9a227] text-[#06090f] hover:bg-[#e8c058] font-bold border-0 px-6 py-2.5 shadow-lg">
                  Apply Now
                </Button>
                <Button variant="outline" className="border-white/40 text-white bg-white/10 hover:bg-white/20 backdrop-blur-sm px-6 py-2.5" onClick={() => navigate("/login")}>
                  Log in
                </Button>
              </div>
            </div>
          </div>
        </section>

        {/* ── Timeline ── */}
        <section id="timeline" className="mx-auto w-full max-w-4xl px-5 py-20 sm:py-28">
          <div className="scroll-reveal mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight text-[#0f1520] dark:text-[#eef1f8] sm:text-4xl">Key dates</h2>
            <p className="mt-3 text-[#5a6680] dark:text-[#8fa0c0]">
              Mark these on your calendar — especially the registration deadline.
            </p>
          </div>

          <ol className="mt-14 flex flex-col">
            {TIMELINE.map((item, i) => {
              const isLast = i === TIMELINE.length - 1;
              const segColor =
                item.status === "done"
                  ? "from-success/60 to-success/20"
                  : item.status === "active"
                    ? "from-[#c9a227]/50 to-[#c9a227]/10"
                    : "from-[rgba(15,21,32,0.12)] to-[rgba(15,21,32,0.04)]";

              return (
                <li key={item.label} className="scroll-reveal relative flex items-start gap-5 sm:gap-7">
                  {/* Node + connector */}
                  <div className="hidden shrink-0 flex-col items-center sm:flex">
                    <div className={[
                      "relative z-10 flex size-14 items-center justify-center rounded-2xl border-2 transition-all",
                      item.status === "done"
                        ? "border-success bg-success/10 text-success"
                        : item.status === "active"
                          ? "border-[#c9a227] bg-[rgba(201,162,39,0.10)] text-[#c9a227] shadow-[0_0_28px_-6px_rgba(201,162,39,0.40)]"
                          : "border-[rgba(15,21,32,0.15)] bg-[#f8f9fc] dark:bg-[#0d1220] dark:border-[rgba(180,190,215,0.14)] text-[#5a6680] dark:text-[#8fa0c0]",
                    ].join(" ")}>
                      {item.status === "done" && (
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="size-6">
                          <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 0 1 .143 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 0 1 1.05-.143Z" clipRule="evenodd" />
                        </svg>
                      )}
                      {item.status === "active" && (
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="size-5">
                          <path d="M2.695 14.763l-1.262 3.154a.5.5 0 0 0 .65.65l3.155-1.262a4 4 0 0 0 1.343-.885L17.5 5.5a2.121 2.121 0 0 0-3-3L3.58 13.42a4 4 0 0 0-.885 1.343Z" />
                        </svg>
                      )}
                      {item.status === "upcoming" && (
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="size-5">
                          <path fillRule="evenodd" d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm.75-13a.75.75 0 0 0-1.5 0v5c0 .414.336.75.75.75h4a.75.75 0 0 0 0-1.5h-3.25V5Z" clipRule="evenodd" />
                        </svg>
                      )}
                    </div>
                    {!isLast && (
                      <div className={`w-px flex-1 bg-gradient-to-b ${segColor} my-1 min-h-[2rem]`} aria-hidden="true" />
                    )}
                  </div>

                  {/* Card */}
                  <div className={[
                    "flex-1 rounded-2xl border p-5",
                    !isLast ? "mb-4" : "mb-0",
                    item.status === "done"
                      ? "border-success/25 bg-success/5"
                      : item.status === "active"
                        ? "border-[rgba(201,162,39,0.40)] bg-[rgba(201,162,39,0.04)] shadow-[0_0_36px_-14px_rgba(201,162,39,0.25)]"
                        : "border-[rgba(15,21,32,0.08)] bg-[#f8f9fc] dark:bg-[#0d1220] dark:border-[rgba(180,190,215,0.10)] opacity-70",
                  ].join(" ")}>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-3">
                        <span className={["text-xs font-black tracking-widest sm:hidden",
                          item.status === "done" ? "text-success" : item.status === "active" ? "text-[#c9a227]" : "text-[#5a6680]",
                        ].join(" ")}>{item.step}</span>
                        <h3 className="text-base font-bold tracking-tight text-[#0f1520] dark:text-[#eef1f8]">{item.label}</h3>
                        {item.status === "done" && (
                          <span className="rounded-full border border-success/30 bg-success/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-success">Completed</span>
                        )}
                        {item.status === "active" && (
                          <span className="flex items-center gap-1.5 rounded-full border border-[rgba(201,162,39,0.35)] bg-[rgba(201,162,39,0.08)] px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-[#a07c10]">
                            <span className="size-1.5 animate-pulse rounded-full bg-[#c9a227]" />
                            Open now
                          </span>
                        )}
                      </div>
                      <span className={["rounded-lg border px-3 py-1 text-xs font-semibold tabular-nums",
                        item.status === "done" ? "border-success/30 text-success"
                          : item.status === "active" ? "border-[rgba(201,162,39,0.45)] text-[#a07c10]"
                          : "border-[rgba(15,21,32,0.12)] text-[#5a6680]",
                      ].join(" ")}>{item.date}</span>
                    </div>
                    <p className="mt-2 text-sm leading-relaxed text-[#5a6680] dark:text-[#8fa0c0]">{item.description}</p>
                    {item.status === "active" && (
                      <div className="mt-4">
                        <a href="/register" className="inline-flex items-center gap-1.5 rounded-xl bg-[#c9a227] px-4 py-2 text-xs font-bold text-white transition-opacity hover:opacity-90">
                          Register before deadline
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="size-3.5">
                            <path fillRule="evenodd" d="M2 8a.75.75 0 0 1 .75-.75h8.69L9.22 5.03a.75.75 0 0 1 1.06-1.06l3.5 3.5a.75.75 0 0 1 0 1.06l-3.5 3.5a.75.75 0 1 1-1.06-1.06l2.22-2.22H2.75A.75.75 0 0 1 2 8Z" clipRule="evenodd" />
                          </svg>
                        </a>
                      </div>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
        </section>

        {/* ── Departments marquee ── */}
        <section className="border-y border-[rgba(201,162,39,0.20)] bg-[#fdf9f0] dark:bg-[#0d1220] py-6">
          <div className="mb-4 text-center text-xs font-semibold uppercase tracking-widest text-[#a07c10] dark:text-[#c9a227]/70">
            Across every department
          </div>
          <div className="marquee">
            <div className="marquee-track">
              <div className="marquee-group">
                {DEPARTMENTS.map((d) => (
                  <span key={d} className="flex items-center gap-3 whitespace-nowrap">
                    <span className="size-1.5 rounded-full bg-[#c9a227]/70" />
                    <span className="text-sm font-semibold text-[#5a6680] dark:text-[#8fa0c0]/80">{d}</span>
                  </span>
                ))}
              </div>
              <div className="marquee-group" aria-hidden="true">
                {DEPARTMENTS.map((d) => (
                  <span key={d} className="flex items-center gap-3 whitespace-nowrap">
                    <span className="size-1.5 rounded-full bg-[#c9a227]/70" />
                    <span className="text-sm font-semibold text-[#5a6680] dark:text-[#8fa0c0]/80">{d}</span>
                  </span>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ── Features ── */}
        <section id="features" className="mx-auto w-full max-w-7xl px-5 py-20 sm:py-28">
          <div className="scroll-reveal mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight text-[#0f1520] dark:text-[#eef1f8] sm:text-4xl">
              Everything around your team, in one place
            </h2>
            <p className="mt-3 text-[#5a6680] dark:text-[#8fa0c0]">
              Real-time rule checks, invites, and matching — built for the SIH 2026 team pool.
            </p>
          </div>

          <div className="scroll-reveal-group mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {FEATURES.map((f) => (
              <div key={f.title} className="card-hover rounded-xl border border-[rgba(201,162,39,0.18)] bg-white dark:bg-[#0d1220] dark:border-[rgba(201,162,39,0.15)] p-6 shadow-sm">
                <span className="flex size-10 items-center justify-center rounded-lg bg-[rgba(201,162,39,0.12)] text-[#c9a227]">
                  {ICONS[f.icon]}
                </span>
                <h3 className="mt-4 text-base font-bold tracking-tight text-[#0f1520] dark:text-[#eef1f8]">{f.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-[#5a6680] dark:text-[#8fa0c0]">{f.body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── How it works ── */}
        <section id="how" className="border-y border-[rgba(201,162,39,0.15)] bg-[#fdf9f0] dark:bg-[#0d1220]">
          <div className="mx-auto w-full max-w-7xl px-5 py-20 sm:py-28">
            <div className="scroll-reveal mx-auto max-w-2xl text-center">
              <h2 className="text-3xl font-bold tracking-tight text-[#0f1520] dark:text-[#eef1f8] sm:text-4xl">How it works</h2>
              <p className="mt-3 text-[#5a6680] dark:text-[#8fa0c0]">From first login to final presentation in three steps.</p>
            </div>

            <div className="scroll-reveal-group mt-12 grid gap-4 md:grid-cols-3">
              {STEPS.map((s) => (
                <div key={s.n} className="rounded-xl border border-[rgba(201,162,39,0.18)] bg-white dark:bg-[#0b1631] dark:border-[rgba(201,162,39,0.15)] p-6 shadow-sm">
                  <span className="text-sm font-black tracking-widest text-[#c9a227]">{s.n}</span>
                  <h3 className="mt-3 text-lg font-bold tracking-tight text-[#0f1520] dark:text-[#eef1f8]">{s.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-[#5a6680] dark:text-[#8fa0c0]">{s.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Rules ── */}
        <section id="rules" className="mx-auto w-full max-w-7xl px-5 py-20 sm:py-28">
          <div className="scroll-reveal mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight text-[#0f1520] dark:text-[#eef1f8] sm:text-4xl">Rules that can't be bent</h2>
            <p className="mt-3 text-[#5a6680] dark:text-[#8fa0c0]">Enforced in the database, not just the UI — no accidental invalid teams.</p>
          </div>

          <div className="scroll-reveal-group mt-12 grid gap-4 sm:grid-cols-3">
            {RULES.map((r) => (
              <div key={r.title} className="flex items-start gap-4 rounded-xl border border-[rgba(201,162,39,0.18)] bg-white dark:bg-[#0d1220] dark:border-[rgba(201,162,39,0.15)] p-6 shadow-sm">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-[rgba(201,162,39,0.10)] text-lg">{r.icon}</span>
                <div>
                  <h3 className="text-base font-bold tracking-tight text-[#0f1520] dark:text-[#eef1f8]">{r.title}</h3>
                  <p className="mt-1 text-sm text-[#5a6680] dark:text-[#8fa0c0]">{r.body}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="scroll-reveal mx-auto mt-10 max-w-2xl rounded-xl border border-[rgba(201,162,39,0.25)] bg-[rgba(201,162,39,0.05)] px-5 py-4 text-center text-sm text-[#a07c10] dark:text-[#c9a227]/80">
            Team rule violations are rejected by the server with a clear message — check any team's live badge for its status.
          </div>
        </section>

        {/* ── Testimonials ── */}
        <section className="border-y border-[rgba(201,162,39,0.15)] bg-[#fdf9f0] dark:bg-[#0d1220]">
          <div className="mx-auto w-full max-w-7xl px-5 py-20 sm:py-24">
            <div className="scroll-reveal mx-auto max-w-2xl text-center">
              <h2 className="text-3xl font-bold tracking-tight text-[#0f1520] dark:text-[#eef1f8] sm:text-4xl">Loved by teams that ship fast</h2>
            </div>
            <div className="scroll-reveal-group mt-12 grid gap-4 md:grid-cols-3">
              {QUOTES.map((t) => (
                <figure key={t.name} className="flex flex-col justify-between gap-6 rounded-xl border border-[rgba(201,162,39,0.18)] bg-white dark:bg-[#0b1631] dark:border-[rgba(201,162,39,0.15)] p-6 shadow-sm">
                  <blockquote className="text-sm leading-relaxed text-[#0f1520]/80 dark:text-[#eef1f8]/80">
                    "{t.text}"
                  </blockquote>
                  <figcaption className="flex items-center gap-3">
                    <span className="flex size-9 items-center justify-center rounded-full bg-[rgba(201,162,39,0.12)] text-xs font-bold text-[#c9a227]">
                      {t.name.split(" ").map((w: string) => w[0]).join("")}
                    </span>
                    <div className="leading-tight">
                      <p className="text-sm font-semibold text-[#0f1520] dark:text-[#eef1f8]">{t.name}</p>
                      <p className="text-xs text-[#5a6680] dark:text-[#8fa0c0]">{t.role}</p>
                    </div>
                  </figcaption>
                </figure>
              ))}
            </div>
          </div>
        </section>

        {/* ── FAQ ── */}
        <section id="faq" className="mx-auto w-full max-w-3xl px-5 py-20 sm:py-28">
          <div className="scroll-reveal text-center">
            <h2 className="text-3xl font-bold tracking-tight text-[#0f1520] dark:text-[#eef1f8] sm:text-4xl">FAQ</h2>
            <p className="mt-3 text-[#5a6680] dark:text-[#8fa0c0]">Everything you need to know about forming a team.</p>
          </div>

          <div className="mt-10 flex flex-col gap-3">
            {FAQS.map((f) => (
              <FaqItem key={f.q} q={f.q} a={f.a} />
            ))}
          </div>
        </section>

        {/* ── CTA ── */}
        <section className="scroll-reveal mx-auto w-full max-w-7xl px-5 pb-20">
          <div className="relative overflow-hidden rounded-3xl px-6 py-16 text-center sm:py-20"
            style={{ background: "linear-gradient(160deg, #060c1a 0%, #0b1631 60%, #0f1e40 100%)" }}>
            <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-[#c9a227] to-transparent" />
            <div className="pointer-events-none absolute inset-0">
              <div className="absolute -top-24 left-1/2 h-64 w-[600px] -translate-x-1/2 rounded-full bg-[#c9a227]/12 blur-[110px]" />
            </div>
            <div className="relative">
              <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
                Stop scrambling for teammates.
              </h2>
              <p className="mx-auto mt-3 max-w-xl text-[#8fa0c0]">
                Fill in the one-minute registration form, find your squad, and show up to SIH 2026 ready to build.
              </p>
              <Button
                onClick={() => navigate("/register")}
                className="mt-8 bg-[#c9a227] text-white hover:bg-[#e8c058] hover:text-[#06090f] font-bold border-0 px-6 py-2.5"
              >
                Apply Now
              </Button>
            </div>
          </div>
        </section>
      </main>

      <RuixenGradientFooter gradientHeight="42vh" stops={["#060c1a", "#0b1631", "#c9a227"]}>
        <div className="mx-auto w-full max-w-7xl px-5 pt-14">
          <div className="flex flex-col gap-10 pb-14 sm:flex-row sm:justify-between">
            <div className="max-w-xs">
              <img src="/logo.png" alt="Sri Manakula Vinayagar Engineering College" className="h-10 w-auto" />
              <p className="mt-4 text-sm leading-relaxed text-white/80">
                The internal team-formation portal for Smart India Hackathon 2026, hosted by Sri
                Manakula Vinayagar Engineering College, Puducherry.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-10 sm:grid-cols-3">
              <FooterCol title="Product" links={[
                { label: "Features", href: "#features" },
                { label: "How it works", href: "#how" },
                { label: "Rules", href: "#rules" },
                { label: "FAQ", href: "#faq" },
              ]} />
              <FooterCol title="Get started" links={[
                { label: "Apply now", href: "/register" },
                { label: "Log in", href: "/login" },
                { label: "Dashboard", href: "/dashboard" },
              ]} />
              <FooterCol title="Resources" links={[
                { label: "Rules", href: "#rules" },
                { label: "Departments", href: "#features" },
                { label: "smvec.ac.in", href: "https://smvec.ac.in" },
              ]} />
            </div>
          </div>
          <div className="border-t border-white/15 py-6">
            <p className="text-xs text-white/70">© 2026 Sri Manakula Vinayagar Engineering College · SIH 2026 Team Builder</p>
          </div>
        </div>
      </RuixenGradientFooter>
    </div>
  );
}

const FaqItem = memo(function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="scroll-reveal overflow-hidden rounded-xl border border-[rgba(201,162,39,0.18)] bg-white dark:bg-[#0d1220] dark:border-[rgba(201,162,39,0.15)] shadow-sm">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left text-sm font-semibold text-[#0f1520] dark:text-[#eef1f8] hover:text-[#c9a227] dark:hover:text-[#c9a227]"
      >
        {q}
        <span className={`text-[#c9a227] transition-transform duration-200 ${open ? "rotate-45" : ""}`}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M12 5v14M5 12h14" />
          </svg>
        </span>
      </button>
      {open && (
        <p className="px-5 pb-5 text-sm leading-relaxed text-[#5a6680] dark:text-[#8fa0c0]">{a}</p>
      )}
    </div>
  );
});

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
