import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Lock, CheckCircle2, ArrowLeft, AlertCircle } from "lucide-react";
import { formatScore, getScoreBadgeClass } from "@/lib/utils/score-calculator";
import { UOM_TYPE_OPTIONS } from "@/types";

interface SheetGoal {
  id: string;
  title: string;
  description: string | null;
  thrust_area: string;
  uom_type: string;
  target_value: number | null;
  target_date: string | null;
  weightage: number;
  status: string;
  is_shared: boolean;
  checkins?: { quarter: string; actual_value: number | null; computed_score: number | null; status: string }[];
}

const QUARTERS = ["Q1", "Q2", "Q3", "Q4"] as const;

export default async function GoalSheetPage({
  params,
}: {
  params: Promise<{ sheetId: string }>;
}) {
  const { sheetId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: sheet } = await supabase
    .from("goal_sheets")
    .select("*, goals(*, checkins:quarterly_checkins(*)), cycle:goal_cycles(*), employee:profiles!goal_sheets_employee_id_fkey(name)")
    .eq("id", sheetId)
    .single();

  if (!sheet) notFound();

  const isLocked = sheet.status === "approved" || sheet.status === "submitted";
  const statusColors: Record<string, string> = {
    draft: "status-draft", submitted: "status-submitted",
    approved: "status-approved", returned: "status-returned",
  };
  const goalStatusColors: Record<string, string> = {
    not_started: "status-not_started", on_track: "status-on_track", completed: "status-completed",
  };

  const goals = (sheet.goals || []) as SheetGoal[];
  const totalWeightage = goals.reduce((s, g) => s + g.weightage, 0);

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      {/* Header */}
      <div>
        <Link
          href="/goals"
          className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1 mb-3"
        >
          <ArrowLeft className="w-3 h-3" /> Goals
        </Link>
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
              {sheet.cycle?.name}
              {isLocked && (
                <Lock
                  className="w-4 h-4 text-muted-foreground"
                  aria-label={`${sheet.status} (read-only)`}
                />
              )}
            </h1>
            <p className="text-sm text-muted-foreground mt-1 tabular-nums">
              {sheet.employee?.name}
              <span className="mx-2 text-border">·</span>
              {goals.length} {goals.length === 1 ? "goal" : "goals"}
              <span className="mx-2 text-border">·</span>
              <span className={totalWeightage === 100 ? "text-emerald-400" : "text-red-400"}>
                {totalWeightage}% allocated
              </span>
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge className={statusColors[sheet.status]}>
              {sheet.status.charAt(0).toUpperCase() + sheet.status.slice(1)}
            </Badge>
            {sheet.status === "approved" && (
              <Link href={`/goals/${sheetId}/checkin`}>
                <Button size="sm">
                  <CheckCircle2 className="w-4 h-4 mr-2" />
                  Check-in
                </Button>
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* Return reason — inline, no Card wrapper */}
      {sheet.status === "returned" && sheet.return_reason && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3">
          <p className="text-sm font-medium text-red-400 flex items-center gap-2">
            <AlertCircle className="w-4 h-4" />
            Returned for revision
          </p>
          <p className="text-sm text-red-300 mt-1.5">{sheet.return_reason}</p>
          <Link href="/goals/new">
            <Button size="sm" variant="outline" className="mt-3 border-red-500/40 text-red-300 hover:bg-red-500/10">
              Edit and resubmit
            </Button>
          </Link>
        </div>
      )}

      {/* Goals — flat list with hairline dividers, no per-goal Cards */}
      <ul className="divide-y divide-border/60 border-y border-border/60">
        {goals.map((goal, index) => {
          const uom = UOM_TYPE_OPTIONS.find(o => o.value === goal.uom_type);
          const uomLabel = uom?.label ?? goal.uom_type;
          const uomExample = uom?.example;
          const target = goal.target_value !== null
            ? String(goal.target_value)
            : goal.target_date
              ? new Date(goal.target_date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
              : "—";

          return (
            <li key={goal.id} className="py-5">
              {/* Title row */}
              <div className="flex items-start justify-between gap-4 mb-1.5">
                <div className="flex items-baseline gap-2 min-w-0">
                  <span className="text-xs text-muted-foreground tabular-nums shrink-0">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <h3 className="font-medium text-base leading-snug">{goal.title}</h3>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="text-xs text-muted-foreground tabular-nums">{goal.weightage}%</span>
                  <Badge className={goalStatusColors[goal.status]}>
                    {goal.status.replace("_", " ")}
                  </Badge>
                  {goal.is_shared && (
                    <Badge variant="outline" className="text-xs">Shared</Badge>
                  )}
                </div>
              </div>

              {/* Description (only if present) */}
              {goal.description && (
                <p className="text-sm text-muted-foreground pl-7 mb-2">{goal.description}</p>
              )}

              {/* Meta on one line */}
              <p className="text-xs text-muted-foreground pl-7 tabular-nums">
                {goal.thrust_area}
                <span className="mx-2 text-border">·</span>
                {uomLabel}
                <span className="mx-2 text-border">·</span>
                Target {target}
              </p>
              {uomExample && (
                <p className="text-[11px] text-muted-foreground/70 pl-7 mt-1 italic">
                  {uomExample}
                </p>
              )}

              {/* Quarter strip — only if any check-ins exist */}
              {goal.checkins && goal.checkins.length > 0 && (
                <div className="mt-3 pl-7 flex gap-1.5 flex-wrap">
                  {QUARTERS.map(q => {
                    const ci = goal.checkins?.find(c => c.quarter === q);
                    if (!ci) {
                      return (
                        <div
                          key={q}
                          className="text-[10px] font-medium tabular-nums px-2 py-0.5 rounded border border-dashed border-border/60 text-muted-foreground/60"
                        >
                          {q}
                        </div>
                      );
                    }
                    return (
                      <div
                        key={q}
                        className={`text-[11px] tabular-nums px-2 py-0.5 rounded ${getScoreBadgeClass(ci.computed_score)}`}
                      >
                        <span className="font-semibold">{q}</span>
                        <span className="opacity-80 ml-1.5">{ci.actual_value ?? "—"}</span>
                        <span className="font-medium ml-1.5">{formatScore(ci.computed_score)}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
