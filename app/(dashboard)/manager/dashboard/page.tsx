import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Users, ArrowRight } from "lucide-react";

export default async function ManagerDashboard() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Single nested query: fetch team members with their sheets joined. One
  // round-trip instead of two (was: profiles → then goal_sheets IN teamIds).
  type MemberWithSheets = {
    id: string;
    name: string;
    department: string | null;
    sheets: Array<{
      id: string;
      status: string;
      employee_id: string;
      created_at: string;
      goals: { id: string; status: string }[];
      cycle: { name: string } | null;
    }>;
  };

  const { data: teamRaw } = await supabase
    .from("profiles")
    .select(
      "id, name, department, sheets:goal_sheets!goal_sheets_employee_id_fkey(id, status, employee_id, created_at, goals(id, status), cycle:goal_cycles(name))"
    )
    .eq("manager_id", user.id)
    .order("name");

  const team = (teamRaw as MemberWithSheets[] | null) ?? [];

  // Derive aggregates client-side from the single result set.
  const allSheets = team.flatMap((m) => m.sheets);
  const pendingApproval = allSheets.filter((s) => s.status === "submitted").length;
  const approved = allSheets.filter((s) => s.status === "approved").length;
  const teamSize = team.length;

  const statusColors: Record<string, string> = {
    draft: "status-draft", submitted: "status-submitted",
    approved: "status-approved", returned: "status-returned",
  };

  return (
    <div className="space-y-10">
      {/* Header carries the summary inline. No stat cards. */}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Team</h1>
        <p className="text-muted-foreground mt-1 text-sm tabular-nums">
          {teamSize} {teamSize === 1 ? "member" : "members"}
          <span className="mx-2 text-border">·</span>
          {pendingApproval > 0 ? (
            <span className="text-primary font-medium">{pendingApproval} pending approval</span>
          ) : (
            <span>0 pending approval</span>
          )}
          <span className="mx-2 text-border">·</span>
          {approved} approved
        </p>
      </div>

      {team.length > 0 ? (
        <ul className="divide-y divide-border/60 border-y border-border/60">
          {team.map((member) => {
            // Most recent sheet for this member (sheets are unordered in the
            // nested payload so we sort client-side; teams are small).
            const memberSheet = [...member.sheets]
              .sort(
                (a, b) =>
                  new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
              )[0];
            return (
              <li key={member.id} className="py-4 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className="w-9 h-9 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-primary text-sm font-semibold shrink-0"
                    aria-hidden
                  >
                    {member.name?.charAt(0) || "?"}
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium truncate">{member.name}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {member.department || "No department"}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  {memberSheet ? (
                    <>
                      <Badge className={statusColors[memberSheet.status]}>
                        {memberSheet.status}
                      </Badge>
                      <Link href={`/manager/team/${member.id}/goals`}>
                        <Button size="sm" variant="outline">
                          {memberSheet.status === "submitted" ? "Review" : "Open"}
                          <ArrowRight className="w-3 h-3 ml-1.5" />
                        </Button>
                      </Link>
                    </>
                  ) : (
                    <span className="text-xs text-muted-foreground italic">
                      No sheet yet
                    </span>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="rounded-xl border border-dashed border-border/60 px-6 py-12 text-center">
          <Users className="w-7 h-7 text-muted-foreground mx-auto mb-3" aria-hidden />
          <p className="font-medium">No team members</p>
          <p className="text-sm text-muted-foreground mt-1">
            Employees show up here once an admin assigns you as their manager.
          </p>
        </div>
      )}
    </div>
  );
}
