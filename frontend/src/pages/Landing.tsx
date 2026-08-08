"use client";

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { animate, stagger, type JSAnimation } from "animejs";
import { supabase } from "@/lib/supabase/client";
import { useAnime } from "@/hooks/use-anime";
import { CollegeBrand } from "@/components/college-brand";
import { RuixenGradientFooter } from "@/components/ui/ruixen-gradient-footer";
import { Button } from "@/components/unlumen-ui/button";
import * as data from "@/lib/data";

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
    date: "",
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
    title: "Project Parameters Wizard",
    body: "Enter your hardware or software project parameters, upload PPT slides, and submit video demonstration links.",
    icon: "spark",
  },
  {
    title: "Passwordless Authentication",
    body: "Register securely and log in using your college Register Number with zero password hassle.",
    icon: "shield",
  },
  {
    title: "Live Milestone Feed",
    body: "Track key dates, evaluation timelines, and announcements directly on your student dashboard.",
    icon: "inbox",
  },
  {
    title: "Mentor-Led Formations",
    body: "Mentors analyze your project profile, skills, and department to form balanced hackathon squads.",
    icon: "pulse",
  },
];

const STEPS = [
  { n: "01", title: "Apply via registration form", body: "Fill in your details, select your project type, provide links to your repositories/PPT, and submit the form." },
  { n: "02", title: "Team formation by mentors", body: "Your team will be formed by your mentors based on project types and skills. The final date will be announced soon." },
  { n: "03", title: "Await final announcement", body: "Wait for mentor evaluations and check your dashboard timeline for team assignments." },
];

const RULES = [
  { icon: "👥", title: "6 members max", body: "Teams consist of six  members." },
  { icon: "♀", title: "2 female members", body: "Every team needs at least two female members." },
  { icon: "🏛", title: "2 departments", body: "Every team must span at least two departments." },
];



const FAQS = [
  { q: "What are the official team constraints?", a: "Each formed team must have at most 6 members, at least 2 female members, and members spanning at least 2 different departments. The evaluation mentors will ensure these rules are strictly met during team allocation." },
  { q: "How are teams formed for the hackathon?", a: "Teams are constructed dynamically by our college review mentors based on your department, project type (Hardware/Software/Both), and coding skills. You do not need to form teams manually." },
  { q: "What credentials do I use to log in?", a: "You do not need to create or remember a password. Simply enter your college Register Number (e.g. 24UAI123) to log in directly to your student dashboard." },
  { q: "Who can use this portal?", a: "It is built exclusively for the internal SIH 2026 participant pool of Sri Manakula Vinayagar Engineering College. Students apply with their project preferences and wait for team matching." },
  { q: "How do I register?", a: "Click 'Apply Now' and fill out the form steps: basic details, academic department, coding stack, project title/description, PPT link, and repository URL." },
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
  const [timelineData, setTimelineData] = useState<any[]>([]);
  const [dbConnected, setDbConnected] = useState<boolean | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    supabase?.auth.getSession().then(({ data }) => {
      if (data.session) navigate("/dashboard", { replace: true });
    });

    if (data.isConfigured()) {
      data.fetchTimelineEvents().then((res) => {
        if (res.data && res.data.length > 0) {
          setTimelineData(res.data);
        }
      });
      data.fetchThemes().then((res) => {
        if (res.error) {
          setDbConnected(false);
        } else {
          setDbConnected(true);
        }
      }).catch(() => {
        setDbConnected(false);
      });
    } else {
      setDbConnected(false);
    }
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
    <div className="page-transition min-h-screen bg-transparent relative">
      {/* College Banner Background with smooth fade */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[92vh] overflow-hidden">
        <div
          className="absolute inset-0 bg-cover bg-center bg-no-repeat opacity-[0.80]"
          style={{ backgroundImage: "url('/smvec-banner.jpeg')" }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/45 via-black/15 to-[#050b18]" />
        <div className="bg-grid absolute inset-0 opacity-55" />
      </div>

      {/* SMVEC gold top accent bar */}
      <div className="h-1 w-full bg-gradient-to-r from-transparent via-[#c9a227] to-transparent relative z-30" />



      <header className="sticky top-0 z-40 border-b border-[rgba(201,162,39,0.18)] bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex h-[4.5rem] w-full max-w-[1536px] items-center justify-between gap-3 px-5">
          <a
            href="/"
            onClick={(e) => {
              e.preventDefault();
              navigate("/");
            }}
            className="flex items-center"
          >
            <CollegeBrand />
          </a>

          <nav className="hidden items-center gap-1 lg:flex">
            {NAV_LINKS.map((l) => (
              <a
                key={l.href}
                href={l.href}
                className="rounded-lg px-3 py-2 text-sm font-medium text-slate-200 transition-colors hover:text-[#e8c058]"
              >
                {l.label}
              </a>
            ))}
          </nav>

          <div className="flex items-center gap-1.5 sm:gap-2">
            <span className="hidden sm:inline-flex">
              <Button variant="ghost" className="text-[#8fa0c0] hover:text-[#e8c058] px-2.5 py-1.5 text-xs sm:px-3 sm:py-2 sm:text-sm" onClick={() => navigate("/login")}>
                Log in
              </Button>
            </span>
            <Button onClick={() => navigate("/register")} className="bg-[#c9a227] text-[#06090f] hover:bg-[#e8c058] font-bold border-0 px-2.5 py-1.5 text-xs sm:px-4 sm:py-2 sm:text-sm">
              Apply Now
            </Button>
            {/* Hamburger Menu Button */}
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="inline-flex items-center justify-center p-2 rounded-lg border border-[rgba(201,162,39,0.18)] bg-card/50 text-[#8fa0c0] hover:text-[#e8c058] lg:hidden"
              aria-label="Toggle navigation menu"
            >
              {mobileMenuOpen ? (
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.8" stroke="currentColor" className="size-5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                </svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.8" stroke="currentColor" className="size-5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
                </svg>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Mobile navigation panel */}
      {mobileMenuOpen && (
        <div className="lg:hidden border-b border-[rgba(201,162,39,0.18)] bg-[#050b18]/95 backdrop-blur-md px-5 py-4 flex flex-col gap-2 transition-all sticky top-[4.5rem] z-30 shadow-lg">
          {NAV_LINKS.map((l) => (
            <a
              key={l.href}
              href={l.href}
              onClick={() => setMobileMenuOpen(false)}
              className="rounded-lg px-4 py-2.5 text-sm font-medium text-slate-200 hover:bg-muted/40 hover:text-[#e8c058] transition-all"
            >
              {l.label}
            </a>
          ))}
          <div className="h-px bg-border/50 my-2" />
          <a
            href="/login"
            onClick={(e) => {
              e.preventDefault();
              setMobileMenuOpen(false);
              navigate("/login");
            }}
            className="rounded-lg px-4 py-2.5 text-sm font-semibold text-[#8fa0c0] hover:text-[#e8c058] transition-all"
          >
            Log in
          </a>
        </div>
      )}

      <main>
        <section className="relative overflow-hidden">
          <div className="mx-auto w-full max-w-[1536px] px-5 pb-16 pt-16 sm:pt-24">
            <div ref={heroRef} className="mx-auto flex max-w-3xl flex-col items-center gap-6 text-center">


              <h1 className="reveal text-4xl font-bold leading-[1.08] tracking-tight text-white drop-shadow-[0_4px_16px_rgba(0,0,0,0.9)] sm:text-6xl">
                Smart India Hackathon 2026
                <br />
                <span className="text-gradient">SMVEC Internal</span>
              </h1>
              <span className="reveal inline-flex items-center gap-2 rounded-full border border-[#c9a227]/50 bg-black/50 backdrop-blur-md px-4 py-1.5 text-sm font-semibold text-[#e8c058]">
                <span className="size-2 rounded-full bg-[#e8c058] animate-pulse" />
                Build your Winning SIH team ,Not your Stress
              </span>



              <div className="reveal flex flex-wrap items-center justify-center gap-3 mt-10 sm:mt-24">
                <Button onClick={() => navigate("/register")} className="bg-[#c9a227] text-[#06090f] hover:bg-[#e8c058] font-bold border-0 px-6 py-2.5 shadow-lg shadow-black/20">
                  Apply Now
                </Button>
                <Button variant="outline" className="border-white/30 bg-black/40 text-white hover:bg-white/10 hover:text-white px-6 py-2.5 backdrop-blur-md shadow-lg shadow-black/20" onClick={() => navigate("/login")}>
                  Log in
                </Button>
              </div>
            </div>
          </div>
        </section>

        {/* ── Timeline ── */}
        <section id="timeline" className="relative overflow-hidden mx-auto w-full max-w-4xl px-5 py-12 sm:py-28 mt-10 sm:mt-24">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">Key dates</h2>
            <p className="mt-3 text-muted-foreground">
              Mark these on your calendar — especially the registration deadline.
            </p>
          </div>

          <ol className="mt-14 flex flex-col gap-6">
            {(timelineData.length > 0 ? timelineData : TIMELINE).map((item, i, arr) => {
              const isLast = i === arr.length - 1;
              // colour of the connector segment below this node
              const segColor =
                item.status === "done"
                  ? "from-success/60 to-success/20"
                  : item.status === "active"
                    ? "from-accent/50 to-border/40"
                    : "from-border/40 to-border/20";

              return (
                <TimelineItem
                  key={item.label}
                  item={item}
                  isLast={isLast}
                  segColor={segColor}
                  index={i}
                  navigate={navigate}
                />
              );
            })}
          </ol>
        </section>

        <section className="border-y border-[rgba(201,162,39,0.15)] bg-card/30 backdrop-blur-sm py-6">
          <div className="mb-4 text-center text-xs font-semibold uppercase tracking-widest text-[#c9a227]/70">
            Across every department
          </div>
          <div className="marquee">
            <div className="marquee-track">
              <div className="marquee-group">
                {DEPARTMENTS.map((d) => (
                  <span key={d} className="flex items-center gap-3 whitespace-nowrap">
                    <span className="size-1.5 rounded-full bg-[#c9a227]/60" />
                    <span className="text-sm font-semibold text-[#8fa0c0]/70">{d}</span>
                  </span>
                ))}
              </div>
              <div className="marquee-group" aria-hidden="true">
                {DEPARTMENTS.map((d) => (
                  <span key={d} className="flex items-center gap-3 whitespace-nowrap">
                    <span className="size-1.5 rounded-full bg-[#c9a227]/60" />
                    <span className="text-sm font-semibold text-[#8fa0c0]/70">{d}</span>
                  </span>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section id="features" className="mx-auto w-full max-w-[1536px] px-5 py-20 sm:py-28">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Everything for your registration, in one place
            </h2>
            <p className="mt-3 text-muted-foreground">
              Dynamic project details, passwordless logins, and real-time timeline feeds for the SIH 2026 registration.
            </p>
          </div>

          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {FEATURES.map((f) => (
              <div
                key={f.title}
                className="card-hover rounded-xl border border-[rgba(201,162,39,0.15)] bg-card/50 backdrop-blur-md p-6 hover:border-[rgba(201,162,39,0.45)]"
              >
                <span className="flex size-10 items-center justify-center rounded-lg bg-[rgba(201,162,39,0.12)] text-[#c9a227]">
                  {ICONS[f.icon]}
                </span>
                <h3 className="mt-4 text-base font-bold tracking-tight">{f.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{f.body}</p>
              </div>
            ))}
          </div>
        </section>

        <section id="how" className="border-y border-[rgba(201,162,39,0.12)] bg-card/30 backdrop-blur-sm">
          <div className="mx-auto w-full max-w-[1536px] px-5 py-20 sm:py-28">
            <div className="mx-auto max-w-2xl text-center">
              <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">How it works</h2>
              <p className="mt-3 text-muted-foreground">
                From first login to final presentation in three steps.
              </p>
            </div>

            <div className="mt-12 grid gap-4 md:grid-cols-3">
              {STEPS.map((s) => (
                <div key={s.n} className="card-hover rounded-xl border border-[rgba(201,162,39,0.15)] bg-card/50 backdrop-blur-md p-6">
                  <span className="text-sm font-black tracking-widest text-[#c9a227]">{s.n}</span>
                  <h3 className="mt-3 text-lg font-bold tracking-tight">{s.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{s.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="rules" className="mx-auto w-full max-w-[1536px] px-5 py-20 sm:py-28">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">National SIH Team Guidelines</h2>
            <p className="mt-3 text-muted-foreground">
              Mentors will structure teams matching these official parameters.
            </p>
          </div>

          <div className="mt-12 grid gap-4 sm:grid-cols-3">
            {RULES.map((r) => (
              <div key={r.title} className="card-hover flex items-start gap-4 rounded-xl border border-[rgba(201,162,39,0.15)] bg-card/50 backdrop-blur-md p-6">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-[rgba(201,162,39,0.10)] text-lg">
                  {r.icon}
                </span>
                <div>
                  <h3 className="text-base font-bold tracking-tight">{r.title}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{r.body}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="mx-auto mt-10 max-w-2xl rounded-xl border border-[rgba(201,162,39,0.18)] bg-[rgba(201,162,39,0.05)] px-5 py-4 text-center text-sm text-[#c9a227]/80">
            Mentors will dynamically construct optimal teams mapping to these conditions after the registration window closes.
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

        <section className="mx-auto w-full max-w-[1536px] px-5 pb-20">
          <div className="relative overflow-hidden rounded-3xl px-6 py-16 text-center sm:py-20 backdrop-blur-md"
            style={{ background: "linear-gradient(160deg, rgba(10, 18, 38, 0.9) 0%, rgba(16, 28, 63, 0.8) 60%, rgba(20, 35, 75, 0.7) 100%)" }}>
            {/* Gold top border accent */}
            <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-[#c9a227] to-transparent" />
            {/* Gold glow blob */}
            <div className="pointer-events-none absolute inset-0">
              <div className="absolute -top-24 left-1/2 h-64 w-[600px] -translate-x-1/2 rounded-full bg-[#c9a227]/12 blur-[110px]" />
            </div>
            <div className="relative">
              <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
                Register for SIH 2026 Today
              </h2>
              <p className="mx-auto mt-3 max-w-xl text-[#8fa0c0]">
                Fill in the registration form, enter your project details, and prepare to build your hackathon solution.
              </p>
              <Button
                onClick={() => navigate("/register")}
                className="mt-8 bg-[#c9a227] text-[#06090f] hover:bg-[#e8c058] font-bold border-0 px-6 py-2.5"
              >
                Apply Now
              </Button>
            </div>
          </div>
        </section>
      </main>

      <RuixenGradientFooter gradientHeight="16vh" stops={["#050b18", "#081026", "#c9a227"]}>
        <div className="mx-auto w-full max-w-[1536px] px-5 pt-14">
          <div className="flex flex-col gap-10 pb-14 sm:flex-row sm:justify-between">
            <div className="max-w-xs">
              <div className="flex items-center gap-3">
                <img src="/logo.png" alt="Sri Manakula Vinayagars Engineering College" className="h-16 w-auto brightness-110 contrast-125" />
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
          <div className="border-t border-white/15 py-6 flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-xs text-white/70">
              © 2026 Sri Manakula Vinayagar Engineering College · SIH 2026 Team Builder
            </p>
            <a
              href="/admin"
              onClick={(e) => {
                e.preventDefault();
                navigate("/admin");
              }}
              className="text-xs font-semibold text-[#dba328] hover:text-[#dba328]/80 transition-colors flex items-center gap-1.5"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
              <span>Admin Portal</span>
              {dbConnected === null && (
                <span className="size-2 rounded-full bg-neutral-500 animate-pulse" title="Checking database connection..." />
              )}
              {dbConnected === true && (
                <span className="size-2 rounded-full bg-emerald-500 shadow-[0_0_8px_#10b981]" title="Database connected" />
              )}
              {dbConnected === false && (
                <span className="size-2 rounded-full bg-rose-500 shadow-[0_0_8px_#f43f5e]" title="Database disconnected" />
              )}
            </a>
          </div>
        </div>
      </RuixenGradientFooter>
    </div>
  );
}

function TimelineItem({ item, isLast, segColor, index, navigate }: { item: any; isLast: boolean; segColor: string; index: number; navigate: (p: string) => void }) {
  const [inView, setInView] = useState(false);
  const [ref, setRef] = useState<HTMLLIElement | null>(null);

  useEffect(() => {
    if (!ref) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          observer.unobserve(ref);
        }
      },
      { threshold: 0.05, rootMargin: "0px 0px -60px 0px" }
    );
    observer.observe(ref);
    return () => observer.disconnect();
  }, [ref]);

  return (
    <li
      ref={setRef}
      style={{
        transitionDelay: `${index * 120}ms`,
      }}
      className={`relative flex items-start gap-6 sm:gap-10 transition-all duration-[800ms] ease-out ${inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-12"
        }`}
    >
      {/* Left column: node + connector */}
      <div className="hidden shrink-0 flex-col items-center sm:flex">
        {/* Node */}
        <div
          className={[
            "relative z-10 flex size-14 items-center justify-center rounded-2xl border-2 transition-all",
            item.status === "done"
              ? "border-success bg-success/10 text-success"
              : item.status === "active"
                ? "border-[#c9a227] bg-[rgba(201,162,39,0.10)] text-[#c9a227] shadow-[0_0_28px_-6px_rgba(201,162,39,0.55)]"
                : "border-border bg-card text-muted-foreground",
          ].join(" ")}
        >
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

        {/* Connector segment */}
        {!isLast && (
          <div
            className={`w-px flex-1 bg-gradient-to-b ${segColor} my-1 min-h-[3rem]`}
            aria-hidden="true"
          />
        )}
      </div>

      {/* Card */}
      <div
        className={[
          "card-hover flex-1 rounded-2xl border p-6 sm:p-7",
          !isLast ? "mb-6" : "mb-0",
          item.status === "done"
            ? "border-success/25 bg-success/5"
            : item.status === "active"
              ? "border-[rgba(201,162,39,0.45)] bg-[rgba(201,162,39,0.05)] shadow-[0_0_36px_-14px_rgba(201,162,39,0.35)]"
              : "border-[rgba(180,190,215,0.12)] bg-card/50 backdrop-blur-md opacity-70",
        ].join(" ")}
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            {/* Step number — mobile only */}
            <span className={[
              "text-xs font-black tracking-widest sm:hidden",
              item.status === "done" ? "text-success" : item.status === "active" ? "text-[#c9a227]" : "text-muted-foreground",
            ].join(" ")}>
              {item.step}
            </span>
            <h3 className="text-lg sm:text-xl font-bold tracking-tight">{item.label}</h3>
            {item.status === "done" && (
              <span className="rounded-full border border-success/30 bg-success/10 px-2 py-0.5 text-xs font-bold uppercase tracking-widest text-success">
                Completed
              </span>
            )}
            {item.status === "active" && (
              <span className="flex items-center gap-1.5 rounded-full border border-[rgba(201,162,39,0.35)] bg-[rgba(201,162,39,0.08)] px-2 py-0.5 text-xs font-bold uppercase tracking-widest text-[#c9a227]">
                <span className="size-1.5 animate-pulse rounded-full bg-[#c9a227]" />
                Open now
              </span>
            )}
          </div>

          <span
            className={[
              "rounded-lg border px-3 py-1 text-sm font-semibold tabular-nums",
              item.status === "done"
                ? "border-success/30 text-success"
                : item.status === "active"
                  ? "border-[rgba(201,162,39,0.45)] text-[#c9a227]"
                  : "border-border text-muted-foreground",
            ].join(" ")}
          >
            {item.date}
          </span>
        </div>

        <p className="mt-2.5 text-sm sm:text-base leading-relaxed text-muted-foreground">{item.description}</p>

        {item.status === "active" && (
          <div className="mt-4">
            <a
              href="/register"
              onClick={(e) => {
                e.preventDefault();
                navigate("/register");
              }}
              className="inline-flex items-center gap-1.5 rounded-xl bg-[#c9a227] px-4 py-2 text-xs font-bold text-[#06090f] transition-opacity hover:opacity-90"
            >
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
}

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="card-hover overflow-hidden rounded-xl border border-[rgba(201,162,39,0.15)] bg-card/50 backdrop-blur-md">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left text-sm font-semibold hover:text-[#c9a227] transition-colors"
      >
        {q}
        <span className={`text-[#c9a227]/70 transition-transform duration-200 ${open ? "rotate-45" : ""}`}>
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

