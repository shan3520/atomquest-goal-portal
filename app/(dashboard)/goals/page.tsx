import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FilePlus, ArrowRight } from "lucide-react";

export default async function GoalsListPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: sheets } = await supabase
    .from("goal_sheets")
    .select("*, goals(id), cycle:goal_cycles(name)")
    .eq("employee_id", user.id)
    .order("created_at", { ascending: false });

  const statusColors: Record<string, string> = {
    draft: "status-draft", submitted: "status-submitted",
    approved: "status-approved", returned: "status-returned",
  };

  if (!sheets || sheets.length === 0) {
    return (
      <div className="text-center py-20">
        <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
          <FilePlus className="w-8 h-8 text-primary" />
        </div>
        <h2 className="text-xl font-semibold mb-2">No goal sheets yet</h2>
        <p className="text-muted-foreground text-sm mb-4">Create your first goal sheet to get started.</p>
        <Link href="/goals/new"><Button><FilePlus className="w-4 h-4 mr-2" />Create goal sheet</Button></Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">My goal sheets</h1>
          <p className="text-muted-foreground mt-1 text-sm tabular-nums">{sheets.length} {sheets.length === 1 ? "sheet" : "sheets"}</p>
        </div>
        <Link href="/goals/new"><Button><FilePlus className="w-4 h-4 mr-2" />New sheet</Button></Link>
      </div>

      <div className="grid gap-4">
        {sheets.map((sheet) => (
          <Link key={sheet.id} href={`/goals/${sheet.id}`}>
            <Card className="glass-card glass-card-hover cursor-pointer">
              <CardContent className="py-5 flex items-center justify-between">
                <div>
                  <p className="font-medium">{sheet.cycle?.name || "Unknown cycle"}</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    {sheet.goals?.length || 0} goals · Created {new Date(sheet.created_at).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <Badge className={statusColors[sheet.status]}>{sheet.status}</Badge>
                  <ArrowRight className="w-4 h-4 text-muted-foreground" />
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
