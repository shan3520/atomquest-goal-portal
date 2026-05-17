"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { approveGoalSheet, returnGoalSheet, addManagerComment } from "@/app/actions/manager";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import { CheckCircle2, RotateCcw, Loader2, MessageSquare, FileEdit, Hourglass } from "lucide-react";
import { formatScore, getScoreColor } from "@/lib/utils/score-calculator";
import { UOM_TYPE_OPTIONS } from "@/types";
import type { GoalSheet } from "@/types";

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
    const result = await addManagerComment(checkinId, comment);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    toast.success("Comment added");
    setCommentGoalId(null);
    setComment("");
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
        <span className="text-sm text-muted-foreground">
          {sheet.goals?.length || 0} goals · Total weightage: {sheet.goals?.reduce((s, g) => s + g.weightage, 0)}%
        </span>
      </div>

      {/* Goals */}
      {sheet.goals?.map((goal, index) => {
        const uomLabel = UOM_TYPE_OPTIONS.find(o => o.value === goal.uom_type)?.label || goal.uom_type;
        return (
          <Card key={goal.id} className="glass-card">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs text-muted-foreground">#{index + 1}</span>
                    <Badge variant="outline">{goal.weightage}%</Badge>
                    <Badge className={goalStatusColors[goal.status]}>{goal.status.replace("_", " ")}</Badge>
                  </div>
                  <CardTitle className="text-base">{goal.title}</CardTitle>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {goal.description && <p className="text-sm text-muted-foreground">{goal.description}</p>}
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
                <div><span className="text-muted-foreground">Area: </span>{goal.thrust_area}</div>
                <div><span className="text-muted-foreground">UoM: </span>{uomLabel}</div>
                <div><span className="text-muted-foreground">Target: </span>{goal.target_value ?? goal.target_date ?? "—"}</div>
              </div>

              {/* Check-in data with comment */}
              {sheet.status === "approved" && (
                <>
                  <Separator className="bg-border/50" />
                  {goal.checkins && goal.checkins.length > 0 ? (
                    <div className="space-y-2">
                      {goal.checkins.map((ci) => (
                        <div key={ci.id} className="flex items-center justify-between p-2 rounded-lg bg-secondary/30 text-sm">
                          <div className="flex items-center gap-3">
                            <Badge variant="outline">{ci.quarter}</Badge>
                            <span>Actual: {ci.actual_value ?? "—"}</span>
                            <span className={`font-bold ${getScoreColor(ci.computed_score || 0)}`}>
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
                      No check-ins yet — comments will appear here once the employee submits one.
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
            <AlertDialogTitle>Approve Goal Sheet?</AlertDialogTitle>
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
            <DialogTitle>Return Goal Sheet</DialogTitle>
            <DialogDescription>Provide a reason for returning the sheet.</DialogDescription>
          </DialogHeader>
          <Textarea value={returnReason} onChange={(e) => setReturnReason(e.target.value)}
            placeholder="Please specify what needs to be changed..." className="min-h-[100px]" />
          <DialogFooter>
            <Button variant="outline" onClick={() => setReturnOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleReturn} disabled={loading || !returnReason.trim()}>
              {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Return Sheet
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Comment Dialog */}
      <Dialog open={!!commentGoalId} onOpenChange={() => setCommentGoalId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Manager Comment</DialogTitle>
            <DialogDescription>Add feedback for this check-in.</DialogDescription>
          </DialogHeader>
          <Textarea value={comment} onChange={(e) => setComment(e.target.value)}
            placeholder="Your feedback..." />
          <DialogFooter>
            <Button variant="outline" onClick={() => setCommentGoalId(null)}>Cancel</Button>
            <Button onClick={() => commentGoalId && handleComment(commentGoalId)}>Save Comment</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
