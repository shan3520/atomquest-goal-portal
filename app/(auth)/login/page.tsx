"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Target, Loader2, Eye, EyeOff } from "lucide-react";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [touched, setTouched] = useState<{ email: boolean; password: boolean }>({
    email: false,
    password: false,
  });
  const [authError, setAuthError] = useState<string | null>(null);
  const router = useRouter();

  const emailError =
    touched.email && !email.trim()
      ? "Email is required"
      : touched.email && !EMAIL_PATTERN.test(email)
        ? "Enter a valid email address"
        : null;
  const passwordError =
    touched.password && !password ? "Password is required" : null;

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setAuthError(null);
    setTouched({ email: true, password: true });
    if (!email.trim() || !EMAIL_PATTERN.test(email) || !password) {
      // Inline errors will render; no toast needed.
      return;
    }
    setLoading(true);

    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithPassword({ email, password });

      if (error) {
        setAuthError(error.message || "Could not sign in. Check your credentials.");
        setLoading(false);
        return;
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", user.id)
          .single();

        toast.success("Welcome back");

        if (profile?.role === "admin") {
          router.push("/admin/dashboard");
        } else if (profile?.role === "manager") {
          router.push("/manager/dashboard");
        } else {
          router.push("/dashboard");
        }
        router.refresh();
      }
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : "An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="w-full max-w-sm px-4 relative z-10">
      {/* Brand mark, no nested Card wrapper around the form */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-primary/10 border border-primary/20 mb-4">
          <Target className="w-6 h-6 text-primary" aria-hidden />
        </div>
        <h1 className="text-2xl font-semibold text-primary tracking-tight">AtomQuest</h1>
        <p className="text-xs text-muted-foreground mt-1 tracking-wide uppercase">
          Atomberg Technologies
        </p>
      </div>

      <form onSubmit={handleLogin} className="space-y-4" noValidate>
        {/* Auth error lives above the form, announced as live region */}
        {authError && (
          <div
            role="alert"
            className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300"
          >
            {authError}
          </div>
        )}

        <div className="space-y-1.5">
          <Label htmlFor="email" className="text-xs">Email</Label>
          <Input
            id="email"
            type="email"
            placeholder="you@atomberg.com"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              if (authError) setAuthError(null);
            }}
            onBlur={() => setTouched((t) => ({ ...t, email: true }))}
            disabled={loading}
            autoComplete="email"
            aria-invalid={!!emailError}
            aria-describedby={emailError ? "email-error" : undefined}
            className={emailError ? "border-red-500/60 focus-visible:ring-red-500/30" : undefined}
          />
          {emailError && (
            <p id="email-error" className="text-xs text-red-400">
              {emailError}
            </p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="password" className="text-xs">Password</Label>
          <div className="relative">
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              placeholder="••••••••"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (authError) setAuthError(null);
              }}
              onBlur={() => setTouched((t) => ({ ...t, password: true }))}
              disabled={loading}
              autoComplete="current-password"
              aria-invalid={!!passwordError}
              aria-describedby={passwordError ? "password-error" : undefined}
              className={`pr-10 ${passwordError ? "border-red-500/60 focus-visible:ring-red-500/30" : ""}`}
            />
            <button
              type="button"
              onClick={() => setShowPassword((s) => !s)}
              aria-label={showPassword ? "Hide password" : "Show password"}
              aria-pressed={showPassword}
              tabIndex={loading ? -1 : 0}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          {passwordError && (
            <p id="password-error" className="text-xs text-red-400">
              {passwordError}
            </p>
          )}
        </div>

        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" aria-hidden />
              <span>Signing in</span>
            </>
          ) : (
            "Sign in"
          )}
        </Button>
      </form>

      {/* Demo creds — neutral, no role-color flair */}
      <div className="mt-8 pt-6 border-t border-border/50">
        <p className="text-[10px] font-medium text-muted-foreground tracking-wider uppercase mb-2">
          Demo accounts
        </p>
        <div className="space-y-0.5">
          {[
            { label: "Admin", email: "admin@atomberg.com", pass: "Admin@123" },
            { label: "Manager", email: "manager@atomberg.com", pass: "Manager@123" },
            { label: "Employee", email: "employee1@atomberg.com", pass: "Employee@123" },
          ].map((cred) => (
            <button
              key={cred.email}
              type="button"
              onClick={() => {
                setEmail(cred.email);
                setPassword(cred.pass);
              }}
              className="w-full flex items-center justify-between px-2 py-1.5 rounded text-sm hover:bg-card/60 transition-colors"
            >
              <span className="font-medium">{cred.label}</span>
              <span className="text-muted-foreground text-xs">{cred.email}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
