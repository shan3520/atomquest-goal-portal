import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { FilePlus, CheckCircle2, AlertCircle, ArrowRight } from "lucide-react";

export default async function EmployeeDashboard() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // All three reads are independent of each other — fire them in parallel so
  // the page waits on one round-trip's latency instead of three.
  const [profileRes, activeCycleRes, sheetsRes] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(),
    supabase.from("goal_cycles").select("*").eq("is_active", true).maybeSingle(),
    supabase
      .from("goal_sheets")
      .select("*, goals(*), cycle:goal_cycles(*)")
      .eq("employee_id", user.id)
      .order("created_at", { ascending: false }),
  ]);
  const profile = profileRes.data;
  const activeCycle = activeCycleRes.data;
  const sheets = sheetsRes.data;

  const currentSheet = sheets?.find(s => s.cycle_id === activeCycle?.id);
  const totalGoals = currentSheet?.goals?.length || 0;
  const completedGoals = currentSheet?.goals?.filter(
    (g: { status: string }) => g.status === "completed"
  ).length || 0;
  const completionPct = totalGoals > 0 ? Math.round((completedGoals / totalGoals) * 100) : 0;

  const statusColors: Record<string, string> = {
    draft: "status-draft", submitted: "status-submitted",
    approved: "status-approved", returned: "status-returned",
  };

  const pastSheets = sheets?.filter((s) => s.id !== currentSheet?.id) ?? [];

  return (
    <div className="space-y-10">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          <span className="text-muted-foreground font-normal">Welcome back, </span>
          {profile?.name}
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          {activeCycle ? activeCycle.name : "No active cycle"}
        </p>
      </div>

      {/* Current sheet — the focal point. Stats are inlined here, not above. */}
      {currentSheet ? (
        <section className="glass-card glass-card-hover rounded-xl">
          {currentSheet.status === "returned" && currentSheet.return_reason && (
            <div className="px-6 pt-5 pb-0">
              <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm">
                <p className="font-medium text-red-400 mb-1 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4" />
                  Returned for revision
                </p>
                <p className="text-red-300">{currentSheet.return_reason}</p>
              </div>
            </div>
          )}

          <div className="p-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 mb-2">
                <h2 className="text-lg font-semibold">Current sheet</h2>
                <Badge className={statusColors[currentSheet.status]}>
                  {currentSheet.status.charAt(0).toUpperCase() + currentSheet.status.slice(1)}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground tabular-nums">
                {totalGoals} {totalGoals === 1 ? "goal" : "goals"}
                <span className="mx-2 text-border">·</span>
                {completedGoals} completed
                <span className="mx-2 text-border">·</span>
                <span className={completionPct === 100 ? "text-emerald-400" : "text-foreground"}>
                  {completionPct}%
                </span>
              </p>
              {totalGoals > 0 && (
                <Progress value={completionPct} className="mt-3 h-1 max-w-xs" />
              )}
            </div>
            <div className="flex gap-2 shrink-0">
              {currentSheet.status === "approved" && (
                <Link href={`/goals/${currentSheet.id}/checkin`}>
                  <Button size="sm" variant="outline">
                    <CheckCircle2 className="w-4 h-4 mr-2" />
                    Check-in
                  </Button>
                </Link>
              )}
              <Link href={`/goals/${currentSheet.id}`}>
                <Button size="sm">
                  Open <ArrowRight className="w-4 h-4 ml-1.5" />
                </Button>
              </Link>
            </div>
          </div>
        </section>
      ) : (
        <section className="rounded-xl border border-dashed border-primary/30 px-6 py-8">
          <div className="max-w-md mx-auto text-center">
            <FilePlus className="w-7 h-7 text-primary mx-auto mb-3" aria-hidden />
            <h3 className="text-base font-semibold">No goal sheet yet</h3>
            <p className="text-muted-foreground text-sm mt-1 mb-5">
              {activeCycle
                ? `Set up your goals for ${activeCycle.name} to start tracking progress.`
                : "No active cycle available. Contact your admin to start one."}
            </p>
            {activeCycle && (
              <Link href="/goals/new">
                <Button>
                  <FilePlus className="w-4 h-4 mr-2" />
                  Create goal sheet
                </Button>
              </Link>
            )}
          </div>
          {activeCycle && (
            <div className="mt-8 pt-6 border-t border-border/40 max-w-xl mx-auto">
              <p className="text-[10px] font-medium text-muted-foreground tracking-wider uppercase mb-3 text-center">
                What goes in a goal sheet
              </p>
              <ol className="text-xs text-muted-foreground space-y-2 tabular-nums">
                <li className="flex gap-3">
                  <span className="text-primary font-semibold shrink-0">1.</span>
                  <span><strong className="text-foreground">3 to 8 goals</strong>, each tied to an Atomberg thrust area (Business Growth, Customer Experience, and so on).</span>
                </li>
                <li className="flex gap-3">
                  <span className="text-primary font-semibold shrink-0">2.</span>
                  <span><strong className="text-foreground">Weightages sum to 100%</strong>. Higher weightage means the goal matters more to your year-end score.</span>
                </li>
                <li className="flex gap-3">
                  <span className="text-primary font-semibold shrink-0">3.</span>
                  <span><strong className="text-foreground">Submit for approval</strong>. Your manager reviews, then quarterly check-ins unlock.</span>
                </li>
              </ol>
            </div>
          )}
        </section>
      )}

      {/* Past sheets — quiet list, no individual chrome */}
      {pastSheets.length > 0 && (
        <section>
          <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">
            Past sheets
          </h2>
          <ul className="divide-y divide-border/60 border-y border-border/60">
            {pastSheets.map((sheet) => (
              <li key={sheet.id}>
                <Link
                  href={`/goals/${sheet.id}`}
                  className="flex items-center justify-between gap-4 py-3 px-1 hover:bg-card/40 rounded transition-colors"
                >
                  <div className="min-w-0">
                    <p className="font-medium truncate">{sheet.cycle?.name}</p>
                    <p className="text-xs text-muted-foreground mt-0.5 tabular-nums">
                      {sheet.goals?.length || 0} goals
                    </p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <Badge className={statusColors[sheet.status]}>{sheet.status}</Badge>
                    <ArrowRight className="w-4 h-4 text-muted-foreground/60" />
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
