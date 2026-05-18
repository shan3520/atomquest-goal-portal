"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { updateEscalationRule } from "@/app/actions/admin";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Bell, Save, Loader2, Zap } from "lucide-react";
import type { EscalationRule } from "@/types";

export default function EscalationsPage({ rules }: { rules: EscalationRule[] }) {
  const router = useRouter();
  const [localRules, setLocalRules] = useState(rules);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [running, setRunning] = useState(false);

  async function runNow() {
    setRunning(true);
    try {
      const res = await fetch("/api/cron/escalations");
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error || "Failed to run escalations");
        return;
      }
      const totals = (json.outcomes ?? []).reduce(
        (acc: { matched: number; emailed: number }, o: { matched: number; emailed: number }) => ({
          matched: acc.matched + o.matched,
          emailed: acc.emailed + o.emailed,
        }),
        { matched: 0, emailed: 0 }
      );
      toast.success(
        totals.matched === 0
          ? "Escalation tick complete — no overdue items found"
          : `Escalation tick: ${totals.matched} matched, ${totals.emailed} emailed`
      );
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to run escalations");
    } finally {
      setRunning(false);
    }
  }

  async function handleUpdate(id: string, data: { threshold_days?: number; is_active?: boolean }) {
    setSavingId(id);
    const result = await updateEscalationRule(id, data);
    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success("Rule updated");
      router.refresh();
    }
    setSavingId(null);
  }

  const ruleLabels: Record<string, { label: string; desc: string }> = {
    checkin_overdue: { label: "Check-in Overdue", desc: "Days after quarter window opens before escalation" },
    approval_pending: { label: "Approval Pending", desc: "Days after submission before escalating to admin" },
    submission_reminder: { label: "Submission Reminder", desc: "Days before deadline to send reminder" },
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Escalation Rules</h1>
          <p className="text-muted-foreground mt-1">Configure automated escalation thresholds</p>
        </div>
        <Button onClick={runNow} disabled={running} variant="outline">
          {running ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <Zap className="w-4 h-4 mr-2" />
          )}
          Run now
        </Button>
      </div>

      <div className="grid gap-4">
        {localRules.map((rule) => {
          const info = ruleLabels[rule.rule_type] || { label: rule.rule_type, desc: "" };
          return (
            <Card key={rule.id} className="glass-card">
              <CardContent className="py-5">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center mt-1">
                      <Bell className="w-5 h-5 text-amber-400" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold">{info.label}</h3>
                        <Badge className={rule.is_active ? "status-approved" : "status-draft"}>
                          {rule.is_active ? "Active" : "Inactive"}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">{info.desc}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2">
                      <Label className="text-xs whitespace-nowrap">Days:</Label>
                      <Input
                        type="number"
                        className="w-20 h-8 text-sm bg-background/50"
                        value={rule.threshold_days}
                        onChange={(e) => {
                          setLocalRules(prev => prev.map(r =>
                            r.id === rule.id ? {...r, threshold_days: Number(e.target.value)} : r
                          ));
                        }}
                      />
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleUpdate(rule.id, { is_active: !rule.is_active })}
                      disabled={savingId === rule.id}
                    >
                      {rule.is_active ? "Disable" : "Enable"}
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => handleUpdate(rule.id, { threshold_days: rule.threshold_days })}
                      disabled={savingId === rule.id}
                    >
                      {savingId === rule.id
                        ? <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                        : <Save className="w-3 h-3 mr-1" />}
                      Save
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
        {localRules.length === 0 && (
          <Card className="glass-card border-dashed">
            <CardContent className="py-12 text-center text-muted-foreground">
              No escalation rules configured.
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
