import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { AnalyticsCharts } from "@/components/charts/analytics-charts";
import { STATUS_CHART_COLORS } from "@/lib/utils/chart-colors";

export default async function AnalyticsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Single fan-out: every aggregation derives from these four reads. The two
  // earlier separate quarterly_checkins reads and the standalone goals/profiles
  // reads collapsed into one Promise.all (was 6 sequential round-trips before).
  const [
    { data: allCheckins },
    { data: allProfiles },
    { data: allSheets },
    { data: allGoals },
  ] = await Promise.all([
    supabase.from("quarterly_checkins").select("goal_id, quarter, computed_score"),
    supabase.from("profiles").select("id, name, role, department, manager_id"),
    supabase.from("goal_sheets").select("id, employee_id, status"),
    supabase.from("goals").select("id, sheet_id, status"),
  ]);

  // Trend: average computed_score per quarter
  const quarterScores: Record<string, { total: number; count: number }> = {};
  (allCheckins || []).forEach((ci: { quarter: string; computed_score: number | null }) => {
    if (ci.computed_score !== null) {
      if (!quarterScores[ci.quarter]) quarterScores[ci.quarter] = { total: 0, count: 0 };
      quarterScores[ci.quarter].total += ci.computed_score;
      quarterScores[ci.quarter].count += 1;
    }
  });

  const trendData = ["Q1", "Q2", "Q3", "Q4"].map((q) => ({
    quarter: q,
    score: quarterScores[q] ? Math.round(quarterScores[q].total / quarterScores[q].count) : 0,
  }));

  // Status distribution derived from the same allGoals already fetched
  const statusCounts: Record<string, number> = { not_started: 0, on_track: 0, completed: 0 };
  (allGoals || []).forEach((g: { status: string }) => {
    statusCounts[g.status] = (statusCounts[g.status] || 0) + 1;
  });

  const statusData = [
    { name: "Not started", value: statusCounts.not_started, color: STATUS_CHART_COLORS.not_started },
    { name: "On track", value: statusCounts.on_track, color: STATUS_CHART_COLORS.on_track },
    { name: "Completed", value: statusCounts.completed, color: STATUS_CHART_COLORS.completed },
  ];

  const profilesById = new Map<string, { department: string | null; manager_id: string | null }>();
  (allProfiles || []).forEach((p: { id: string; department: string | null; manager_id: string | null }) => {
    profilesById.set(p.id, { department: p.department, manager_id: p.manager_id });
  });

  const sheetsById = new Map<string, { employee_id: string; status: string }>();
  (allSheets || []).forEach((s: { id: string; employee_id: string; status: string }) => {
    sheetsById.set(s.id, { employee_id: s.employee_id, status: s.status });
  });

  // Department completion — % of approved-sheet goals with status="completed".
  const deptAgg: Record<string, { completed: number; total: number }> = {};
  (allGoals || []).forEach((g: { id: string; sheet_id: string; status: string }) => {
    const sheet = sheetsById.get(g.sheet_id);
    if (!sheet || sheet.status !== "approved") return;
    const dept = profilesById.get(sheet.employee_id)?.department;
    if (!dept) return;
    if (!deptAgg[dept]) deptAgg[dept] = { completed: 0, total: 0 };
    deptAgg[dept].total += 1;
    if (g.status === "completed") deptAgg[dept].completed += 1;
  });

  const deptData = Object.entries(deptAgg).map(([department, { completed, total }]) => ({
    department,
    completion: total === 0 ? 0 : Math.round((completed / total) * 100),
  }));

  // Manager check-in completion: actual check-ins vs. max possible
  // (team's approved-sheet goals × 4 quarters). Uses the already-fetched
  // allCheckins set; no extra round-trip.
  const checkinCountByGoal = new Map<string, number>();
  (allCheckins || []).forEach((c: { goal_id: string }) => {
    checkinCountByGoal.set(c.goal_id, (checkinCountByGoal.get(c.goal_id) ?? 0) + 1);
  });

  const managerData = (allProfiles || [])
    .filter((p: { role: string }) => p.role === "manager")
    .map((m: { id: string; name: string }) => {
      const teamIds = (allProfiles || [])
        .filter((p: { manager_id: string | null }) => p.manager_id === m.id)
        .map((p: { id: string }) => p.id);

      const teamGoalIds = (allGoals || [])
        .filter((g: { sheet_id: string }) => {
          const sheet = sheetsById.get(g.sheet_id);
          return (
            sheet?.status === "approved" && teamIds.includes(sheet.employee_id)
          );
        })
        .map((g: { id: string }) => g.id);

      const checkins = teamGoalIds.reduce(
        (sum, gid) => sum + (checkinCountByGoal.get(gid) ?? 0),
        0
      );

      return {
        manager: m.name,
        checkins,
        total: teamGoalIds.length * 4,
      };
    });

  return (
    <AnalyticsCharts
      data={{ trendData, statusData, deptData, managerData }}
    />
  );
}
