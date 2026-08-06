"use client";

import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase/client";
import { AuthCard } from "@/components/auth-card";
import { CollegeBrand } from "@/components/college-brand";

export default function LoginPage() {
  const navigate = useNavigate();

  useEffect(() => {
    supabase?.auth.getSession().then(({ data }) => {
      if (data.session) navigate("/dashboard", { replace: true });
    });
  }, [navigate]);

  return (
    <div className="page-transition flex min-h-screen flex-col overflow-hidden">
      {/* SMVEC gold top accent bar */}
      <div className="h-1 w-full bg-gradient-to-r from-transparent via-[#c9a227] to-transparent" />

      <div className="grow flex flex-col lg:flex-row">
        {/* Left panel — Glass styled midnight panel */}
        <div className="relative w-full overflow-hidden lg:fixed lg:inset-y-0 lg:w-1/2 lg:rounded-r-[3rem] border-r border-[rgba(147,197,253,0.08)] bg-card/60 backdrop-blur-xl">

          {/* Gold top border on rounded right edge */}
          <div className="absolute inset-y-0 right-0 hidden w-[2px] lg:block"
            style={{ background: "linear-gradient(to bottom, transparent, #c9a227 30%, #c9a227 70%, transparent)" }} />

          {/* Subtle grid decoration inside left panel */}
          <div aria-hidden="true" className="pointer-events-none absolute inset-0">
            <div className="bg-grid absolute inset-0 opacity-40" />
          </div>

          <div className="relative min-h-full w-full max-w-xl mx-auto flex flex-col justify-start px-5 py-6 sm:px-6 lg:justify-center lg:py-20">
            {/* Logo */}
            <div className="mt-8 flex justify-center lg:mt-0">
              <a href="/" className="inline-flex">
                <CollegeBrand className="scale-[1.5] sm:scale-[1.75] origin-center" />
              </a>
            </div>

            <div className="mt-14 space-y-4 lg:mt-12">
              {/* Gold accent label */}
              <p className="font-caveat text-3xl text-[#e8c058]">Welcome back</p>
              <h1 className="text-4xl font-bold leading-tight tracking-tight text-white sm:text-5xl">
                Log in with your Register Number.
              </h1>
              <p className="block font-caveat text-xl text-[#8fa0c0]">— Welcome back to SIH 2026</p>
            </div>

            {/* Gold divider line */}
            <div className="mt-10 gold-bar w-24" />
          </div>
        </div>

        {/* Right panel */}
        <main className="flex w-full flex-col bg-transparent lg:ml-auto lg:w-1/2">
          <div className="grow w-full max-w-xl mx-auto px-5 py-12 sm:px-6 lg:pt-20 lg:pb-24">
            {/* Home nav */}
            <div className="mb-8 flex items-center gap-3">
              <a
                href="/"
                className="inline-flex items-center gap-2 rounded-xl border border-[rgba(201,162,39,0.20)] bg-[rgba(201,162,39,0.05)] px-3.5 py-2 text-sm font-medium text-[#8fa0c0] transition-colors hover:border-[rgba(201,162,39,0.45)] hover:bg-[rgba(201,162,39,0.10)] hover:text-[#e8c058]"
                title="Back to home"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="size-4 shrink-0">
                  <path fillRule="evenodd" d="M9.293 2.293a1 1 0 0 1 1.414 0l7 7A1 1 0 0 1 17 11h-1v6a1 1 0 0 1-1 1h-2a1 1 0 0 1-1-1v-3a1 1 0 0 0-1-1H9a1 1 0 0 0-1 1v3a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-6H3a1 1 0 0 1-.707-1.707l7-7Z" clipRule="evenodd" />
                </svg>
                Home
              </a>
              <span className="text-xs text-muted-foreground">New here?{" "}
                <a href="/register" className="font-semibold text-[#c9a227] hover:underline">Register</a>
              </span>
            </div>
            <AuthCard />
          </div>
        </main>
      </div>
    </div>
  );
}
