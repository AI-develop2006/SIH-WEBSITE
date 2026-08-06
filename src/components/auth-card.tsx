"use client";

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { assertSupabase, isSupabaseConfigured } from "@/lib/supabase/client";
import { useToast } from "@/components/unlumen-ui/toast";

const inputCls =
  "w-full rounded-xl border border-[rgba(201,162,39,0.25)] bg-[#0d1a35] px-3.5 py-2.5 text-sm text-white outline-none transition-all placeholder:text-[#4e6080] focus:border-[#c9a227] focus:shadow-[0_0_0_3px_rgba(201,162,39,0.15)]";

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
        <div className="mb-6 rounded-xl border border-yellow-500/40 bg-yellow-500/10 px-5 py-3 text-sm text-yellow-300">
          Supabase isn&apos;t configured yet. Copy{" "}
          <code className="font-mono">.env.local.example</code> to{" "}
          <code className="font-mono">.env.local</code>, add your project URL + anon key, then run the
          migrations in <code className="font-mono">supabase/migrations</code>.
        </div>
      )}

      {/* ── Header ── */}
      <div className="mb-8">
        <p className="font-caveat text-2xl text-[#c9a227]">Smart India Hackathon 2026</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-white sm:text-3xl">
          Welcome back
        </h1>
        <p className="mt-1 text-sm text-[#8fa0c0]">
          Log in with the email you used to register for SIH 2026.
        </p>
      </div>

      <form onSubmit={handleLogin} className="flex grow flex-col">
        <article className="divide-y divide-[rgba(201,162,39,0.15)]">
          <section className="py-8">
            {/* ── Section header ── */}
            <div className="mb-5 flex items-baseline justify-between gap-3">
              <h2 className="text-lg font-semibold tracking-tight text-white">
                Account access
              </h2>
              <span className="text-[11px] font-semibold uppercase tracking-widest text-[#c9a227]">
                Required <span className="text-red-400">*</span>
              </span>
            </div>

            <div className="flex flex-col gap-5">
              {/* Email */}
              <div>
                <label className="mb-1.5 block text-sm font-medium text-[#c9a227]">
                  Email <span className="text-red-400">*</span>
                </label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  placeholder="you@college.edu"
                  className={inputCls}
                  required
                />
              </div>

              {/* Password */}
              <div>
                <label className="mb-1.5 block text-sm font-medium text-[#c9a227]">
                  Password <span className="text-red-400">*</span>
                </label>
                <input
                  type="password"
                  value={form.password}
                  onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                  placeholder="••••••••"
                  className={inputCls}
                  required
                />
              </div>
            </div>
          </section>
        </article>

        {/* ── Nav buttons ── */}
        <div className="mt-8 flex items-center justify-between border-t border-[rgba(201,162,39,0.15)] pt-6">
          <button
            type="button"
            onClick={() => navigate("/")}
            className="rounded-lg px-4 py-2 text-sm font-semibold text-[#8fa0c0] transition-colors hover:text-white"
          >
            ← Back
          </button>
          <button
            type="submit"
            disabled={busy}
            className="inline-flex items-center gap-2 rounded-lg bg-[#c9a227] px-6 py-2 text-sm font-bold text-[#06090f] transition-colors hover:bg-[#e8c058] disabled:pointer-events-none disabled:opacity-50"
          >
            {busy && <span className="size-3.5 animate-spin rounded-full border-2 border-[#06090f] border-t-transparent" />}
            Log in
          </button>
        </div>
      </form>

      {/* ── Register CTA ── */}
      <div className="mt-6 border-t border-[rgba(201,162,39,0.15)] pt-5 text-center">
        <p className="text-sm text-[#8fa0c0]">New participant?</p>
        <button
          type="button"
          onClick={() => navigate("/register")}
          className="mt-2 w-full rounded-lg border border-[rgba(201,162,39,0.30)] bg-transparent px-4 py-2 text-sm font-semibold text-[#c9a227] transition-colors hover:bg-[rgba(201,162,39,0.08)] hover:text-[#e8c058]"
        >
          Apply via registration form
        </button>
      </div>
    </div>
  );
}
