"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createGoalSheet } from "@/app/actions/goals";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "sonner";
import {
  Plus, Trash2, Loader2, Send, AlertCircle, Info, Save, Share2, Lock,
} from "lucide-react";
import {
  THRUST_AREAS, UOM_TYPE_OPTIONS,
  type GoalFormData, type UomType,
} from "@/types";

interface GoalSheetNewPageProps {
  cycles: { id: string; name: string }[];
  initialGoals?: GoalFormData[];
  initialCycleId?: string;
}

const emptyGoal = (): GoalFormData => ({
  title: "", description: "", thrust_area: "",
  uom_type: "numeric_min" as UomType, target_value: null,
  target_date: null, weightage: 10,
});

const MIN_WEIGHTAGE = 10;
const MAX_GOALS = 8;

export function GoalSheetForm({ cycles, initialGoals, initialCycleId }: GoalSheetNewPageProps) {
  const [cycleId, setCycleId] = useState(initialCycleId || cycles[0]?.id || "");
  const [goals, setGoals] = useState<GoalFormData[]>(
    initialGoals && initialGoals.length > 0 ? initialGoals : [emptyGoal()]
  );
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const totalWeightage = goals.reduce((sum, g) => sum + g.weightage, 0);
  const remaining = 100 - totalWeightage;
  const hasMinWeightageError = goals.some((g) => g.weightage < MIN_WEIGHTAGE);
  const allRequiredFilled = goals.every((g) => {
    if (!g.title.trim() || !g.thrust_area) return false;
    if (g.uom_type === "timeline") return !!g.target_date;
    return g.target_value !== null && g.target_value !== undefined;
  });
  const canSubmit = totalWeightage === 100 && !hasMinWeightageError && allRequiredFilled && goals.length <= MAX_GOALS;

  function updateGoal(index: number, field: keyof GoalFormData, value: unknown) {
    setGoals((prev) => {
      const updated = [...prev];
      (updated[index] as unknown as Record<string, unknown>)[field] = value;
      return updated;
    });
  }

  function addGoal() {
    if (goals.length >= MAX_GOALS) { toast.error(`Maximum ${MAX_GOALS} goals allowed`); return; }
    setGoals([...goals, emptyGoal()]);
  }

  function removeGoal(index: number) {
    if (goals.length <= 1) { toast.error("At least 1 goal required"); return; }
    setGoals(goals.filter((_, i) => i !== index));
  }

  function handleSubmit(submit: boolean) {
    if (!cycleId) { toast.error("Please select a cycle"); return; }
    if (submit && !canSubmit) {
      if (totalWeightage !== 100) toast.error("Total weightage must equal exactly 100%");
      else if (hasMinWeightageError) toast.error(`Each goal needs at least ${MIN_WEIGHTAGE}% weightage`);
      else if (!allRequiredFilled) toast.error("Fill all required fields on every goal");
      return;
    }
    if (hasMinWeightageError) {
      toast.error(`Each goal needs at least ${MIN_WEIGHTAGE}% weightage`);
      return;
    }

    startTransition(async () => {
      const result = await createGoalSheet(cycleId, goals, submit);
      if (!result.data) {
        toast.error(result.error || "Failed to save goal sheet");
        return;
      }
      if (submit) {
        toast.success("Goal sheet submitted! Awaiting manager approval.");
        router.push(`/goals/${result.data.id}`);
      } else {
        toast.success("Draft saved");
        router.push("/dashboard");
      }
      router.refresh();
    });
  }

  const loading = isPending;

  // Spec: red when <100%, green when exactly 100%, red when >100%
  const weightageColor = totalWeightage === 100 ? "text-emerald-400" : "text-red-400";
  const weightageBarClass =
    totalWeightage === 100
      ? "[&>[data-slot=progress-indicator]]:bg-emerald-500"
      : "[&>[data-slot=progress-indicator]]:bg-red-500";

  const blockReason: string | null =
    totalWeightage !== 100
      ? totalWeightage < 100
        ? `Allocate ${100 - totalWeightage}% more weightage to reach 100%`
        : `Reduce ${totalWeightage - 100}% — weightage exceeds 100%`
      : hasMinWeightageError
        ? `Each goal needs at least ${MIN_WEIGHTAGE}% weightage`
        : !allRequiredFilled
          ? "Fill all required fields (title, thrust area, target) on every goal"
          : null;

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold">Create Goal Sheet</h1>
        <p className="text-muted-foreground mt-1">Define your goals for the cycle</p>
      </div>

      {/* Cycle Selector */}
      <Card className="glass-card">
        <CardContent className="pt-6">
          <Label>Goal Cycle</Label>
          <Select value={cycleId} onValueChange={(v) => v && setCycleId(v)}>
            <SelectTrigger className="mt-2 bg-background/50">
              {/* base-ui Select.Value renders the raw value (UUID) unless you pass a
                  children-as-function. Map id → cycle name so the trigger shows the label. */}
              <SelectValue placeholder="Select cycle">
                {(value: unknown) => {
                  if (typeof value !== "string" || !value) return "Select cycle";
                  return cycles.find((c) => c.id === value)?.name ?? value;
                }}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {cycles.map(c => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* Weightage Progress */}
      <Card className="glass-card sticky top-0 z-20">
        <CardContent className="py-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">Weightage Allocation</span>
            <span className={`text-sm font-bold ${weightageColor}`}>
              {totalWeightage}% / 100%
              {remaining !== 0 && (
                <span className="text-muted-foreground font-normal ml-2">
                  ({remaining > 0 ? `${remaining}% remaining` : `${Math.abs(remaining)}% over`})
                </span>
              )}
            </span>
          </div>
          <Progress
            value={Math.min(totalWeightage, 100)}
            className={`h-3 ${weightageBarClass}`}
          />
          {totalWeightage > 100 && (
            <p className="text-xs text-red-400 mt-1 flex items-center gap-1">
              <AlertCircle className="w-3 h-3" /> Total exceeds 100% — reduce by {totalWeightage - 100}%
            </p>
          )}
          {totalWeightage < 100 && (
            <p className="text-xs text-red-400 mt-1 flex items-center gap-1">
              <AlertCircle className="w-3 h-3" /> {remaining}% remaining — total must equal exactly 100%
            </p>
          )}
          {totalWeightage === 100 && (
            <p className="text-xs text-emerald-400 mt-1 flex items-center gap-1">
              <Info className="w-3 h-3" /> Total weightage is 100% — ready to submit
            </p>
          )}
        </CardContent>
      </Card>

      {/* Goals */}
      {goals.map((goal, index) => {
        // Shared goals: title/description/thrust/UoM/target are read-only;
        // employee may only edit weightage (BRD §2.1).
        const isShared = !!goal.is_shared || !!goal.shared_from;
        return (
        <Card key={goal.id ?? index} className="glass-card">
          <CardHeader className="flex flex-row items-center justify-between pb-4">
            <CardTitle className="text-base flex items-center gap-2">
              Goal {index + 1}
              <Badge variant="outline" className="text-xs">{goal.weightage}%</Badge>
              {isShared && (
                <Badge className="text-xs bg-blue-500/15 text-blue-300 border border-blue-500/30 gap-1">
                  <Share2 className="w-3 h-3" /> Shared
                </Badge>
              )}
            </CardTitle>
            <Button variant="ghost" size="icon" onClick={() => removeGoal(index)}
              disabled={isShared}
              title={isShared ? "Shared goals cannot be removed" : "Remove goal"}
              className="text-destructive hover:text-destructive h-8 w-8 disabled:opacity-30">
              <Trash2 className="w-4 h-4" />
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            {isShared && (
              <p className="text-xs text-blue-300/80 flex items-center gap-1.5">
                <Lock className="w-3 h-3" />
                Shared goal — you can only adjust weightage. Title, target, and UoM are set by the goal owner.
              </p>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Thrust Area *</Label>
                <Select
                  value={goal.thrust_area}
                  onValueChange={(v) => v && updateGoal(index, "thrust_area", v)}
                  disabled={isShared}
                >
                  <SelectTrigger className="bg-background/50">
                    <SelectValue placeholder="Select area" />
                  </SelectTrigger>
                  <SelectContent>
                    {THRUST_AREAS.map(area => (
                      <SelectItem key={area} value={area}>{area}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Weightage (%) *</Label>
                <Input
                  type="number"
                  min={10}
                  max={100}
                  step={5}
                  // Empty when 0 so users don't have to backspace over a leading zero
                  value={goal.weightage === 0 ? "" : goal.weightage}
                  className="bg-background/50"
                  onChange={(e) => {
                    const raw = e.target.value;
                    if (raw === "") {
                      updateGoal(index, "weightage", 0);
                      return;
                    }
                    // Strip leading zeros so "050" → 50
                    const cleaned = raw.replace(/^0+(?=\d)/, "");
                    const parsed = Number(cleaned);
                    updateGoal(
                      index,
                      "weightage",
                      Number.isFinite(parsed) ? parsed : 0
                    );
                  }}
                  onBlur={(e) => {
                    // Normalize on blur: empty → 0, otherwise re-parse the number to drop any stray zeros
                    const parsed = Number(e.target.value);
                    updateGoal(
                      index,
                      "weightage",
                      Number.isFinite(parsed) ? parsed : 0
                    );
                  }}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Goal Title *</Label>
              <Input value={goal.title} className="bg-background/50"
                placeholder="e.g., Increase Monthly Active Users by 25%"
                disabled={isShared}
                onChange={(e) => updateGoal(index, "title", e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea value={goal.description} className="bg-background/50"
                placeholder="Describe the goal, expected outcomes, and key actions..."
                disabled={isShared}
                onChange={(e) => updateGoal(index, "description", e.target.value)}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Unit of Measurement *</Label>
                <Select
                  value={goal.uom_type}
                  onValueChange={(v) => v && updateGoal(index, "uom_type", v)}
                  disabled={isShared}
                >
                  <SelectTrigger className="bg-background/50">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {UOM_TYPE_OPTIONS.map(opt => (
                      <SelectItem key={opt.value} value={opt.value}>
                        <div>
                          <p>{opt.label}</p>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {/* UoM description */}
                {goal.uom_type && (
                  <div className="text-xs text-muted-foreground flex items-start gap-1.5 mt-1">
                    <Info className="w-3 h-3 mt-0.5 shrink-0" />
                    <span>
                      {UOM_TYPE_OPTIONS.find(o => o.value === goal.uom_type)?.example}
                    </span>
                  </div>
                )}
              </div>

              {goal.uom_type === "timeline" ? (
                <div className="space-y-2">
                  <Label>Target Date *</Label>
                  <Input type="date" value={goal.target_date || ""} className="bg-background/50"
                    disabled={isShared}
                    onChange={(e) => updateGoal(index, "target_date", e.target.value)}
                  />
                </div>
              ) : (
                <div className="space-y-2">
                  <Label>Target Value *</Label>
                  <Input type="number" step="any" value={goal.target_value ?? ""} className="bg-background/50"
                    placeholder="e.g., 50000"
                    disabled={isShared}
                    onChange={(e) => updateGoal(index, "target_value", e.target.value ? Number(e.target.value) : null)}
                  />
                </div>
              )}
            </div>
          </CardContent>
        </Card>
        );
      })}

      {/* Add Goal Button */}
      {goals.length < 8 && (
        <Button variant="outline" onClick={addGoal} className="w-full border-dashed border-2">
          <Plus className="w-4 h-4 mr-2" /> Add Goal ({goals.length}/8)
        </Button>
      )}

      {/* Submit */}
      <div className="flex flex-col gap-2 items-end sticky bottom-4 z-10">
        {hasMinWeightageError && (
          <p className="text-xs text-red-400 flex items-center gap-1">
            <AlertCircle className="w-3 h-3" /> Each goal must have at least {MIN_WEIGHTAGE}% weightage
          </p>
        )}
        <div className="flex gap-3">
          <Button
            variant="outline"
            onClick={() => handleSubmit(false)}
            disabled={loading || hasMinWeightageError}
          >
            {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
            Save as Draft
          </Button>
          {blockReason ? (
            <Tooltip>
              <TooltipTrigger
                render={
                  <span className="inline-block cursor-not-allowed" tabIndex={0}>
                    {/* Muted "secondary" variant + extra opacity makes the disabled state
                        visually unmistakable vs. the active amber Submit. */}
                    <Button
                      type="button"
                      disabled
                      variant="secondary"
                      aria-disabled
                      className="pointer-events-none opacity-60"
                    >
                      <Send className="w-4 h-4 mr-2" />
                      Submit Goal Sheet
                    </Button>
                  </span>
                }
              />
              <TooltipContent>
                {totalWeightage !== 100
                  ? "Total weightage must equal 100%"
                  : blockReason}
              </TooltipContent>
            </Tooltip>
          ) : (
            <Button onClick={() => handleSubmit(true)} disabled={loading}>
              {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
              Submit Goal Sheet
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
