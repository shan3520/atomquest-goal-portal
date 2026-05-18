import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Progress } from "@/components/ui/progress";
import { Users, Target, CheckCircle2, Clock, TrendingUp } from "lucide-react";

export default async function AdminDashboard() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Seven independent counts; one round-trip's latency instead of seven.
  const [
    { count: totalUsers },
    { count: totalSheets },
    { count: submittedSheets },
    { count: approvedSheets },
    { count: totalCheckins },
    { count: totalGoals },
    { count: completedGoals },
  ] = await Promise.all([
    supabase.from("profiles").select("*", { count: "exact", head: true }),
    supabase.from("goal_sheets").select("*", { count: "exact", head: true }),
    supabase.from("goal_sheets").select("*", { count: "exact", head: true }).eq("status", "submitted"),
    supabase.from("goal_sheets").select("*", { count: "exact", head: true }).eq("status", "approved"),
    supabase.from("quarterly_checkins").select("*", { count: "exact", head: true }),
    supabase.from("goals").select("*", { count: "exact", head: true }),
    supabase.from("goals").select("*", { count: "exact", head: true }).eq("status", "completed"),
  ]);

  const approvalRate = totalSheets ? Math.round(((approvedSheets || 0) / totalSheets) * 100) : 0;
  const completionRate = totalGoals ? Math.round(((completedGoals || 0) / totalGoals) * 100) : 0;

  // One accent (amber) goes to the only KPI that demands action: Pending Approval.
  // Everything else recedes into the muted-foreground tier. Hierarchy by attention,
  // not by hue.
  const stats: Array<{
    label: string;
    value: number;
    icon: typeof Users;
    accent?: boolean;
  }> = [
    { label: "Total users", value: totalUsers || 0, icon: Users },
    { label: "Goal sheets", value: totalSheets || 0, icon: Target },
    { label: "Pending approval", value: submittedSheets || 0, icon: Clock, accent: true },
    { label: "Approved", value: approvedSheets || 0, icon: CheckCircle2 },
    { label: "Total check-ins", value: totalCheckins || 0, icon: TrendingUp },
    { label: "Total goals", value: totalGoals || 0, icon: Target },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Admin Dashboard</h1>
        <p className="text-muted-foreground mt-1 text-sm">Organization-wide overview</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-px bg-border/40 rounded-xl overflow-hidden border border-border/40">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="bg-card px-4 py-5 flex flex-col gap-3"
          >
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs text-muted-foreground truncate">{stat.label}</p>
              <stat.icon
                className={`w-3.5 h-3.5 shrink-0 ${stat.accent ? "text-primary" : "text-muted-foreground/50"}`}
                aria-hidden
              />
            </div>
            <p
              className={`text-2xl font-semibold tabular-nums tracking-tight ${
                stat.accent && stat.value > 0 ? "text-primary" : "text-foreground"
              }`}
            >
              {stat.value}
            </p>
          </div>
        ))}
      </div>

      {/* Rates */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="glass-card rounded-xl p-5">
          <p className="text-sm text-muted-foreground">Approval rate</p>
          <div className="flex items-baseline justify-between mt-2 mb-3">
            <span className="text-3xl font-semibold tabular-nums tracking-tight">{approvalRate}%</span>
            <span className="text-xs text-muted-foreground tabular-nums">{approvedSheets}/{totalSheets} sheets</span>
          </div>
          <Progress value={approvalRate} className="h-1.5" />
        </div>
        <div className="glass-card rounded-xl p-5">
          <p className="text-sm text-muted-foreground">Goal completion rate</p>
          <div className="flex items-baseline justify-between mt-2 mb-3">
            <span className="text-3xl font-semibold tabular-nums tracking-tight">{completionRate}%</span>
            <span className="text-xs text-muted-foreground tabular-nums">{completedGoals}/{totalGoals} goals</span>
          </div>
          <Progress value={completionRate} className="h-1.5" />
        </div>
      </div>
    </div>
  );
}
