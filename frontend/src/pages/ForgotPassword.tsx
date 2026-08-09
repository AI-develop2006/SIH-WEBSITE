"use client";

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { assertSupabase } from "@/lib/supabase/client";
import * as data from "@/lib/data";
import { useToast } from "@/components/unlumen-ui/toast";
import { Button } from "@/components/unlumen-ui/button";
import { Input } from "@/components/unlumen-ui/input";
import { CollegeBrand } from "@/components/college-brand";

export default function ForgotPasswordPage() {
  const navigate = useNavigate();
  const toast = useToast();

  const [step, setStep] = useState(0); // 0 = Verification, 1 = Set Password
  const [busy, setBusy] = useState(false);
  const [success, setSuccess] = useState(false);
  const [form, setForm] = useState({
    registerNo: "",
    email: "",
    newPassword: "",
    confirmPassword: ""
  });

  // Step 0: Verify Register Number and Email match
  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    const regNo = form.registerNo.trim().toUpperCase();
    const email = form.email.trim().toLowerCase();

    if (!regNo || !email) return;

    if (!email.endsWith("@smvec.ac.in")) {
      toast("error", "Please enter your college email ending with @smvec.ac.in");
      return;
    }

    setBusy(true);
    try {
      const res = await data.getEmailByRegisterNo(regNo);
      if (res.error) throw new Error(res.error);
      if (!res.email) {
        throw new Error("Register number not found. Please check and try again.");
      }
      if (res.email.toLowerCase() !== email) {
        throw new Error("The email address does not match your registered college email.");
      }

      // If matched, advance to step 1
      setStep(1);
      toast("success", "Account verified! Please set your new password.");
    } catch (err) {
      toast("error", err instanceof Error ? err.message : "Verification failed. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  // Step 1: Submit new password to Supabase
  async function handleResetPassword(e: React.FormEvent) {
    e.preventDefault();
    const regNo = form.registerNo.trim().toUpperCase();
    const email = form.email.trim().toLowerCase();
    const password = form.newPassword;
    const confirm = form.confirmPassword;

    if (!password || !confirm) return;

    if (password.length < 6) {
      toast("error", "Password must be at least 6 characters");
      return;
    }

    if (password !== confirm) {
      toast("error", "Passwords do not match");
      return;
    }

    setBusy(true);
    try {
      const supabase = assertSupabase();

      // Call our custom Postgres stored procedure to update password
      const { data: resetSuccess, error } = await supabase.rpc("reset_student_password", {
        p_register_no: regNo,
        p_email: email,
        p_new_password: password
      });

      if (error) throw new Error(error.message);

      if (resetSuccess === true) {
        setSuccess(true);
        toast("success", "Password reset successfully!");
      } else {
        throw new Error("Reset failed. Verification mismatch. Please restart the process.");
      }
    } catch (err) {
      toast("error", err instanceof Error ? err.message : "Password reset failed. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="page-transition flex min-h-screen flex-col overflow-hidden">
      {/* Gold top accent bar */}
      <div className="h-1 w-full bg-gradient-to-r from-transparent via-[#c9a227] to-transparent" />

      <div className="grow flex flex-col lg:flex-row">
        {/* Left panel */}
        <div className="relative w-full overflow-hidden lg:fixed lg:inset-y-0 lg:w-1/2 lg:rounded-r-[3rem] border-r border-[rgba(147,197,253,0.08)] bg-card/60 backdrop-blur-xl">
          <div className="absolute inset-y-0 right-0 hidden w-[2px] lg:block"
            style={{ background: "linear-gradient(to bottom, transparent, #c9a227 30%, #c9a227 70%, transparent)" }} />
          <div aria-hidden="true" className="pointer-events-none absolute inset-0">
            <div className="bg-grid absolute inset-0 opacity-40" />
          </div>
          <div className="relative h-full lg:h-screen w-full max-w-xl mx-auto flex flex-col justify-start px-5 py-6 sm:px-6 lg:justify-center lg:py-20">
            <div className="mt-8 flex justify-center lg:mt-0">
              <a href="/" className="inline-flex">
                <CollegeBrand className="scale-[1.5] sm:scale-[1.75] origin-center" />
              </a>
            </div>
            <div className="mt-14 space-y-4 lg:mt-12">
              <p className="font-caveat text-3xl text-[#e8c058]">Reset your password</p>
              <h1 className="text-4xl font-bold leading-tight tracking-tight text-white sm:text-5xl">
                {step === 0 ? "Verify your student account." : "Create your new password."}
              </h1>
              <p className="block font-caveat text-xl text-[#8fa0c0]">
                {step === 0 ? "— Enter your details to get started" : "— Make it at least 6 characters long"}
              </p>
            </div>
            <div className="mt-10 gold-bar w-24" />
          </div>
        </div>

        {/* Right panel */}
        <main className="flex w-full flex-col bg-transparent lg:ml-auto lg:w-1/2 lg:h-screen lg:overflow-y-auto">
          <div className="grow w-full max-w-xl mx-auto px-5 py-12 sm:px-6 lg:py-16">
            {/* Nav */}
            <div className="mb-8 flex items-center gap-3">
              <button
                type="button"
                onClick={() => {
                  if (step === 1 && !success) {
                    setStep(0);
                  } else {
                    navigate("/login");
                  }
                }}
                className="inline-flex items-center gap-2 rounded-xl border border-[rgba(201,162,39,0.20)] bg-[rgba(201,162,39,0.05)] px-3.5 py-2 text-sm font-medium text-[#8fa0c0] transition-colors hover:border-[rgba(201,162,39,0.45)] hover:bg-[rgba(201,162,39,0.10)] hover:text-[#e8c058]"
              >
                {step === 1 && !success ? "← Back to Verification" : "← Back to Login"}
              </button>
            </div>

            {success ? (
              /* Success state */
              <div className="flex flex-col items-center justify-center min-h-[50vh] text-center gap-6">
                <div className="flex size-20 items-center justify-center rounded-full bg-[rgba(201,162,39,0.12)] border border-[rgba(201,162,39,0.3)]">
                  <svg xmlns="http://www.w3.org/2000/svg" className="size-10 text-[#c9a227]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-white">Password Reset Successful!</h2>
                  <p className="mt-2 text-muted-foreground max-w-sm">
                    Your password has been changed. You can now use your new password to sign in.
                  </p>
                </div>
                <Button className="mt-2 w-full max-w-xs bg-[#c9a227] text-[#06090f] hover:bg-[#e8c058] font-bold border-0" onClick={() => navigate("/login")}>
                  Log in now
                </Button>
              </div>
            ) : step === 0 ? (
              /* Step 0: Verification Form */
              <div className="flex flex-col animate-page-enter">
                <div className="mb-8">
                  <p className="font-caveat text-2xl text-[#dba328]">Smart India Hackathon 2026</p>
                  <h2 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">Verify Account</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Enter your Registered details to verify your account identity.
                  </p>
                </div>

                <form onSubmit={handleVerify} className="flex flex-col gap-5">
                  <Input
                    label="Register Number"
                    type="text"
                    value={form.registerNo}
                    onChange={(e) => setForm((f) => ({ ...f, registerNo: e.target.value.toUpperCase() }))}
                    placeholder="e.g. 24UAI123"
                    required
                  />
                  <div>
                    <Input
                      label="College Email"
                      type="email"
                      value={form.email}
                      onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                      placeholder="yourname@smvec.ac.in"
                      required
                    />
                    <p className="mt-1.5 text-xs text-muted-foreground">Must be your registered @smvec.ac.in email</p>
                  </div>

                  <div className="mt-4 flex items-center justify-between border-t border-border pt-6">
                    <Button type="button" variant="ghost" onClick={() => navigate("/login")}>
                      Cancel
                    </Button>
                    <Button type="submit" loading={busy}>
                      Verify Details
                    </Button>
                  </div>
                </form>
              </div>
            ) : (
              /* Step 1: Set New Password Form */
              <div className="flex flex-col animate-page-enter">
                <div className="mb-8">
                  <p className="font-caveat text-2xl text-[#dba328]">Account Verified</p>
                  <h2 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">Set New Password</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Enter your new password below to secure your account.
                  </p>
                </div>

                <form onSubmit={handleResetPassword} className="flex flex-col gap-5">
                  <Input
                    label="New Password"
                    type="password"
                    value={form.newPassword}
                    onChange={(e) => setForm((f) => ({ ...f, newPassword: e.target.value }))}
                    placeholder="At least 6 characters"
                    required
                  />
                  <Input
                    label="Confirm New Password"
                    type="password"
                    value={form.confirmPassword}
                    onChange={(e) => setForm((f) => ({ ...f, confirmPassword: e.target.value }))}
                    placeholder="Confirm your new password"
                    required
                  />

                  <div className="mt-4 flex items-center justify-between border-t border-border pt-6">
                    <Button type="button" variant="ghost" onClick={() => setStep(0)}>
                      ← Back
                    </Button>
                    <Button type="submit" loading={busy}>
                      Reset Password
                    </Button>
                  </div>
                </form>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
