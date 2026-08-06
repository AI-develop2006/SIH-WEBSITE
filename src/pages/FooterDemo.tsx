import { CollegeBrand } from "@/components/college-brand";
import { RuixenGradientFooter } from "@/components/ui/ruixen-gradient-footer";

const NAV_LINKS = [
  { label: "Apply", href: "/register" },
  { label: "Features", href: "#features" },
  { label: "How it works", href: "#how" },
  { label: "Rules", href: "#rules" },
  { label: "FAQ", href: "#faq" },
];

export default function FooterDemo() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
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

          <a
            href="/register"
            className="rounded-lg bg-[#DBA328] px-4 py-2 text-sm font-semibold text-[#36429B] hover:opacity-90"
          >
            Apply Now
          </a>
        </div>
      </header>

      <main className="flex-1">
        <section className="mx-auto w-full max-w-7xl px-5 pb-56 pt-24 text-center">
          <h1 className="text-4xl font-bold tracking-tight sm:text-6xl">
            Gradient footer preview
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-muted-foreground">
            Scroll down to see the RuixenGradientFooter rise into view with its glowing,
            blur-blended gradient bands.
          </p>
        </section>
      </main>

      <RuixenGradientFooter gradientHeight="50vh" stops={["#36429B", "#7C3AED", "#DBA328"]}>
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
              <DemoFooterCol title="Product" links={NAV_LINKS} />
              <DemoFooterCol
                title="Get started"
                links={[
                  { label: "Apply now", href: "/register" },
                  { label: "Log in", href: "/login" },
                  { label: "Dashboard", href: "/dashboard" },
                ]}
              />
              <DemoFooterCol
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

function DemoFooterCol({ title, links }: { title: string; links: { label: string; href: string }[] }) {
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
