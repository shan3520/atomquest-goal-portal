import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import SharedGoalsPage from "@/components/admin/shared-goals";
import type { Profile, GoalCycle } from "@/types";

export default async function AdminSharedGoalsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: employees } = await supabase.from("profiles").select("*").order("name");
  const { data: cycles } = await supabase.from("goal_cycles").select("*").eq("is_active", true);

  return <SharedGoalsPage employees={(employees || []) as Profile[]} cycles={(cycles || []) as GoalCycle[]} />;
}
