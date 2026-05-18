import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CheckCircle2, ArrowRight, Clock } from "lucide-react";

export default async function ManagerCheckinsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: team } = await supabase
    .from("profiles").select("*").eq("manager_id", user.id);

  const teamIds = team?.map(t => t.id) || [];

  // Get approved sheets with goals that need check-in action
  const { data: sheets } = teamIds.length > 0
    ? await supabase
        .from("goal_sheets")
        .select("*, goals(*, checkins:quarterly_checkins(*)), employee:profiles!goal_sheets_employee_id_fkey(name, department)")
        .in("employee_id", teamIds)
        .eq("status", "approved")
    : { data: [] };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Team check-ins</h1>
        <p className="text-muted-foreground mt-1">Review and comment on team member check-ins</p>
      </div>

      {sheets && sheets.length > 0 ? (
        <div className="grid gap-4">
          {sheets.map((sheet) => {
            const goalsWithCheckins = sheet.goals?.filter(
              (g: { checkins?: unknown[] }) => g.checkins && g.checkins.length > 0
            ).length || 0;
            const totalGoals = sheet.goals?.length || 0;
            const uncommented = sheet.goals?.reduce((count: number, g: { checkins?: { manager_comment: string | null }[] }) => {
              return count + (g.checkins?.filter(c => !c.manager_comment).length || 0);
            }, 0) || 0;

            return (
              <Card key={sheet.id} className="glass-card glass-card-hover">
                <CardContent className="py-5 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold">
                      {sheet.employee?.name?.charAt(0) || "?"}
                    </div>
                    <div>
                      <p className="font-medium">{sheet.employee?.name}</p>
                      <p className="text-sm text-muted-foreground tabular-nums">
                        {goalsWithCheckins}/{totalGoals} goals checked in
                        {uncommented > 0 && (
                          <span className="text-amber-400 ml-2">· {uncommented} awaiting comment</span>
                        )}
                      </p>
                    </div>
                  </div>
                  <Link href={`/manager/team/${sheet.employee_id}/goals`}>
                    <Button size="sm" variant="outline">
                      Review <ArrowRight className="w-3 h-3 ml-1" />
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card className="glass-card border-dashed">
          <CardContent className="py-12 text-center">
            <CheckCircle2 className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground">No check-ins pending review.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
