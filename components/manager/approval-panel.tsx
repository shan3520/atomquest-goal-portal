"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  approveGoalSheet,
  returnGoalSheet,
  addManagerComment,
  managerUpdateGoal,
} from "@/app/actions/manager";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import {
  CheckCircle2, RotateCcw, Loader2, MessageSquare, FileEdit, Hourglass,
  Pencil, X, Save,
} from "lucide-react";
import { formatScore, getScoreColor } from "@/lib/utils/score-calculator";
import { UOM_TYPE_OPTIONS } from "@/types";
import type { GoalSheet, Goal } from "@/types";

interface ApprovalPanelProps {
  sheet: GoalSheet;
}

export function ApprovalPanel({ sheet }: ApprovalPanelProps) {
  const router = useRouter();
  const [approveOpen, setApproveOpen] = useState(false);
  const [returnOpen, setReturnOpen] = useState(false);
  const [returnReason, setReturnReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [commentGoalId, setCommentGoalId] = useState<string | null>(null);
  const [comment, setComment] = useState("");
  const [commentSaving, setCommentSaving] = useState(false);
  // Inline-edit state. Per BRD §2.1 the manager can edit target / weightage
  // while the sheet is `submitted`. We keep one goal in edit mode at a time
  // so the changes you stage are obvious.
  const [editingGoalId, setEditingGoalId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<Partial<Goal>>({});
  const [editSaving, setEditSaving] = useState(false);
  const canEdit = sheet.status === "submitted";

  function startEdit(goal: Goal) {
    setEditingGoalId(goal.id);
    setEditDraft({
      title: goal.title,
      description: goal.description,
      thrust_area: goal.thrust_area,
      uom_type: goal.uom_type,
      target_value: goal.target_value,
      target_date: goal.target_date,
      weightage: goal.weightage,
    });
  }
  function cancelEdit() {
    setEditingGoalId(null);
    setEditDraft({});
  }
  async function saveEdit(goalId: string) {
    setEditSaving(true);
    const result = await managerUpdateGoal(goalId, {
      title: editDraft.title,
      description: editDraft.description ?? null,
      thrust_area: editDraft.thrust_area,
      uom_type: editDraft.uom_type,
      target_value: editDraft.target_value ?? null,
      target_date: editDraft.target_date ?? null,
      weightage: editDraft.weightage,
    });
    setEditSaving(false);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    toast.success("Goal updated");
    setEditingGoalId(null);
    setEditDraft({});
    router.refresh();
  }

  const statusColors: Record<string, string> = {
    draft: "status-draft", submitted: "status-submitted",
    approved: "status-approved", returned: "status-returned",
  };
  const goalStatusColors: Record<string, string> = {
    not_started: "status-not_started", on_track: "status-on_track", completed: "status-completed",
  };

  async function handleApprove() {
    setLoading(true);
    const result = await approveGoalSheet(sheet.id);
    if (result.error) {
      toast.error(result.error);
      setLoading(false);
      return;
    }
    toast.success("Goal sheet approved!");
    setLoading(false);
    setApproveOpen(false);
    router.push("/manager/dashboard");
    router.refresh();
  }

  async function handleReturn() {
    if (!returnReason.trim()) { toast.error("Reason is required"); return; }
    setLoading(true);
    const result = await returnGoalSheet(sheet.id, returnReason);
    if (result.error) {
      toast.error(result.error);
      setLoading(false);
      return;
    }
    toast.success("Goal sheet returned to employee");
    setReturnReason("");
    setLoading(false);
    setReturnOpen(false);
    router.push("/manager/dashboard");
    router.refresh();
  }

  async function handleComment(checkinId: string) {
    if (!comment.trim()) { toast.error("Comment cannot be empty"); return; }
    if (commentSaving) return; // belt-and-suspenders against double-clicks
    setCommentSaving(true);
    const result = await addManagerComment(checkinId, comment);
    if (result.error) {
      toast.error(result.error);
      setCommentSaving(false);
      return;
    }
    toast.success("Comment added");
    setCommentGoalId(null);
    setComment("");
    setCommentSaving(false);
    router.refresh();
  }

  return (
    <div className="space-y-6">
      {/* Status banner — explains what (if any) action the manager can take */}
      {sheet.status === "submitted" && (
        <Card className="glass-card border-amber-500/30">
          <CardContent className="py-4 flex items-center justify-between">
            <p className="text-sm font-medium text-amber-400">This sheet is pending your review</p>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setReturnOpen(true)}
                className="border-red-500/30 text-red-400 hover:bg-red-500/10">
                <RotateCcw className="w-4 h-4 mr-2" /> Return
              </Button>
              <Button onClick={() => setApproveOpen(true)}>
                <CheckCircle2 className="w-4 h-4 mr-2" /> Approve
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
      {sheet.status === "draft" && (
        <Card className="glass-card border-zinc-500/30">
          <CardContent className="py-4 flex items-center gap-3">
            <FileEdit className="w-5 h-5 text-zinc-400 shrink-0" />
            <p className="text-sm text-muted-foreground">
              Employee is still drafting this sheet. Approve/return will appear once they submit it for review.
            </p>
          </CardContent>
        </Card>
      )}
      {sheet.status === "returned" && (
        <Card className="glass-card border-red-500/30">
          <CardContent className="py-4 space-y-1">
            <p className="text-sm font-medium text-red-400">You returned this sheet for revision</p>
            {sheet.return_reason && (
              <p className="text-sm text-muted-foreground">Reason: {sheet.return_reason}</p>
            )}
          </CardContent>
        </Card>
      )}
      {sheet.status === "approved" && (
        <Card className="glass-card border-emerald-500/30">
          <CardContent className="py-4 flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
            <p className="text-sm text-muted-foreground">
              This sheet is approved. Goals are locked; you can still leave comments on check-ins below.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Status */}
      <div className="flex items-center gap-3">
        <Badge className={statusColors[sheet.status]}>
          {sheet.status.charAt(0).toUpperCase() + sheet.status.slice(1)}
        </Badge>
        <span className="text-sm text-muted-foreground tabular-nums">
          {sheet.goals?.length || 0} goals
          <span className="mx-2 text-border">·</span>
          Total weightage: {sheet.goals?.reduce((s, g) => s + g.weightage, 0)}%
        </span>
      </div>

      {/* Goals */}
      {sheet.goals?.map((goal, index) => {
        const uomLabel = UOM_TYPE_OPTIONS.find(o => o.value === goal.uom_type)?.label || goal.uom_type;
        const isEditing = editingGoalId === goal.id;
        return (
          <Card key={goal.id} className="glass-card">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs text-muted-foreground tabular-nums">#{index + 1}</span>
                    <Badge variant="outline" className="tabular-nums">{goal.weightage}%</Badge>
                    <Badge className={goalStatusColors[goal.status]}>{goal.status.replace("_", " ")}</Badge>
                  </div>
                  <CardTitle className="text-base">{goal.title}</CardTitle>
                </div>
                {canEdit && !isEditing && (
                  <Button size="sm" variant="ghost" onClick={() => startEdit(goal)}>
                    <Pencil className="w-3 h-3 mr-1" /> Edit
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {isEditing ? (
                <div className="space-y-3 rounded-lg border border-primary/30 p-3 bg-primary/5">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-muted-foreground">Title</label>
                      <Input
                        value={editDraft.title ?? ""}
                        onChange={(e) => setEditDraft({ ...editDraft, title: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground">Weightage (%)</label>
                      <Input
                        type="number"
                        min={10}
                        max={100}
                        value={editDraft.weightage ?? 0}
                        onChange={(e) =>
                          setEditDraft({ ...editDraft, weightage: Number(e.target.value) || 0 })
                        }
                      />
                    </div>
                    {goal.uom_type === "timeline" ? (
                      <div>
                        <label className="text-xs text-muted-foreground">Target date</label>
                        <Input
                          type="date"
                          value={editDraft.target_date ?? ""}
                          onChange={(e) =>
                            setEditDraft({ ...editDraft, target_date: e.target.value || null })
                          }
                        />
                      </div>
                    ) : (
                      <div>
                        <label className="text-xs text-muted-foreground">Target value</label>
                        <Input
                          type="number"
                          value={editDraft.target_value ?? ""}
                          onChange={(e) =>
                            setEditDraft({
                              ...editDraft,
                              target_value: e.target.value === "" ? null : Number(e.target.value),
                            })
                          }
                        />
                      </div>
                    )}
                    <div className="md:col-span-2">
                      <label className="text-xs text-muted-foreground">Description</label>
                      <Textarea
                        value={editDraft.description ?? ""}
                        onChange={(e) =>
                          setEditDraft({ ...editDraft, description: e.target.value })
                        }
                        className="min-h-[60px]"
                      />
                    </div>
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button size="sm" variant="ghost" onClick={cancelEdit} disabled={editSaving}>
                      <X className="w-3 h-3 mr-1" /> Cancel
                    </Button>
                    <Button size="sm" onClick={() => saveEdit(goal.id)} disabled={editSaving}>
                      {editSaving ? (
                        <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                      ) : (
                        <Save className="w-3 h-3 mr-1" />
                      )}
                      Save
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  {goal.description && <p className="text-sm text-muted-foreground">{goal.description}</p>}
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
                    <div><span className="text-muted-foreground">Area: </span>{goal.thrust_area}</div>
                    <div><span className="text-muted-foreground">UoM: </span>{uomLabel}</div>
                    <div><span className="text-muted-foreground">Target: </span>{goal.target_value ?? goal.target_date ?? "—"}</div>
                  </div>
                </>
              )}

              {/* Check-in data with comment */}
              {sheet.status === "approved" && (
                <>
                  <Separator className="bg-border/50" />
                  {goal.checkins && goal.checkins.length > 0 ? (
                    <div className="space-y-2">
                      {goal.checkins.map((ci) => (
                        <div key={ci.id} className="flex items-center justify-between p-2 rounded-lg bg-secondary/30 text-sm">
                          <div className="flex items-center gap-3 tabular-nums">
                            <Badge variant="outline">{ci.quarter}</Badge>
                            <span>Actual: {ci.actual_value ?? "—"}</span>
                            <span className={`font-semibold ${getScoreColor(ci.computed_score || 0)}`}>
                              {formatScore(ci.computed_score)}
                            </span>
                            {ci.manager_comment && (
                              <span className="text-xs text-muted-foreground italic truncate max-w-[200px]" title={ci.manager_comment}>
                                &ldquo;{ci.manager_comment}&rdquo;
                              </span>
                            )}
                          </div>
                          <Button size="sm" variant="ghost" onClick={() => { setCommentGoalId(ci.id); setComment(ci.manager_comment || ""); }}>
                            <MessageSquare className="w-3 h-3 mr-1" /> Comment
                          </Button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground py-1">
                      <Hourglass className="w-3 h-3" />
                      No check-ins yet. Comments will appear here once the employee submits one.
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        );
      })}

      {/* Approve Dialog */}
      <AlertDialog open={approveOpen} onOpenChange={setApproveOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Approve this goal sheet?</AlertDialogTitle>
            <AlertDialogDescription>
              This will lock the goal sheet. The employee will not be able to edit goals after approval.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleApprove} disabled={loading}>
              {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Approve
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Return Dialog */}
      <Dialog open={returnOpen} onOpenChange={setReturnOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Return goal sheet</DialogTitle>
            <DialogDescription>Provide a reason for returning the sheet.</DialogDescription>
          </DialogHeader>
          <Textarea value={returnReason} onChange={(e) => setReturnReason(e.target.value)}
            placeholder="Please specify what needs to be changed..." className="min-h-[100px]" />
          <DialogFooter>
            <Button variant="outline" onClick={() => setReturnOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleReturn} disabled={loading || !returnReason.trim()}>
              {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Return sheet
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Comment Dialog */}
      <Dialog open={!!commentGoalId} onOpenChange={() => setCommentGoalId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add manager comment</DialogTitle>
            <DialogDescription>Add feedback for this check-in.</DialogDescription>
          </DialogHeader>
          <Textarea value={comment} onChange={(e) => setComment(e.target.value)}
            placeholder="Your feedback..." />
          <DialogFooter>
            <Button variant="outline" onClick={() => setCommentGoalId(null)} disabled={commentSaving}>
              Cancel
            </Button>
            <Button
              onClick={() => commentGoalId && handleComment(commentGoalId)}
              disabled={commentSaving || !comment.trim()}
            >
              {commentSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" aria-hidden />}
              Save comment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
