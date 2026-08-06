"use client";

import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase/client";
import { RegisterForm } from "@/components/register-form";
import { CollegeBrand } from "@/components/college-brand";
import { ThemeToggle } from "@/components/theme-toggle";

export default function RegisterPage() {
  const navigate = useNavigate();

  useEffect(() => {
    supabase?.auth.getSession().then(({ data }) => {
      if (data.session) navigate("/dashboard", { replace: true });
    });
  }, [navigate]);

  return (
    <div className="flex min-h-screen flex-col overflow-hidden">
      <div className="grow flex flex-col lg:flex-row">
        {/* Left side — quote panel */}
        <div className="relative w-full overflow-hidden bg-[#0b1120] lg:fixed lg:inset-y-0 lg:w-1/2 lg:rounded-r-[3rem]">
          {/* Background illustration */}
          <div className="pointer-events-none absolute -top-64 left-1/2 -translate-x-1/2 blur-3xl" aria-hidden="true">
            <div className="size-[720px] rounded-full" style={{ background: "radial-gradient(circle, rgba(54,66,155,0.55), transparent 65%)" }} />
          </div>
          <div className="pointer-events-none absolute bottom-[-30%] right-[-15%] blur-3xl" aria-hidden="true">
            <div className="size-[420px] rounded-full" style={{ background: "radial-gradient(circle, rgba(219,163,40,0.35), transparent 65%)" }} />
          </div>

          <div className="min-h-full w-full max-w-xl mx-auto flex flex-col justify-start px-5 py-6 sm:px-6 lg:justify-center lg:py-20">
            <div className="flex items-center justify-between">
              <a href="/" className="flex items-center">
                <CollegeBrand />
              </a>
              <ThemeToggle />
            </div>

            <div className="mt-14 space-y-4 lg:mt-6">
              <p className="font-caveat text-3xl text-[#dba328]">Registration for</p>
              <h1 className="text-4xl font-bold leading-tight tracking-tight text-white sm:text-5xl">
                SIH Internal Hackathon Registration-2026
              </h1>
              <p className="block font-caveat text-xl text-slate-400">— 06 August, 2026</p>
            </div>
          </div>
        </div>

        {/* Right side — content */}
        <main className="flex w-full flex-col lg:ml-auto lg:w-1/2">
          <div className="grow w-full max-w-xl mx-auto px-5 py-12 sm:px-6 lg:pt-20 lg:pb-24">
            <RegisterForm />
          </div>
        </main>
      </div>
    </div>
  );
}
