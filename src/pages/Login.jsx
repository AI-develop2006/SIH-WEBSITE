import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Shield, User, Lock, Eye, EyeOff } from "lucide-react";
import { loginSpoc, getCurrentProfile } from "@/lib/data";
import { useToast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";

export default function LoginPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);

  // Redirect if already logged in as SPOC
  useEffect(() => {
    getCurrentProfile().then(({ data: p }) => {
      if (p && p.role === "spoc") navigate("/dashboard", { replace: true });
    });
  }, [navigate]);

  async function handleLogin(e) {
    e.preventDefault();
    if (!name.trim()) return toast("error", "Name is required");
    if (!password.trim()) return toast("error", "Password is required");

    setBusy(true);
    try {
      const res = await loginSpoc(name.trim(), password.trim());
      if (res.error) throw new Error(res.error);
      const profile = res.data?.profile;
      if (!profile || profile.role !== "spoc") {
        throw new Error("Access denied — SPOC role required. Contact admin to get access.");
      }
      toast("success", `Welcome, ${profile.name}!`);
      navigate("/dashboard", { replace: true });
    } catch (err) {
      toast("error", err.message || "Login failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#050b18] px-4">
      {/* Background orbs */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-40 -left-40 size-96 rounded-full bg-[rgba(109,123,221,0.12)] blur-3xl" />
        <div className="absolute -bottom-40 -right-40 size-96 rounded-full bg-[rgba(229,185,74,0.10)] blur-3xl" />
      </div>

      <div className="relative w-full max-w-md">
        {/* Gold top bar */}
        <div className="h-1 w-full rounded-t-3xl bg-gradient-to-r from-transparent via-[#c9a227] to-transparent" />

        <div className="rounded-b-3xl rounded-t-none border border-[rgba(147,197,253,0.12)] bg-[#0a1226] px-8 py-10 shadow-2xl">
          {/* Logo */}
          <div className="mb-8 flex flex-col items-center gap-3">
            <div className="flex size-14 items-center justify-center rounded-2xl border border-[#c9a227]/30 bg-[#c9a227]/10">
              <Shield className="size-7 text-[#c9a227]" strokeWidth={1.75} />
            </div>
            <div className="text-center">
              <p className="text-xl font-bold text-[#e8c058]">Smart India Hackathon 2026</p>
              <h1 className="text-2xl font-black text-white">SPOC Portal</h1>
              <p className="mt-1 text-xs text-[#94a3b8]">Single Point of Contact — Final Team Formation</p>
            </div>
          </div>

          <form onSubmit={handleLogin} className="space-y-5">
            {/* Name field */}
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-[#94a3b8]">
                Name
              </label>
              <div className="relative">
                <User className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-[#94a3b8]/60 pointer-events-none" />
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Enter your name"
                  required
                  autoComplete="username"
                  autoFocus
                  className="w-full rounded-xl border border-[rgba(147,197,253,0.18)] bg-[#050b18]/60 pl-10 pr-4 py-3 text-sm text-white outline-none placeholder:text-[#94a3b8]/60 focus:border-[#c9a227]/60 focus:shadow-[0_0_0_3px_rgba(201,162,39,0.12)] transition-all"
                />
              </div>
            </div>

            {/* Password field */}
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-[#94a3b8]">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-[#94a3b8]/60 pointer-events-none" />
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  autoComplete="current-password"
                  className="w-full rounded-xl border border-[rgba(147,197,253,0.18)] bg-[#050b18]/60 pl-10 pr-11 py-3 text-sm text-white outline-none placeholder:text-[#94a3b8]/60 focus:border-[#c9a227]/60 focus:shadow-[0_0_0_3px_rgba(201,162,39,0.12)] transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#94a3b8]/60 hover:text-[#94a3b8] transition-colors cursor-pointer"
                  tabIndex={-1}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </div>

            <Button type="submit" loading={busy} className="w-full py-3 mt-2">
              Sign In
            </Button>
          </form>

          <p className="mt-6 text-center text-[10px] text-[#94a3b8]/50">
            Use your SPOC name and password to sign in.
            <br />Contact admin if you need access.
          </p>
        </div>
      </div>
    </div>
  );
}
