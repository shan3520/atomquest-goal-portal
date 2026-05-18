import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { ApprovalPanel } from "@/components/manager/approval-panel";
import type { GoalSheet } from "@/types";

export default async function ManagerEmployeeGoalsPage({
  params,
}: {
  params: Promise<{ employeeId: string }>;
}) {
  const { employeeId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: employee } = await supabase
    .from("profiles").select("*").eq("id", employeeId).single();

  if (!employee) notFound();

  // Get latest sheet with goals and check-ins
  const { data: sheets } = await supabase
    .from("goal_sheets")
    .select("*, goals(*, checkins:quarterly_checkins(*)), cycle:goal_cycles(*)")
    .eq("employee_id", employeeId)
    .order("created_at", { ascending: false })
    .limit(1);

  const sheet = sheets?.[0];

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div>
        <Link href="/manager/dashboard" className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1 mb-2">
          <ArrowLeft className="w-3 h-3" /> Back to Team
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">{employee.name}&apos;s goals</h1>
        <p className="text-muted-foreground mt-1">{employee.department || "No department"}</p>
      </div>

      {sheet ? (
        <ApprovalPanel sheet={sheet as unknown as GoalSheet} />
      ) : (
        <div className="text-center py-20">
          <p className="text-muted-foreground">No goal sheet found for this employee.</p>
        </div>
      )}
    </div>
  );
}
