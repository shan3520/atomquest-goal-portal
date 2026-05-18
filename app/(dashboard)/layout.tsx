"use client";

import { useState, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { ensureProfile } from "@/app/actions/auth";
import { Sidebar } from "@/components/layout/sidebar";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Menu, X, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Profile } from "@/types";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

  // Auto-close mobile drawer on navigation
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  useEffect(() => {
    let cancelled = false;

    async function loadProfile() {
      try {
        const supabase = createClient();
        const { data: userData, error: userErr } = await supabase.auth.getUser();
        const user = userData?.user;
        if (userErr || !user) {
          router.push("/login");
          return;
        }

        // maybeSingle so a zero-row response returns { data: null, error: null }
        // instead of throwing PGRST116 — single() silently swallowed that error
        // and left profile null, which used to blank the screen.
        const { data, error } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", user.id)
          .maybeSingle();

        if (cancelled) return;

        if (error) {
          console.error("[DashboardLayout] profile fetch failed:", error);
          setLoadError(`Could not load your profile: ${error.message}`);
          setLoading(false);
          return;
        }

        if (data) {
          setProfile(data as Profile);
          setLoading(false);
          return;
        }

        // No profile row — recovery path. Hits a server action that uses the
        // service-role client to insert a default profile (bypasses RLS).
        console.warn(
          "[DashboardLayout] no profiles row for authenticated user — invoking ensureProfile()"
        );
        const ensured = await ensureProfile();
        if (cancelled) return;

        if (ensured.data) {
          setProfile(ensured.data);
          setLoading(false);
          return;
        }

        console.error("[DashboardLayout] ensureProfile failed:", ensured.error);
        setLoadError(
          ensured.error ||
            "Your account exists in Auth but has no matching profile row, and one could not be created automatically."
        );
        setLoading(false);
      } catch (err) {
        if (cancelled) return;
        console.error("[DashboardLayout] unexpected error:", err);
        setLoadError(
          err instanceof Error ? err.message : "Unexpected error loading dashboard"
        );
        setLoading(false);
      }
    }

    loadProfile();
    return () => {
      cancelled = true;
    };
  }, [router]);

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    toast.success("Logged out successfully");
    router.push("/login");
    router.refresh();
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-muted-foreground">Loading…</p>
        </div>
      </div>
    );
  }

  if (loadError || !profile) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="max-w-md w-full glass-card rounded-xl p-6 space-y-4">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-6 h-6 text-red-400 shrink-0" />
            <h2 className="text-lg font-semibold">Unable to load dashboard</h2>
          </div>
          <p className="text-sm text-muted-foreground whitespace-pre-line">
            {loadError ||
              "Your profile could not be loaded. Try signing out and back in."}
          </p>
          <p className="text-xs text-muted-foreground/70">
            Tip: ensure the <code className="text-primary">handle_new_user</code>{" "}
            trigger from migration <code className="text-primary">003_functions.sql</code> is
            installed, and that <code className="text-primary">SUPABASE_SERVICE_ROLE_KEY</code>{" "}
            is set in your environment.
          </p>
          <div className="flex gap-2 justify-end pt-2">
            <Button variant="outline" onClick={() => window.location.reload()}>
              Retry
            </Button>
            <Button variant="destructive" onClick={handleLogout}>
              Sign out
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      {/* Desktop Sidebar */}
      <div className="hidden lg:block">
        <Sidebar
          role={profile.role}
          userName={profile.name}
          collapsed={collapsed}
          onToggle={() => setCollapsed(!collapsed)}
          onLogout={handleLogout}
        />
      </div>

      {/* Mobile Overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
          <div className="fixed left-0 top-0 h-full w-64 z-50">
            <Sidebar
              role={profile.role}
              userName={profile.name}
              collapsed={false}
              onToggle={() => setMobileOpen(false)}
              onLogout={handleLogout}
            />
          </div>
        </div>
      )}

      {/* Mobile Header */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-30 h-14 bg-sidebar border-b border-sidebar-border flex items-center px-4 gap-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setMobileOpen(true)}
          aria-label="Open navigation menu"
          aria-expanded={mobileOpen}
          className="shrink-0 h-11 w-11"
        >
          {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </Button>
        <h1 className="text-sm font-semibold text-primary tracking-tight">AtomQuest</h1>
      </div>

      {/* Main Content */}
      <main
        className={cn(
          "transition-all duration-300 min-h-screen",
          "lg:pt-0 pt-14",
          collapsed ? "lg:pl-[68px]" : "lg:pl-64"
        )}
      >
        <div className="p-4 lg:p-8 max-w-7xl mx-auto">{children}</div>
      </main>
    </div>
  );
}
