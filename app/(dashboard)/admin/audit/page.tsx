import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { ScrollText } from "lucide-react";

export default async function AuditPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: logs } = await supabase
    .from("audit_logs")
    .select("*, changed_by_profile:profiles!audit_logs_changed_by_fkey(name)")
    .order("created_at", { ascending: false })
    .limit(100);

  const actionColors: Record<string, string> = {
    approved: "status-approved",
    returned: "status-returned",
    unlocked: "bg-amber-500/20 text-amber-400 border-amber-500/30",
    role_updated: "bg-blue-500/20 text-blue-400 border-blue-500/30",
    shared_goal_created: "bg-purple-500/20 text-purple-400 border-purple-500/30",
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Audit trail</h1>
        <p className="text-muted-foreground mt-1">Track all changes across the system</p>
      </div>

      <Card className="glass-card overflow-hidden">
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>User</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Table</TableHead>
                <TableHead>Details</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs && logs.length > 0 ? logs.map((log) => (
                <TableRow key={log.id}>
                  <TableCell className="text-sm whitespace-nowrap">
                    {new Date(log.created_at).toLocaleString()}
                  </TableCell>
                  <TableCell className="font-medium">
                    {(log.changed_by_profile as { name: string } | null)?.name || "System"}
                  </TableCell>
                  <TableCell>
                    <Badge className={actionColors[log.action] || "status-draft"}>
                      {log.action}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{log.table_name}</TableCell>
                  <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">
                    {log.new_values ? JSON.stringify(log.new_values) : "—"}
                  </TableCell>
                </TableRow>
              )) : (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-12">
                    <ScrollText className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    No audit logs yet
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
