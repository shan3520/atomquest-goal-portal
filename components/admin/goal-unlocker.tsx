"use client";

import { useState } from "react";
import { unlockGoal } from "@/app/actions/admin";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { Search, Unlock, Lock, Loader2 } from "lucide-react";

interface GoalWithSheet {
  id: string; title: string; thrust_area: string; weightage: number;
  sheet: { id: string; status: string; employee: { name: string; email: string } };
}

export function GoalUnlocker({ initialGoals }: { initialGoals: GoalWithSheet[] }) {
  const [search, setSearch] = useState("");
  const [unlockId, setUnlockId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const filtered = initialGoals.filter(g =>
    g.title.toLowerCase().includes(search.toLowerCase()) ||
    g.sheet.employee.name.toLowerCase().includes(search.toLowerCase())
  );

  const lockedGoals = filtered.filter(g => g.sheet.status === "approved");

  async function handleUnlock() {
    if (!unlockId) return;
    setLoading(true);
    const result = await unlockGoal(unlockId);
    if (result.error) toast.error(result.error);
    else toast.success("Goal unlocked! Sheet status set to draft.");
    setLoading(false);
    setUnlockId(null);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Unlock goals</h1>
        <p className="text-muted-foreground mt-1">Unlock approved goals for editing (creates audit log)</p>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by goal title or employee..." className="pl-10 bg-background/50" />
      </div>

      <div className="grid gap-3">
        {lockedGoals.map((goal) => (
          <Card key={goal.id} className="glass-card">
            <CardContent className="py-4 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <Lock className="w-3.5 h-3.5 text-amber-400" />
                  <span className="font-medium">{goal.title}</span>
                  <Badge variant="outline" className="text-xs">{goal.weightage}%</Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  {goal.sheet.employee.name} · {goal.thrust_area}
                </p>
              </div>
              <Button size="sm" variant="outline" onClick={() => setUnlockId(goal.id)}
                className="border-amber-500/30 text-amber-400 hover:bg-amber-500/10">
                <Unlock className="w-3 h-3 mr-1" /> Unlock
              </Button>
            </CardContent>
          </Card>
        ))}
        {lockedGoals.length === 0 && (
          <Card className="glass-card border-dashed">
            <CardContent className="py-12 text-center text-muted-foreground">
              No locked goals found{search && " matching your search"}.
            </CardContent>
          </Card>
        )}
      </div>

      <AlertDialog open={!!unlockId} onOpenChange={() => setUnlockId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Unlock this goal?</AlertDialogTitle>
            <AlertDialogDescription>
              This will set the goal sheet back to draft status, allowing the employee to edit.
              An audit log entry will be created.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleUnlock} disabled={loading}>
              {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />} Unlock
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
