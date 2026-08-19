"use client";

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { animate, stagger } from "animejs";
import {
  SlidersHorizontal,
  CalendarClock,
  GraduationCap,
  Users,
  Building2,
  UserCheck,
  Menu,
  X,
  Lock,
  Check,
  Pencil,
  Clock,
  ArrowRight,
  Plus,
} from "lucide-react";
import { useAnime } from "@/hooks/use-anime";
import { CollegeBrand } from "@/components/common/college-brand";
import { RuixenGradientFooter } from "@/components/ui/ruixen-gradient-footer";
import { Button } from "@/components/unlumen-ui/button";
import { RegistrationClosedModal } from "@/components/common/registration-closed-modal";
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

function computeStatus(
  isoDate,
  prevStatus
) {
  if (!isoDate) return "upcoming";
  const deadline = new Date(isoDate);
  deadline.setHours(23, 59, 59, 999);
  const now = new Date();
  if (now > deadline) return "done";
  if (prevStatus === "done") return "active";
  return "upcoming";
}

const TIMELINE = [
  {
    isoDate: "2026-08-06",
    date: "6 Aug 2026",
    label: "Portal opens",
    description: "Registration portal goes live. Create your account and fill in your profile.",
    step: "01",
  },
  {
    isoDate: "2026-08-15",
    date: "15 Aug 2026",
    label: "Registration deadline",
    description: "Last day to submit your registration form. No entries accepted after midnight.",
    step: "02",
  },
  {
    isoDate: "",
    date: "TBA",
    label: "Team formation",
    description: "Teams will be formed by your mentor based on skills and preferences. Date will be announced soon.",
    step: "03",
  },
  {
    isoDate: "",
    date: "TBA",
    label: "Internal hackathon",
    description: "Present your solution to the evaluation panel. Top teams proceed to the national SIH round.",
    step: "04",
  },
];

function getComputedTimeline(items) {
  let prev = "done";
  return items.map((item) => {
    const status = computeStatus(item.isoDate, prev);
    prev = status;
    return { ...item, status };
  });
}

const FEATURES = [
  {
    title: "Project Parameters Wizard",
    body: "Enter your hardware or software project parameters, upload PPT slides, and submit video demonstration links.",
    icon: <SlidersHorizontal className="size-5" />,
  },
  {
    title: "Live Milestone Feed",
    body: "Track key dates, evaluation timelines, and announcements directly on your student dashboard.",
    icon: <CalendarClock className="size-5" />,
  },
  {
    title: "Mentor-Led Formations",
    body: "Mentors analyze your project profile, skills, and department to form balanced hackathon squads.",
    icon: <GraduationCap className="size-5" />,
  },
];

const STEPS = [
  { n: "01", title: "Apply via registration form", body: "Fill in your details, select your project type, provide links to your repositories/PPT, and submit the form." },
  { n: "02", title: "Team formation by mentors", body: "Your team will be formed by your mentors based on project types and skills. The final date will be announced soon." },
  { n: "03", title: "Await final announcement", body: "Wait for mentor evaluations and check your dashboard timeline for team assignments." },
];

const RULES = [
  {
    icon: <Users className="size-5 text-[#c9a227]" />,
    title: "2 members per team",
    body: "Every formed team consists of exactly 2 members.",
  },
  {
    icon: <Building2 className="size-5 text-[#c9a227]" />,
    title: "Same department",
    body: "Both members in a team must belong to the exact same department.",
  },
  {
    icon: <UserCheck className="size-5 text-[#c9a227]" />,
    title: "Skill & Domain diversity",
    body: "Members in the same team must not have the same skillset or domain of interest.",
  },
];

const FAQS = [
  { q: "What are the official team constraints?", a: "Each formed team consists of exactly 2 members from the same department. The two members in the same team must not have the same skillset or domain of interest." },
  { q: "How are teams formed for the hackathon?", a: "Teams are constructed dynamically by our college review mentors based on your department, project type (Hardware/Software/Both), and coding skills. You do not need to form teams manually." },
  { q: "What credentials do I use to log in?", a: "You do not need to create or remember a password. Simply enter your college Register Number (e.g. 24UAI123) to log in directly to your student dashboard." },
  { q: "Who can use this portal?", a: "It is built exclusively for the internal SIH 2026 participant pool of Sri Manakula Vinayagar Engineering College. Students apply with their project preferences and wait for team matching." },
  { q: "How do I register?", a: "Click 'Register Now' and fill out the form steps: basic details, academic department, coding stack, project title/description, PPT link, and repository URL." },
];

export default function LandingPage() {
  const navigate = useNavigate();
  const [timelineData, setTimelineData] = useState([]);
  const [dbConnected, setDbConnected] = useState(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [announcement, setAnnouncement] = useState(null);
  const [showAnnouncementPopup, setShowAnnouncementPopup] = useState(false);
  const [regStatus, setRegStatus] = useState(null);
  const [showClosedModal, setShowClosedModal] = useState(false);

  useEffect(() => {
    data.fetchRegistrationStatus().then((res) => {
      if (res.data) setRegStatus(res.data);
    });

    data.getCurrentProfile().then(({ data: profile }) => {
      if (profile) navigate("/dashboard", { replace: true });
    });

    let timer;
    if (data.isConfigured()) {
      data.fetchTimelineEvents().then((res) => {
        if (res.data && res.data.length > 0) {
          setTimelineData(res.data);
        }
      });
      data.fetchAnnouncements().then((res) => {
        if (res.data && res.data.length > 0) {
          const active = res.data.find(
            (a) => a.active && (a.target === "student" || a.target === "all" || !a.target)
          );
          if (active) {
            setAnnouncement(active);
            const isDismissed = sessionStorage.getItem("sih_announcement_dismissed");
            if (!isDismissed) {
              timer = setTimeout(() => {
                setShowAnnouncementPopup(true);
              }, 3000);
            }
          }
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

    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [navigate]);

  const handleRegisterClick = (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (regStatus && !regStatus.is_open) {
      window.scrollTo({ top: 0, left: 0, behavior: "instant" });
      setShowClosedModal(true);
    } else {
      navigate("/register");
    }
  };

  const heroRef = useAnime((el) => {
    const anims = [];
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
    <div className="page-transition min-h-screen bg-transparent relative overflow-x-hidden">
      {/* College Banner Background with smooth fade */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-screen overflow-hidden">
        <div
          className="absolute inset-0 bg-cover bg-center bg-no-repeat opacity-[0.80]"
          style={{ backgroundImage: "url('/smvec-banner.jpeg')" }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/45 via-black/15 to-[#050b18]" />
        <div className="bg-grid absolute inset-0 opacity-55" />
      </div>

      <header className="sticky top-0 z-40 border-b border-[rgba(201,162,39,0.18)] bg-[#050b18] backdrop-blur-md">
        {/* SMVEC gold top accent bar */}
        <div className="h-1 w-full bg-gradient-to-r from-transparent via-[#c9a227] to-transparent" />
        <div className="mx-auto flex h-[4.5rem] w-full max-w-[1536px] items-center justify-between px-4 sm:px-5 gap-3">

          {/* Logo — fixed width, never grows */}
          <a
            href="/"
            onClick={(e) => { e.preventDefault(); navigate("/"); }}
            className="flex items-center shrink-0"
          >
            <CollegeBrand />
          </a>

          {/* Desktop nav — centre */}
          <nav className="hidden items-center gap-1 lg:flex flex-1 justify-center">
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

          {/* Right actions — shrink-0 so they never collapse */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <span className="hidden sm:inline-flex">
              <Button
                variant="ghost"
                className="text-[#8fa0c0] hover:text-[#e8c058] px-2.5 py-1.5 text-xs sm:px-3 sm:py-2 sm:text-sm"
                onClick={() => navigate("/login")}
              >
                Log in
              </Button>
            </span>
            <Button
              onClick={handleRegisterClick}
              className="bg-[#c9a227] text-[#06090f] hover:bg-[#e8c058] font-bold border-0 px-3 py-1.5 text-xs sm:px-4 sm:py-2 sm:text-sm whitespace-nowrap"
            >
              Register Now
            </Button>
            {/* Hamburger */}
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="inline-flex items-center justify-center p-2 rounded-lg border border-[rgba(201,162,39,0.18)] bg-card/50 text-[#8fa0c0] hover:text-[#e8c058] lg:hidden"
              aria-label="Toggle navigation menu"
            >
              {mobileMenuOpen ? (
                <X className="size-5" strokeWidth={1.8} />
              ) : (
                <Menu className="size-5" strokeWidth={1.8} />
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Mobile navigation panel */}
      {mobileMenuOpen && (
        <div className="lg:hidden fixed inset-x-0 top-[4.5rem] z-30 border-b border-[rgba(201,162,39,0.18)] bg-[#050b18]/98 px-5 py-4 flex flex-col gap-2 shadow-lg max-h-[calc(100dvh-4.5rem)] overflow-y-auto">
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
        {/* ── First Section (Hero + Marquee pinned at bottom of viewport) ── */}
        <section className="relative flex min-h-[calc(100dvh-4.5rem)] flex-col justify-between overflow-hidden">
          <div className="mx-auto flex w-full max-w-[1536px] flex-1 flex-col items-center justify-center px-5 py-8 sm:py-12">
            <div ref={heroRef} className="mx-auto flex max-w-3xl flex-col items-center gap-6 text-center">
              <h1 className="reveal text-4xl font-bold leading-[1.08] tracking-tight text-white drop-shadow-[0_4px_16px_rgba(0,0,0,0.9)] sm:text-6xl">
                Smart India Hackathon 2026
                <br />
                <span className="text-gradient">SMVEC Internal</span>
              </h1>
              <span className="reveal inline-flex items-center gap-2 rounded-full border border-[#c9a227]/50 bg-black/50 backdrop-blur-md px-4 py-3 mt-6 sm:mt-8 text-sm font-semibold text-[#e8c058]">
                “The right team can turn a good idea into a winning solution.”
              </span>
            </div>
          </div>

          {/* Marquee pinned to the end of the first section/viewport */}
          <div className="w-full border-y border-[rgba(201,162,39,0.15)] bg-card/30 backdrop-blur-sm py-4 mt-auto">
            <div className="mb-3 text-center text-xs font-semibold uppercase tracking-widest text-[#c9a227]/70">
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
          </div>
        </section>

        {/* ── Timeline ── */}
        <section id="timeline" className="relative overflow-hidden mx-auto w-full max-w-4xl px-5 py-12 sm:py-24 mt-4 sm:mt-8">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">Key dates</h2>
            <p className="mt-3 text-muted-foreground">
              Mark these on your calendar — especially the registration deadline.
            </p>
          </div>

          <ol className="relative mt-14 flex flex-col gap-6">
            {/* Continuous vertical line behind all nodes */}
            <li aria-hidden="true" className="pointer-events-none absolute left-[1.75rem] top-7 hidden h-[calc(100%-3.5rem)] w-0.5 -translate-x-1/2 sm:block bg-slate-800/90" />
            {(timelineData.length > 0 ? timelineData : getComputedTimeline(TIMELINE)).map((item, i, arr) => {
              const isLast = i === arr.length - 1;
              return (
                <TimelineItem
                  key={item.label}
                  item={item}
                  isLast={isLast}
                  index={i}
                  navigate={navigate}
                  onRegisterClick={handleRegisterClick}
                />
              );
            })}
          </ol>
        </section>

        <section id="features" className="mx-auto w-full max-w-[1536px] px-5 py-20 sm:py-28">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Everything for your registration, in one place
            </h2>
            <p className="mt-3 text-muted-foreground">
              Dynamic project details, easy secure logins, and real-time timeline feeds for the SIH 2026 registration.
            </p>
          </div>

          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <div
                key={f.title}
                className="card-hover rounded-xl border border-[rgba(201,162,39,0.15)] bg-card/50 backdrop-blur-md p-6 hover:border-[rgba(201,162,39,0.45)] transition-all"
              >
                <span className="flex size-10 items-center justify-center rounded-lg bg-[rgba(201,162,39,0.12)] text-[#c9a227]">
                  {f.icon}
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

          <div className="mt-12 grid gap-4 sm:grid-cols-2 md:grid-cols-3">
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
                onClick={handleRegisterClick}
                className="mt-8 bg-[#c9a227] text-[#06090f] hover:bg-[#e8c058] font-bold border-0 px-6 py-2.5 w-full sm:w-auto"
              >
                Register Now
              </Button>
            </div>
          </div>
        </section>
      </main>

      <RuixenGradientFooter gradientHeight="16vh" stops={["#050b18", "#081026", "#c9a227"]}>
        <div className="mx-auto w-full max-w-[1536px] px-5 pt-14">
          <div className="flex flex-col gap-10 pb-14 sm:flex-row sm:items-start sm:justify-between">
            <div className="max-w-xs">
              <div className="flex items-center gap-3">
                <img src="/logo.png" alt="Sri Manakula Vinayagar Engineering College" className="h-16 w-auto brightness-110 contrast-125" />
              </div>
              <p className="mt-4 text-sm leading-relaxed text-white/80">
                The internal team-formation portal for Smart India Hackathon 2026, hosted by Sri
                Manakula Vinayagar Engineering College, Puducherry.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-10">
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
                title="Resources"
                links={[
                  { label: "Rules", href: "#rules" },
                  { label: "Departments", href: "#features" },
                  { label: "smvec.ac.in", href: "https://smvec.ac.in" },
                ]}
              />
            </div>
          </div>
          <div className="border-t border-white/15 py-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex flex-col items-start gap-2">
              <p className="text-xs text-white/70">
                © 2026 Sri Manakula Vinayagar Engineering College · SIH 2026 Team Builder
              </p>
              <a
                href="/admin"
                onClick={(e) => {
                  e.preventDefault();
                  navigate("/admin");
                }}
                className="text-xs font-semibold text-[#dba328] opacity-0 hover:opacity-50 transition-opacity duration-300 flex items-center gap-1.5 cursor-pointer"
              >
                <Lock className="size-3 shrink-0" strokeWidth={2.5} />
                <span>Admin Portal</span>
              </a>
            </div>
            <div className="flex items-center">
              {dbConnected === null && (
                <span className="size-2 rounded-full bg-neutral-500 animate-pulse" title="Checking database connection..." />
              )}
              {dbConnected === true && (
                <span className="size-2 rounded-full bg-emerald-500 shadow-[0_0_8px_#10b981]" title="Database connected" />
              )}
              {dbConnected === false && (
                <span className="size-2 rounded-full bg-rose-500 shadow-[0_0_8px_#f43f5e]" title="Database disconnected" />
              )}
            </div>
          </div>
        </div>
      </RuixenGradientFooter>

      <RegistrationClosedModal
        isOpen={showClosedModal}
        onClose={() => setShowClosedModal(false)}
        message={regStatus?.closing_message}
        closingDate={regStatus?.closing_date}
      />

      {/* ── Floating Top Announcement Banner ── */}
      {showAnnouncementPopup && announcement && (
        <div className="fixed top-6 left-1/2 z-50 w-[95%] max-w-xl rounded-xl border border-[rgba(201,162,39,0.25)] bg-[rgba(10,18,38,0.85)] backdrop-blur-lg p-4 shadow-[0_10px_25px_-5px_rgba(0,0,0,0.5),0_0_15px_-3px_rgba(201,162,39,0.1)] flex flex-col gap-3 animate-slide-down">
          {/* Close button at absolute top right */}
          <button
            onClick={() => {
              sessionStorage.setItem("sih_announcement_dismissed", "true");
              setShowAnnouncementPopup(false);
            }}
            className="absolute top-3 right-3 text-white/40 hover:text-white transition-colors p-1 cursor-pointer z-10"
          >
            <X className="size-3.5" strokeWidth={2.5} />
          </button>

          <div className="flex items-start gap-3 flex-1 min-w-0 pr-4">
            <div className="flex-1 min-w-0">
              <p className="text-[12px] text-white/95 font-medium leading-relaxed whitespace-pre-wrap font-sans">
                {announcement.content ? announcement.content.replace(/\p{Extended_Pictographic}/gu, "").replace(/^[ \t]+/gm, "").trim() : ""}
              </p>
            </div>
          </div>

          {/* Center-aligned Register Now button at bottom */}
          <div className="flex justify-center w-full mt-1.5">
            <Button
              onClick={() => {
                sessionStorage.setItem("sih_announcement_dismissed", "true");
                setShowAnnouncementPopup(false);
                navigate("/register");
              }}
              className="text-[10px] font-bold px-5 py-1.5 bg-[#c9a227] text-[#06090f] hover:bg-[#e8c058] border-0 rounded-lg shadow-sm"
            >
              Register Now
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function TimelineItem({ item, isLast, index, navigate, onRegisterClick }) {
  const [inView, setInView] = useState(false);
  const [ref, setRef] = useState(null);

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
      style={{ transitionDelay: `${index * 120}ms` }}
      className={`relative flex items-start gap-6 sm:gap-10 transition-all duration-[800ms] ease-out ${
        inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-12"
      }`}
    >
      {/* Left column: node only — the continuous line is behind the ol */}
      <div className="hidden shrink-0 flex-col items-center sm:flex">
        <div
          className={[
            "relative z-10 flex size-14 items-center justify-center rounded-2xl border-2 transition-all",
            item.status === "done"
              ? "border-success bg-[#061712] text-success"
              : item.status === "active"
                ? "border-[#c9a227] bg-[#1c1708] text-[#c9a227] shadow-[0_0_28px_-6px_rgba(201,162,39,0.55)]"
                : "border-slate-800 bg-[#091122] text-muted-foreground",
          ].join(" ")}
        >
          {item.status === "done" && (
            <Check className="size-6" />
          )}
          {item.status === "active" && (
            <Pencil className="size-5" />
          )}
          {item.status === "upcoming" && (
            <Clock className="size-5" />
          )}
        </div>
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
              onClick={onRegisterClick}
              className="inline-flex items-center gap-1.5 rounded-xl bg-[#c9a227] px-4 py-2 text-xs font-bold text-[#06090f] transition-opacity hover:opacity-90"
            >
              Register before deadline
              <ArrowRight className="size-3.5" />
            </a>
          </div>
        )}
      </div>
    </li>
  );
}

function FaqItem({ q, a }) {
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
          <Plus className="size-4" strokeWidth={2} />
        </span>
      </button>
      {open && (
        <p className="px-5 pb-5 text-sm leading-relaxed text-muted-foreground">{a}</p>
      )}
    </div>
  );
}

function FooterCol({ title, links }) {
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
