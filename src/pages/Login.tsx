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
    <div className="flex min-h-screen flex-col overflow-hidden">
      <div className="grow flex flex-col lg:flex-row">
        {/* Left panel */}
        <div className="relative w-full overflow-hidden bg-[#0b1120] lg:fixed lg:inset-y-0 lg:w-1/2 lg:rounded-r-[3rem]">
          {/* Orb backdrops */}
          <div aria-hidden="true" className="pointer-events-none absolute inset-0">
            <div className="orb orb-a absolute -top-40 left-1/2 size-[600px] -translate-x-1/2 opacity-70" />
            <div className="orb orb-b absolute bottom-[-20%] right-[-10%] size-[380px] opacity-60" />
            <div className="bg-grid absolute inset-0" />
          </div>

          <div className="relative min-h-full w-full max-w-xl mx-auto flex flex-col justify-start px-5 py-6 sm:px-6 lg:justify-center lg:py-20">
            {/* Centered logo */}
            <div className="mt-8 flex justify-center lg:mt-0">
              <a href="/" className="inline-flex">
                <CollegeBrand className="scale-[1.5] sm:scale-[1.75] origin-center" />
              </a>
            </div>

            <div className="mt-14 space-y-4 lg:mt-12">
              <p className="font-caveat text-3xl text-accent">Welcome back</p>
              <h1 className="text-4xl font-bold leading-tight tracking-tight text-white sm:text-5xl">
                Log in with the email you used to register for SIH 2026.
              </h1>
              <p className="block font-caveat text-xl text-muted-foreground">— Your team is waiting</p>
            </div>
          </div>
        </div>

        {/* Right panel */}
        <main className="flex w-full flex-col lg:ml-auto lg:w-1/2">
          <div className="grow w-full max-w-xl mx-auto px-5 py-12 sm:px-6 lg:pt-20 lg:pb-24">
            {/* Home nav */}
            <div className="mb-8 flex items-center gap-3">
              <a
                href="/"
                className="inline-flex items-center gap-2 rounded-xl border border-border bg-muted/40 px-3.5 py-2 text-sm font-medium text-muted-foreground transition-colors hover:border-ring/40 hover:bg-muted hover:text-foreground"
                title="Back to home"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="size-4 shrink-0">
                  <path fillRule="evenodd" d="M9.293 2.293a1 1 0 0 1 1.414 0l7 7A1 1 0 0 1 17 11h-1v6a1 1 0 0 1-1 1h-2a1 1 0 0 1-1-1v-3a1 1 0 0 0-1-1H9a1 1 0 0 0-1 1v3a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-6H3a1 1 0 0 1-.707-1.707l7-7Z" clipRule="evenodd" />
                </svg>
                Home
              </a>
              <span className="text-xs text-muted-foreground">New here?{" "}
                <a href="/register" className="font-semibold text-primary hover:underline">Register</a>
              </span>
            </div>
            <AuthCard />
          </div>
        </main>
      </div>
    </div>
  );
}
