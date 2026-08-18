"use client";

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import * as data from "@/lib/data";
import { Home } from "lucide-react";
import { RegisterForm } from "@/components/auth/register-form";
import { CollegeBrand } from "@/components/common/college-brand";
import { RegistrationClosedModal } from "@/components/common/registration-closed-modal";

export default function RegisterPage() {
  const navigate = useNavigate();
  const [regStatus, setRegStatus] = useState(null);
  const [isClosed, setIsClosed] = useState(false);

  useEffect(() => {
    data.getCurrentProfile().then(({ data: profile }) => {
      if (profile) navigate("/dashboard", { replace: true });
    });

    data.fetchRegistrationStatus().then((res) => {
      if (res.data) {
        setRegStatus(res.data);
        if (!res.data.is_open) {
          setIsClosed(true);
        }
      }
    });
  }, [navigate]);

  return (
    <div className="page-transition flex min-h-screen flex-col overflow-hidden">
      <RegistrationClosedModal
        isOpen={isClosed}
        onClose={() => navigate("/")}
        message={regStatus?.closing_message}
        closingDate={regStatus?.closing_date}
      />

      {/* SMVEC gold top accent bar */}
      <div className="h-1 w-full bg-gradient-to-r from-transparent via-[#c9a227] to-transparent" />

      <div className="grow flex flex-col lg:flex-row">
        {/* Left panel — Glass styled midnight panel */}
        <div className="relative w-full overflow-hidden lg:fixed lg:inset-y-0 lg:w-1/2 lg:rounded-r-[3rem] border-r border-[rgba(147,197,253,0.08)] bg-card/60 backdrop-blur-xl">

          {/* Gold vertical border on rounded right edge */}
          <div className="absolute inset-y-0 right-0 hidden w-[2px] lg:block"
            style={{ background: "linear-gradient(to bottom, transparent, #c9a227 30%, #c9a227 70%, transparent)" }} />

          {/* Subtle grid decoration inside left panel */}
          <div aria-hidden="true" className="pointer-events-none absolute inset-0">
            <div className="bg-grid absolute inset-0 opacity-40" />
          </div>

          <div className="relative h-full lg:h-screen w-full max-w-xl mx-auto flex flex-col justify-start px-5 py-6 sm:px-6 lg:justify-center lg:py-20">
            {/* Logo */}
            <div className="mt-4 lg:mt-0 flex justify-center">
              <a href="/" className="inline-flex">
                <CollegeBrand className="scale-[1.3] sm:scale-[1.75] origin-center" />
              </a>
            </div>

            <div className="mt-6 lg:mt-12 space-y-3 lg:space-y-4">
              <p className="font-caveat text-2xl lg:text-3xl text-[#e8c058]">Registration for</p>
              <h1 className="text-3xl lg:text-4xl font-bold leading-tight tracking-tight text-white sm:text-5xl">
                SIH Internal Hackathon Registration 2026
              </h1>
            </div>

            {/* Gold divider line */}
            <div className="mt-6 lg:mt-10 gold-bar w-24" />
          </div>
        </div>

        {/* Right panel */}
        <main className="flex w-full flex-col bg-transparent lg:ml-auto lg:w-1/2 lg:h-screen lg:overflow-y-auto">
          <div className="grow w-full max-w-xl mx-auto px-5 py-12 sm:px-6 lg:py-16">
            {/* Home nav */}
            <div className="mb-8 flex items-center gap-3">
              <a
                href="/"
                className="inline-flex items-center gap-2 rounded-xl border border-[rgba(201,162,39,0.20)] bg-[rgba(201,162,39,0.05)] px-3.5 py-2 text-sm font-medium text-[#8fa0c0] transition-colors hover:border-[rgba(201,162,39,0.45)] hover:bg-[rgba(201,162,39,0.10)] hover:text-[#e8c058]"
                title="Back to home"
              >
                <Home className="size-4 shrink-0" />
                Home
              </a>
              <span className="text-xs text-muted-foreground">Already registered?{" "}
                <a href="/login" className="font-semibold text-[#c9a227] hover:underline">Log in</a>
              </span>
            </div>
            <RegisterForm />
          </div>
        </main>
      </div>
    </div>
  );
}
