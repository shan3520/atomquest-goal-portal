import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { GoalUnlocker } from "@/components/admin/goal-unlocker";

export default async function UnlockPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: goals } = await supabase
    .from("goals")
    .select("id, title, thrust_area, weightage, sheet:goal_sheets!inner(id, status, employee:profiles!goal_sheets_employee_id_fkey(name, email))")
    .eq("sheet.status", "approved");

  return <GoalUnlocker initialGoals={(goals || []) as never[]} />;
}
