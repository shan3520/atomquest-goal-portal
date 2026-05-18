"use client";

import { useState, useEffect, useTransition } from "react";
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
  Plus, Trash2, Loader2, Send, AlertCircle, Info, Save, Share2, Lock, X,
} from "lucide-react";
import {
  THRUST_AREAS, UOM_TYPE_OPTIONS,
  type GoalFormData, type UomType,
} from "@/types";

const FIRST_VISIT_KEY = "atomquest.goal-sheet-form.tip-dismissed";

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

interface GoalFieldErrors {
  title?: string;
  thrust_area?: string;
  weightage?: string;
  target?: string;
}

function getGoalErrors(goal: GoalFormData): GoalFieldErrors {
  const errs: GoalFieldErrors = {};
  if (!goal.title?.trim()) errs.title = "Required";
  if (!goal.thrust_area) errs.thrust_area = "Required";
  if (goal.weightage < MIN_WEIGHTAGE) errs.weightage = `Minimum ${MIN_WEIGHTAGE}%`;
  else if (goal.weightage > 100) errs.weightage = "Cannot exceed 100%";
  if (goal.uom_type === "timeline") {
    if (!goal.target_date) errs.target = "Required";
  } else if (goal.target_value === null || goal.target_value === undefined) {
    errs.target = "Required";
  }
  return errs;
}

export function GoalSheetForm({ cycles, initialGoals, initialCycleId }: GoalSheetNewPageProps) {
  const [cycleId, setCycleId] = useState(initialCycleId || cycles[0]?.id || "");
  const [goals, setGoals] = useState<GoalFormData[]>(
    initialGoals && initialGoals.length > 0 ? initialGoals : [emptyGoal()]
  );
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  // First-visit tip panel. Persisted via localStorage so it only ever shows once
  // per browser. Hidden if the user is editing a returning draft (they've seen
  // the form before). Default false during SSR + first hydration tick; we flip
  // it on mount based on localStorage to avoid a hydration mismatch.
  const isFirstVisit = !initialGoals || initialGoals.length === 0;
  const [showTip, setShowTip] = useState(false);
  useEffect(() => {
    if (!isFirstVisit) return;
    if (typeof window === "undefined") return;
    if (window.localStorage.getItem(FIRST_VISIT_KEY) !== "true") {
      setShowTip(true);
    }
  }, [isFirstVisit]);
  function dismissTip() {
    setShowTip(false);
    try {
      window.localStorage.setItem(FIRST_VISIT_KEY, "true");
    } catch {
      // localStorage can throw in private-mode Safari; tip just won't persist
    }
  }

  const totalWeightage = goals.reduce((sum, g) => sum + g.weightage, 0);
  const remaining = 100 - totalWeightage;
  const hasMinWeightageError = goals.some((g) => g.weightage < MIN_WEIGHTAGE);
  const allRequiredFilled = goals.every((g) => Object.keys(getGoalErrors(g)).length === 0);
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
    setSubmitAttempted(true);
    if (!cycleId) { toast.error("Please select a cycle"); return; }
    if (submit && !canSubmit) {
      // Inline errors are now visible on the offending fields; toast as backup
      if (totalWeightage !== 100) toast.error("Total weightage must equal exactly 100%");
      else if (hasMinWeightageError) toast.error(`Each goal needs at least ${MIN_WEIGHTAGE}% weightage`);
      else if (!allRequiredFilled) toast.error("Fill required fields highlighted on each goal");
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
        : `Reduce ${totalWeightage - 100}% (weightage exceeds 100%)`
      : hasMinWeightageError
        ? `Each goal needs at least ${MIN_WEIGHTAGE}% weightage`
        : !allRequiredFilled
          ? "Fill all required fields (title, thrust area, target) on every goal"
          : null;

  return (
    // pb-24 ensures the last goal scrolls clear of the sticky submit bar
    // (which floats ~16px from the bottom on short viewports).
    <div className="space-y-6 max-w-4xl mx-auto pb-24">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Create goal sheet</h1>
        <p className="text-muted-foreground mt-1 text-sm">Define your goals for the cycle</p>
      </div>

      {/* First-visit tip panel. Hidden after dismissal (persisted) and never
          shown when editing a returning draft. */}
      {showTip && (
        <aside
          role="note"
          aria-labelledby="first-visit-tip-title"
          className="rounded-xl border border-primary/30 bg-primary/[0.06] px-5 py-4"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <p
                id="first-visit-tip-title"
                className="text-sm font-semibold text-primary mb-1.5"
              >
                How a goal sheet works
              </p>
              <ul className="text-xs text-foreground/85 space-y-1 leading-relaxed">
                <li>
                  Add <strong>3 to 8 goals</strong>. The weightages across all goals must sum to exactly 100%.
                </li>
                <li>
                  Each goal belongs to a <strong>thrust area</strong>, the Atomberg priority it contributes to.
                </li>
                <li>
                  Pick a <strong>unit of measurement</strong> that matches how the goal will be measured at year-end.
                </li>
                <li>
                  Save as draft anytime. Submit when total weightage hits 100%, then your manager reviews.
                </li>
              </ul>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={dismissTip}
              aria-label="Dismiss tip"
              className="h-8 w-8 shrink-0 text-muted-foreground hover:text-foreground"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </aside>
      )}

      {/* Cycle Selector */}
      <Card className="glass-card">
        <CardContent className="pt-6">
          <Label>Goal cycle</Label>
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
            <span className="text-sm font-medium">Weightage allocation</span>
            <span className={`text-sm font-semibold tabular-nums ${weightageColor}`}>
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
              <AlertCircle className="w-3 h-3" /> Total exceeds 100%, reduce by {totalWeightage - 100}%
            </p>
          )}
          {totalWeightage < 100 && (
            <p className="text-xs text-red-400 mt-1 flex items-center gap-1">
              <AlertCircle className="w-3 h-3" /> {remaining}% remaining, total must equal exactly 100%
            </p>
          )}
          {totalWeightage === 100 && (
            <p className="text-xs text-emerald-400 mt-1 flex items-center gap-1">
              <Info className="w-3 h-3" /> Total weightage is 100%, ready to submit
            </p>
          )}
        </CardContent>
      </Card>

      {/* Goals */}
      {goals.map((goal, index) => {
        const isShared = !!goal.is_shared || !!goal.shared_from;
        const errors = getGoalErrors(goal);
        const showErrors = submitAttempted;
        const errClass = "border-red-500/60 focus-visible:ring-red-500/30";
        const errId = (field: string) => `goal-${index}-${field}-error`;

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
              aria-label={isShared ? `Goal ${index + 1} is shared and cannot be removed` : `Remove goal ${index + 1}`}
              className="text-destructive hover:text-destructive h-11 w-11 disabled:opacity-30">
              <Trash2 className="w-4 h-4" />
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            {isShared && (
              <p className="text-xs text-blue-300/80 flex items-center gap-1.5">
                <Lock className="w-3 h-3" />
                Shared goal: you can only adjust weightage. Title, target, and UoM are set by the goal owner.
              </p>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor={`goal-${index}-thrust`}>Thrust area</Label>
                <Select
                  value={goal.thrust_area}
                  onValueChange={(v) => v && updateGoal(index, "thrust_area", v)}
                  disabled={isShared}
                >
                  <SelectTrigger
                    id={`goal-${index}-thrust`}
                    aria-invalid={showErrors && !!errors.thrust_area}
                    aria-describedby={showErrors && errors.thrust_area ? errId("thrust") : `goal-${index}-thrust-hint`}
                    className={`bg-background/50 ${showErrors && errors.thrust_area ? errClass : ""}`}
                  >
                    <SelectValue placeholder="Select area" />
                  </SelectTrigger>
                  <SelectContent>
                    {THRUST_AREAS.map(area => (
                      <SelectItem key={area} value={area}>{area}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {showErrors && errors.thrust_area ? (
                  <p id={errId("thrust")} className="text-xs text-red-400">{errors.thrust_area}</p>
                ) : (
                  <p id={`goal-${index}-thrust-hint`} className="text-xs text-muted-foreground">
                    Which Atomberg priority does this goal advance?
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor={`goal-${index}-weight`}>Weightage (%)</Label>
                <Input
                  id={`goal-${index}-weight`}
                  type="number"
                  min={10}
                  max={100}
                  step={5}
                  value={goal.weightage === 0 ? "" : goal.weightage}
                  aria-invalid={showErrors && !!errors.weightage}
                  aria-describedby={showErrors && errors.weightage ? errId("weight") : `goal-${index}-weight-hint`}
                  className={`bg-background/50 ${showErrors && errors.weightage ? errClass : ""}`}
                  onChange={(e) => {
                    const raw = e.target.value;
                    if (raw === "") {
                      updateGoal(index, "weightage", 0);
                      return;
                    }
                    const cleaned = raw.replace(/^0+(?=\d)/, "");
                    const parsed = Number(cleaned);
                    updateGoal(index, "weightage", Number.isFinite(parsed) ? parsed : 0);
                  }}
                  onBlur={(e) => {
                    const parsed = Number(e.target.value);
                    updateGoal(index, "weightage", Number.isFinite(parsed) ? parsed : 0);
                  }}
                />
                {showErrors && errors.weightage ? (
                  <p id={errId("weight")} className="text-xs text-red-400">{errors.weightage}</p>
                ) : (
                  <p id={`goal-${index}-weight-hint`} className="text-xs text-muted-foreground">
                    Min 10%. All goals must sum to 100%.
                  </p>
                )}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor={`goal-${index}-title`}>Goal title</Label>
              <Input
                id={`goal-${index}-title`}
                value={goal.title}
                placeholder="e.g., Increase Monthly Active Users by 25%"
                disabled={isShared}
                aria-invalid={showErrors && !!errors.title}
                aria-describedby={showErrors && errors.title ? errId("title") : undefined}
                className={`bg-background/50 ${showErrors && errors.title ? errClass : ""}`}
                onChange={(e) => updateGoal(index, "title", e.target.value)}
              />
              {showErrors && errors.title && (
                <p id={errId("title")} className="text-xs text-red-400">{errors.title}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor={`goal-${index}-desc`}>Description</Label>
              <Textarea
                id={`goal-${index}-desc`}
                value={goal.description}
                className="bg-background/50"
                placeholder="Describe the goal, expected outcomes, and key actions"
                disabled={isShared}
                onChange={(e) => updateGoal(index, "description", e.target.value)}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor={`goal-${index}-uom`}>Unit of measurement</Label>
                <Select
                  value={goal.uom_type}
                  onValueChange={(v) => v && updateGoal(index, "uom_type", v)}
                  disabled={isShared}
                >
                  <SelectTrigger id={`goal-${index}-uom`} className="bg-background/50">
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
                {goal.uom_type && (
                  <p className="text-xs text-muted-foreground flex items-start gap-1.5">
                    <Info className="w-3 h-3 mt-0.5 shrink-0" aria-hidden />
                    <span>{UOM_TYPE_OPTIONS.find(o => o.value === goal.uom_type)?.example}</span>
                  </p>
                )}
              </div>

              {goal.uom_type === "timeline" ? (
                <div className="space-y-1.5">
                  <Label htmlFor={`goal-${index}-tdate`}>Target date</Label>
                  <Input
                    id={`goal-${index}-tdate`}
                    type="date"
                    value={goal.target_date || ""}
                    disabled={isShared}
                    aria-invalid={showErrors && !!errors.target}
                    aria-describedby={showErrors && errors.target ? errId("target") : undefined}
                    className={`bg-background/50 ${showErrors && errors.target ? errClass : ""}`}
                    onChange={(e) => updateGoal(index, "target_date", e.target.value)}
                  />
                  {showErrors && errors.target && (
                    <p id={errId("target")} className="text-xs text-red-400">{errors.target}</p>
                  )}
                </div>
              ) : (
                <div className="space-y-1.5">
                  <Label htmlFor={`goal-${index}-tval`}>Target value</Label>
                  <Input
                    id={`goal-${index}-tval`}
                    type="number"
                    step="any"
                    value={goal.target_value ?? ""}
                    placeholder="e.g., 50000"
                    disabled={isShared}
                    aria-invalid={showErrors && !!errors.target}
                    aria-describedby={showErrors && errors.target ? errId("target") : undefined}
                    className={`bg-background/50 ${showErrors && errors.target ? errClass : ""}`}
                    onChange={(e) => updateGoal(index, "target_value", e.target.value ? Number(e.target.value) : null)}
                  />
                  {showErrors && errors.target && (
                    <p id={errId("target")} className="text-xs text-red-400">{errors.target}</p>
                  )}
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
          <Plus className="w-4 h-4 mr-2" /> Add goal ({goals.length}/8)
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
            Save as draft
          </Button>
          {blockReason ? (
            <Tooltip>
              {/* Button stays focusable (no wrapping span with tabIndex=0). It's
                  aria-disabled, not actually disabled, so screen readers can read
                  the block reason via aria-describedby and the click handler
                  intercepts. Visual state: muted variant + extra opacity. */}
              <TooltipTrigger
                render={
                  <Button
                    type="button"
                    variant="secondary"
                    aria-disabled
                    aria-describedby="submit-block-reason"
                    onClick={(e) => {
                      e.preventDefault();
                      setSubmitAttempted(true);
                      toast.error(blockReason);
                    }}
                    className="opacity-60 cursor-not-allowed"
                  >
                    <Send className="w-4 h-4 mr-2" />
                    Submit goal sheet
                  </Button>
                }
              />
              <TooltipContent id="submit-block-reason">
                {totalWeightage !== 100
                  ? "Total weightage must equal 100%"
                  : blockReason}
              </TooltipContent>
            </Tooltip>
          ) : (
            <Button onClick={() => handleSubmit(true)} disabled={loading}>
              {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
              Submit goal sheet
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
