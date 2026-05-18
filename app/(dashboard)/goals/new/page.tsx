import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { GoalSheetForm } from "@/components/goals/goal-sheet-form";
import type { GoalFormData, UomType } from "@/types";

export default async function NewGoalSheetPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: cycles } = await supabase
    .from("goal_cycles")
    .select("id, name")
    .eq("is_active", true)
    .order("created_at", { ascending: false });

  if (!cycles || cycles.length === 0) {
    return (
      <div className="text-center py-20">
        <h2 className="text-xl font-semibold mb-2">No Active Cycle</h2>
        <p className="text-muted-foreground">Contact your admin to create a goal cycle.</p>
      </div>
    );
  }

  const activeCycleId = cycles[0].id;

  // Load existing draft/returned sheet so the user can pick up where they left off.
  // We also pull is_shared/shared_from + the goal id so the form can render
  // shared goals as locked (only weightage editable) per BRD §2.1.
  const { data: existingSheet } = await supabase
    .from("goal_sheets")
    .select("id, status, cycle_id, goals(id, title, description, thrust_area, uom_type, target_value, target_date, weightage, is_shared, shared_from)")
    .eq("employee_id", user.id)
    .eq("cycle_id", activeCycleId)
    .in("status", ["draft", "returned"])
    .maybeSingle();

  let initialGoals: GoalFormData[] | undefined;
  if (existingSheet?.goals && existingSheet.goals.length > 0) {
    initialGoals = (existingSheet.goals as Array<{
      id: string;
      title: string;
      description: string | null;
      thrust_area: string;
      uom_type: string;
      target_value: number | null;
      target_date: string | null;
      weightage: number;
      is_shared: boolean | null;
      shared_from: string | null;
    }>).map((g) => ({
      id: g.id,
      title: g.title,
      description: g.description ?? "",
      thrust_area: g.thrust_area,
      uom_type: g.uom_type as UomType,
      target_value: g.target_value,
      target_date: g.target_date,
      weightage: g.weightage,
      is_shared: g.is_shared ?? false,
      shared_from: g.shared_from,
    }));
  }

  return (
    <GoalSheetForm
      cycles={cycles}
      initialGoals={initialGoals}
      initialCycleId={activeCycleId}
    />
  );
}
