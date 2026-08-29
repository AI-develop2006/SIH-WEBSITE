"use client";

import { useEffect, useRef, useState } from "react";
import { checkSpocMaintenance, loginSpoc } from "@/lib/data";
import { Shield, Wrench, RefreshCw, KeyRound, Eye, EyeOff, X, Lock } from "lucide-react";

/**
 * MaintenanceGate
 *
 * Wraps the entire SPOC app. On every load it calls the backend to check
 * whether maintenance mode is enabled. If it is, the SPOC portal is replaced
 * by a full-screen maintenance overlay.
 *
 * Hidden bypass: press Ctrl+Alt+T anywhere on the maintenance screen
 * to reveal a password prompt. Entering the master password logs in and
 * dismisses the maintenance gate.
 */
export function MaintenanceGate({ children }) {
  const [status, setStatus] = useState("checking"); // checking | ok | maintenance
  const [message, setMessage] = useState("");
  const [retrying, setRetrying] = useState(false);

  // ── bypass overlay state ──────────────────────────────────────────────────
  const [showBypass, setShowBypass] = useState(false);
  const [bypassPassword, setBypassPassword] = useState("");
  const [bypassError, setBypassError] = useState("");
  const [bypassLoading, setBypassLoading] = useState(false);
  const [showPwd, setShowPwd] = useState(false);

  const passwordInputRef = useRef(null);

  async function check() {
    setRetrying(true);
    try {
      const { enabled, message: msg } = await checkSpocMaintenance();
      setMessage(msg);
      setStatus(enabled ? "maintenance" : "ok");
    } catch (_) {
      setStatus("ok");
    } finally {
      setRetrying(false);
    }
  }

  useEffect(() => { check(); }, []);

  // Ctrl+Alt+T keyboard shortcut to reveal bypass panel
  useEffect(() => {
    if (status !== "maintenance") return;

    function handleKeyDown(e) {
      if (showBypass) return;
      // Ctrl+Alt+T (or Cmd+Alt+T on Mac)
      if ((e.ctrlKey || e.metaKey) && e.altKey && e.key === "t") {
        e.preventDefault();
        setShowBypass(true);
        setBypassPassword("");
        setBypassError("");
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [status, showBypass]);

  // Auto-focus password input when overlay opens
  useEffect(() => {
    if (showBypass) {
      setTimeout(() => passwordInputRef.current?.focus(), 80);
    }
  }, [showBypass]);

  async function handleBypassSubmit(e) {
    e.preventDefault();
    if (!bypassPassword.trim()) return;
    setBypassLoading(true);
    setBypassError("");

    // We don't know the SPOC's name from here, so send a placeholder —
    // the backend master-password path ignores the name field.
    const { data, error } = await loginSpoc("SPOC", bypassPassword.trim());
    setBypassLoading(false);

    if (error || !data) {
      setBypassError("Incorrect password. Try again.");
      setBypassPassword("");
      passwordInputRef.current?.focus();
      return;
    }

    // Successfully authenticated — dismiss maintenance gate
    setShowBypass(false);
    setStatus("ok");
  }

  function closeBypass() {
    setShowBypass(false);
    setBypassPassword("");
    setBypassError("");
  }

  // ── Loading spinner ────────────────────────────────────────────────────────
  if (status === "checking") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#050b18]">
        <div className="flex flex-col items-center gap-3">
          <div className="size-6 animate-spin rounded-full border-2 border-[#c9a227] border-t-transparent" />
          <p className="text-xs text-[#94a3b8]">Checking portal status…</p>
        </div>
      </div>
    );
  }

  // ── Maintenance screen ────────────────────────────────────────────────────
  if (status === "maintenance") {
    return (
      <div className="relative flex min-h-screen items-center justify-center bg-[#050b18] p-6 overflow-hidden">

        {/* ── Ambient glow blobs ─────────────────────────────────────────── */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -top-32 -left-32 size-[480px] rounded-full bg-amber-500/5 blur-[120px]" />
          <div className="absolute -bottom-32 -right-32 size-[480px] rounded-full bg-amber-500/5 blur-[120px]" />
        </div>

        {/* ── Main card ─────────────────────────────────────────────────── */}
        <div className="relative max-w-lg w-full text-center space-y-7">

          {/* Icon */}
          <div className="flex items-center justify-center">
            <div className="relative flex size-24 items-center justify-center rounded-3xl border border-[#c9a227]/30 bg-[#c9a227]/8 shadow-[0_0_60px_rgba(201,162,39,0.15)]">
              <Wrench className="size-11 text-[#c9a227]" strokeWidth={1.5} />
              <span className="absolute -top-1.5 -right-1.5 flex size-5 items-center justify-center rounded-full bg-amber-500 text-[9px] font-black text-black shadow-lg">
                !
              </span>
            </div>
          </div>

          {/* Heading */}
          <div className="space-y-3">
            <h1 className="text-3xl font-extrabold tracking-tight text-white">
              Portal Under Maintenance
            </h1>
            <p className="text-sm text-[#94a3b8] leading-relaxed max-w-sm mx-auto">
              {message || "The SPOC portal is temporarily unavailable. Please check back later."}
            </p>
          </div>

          {/* Live badge */}
          <div className="inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/8 px-5 py-2 text-xs font-bold text-amber-400">
            <span className="size-1.5 rounded-full bg-amber-400 animate-pulse" />
            Scheduled Maintenance In Progress
          </div>

          {/* Info card */}
          <div className="rounded-2xl border border-[rgba(147,197,253,0.10)] bg-[#0a1226]/70 px-5 py-4 text-left space-y-2 backdrop-blur-sm">
            <div className="flex items-center gap-2 text-xs font-bold text-[#94a3b8] uppercase tracking-wider">
              <Shield className="size-3.5 text-[#c9a227]" />
              What's happening?
            </div>
            <p className="text-xs text-[#94a3b8] leading-relaxed">
              The admin has temporarily taken the SPOC portal offline.
              All your data — teams, records, and assignments — is completely safe and untouched.
              Access will be restored shortly.
            </p>
          </div>

          {/* Check again */}
          <button
            type="button"
            onClick={check}
            disabled={retrying}
            className="inline-flex items-center gap-2 rounded-xl border border-[rgba(147,197,253,0.14)] bg-[#0a1226]/60 px-5 py-2.5 text-xs font-bold text-[#94a3b8] hover:text-white hover:border-[rgba(147,197,253,0.3)] transition-all disabled:opacity-50"
          >
            <RefreshCw className={`size-3.5 ${retrying ? "animate-spin" : ""}`} />
            {retrying ? "Checking…" : "Check Again"}
          </button>

          <p className="text-[10px] text-[#94a3b8]/30">SIH 2026 · SMVEC · SPOC Portal</p>
          <p className="text-[10px] text-[#94a3b8]/20 mt-1">Press Ctrl+Alt+T for admin access</p>
        </div>

        {/* ── Bypass overlay (Ctrl+Alt+T to reveal) ─────────────────────── */}
        {showBypass && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-6"
            style={{ background: "rgba(5, 11, 24, 0.92)", backdropFilter: "blur(16px)" }}
          >
            {/* Dismiss on backdrop click */}
            <div className="absolute inset-0" onClick={closeBypass} />

            <div
              className="relative w-full max-w-sm rounded-3xl border border-[rgba(201,162,39,0.25)] bg-[#0a1226] shadow-[0_0_80px_rgba(201,162,39,0.12)] p-8 space-y-6"
              style={{ animation: "fadeSlideUp 0.22s ease-out both" }}
            >
              {/* Close */}
              <button
                type="button"
                onClick={closeBypass}
                className="absolute top-4 right-4 flex size-7 items-center justify-center rounded-full border border-[rgba(148,163,184,0.15)] text-[#94a3b8] hover:text-white hover:border-[rgba(148,163,184,0.35)] transition-all"
              >
                <X className="size-3.5" />
              </button>

              {/* Icon */}
              <div className="flex justify-center">
                <div className="flex size-14 items-center justify-center rounded-2xl border border-[#c9a227]/30 bg-[#c9a227]/8 shadow-[0_0_32px_rgba(201,162,39,0.12)]">
                  <KeyRound className="size-6 text-[#c9a227]" strokeWidth={1.5} />
                </div>
              </div>

              {/* Title */}
              <div className="text-center space-y-1">
                <h2 className="text-lg font-extrabold text-white">Admin Access</h2>
                <p className="text-xs text-[#94a3b8]">
                  Enter the master password to bypass maintenance mode.
                </p>
              </div>

              {/* Form */}
              <form onSubmit={handleBypassSubmit} className="space-y-4">
                <div className="relative">
                  <input
                    ref={passwordInputRef}
                    type={showPwd ? "text" : "password"}
                    value={bypassPassword}
                    onChange={(e) => { setBypassPassword(e.target.value); setBypassError(""); }}
                    placeholder="Master password"
                    autoComplete="current-password"
                    className="w-full rounded-xl border border-[rgba(148,163,184,0.15)] bg-[#050b18] px-4 py-3 pr-11 text-sm text-white placeholder-[#94a3b8]/50 outline-none focus:border-[#c9a227]/50 focus:ring-1 focus:ring-[#c9a227]/20 transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPwd((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#94a3b8]/60 hover:text-[#94a3b8] transition-colors"
                    tabIndex={-1}
                  >
                    {showPwd ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>

                {/* Error */}
                {bypassError && (
                  <p className="text-xs text-red-400 font-medium text-center">{bypassError}</p>
                )}

                <button
                  type="submit"
                  disabled={bypassLoading || !bypassPassword.trim()}
                  className="w-full flex items-center justify-center gap-2 rounded-xl bg-[#c9a227] px-5 py-3 text-sm font-bold text-black hover:bg-[#d4aa30] active:bg-[#b8921f] disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  {bypassLoading ? (
                    <>
                      <div className="size-3.5 animate-spin rounded-full border-2 border-black/30 border-t-black" />
                      Verifying…
                    </>
                  ) : (
                    <>
                      <Lock className="size-3.5" />
                      Enter Portal
                    </>
                  )}
                </button>
              </form>

              {/* Hint */}
              <p className="text-[10px] text-[#94a3b8]/30 text-center">
                Admin eyes only · SIH 2026
              </p>
            </div>

            {/* Keyframe animation */}
            <style>{`
              @keyframes fadeSlideUp {
                from { opacity: 0; transform: translateY(16px) scale(0.97); }
                to   { opacity: 1; transform: translateY(0)   scale(1);    }
              }
            `}</style>
          </div>
        )}
      </div>
    );
  }

  // Normal: render children
  return children;
}
