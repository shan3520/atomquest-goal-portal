"use client";

import { useState } from "react";
import { createOrUpdateCheckin } from "@/app/actions/checkins";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Loader2, Save } from "lucide-react";
import { formatScore, getScoreColor, getScoreBadgeClass, computeScore } from "@/lib/utils/score-calculator";
import type { Goal, Quarter, GoalStatus, UomType } from "@/types";

interface CheckinFormProps {
  goals: Goal[];
  quarter: Quarter;
}

interface CheckinState {
  actual_value: number | null;
  actual_date: string | null;
  status: GoalStatus;
  employee_notes: string;
  computed_score: number | null;
}

export function CheckinForm({ goals, quarter }: CheckinFormProps) {
  const [checkins, setCheckins] = useState<Record<string, CheckinState>>(() => {
    const initial: Record<string, CheckinState> = {};
    goals.forEach((goal) => {
      const existing = goal.checkins?.find(c => c.quarter === quarter);
      initial[goal.id] = {
        actual_value: existing?.actual_value ?? null,
        actual_date: existing?.actual_date ?? null,
        status: (existing?.status as GoalStatus) ?? "not_started",
        employee_notes: existing?.employee_notes ?? "",
        computed_score: existing?.computed_score ?? null,
      };
    });
    return initial;
  });
  const [saving, setSaving] = useState<string | null>(null);

  function updateCheckin(goalId: string, field: string, value: unknown) {
    setCheckins(prev => {
      const updated = { ...prev, [goalId]: { ...prev[goalId], [field]: value } };
      // Recompute score
      const goal = goals.find(g => g.id === goalId)!;
      const ci = updated[goalId];
      const score = computeScore(goal.uom_type, goal.target_value, ci.actual_value, goal.target_date, ci.actual_date);
      updated[goalId].computed_score = score;
      return updated;
    });
  }

  async function saveCheckin(goalId: string) {
    setSaving(goalId);
    const ci = checkins[goalId];
    const result = await createOrUpdateCheckin({
      goal_id: goalId, quarter, actual_value: ci.actual_value,
      actual_date: ci.actual_date, status: ci.status, employee_notes: ci.employee_notes,
    });
    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success("Check-in saved!");
    }
    setSaving(null);
  }

  return (
    <div className="space-y-4">
      {goals.map((goal) => {
        const ci = checkins[goal.id];
        const existing = goal.checkins?.find(c => c.quarter === quarter);
        return (
          <Card key={goal.id} className="glass-card">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base">{goal.title}</CardTitle>
                  <p className="text-xs text-muted-foreground mt-1 tabular-nums">
                    {goal.thrust_area}
                    <span className="mx-1.5 text-border">·</span>
                    {goal.weightage}% weight
                  </p>
                </div>
                {ci.computed_score !== null && (
                  <div className="text-right">
                    <p className="text-[10px] font-medium text-muted-foreground tracking-wider uppercase mb-1">Live score</p>
                    <Badge className={`${getScoreBadgeClass(ci.computed_score)} text-base px-3 py-1 font-semibold tabular-nums`}>
                      {formatScore(ci.computed_score)}
                    </Badge>
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {goal.uom_type === "timeline" ? (
                  <div className="space-y-2">
                    <Label>Actual completion date</Label>
                    <Input type="date" value={ci.actual_date || ""} className="bg-background/50"
                      onChange={(e) => updateCheckin(goal.id, "actual_date", e.target.value || null)} />
                    <p className="text-xs text-muted-foreground">
                      Target: {goal.target_date ? new Date(goal.target_date).toLocaleDateString() : "—"}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Label>Actual value</Label>
                    <Input type="number" step="any" value={ci.actual_value ?? ""} className="bg-background/50"
                      placeholder="Enter actual"
                      onChange={(e) => updateCheckin(goal.id, "actual_value", e.target.value ? Number(e.target.value) : null)} />
                    <p className="text-xs text-muted-foreground tabular-nums">Target: {goal.target_value ?? "—"}</p>
                  </div>
                )}

                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select value={ci.status} onValueChange={(v) => v && updateCheckin(goal.id, "status", v)}>
                    <SelectTrigger className="bg-background/50"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="not_started">Not started</SelectItem>
                      <SelectItem value="on_track">On track</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Notes</Label>
                  <Textarea value={ci.employee_notes} className="bg-background/50 h-[38px]"
                    placeholder="Progress update"
                    onChange={(e) => updateCheckin(goal.id, "employee_notes", e.target.value)} />
                </div>
              </div>

              {/* Manager comment */}
              {existing?.manager_comment && (
                <div className="p-3 rounded-lg bg-blue-500/5 border border-blue-500/20 text-sm">
                  <p className="font-medium text-blue-400 text-xs mb-1">Manager comment</p>
                  <p className="text-blue-300">{existing.manager_comment}</p>
                </div>
              )}

              <div className="flex justify-end">
                <Button size="sm" onClick={() => saveCheckin(goal.id)} disabled={saving === goal.id}>
                  {saving === goal.id ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                  Save
                </Button>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
