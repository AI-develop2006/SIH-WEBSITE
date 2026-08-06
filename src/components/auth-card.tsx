"use client";

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { assertSupabase, isSupabaseConfigured } from "@/lib/supabase/client";
import { useToast } from "@/components/unlumen-ui/toast";
import { Button } from "@/components/unlumen-ui/button";
import { Input } from "@/components/unlumen-ui/input";

export function AuthCard() {
  const navigate = useNavigate();
  const toast = useToast();
  const configured = isSupabaseConfigured();

  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ email: "", password: "" });

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const supabase = assertSupabase();
      const { error } = await supabase.auth.signInWithPassword({
        email: form.email.trim(),
        password: form.password,
      });
      if (error) throw new Error(error.message);
      toast("success", "Welcome back!");
      navigate("/dashboard");
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
          Supabase isn&apos;t configured yet. Copy <code className="font-mono">.env.local.example</code> to{" "}
          <code className="font-mono">.env.local</code>, add your project URL + anon key, then run the
          migrations in <code className="font-mono">supabase/migrations</code>.
        </div>
      )}

      <div className="mb-8">
        <p className="font-caveat text-2xl text-[#dba328]">Smart India Hackathon 2026</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">Welcome back</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Log in with the email you used to register for SIH 2026.
        </p>
      </div>

      <form onSubmit={handleLogin} className="flex grow flex-col">
        <article className="divide-y divide-border">
          <section className="py-8">
            <div className="mb-5 flex items-baseline justify-between gap-3">
              <h2 className="text-lg font-semibold tracking-tight">Account access</h2>
              <span className="text-[11px] font-semibold uppercase tracking-widest text-[#dba328]">
                Required <span className="text-danger">*</span>
              </span>
            </div>

            <div className="flex flex-col gap-4">
              <Input
                label="Email"
                type="email"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                placeholder="you@college.edu"
                required
              />
              <Input
                label="Password"
                type="password"
                value={form.password}
                onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                placeholder="••••••••"
                required
              />
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

      <div className="mt-6 border-t border-border pt-5 text-center">
        <p className="text-sm text-muted-foreground">New participant?</p>
        <Button variant="outline" className="mt-2 w-full" onClick={() => navigate("/register")}>
          Apply via registration form
        </Button>
      </div>
    </div>
  );
}
