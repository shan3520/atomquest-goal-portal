import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import SharedGoalsPage from "@/components/admin/shared-goals";
import { createManagerSharedGoal } from "@/app/actions/manager";
import type { Profile, GoalCycle } from "@/types";

export default async function ManagerSharedGoalsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Manager scope: only direct reports show up in the recipient list.
  const { data: team } = await supabase
    .from("profiles")
    .select("*")
    .eq("manager_id", user.id)
    .order("name");

  const { data: cycles } = await supabase
    .from("goal_cycles")
    .select("*")
    .eq("is_active", true);

  return (
    <SharedGoalsPage
      employees={(team || []) as Profile[]}
      cycles={(cycles || []) as GoalCycle[]}
      action={createManagerSharedGoal}
      title="Team Shared Goals"
      subtitle="Push a KPI to one or more of your direct reports"
    />
  );
}
