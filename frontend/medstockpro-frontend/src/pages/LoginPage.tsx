import { useState } from "react";
import type { FormEvent } from "react";
import { motion } from "framer-motion";
import { AlertCircle, LockKeyhole, ShieldCheck, User } from "lucide-react";
import { authService } from "../services/authService";
import { useAuthStore } from "../stores/authStore";
import { playSound } from "../lib/sound";
import { ApiError } from "../lib/api";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import logoIcon from "../assets/medstockpro-icon.png";

export function LoginPage() {
  const signIn = useAuthStore((s) => s.signIn);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError("");

    if (!username.trim() || !password.trim()) {
      setError("Please enter your username and password.");
      return;
    }

    try {
      setLoading(true);
      const response = await authService.login({
        username: username.trim(),
        password,
      });
      playSound("saveOk");
      signIn(response.user, response.token);
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Login failed. Please try again.";
      setError(message);
      playSound("saveError");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="grid min-h-screen grid-cols-1 lg:grid-cols-[1fr_1.1fr]">
      {/* Left — form */}
      <div className="flex items-center justify-center px-6 py-10">
        <motion.section
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.22, ease: "easeOut" }}
          className="w-full max-w-sm"
        >
          <div className="mb-8 flex items-center gap-3">
            <img
              src={logoIcon}
              alt="MedStock Pro"
              className="h-11 w-11 rounded-2xl object-cover shadow-sm"
            />
            <div>
              <h1 className="text-lg font-semibold tracking-tight text-default">
                MedStock Pro
              </h1>
              <p className="text-xs text-muted">Dental Clinic Inventory</p>
            </div>
          </div>

          <h2 className="text-2xl font-semibold tracking-tight text-default">
            Welcome back
          </h2>
          <p className="mt-1 text-sm text-muted">
            Sign in to manage your clinic's inventory and reports.
          </p>

          <form className="mt-7 space-y-4" onSubmit={handleSubmit}>
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/15 dark:text-red-200"
              >
                <AlertCircle size={16} className="mt-0.5 shrink-0" />
                <span>{error}</span>
              </motion.div>
            )}

            <Input
              label="Username"
              placeholder="e.g. drsmith"
              leadingIcon={<User size={16} />}
              autoComplete="username"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              autoFocus
            />

            <Input
              label="Password"
              type="password"
              placeholder="Enter your password"
              leadingIcon={<LockKeyhole size={16} />}
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />

            <Button
              type="submit"
              size="lg"
              loading={loading}
              className="w-full justify-center"
            >
              {loading ? "Signing in..." : "Sign in"}
            </Button>
          </form>

          <p className="mt-8 flex items-center justify-center gap-2 text-xs text-subtle">
            <ShieldCheck size={13} />
            Secure access for clinic owner and staff
          </p>
        </motion.section>
      </div>

      {/* Right — branding panel */}
      <div className="hidden items-center justify-center overflow-hidden bg-gradient-to-br from-[var(--color-brand-700)] via-[var(--color-brand-800)] to-[var(--color-brand-900)] p-12 text-white lg:flex">
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4, ease: "easeOut" }}
          className="max-w-md space-y-8"
        >
          <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.18em] text-white/80 backdrop-blur">
            <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-brand-200)]" />
            For dental clinics
          </div>

          <h2 className="text-3xl font-semibold leading-tight tracking-tight">
            Inventory that quietly takes care of itself.
          </h2>
          <p className="text-sm leading-relaxed text-white/80">
            Track stock, scan barcodes between patients, and stay ahead of
            expiry dates — all in one calm, focused workspace.
          </p>

          <div className="grid grid-cols-2 gap-3">
            {[
              { kpi: "Low stock", value: "Real‑time" },
              { kpi: "Expiry alerts", value: "Automatic" },
              { kpi: "Restock cost", value: "Estimated" },
              { kpi: "Reports", value: "Monthly" },
            ].map((item) => (
              <div
                key={item.kpi}
                className="rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 backdrop-blur"
              >
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/60">
                  {item.kpi}
                </p>
                <p className="mt-1 text-sm font-semibold text-white">
                  {item.value}
                </p>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </main>
  );
}
