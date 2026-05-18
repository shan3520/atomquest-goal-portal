import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { CyclesManager } from "@/components/admin/cycles-manager";
import type { GoalCycle } from "@/types";

export default async function CyclesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: cycles } = await supabase
    .from("goal_cycles")
    .select("*")
    .order("created_at", { ascending: false });

  return <CyclesManager initialCycles={(cycles || []) as GoalCycle[]} />;
}
