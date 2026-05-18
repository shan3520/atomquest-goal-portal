import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { ReportsView } from "@/components/admin/reports-view";

export default async function ReportsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Six independent reads; one round-trip's latency instead of six.
  const [
    goalsRes,
    managersRes,
    { count: totalEmployees },
    { count: submittedCount },
    { count: approvedCount },
    { count: totalGoals },
  ] = await Promise.all([
    supabase
      .from("goals")
      .select(`
        title, thrust_area, uom_type, target_value, target_date,
        checkins:quarterly_checkins(quarter, actual_value, computed_score),
        sheet:goal_sheets!inner(
          employee:profiles!goal_sheets_employee_id_fkey(name, department, manager_id)
        )
      `),
    supabase.from("profiles").select("id, name").eq("role", "manager"),
    supabase.from("profiles").select("*", { count: "exact", head: true }).eq("role", "employee"),
    supabase.from("goal_sheets").select("*", { count: "exact", head: true }).in("status", ["submitted", "approved"]),
    supabase.from("goal_sheets").select("*", { count: "exact", head: true }).eq("status", "approved"),
    supabase.from("goals").select("*", { count: "exact", head: true }),
  ]);

  const goals = goalsRes.data;
  const managerMap = new Map((managersRes.data || []).map(m => [m.id, m.name]));

  const reportData = (goals || []).map((g: Record<string, unknown>) => {
    const sheet = g.sheet as Record<string, unknown>;
    const employee = sheet?.employee as Record<string, unknown>;
    const checkins = g.checkins as { quarter: string; actual_value: number | null; computed_score: number | null }[];
    const getCheckin = (q: string) => checkins?.find(c => c.quarter === q);

    return {
      employee_name: (employee?.name as string) || "",
      department: (employee?.department as string) || "",
      manager_name: managerMap.get(employee?.manager_id as string) || "",
      goal_title: g.title as string,
      thrust_area: g.thrust_area as string,
      uom_type: g.uom_type as string,
      target: String(g.target_value ?? g.target_date ?? ""),
      q1_actual: String(getCheckin("Q1")?.actual_value ?? ""),
      q2_actual: String(getCheckin("Q2")?.actual_value ?? ""),
      q3_actual: String(getCheckin("Q3")?.actual_value ?? ""),
      q4_actual: String(getCheckin("Q4")?.actual_value ?? ""),
      q1_score: getCheckin("Q1")?.computed_score ?? null,
      q2_score: getCheckin("Q2")?.computed_score ?? null,
      q3_score: getCheckin("Q3")?.computed_score ?? null,
      q4_score: getCheckin("Q4")?.computed_score ?? null,
    };
  });

  return (
    <ReportsView
      reportData={reportData}
      completionData={{
        total_employees: totalEmployees || 0,
        submitted_count: submittedCount || 0,
        approved_count: approvedCount || 0,
        q1_checkins: 0, q2_checkins: 0, q3_checkins: 0, q4_checkins: 0,
        total_goals: totalGoals || 0,
      }}
    />
  );
}
