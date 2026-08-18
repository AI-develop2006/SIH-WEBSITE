"use client";

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { assertSupabase, isSupabaseConfigured } from "@/lib/supabase/client";
import * as data from "@/lib/data";
import { useToast } from "@/components/unlumen-ui/toast";
import { Button } from "@/components/unlumen-ui/button";
import { Input } from "@/components/unlumen-ui/input";
import { cn } from "@/lib/utils";

export function AuthCard() {
  const navigate = useNavigate();
  const toast = useToast();
  const configured = isSupabaseConfigured();

  const [role, setRole] = useState("student");
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ registerNo: "", phone: "", password: "" });

  async function handleLogin(e) {
    e.preventDefault();
    if (role === "student" && !form.registerNo.trim()) return;
    if (role === "mentor" && !form.phone.trim()) return;
    if (!form.password) return;

    setBusy(true);
    try {
      let email = null;

      if (role === "student") {
        const regNoUpper = form.registerNo.trim().toUpperCase();
        const res = await data.getEmailByRegisterNo(regNoUpper);
        if (res.error) throw new Error(res.error);
        if (!res.email) {
          throw new Error("Register number not found. Please verify your inputs or register first.");
        }
        email = res.email;
      } else {
        const phoneClean = form.phone.replace(/\D/g, "").trim();
        if (phoneClean.length !== 10) {
          throw new Error("Mobile number must be exactly 10 digits.");
        }
        const res = await data.getEmailByMentorPhone(phoneClean);
        if (res.error) throw new Error(res.error);
        if (!res.email) {
          throw new Error("Mentor mobile number not found. Please verify your inputs or contact admin.");
        }
        email = res.email;
      }

      const supabase = assertSupabase();
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password: form.password,
      });
      if (error) throw new Error(error.message);

      toast("success", "Welcome back!");

      const { data: p } = await data.getCurrentProfile();
      if (p?.role === "mentor") {
        navigate("/mentor");
      } else if (p?.role === "admin") {
        navigate("/admin");
      } else {
        navigate("/dashboard");
      }
    } catch (err) {
      toast("error", err instanceof Error ? err.message : "Login failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-[50vh] flex-col">
      {!configured && (
        <div className="mb-6 rounded-xl border border-warning/40 bg-warning/10 px-5 py-3 text-sm text-warning">
          Supabase isn&apos;t configured yet. Add <code className="font-mono">VITE_SUPABASE_URL</code> and{" "}
          <code className="font-mono">VITE_SUPABASE_ANON_KEY</code> to your <code className="font-mono">.env</code> file.
        </div>
      )}

      <div className="mb-6">
        <p className="font-caveat text-2xl text-[#dba328]">Smart India Hackathon 2026</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">Welcome back</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {role === "student" ? "Log in with your Register Number." : "Log in with your registered Mobile Number."}
        </p>
      </div>

      {/* Role Selection Tabs */}
      <div className="flex rounded-xl bg-card/40 p-1 border border-border/40 mb-6 backdrop-blur-md">
        <button
          type="button"
          onClick={() => setRole("student")}
          className={cn(
            "flex-1 rounded-lg py-2.5 text-xs sm:text-sm font-semibold transition-all duration-300",
            role === "student"
              ? "bg-[#c9a227] text-black shadow-md font-bold"
              : "text-muted-foreground hover:text-foreground hover:bg-muted/10"
          )}
        >
          Student Access
        </button>
        <button
          type="button"
          onClick={() => setRole("mentor")}
          className={cn(
            "flex-1 rounded-lg py-2.5 text-xs sm:text-sm font-semibold transition-all duration-300",
            role === "mentor"
              ? "bg-[#c9a227] text-black shadow-md font-bold"
              : "text-muted-foreground hover:text-foreground hover:bg-muted/10"
          )}
        >
          Mentor Access
        </button>
      </div>

      <form onSubmit={handleLogin} className="flex grow flex-col justify-between">
        <article className="divide-y divide-border grow flex flex-col">
          <section className="py-4 grow flex flex-col justify-start">
            <div className="mb-5 flex items-baseline justify-between gap-3">
              <h2 className="text-lg font-semibold tracking-tight">Account access</h2>
              <span className="text-[11px] font-semibold uppercase tracking-widest text-[#dba328]">
                Required <span className="text-danger">*</span>
              </span>
            </div>

            <div className="flex flex-col gap-4">
              {role === "student" ? (
                <Input
                  label="Register Number"
                  type="text"
                  value={form.registerNo}
                  onChange={(e) => setForm((f) => ({ ...f, registerNo: e.target.value }))}
                  placeholder="e.g. 24UAI123"
                  required
                />
              ) : (
                <Input
                  label="Mobile Number"
                  type="tel"
                  value={form.phone}
                  onChange={(e) => {
                    const digitsOnly = e.target.value.replace(/\D/g, "").slice(0, 10);
                    setForm((f) => ({ ...f, phone: digitsOnly }));
                  }}
                  placeholder="e.g. 9876543210"
                  maxLength={10}
                  pattern="[0-9]{10}"
                  required
                />
              )}

              <div className="flex flex-col gap-1.5">
                <Input
                  label="Password"
                  type="password"
                  value={form.password}
                  onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                  placeholder={role === "student" ? "Your custom password" : "Your mentor password"}
                  required
                />
                {role === "student" && (
                  <div className="text-right">
                    <button
                      type="button"
                      onClick={() => navigate("/forgot-password")}
                      className="text-xs font-semibold text-[#c9a227] hover:underline"
                    >
                      Forgot password?
                    </button>
                  </div>
                )}
              </div>
            </div>
          </section>
        </article>

        <div className="mt-8 flex items-center justify-between border-t border-border pt-6">
          <Button type="button" variant="ghost" onClick={() => navigate("/")}>
            ← Back
          </Button>
          <Button type="submit" loading={busy}>
            Log in
          </Button>
        </div>
      </form>

      {role === "student" && (
        <div className="mt-6 border-t border-border pt-5 text-center">
          <p className="text-sm text-muted-foreground">New participant?</p>
          <Button variant="outline" className="mt-2 w-full" onClick={() => navigate("/register")}>
            Apply via registration form
          </Button>
        </div>
      )}
    </div>
  );
}
