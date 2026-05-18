"use client";

import { useState } from "react";
import { createSharedGoal } from "@/app/actions/admin";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Share2, Loader2 } from "lucide-react";
import { THRUST_AREAS, UOM_TYPE_OPTIONS } from "@/types";
import type { Profile, GoalCycle } from "@/types";

interface PushPayload {
  title: string;
  description: string;
  thrust_area: string;
  uom_type: string;
  target_value: number | null;
  target_date: string | null;
  employee_ids: string[];
  cycle_id: string;
}
type PushAction = (data: PushPayload) => Promise<{
  data?: { pushed: number; skipped: number };
  error?: string;
}>;

export default function SharedGoalsPage({
  employees, cycles, action, title, subtitle,
}: {
  employees: Profile[];
  cycles: GoalCycle[];
  // Optional overrides so the same UI works for /admin/shared-goals AND
  // /manager/shared-goals. Defaults reproduce the admin behaviour.
  action?: PushAction;
  title?: string;
  subtitle?: string;
}) {
  const pushAction: PushAction = action ?? createSharedGoal;
  const heading = title ?? "Shared Goals";
  const description = subtitle ?? "Create KPIs and push to multiple employees";
  const [loading, setLoading] = useState(false);
  const [selectedEmps, setSelectedEmps] = useState<string[]>([]);
  const [form, setForm] = useState({
    title: "", description: "", thrust_area: "",
    uom_type: "numeric_min", target_value: "" as string,
    target_date: "", cycle_id: cycles[0]?.id || "",
  });

  function toggleEmployee(id: string) {
    setSelectedEmps(prev =>
      prev.includes(id) ? prev.filter(e => e !== id) : [...prev, id]
    );
  }

  async function handleCreate() {
    if (!form.title || !form.thrust_area || selectedEmps.length === 0) {
      toast.error("Fill all fields and select employees");
      return;
    }
    setLoading(true);
    const result = await pushAction({
      title: form.title,
      description: form.description,
      thrust_area: form.thrust_area,
      uom_type: form.uom_type,
      target_value: form.target_value ? Number(form.target_value) : null,
      target_date: form.target_date || null,
      employee_ids: selectedEmps,
      cycle_id: form.cycle_id,
    });
    if (!result.data) {
      toast.error(result.error || "Failed to create shared goal");
    } else {
      const { pushed, skipped } = result.data;
      if (skipped > 0) {
        toast.success(`Shared goal pushed to ${pushed} employees (${skipped} skipped — sheets locked)`);
      } else {
        toast.success(`Shared goal pushed to ${pushed} employees`);
      }
      setForm({ title: "", description: "", thrust_area: "", uom_type: "numeric_min", target_value: "", target_date: "", cycle_id: cycles[0]?.id || "" });
      setSelectedEmps([]);
    }
    setLoading(false);
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold">{heading}</h1>
        <p className="text-muted-foreground mt-1">{description}</p>
      </div>

      <Card className="glass-card">
        <CardHeader><CardTitle className="text-base">Create Shared Goal</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Goal Cycle</Label>
            <Select value={form.cycle_id} onValueChange={(v) => setForm({...form, cycle_id: v ?? ""})}>
              <SelectTrigger>
                {/* Map id → name in the trigger so the user sees "FY 2025-26" instead of the UUID. */}
                <SelectValue placeholder="Select cycle">
                  {(value: unknown) => {
                    if (typeof value !== "string" || !value) return "Select cycle";
                    return cycles.find((c) => c.id === value)?.name ?? value;
                  }}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>{cycles.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-2"><Label>Goal Title</Label>
            <Input value={form.title} onChange={(e) => setForm({...form, title: e.target.value})}
              placeholder="e.g., Achieve 95% Customer Satisfaction" /></div>
          <div className="space-y-2"><Label>Description</Label>
            <Textarea value={form.description} onChange={(e) => setForm({...form, description: e.target.value})} /></div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2"><Label>Thrust Area</Label>
              <Select value={form.thrust_area} onValueChange={(v) => setForm({...form, thrust_area: v ?? ""})}>
                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>{THRUST_AREAS.map(a => <SelectItem key={a} value={a}>{a}</SelectItem>)}</SelectContent>
              </Select></div>
            <div className="space-y-2"><Label>UoM Type</Label>
              <Select value={form.uom_type} onValueChange={(v) => setForm({...form, uom_type: v ?? "numeric_min"})}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{UOM_TYPE_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
              </Select></div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2"><Label>Target Value</Label>
              <Input type="number" value={form.target_value} onChange={(e) => setForm({...form, target_value: e.target.value})} /></div>
            <div className="space-y-2"><Label>Target Date</Label>
              <Input type="date" value={form.target_date} onChange={(e) => setForm({...form, target_date: e.target.value})} /></div>
          </div>

          <div className="space-y-2">
            <Label>Select Employees</Label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-48 overflow-y-auto p-2 rounded-lg border border-border/50 bg-background/30">
              {employees.filter(e => e.role === "employee").length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6 col-span-full">
                  No employees available. Add users with the Employee role first.
                </p>
              ) : (
                employees.filter(e => e.role === "employee").map(emp => (
                  <label key={emp.id} className="flex items-center gap-2 p-2 rounded hover:bg-secondary/30 cursor-pointer text-sm">
                    <Checkbox checked={selectedEmps.includes(emp.id)} onCheckedChange={() => toggleEmployee(emp.id)} />
                    <span>{emp.name}</span>
                    <span className="text-xs text-muted-foreground">{emp.department}</span>
                  </label>
                ))
              )}
            </div>
            <p className="text-xs text-muted-foreground">{selectedEmps.length} selected</p>
          </div>

          <Button onClick={handleCreate} disabled={loading} className="w-full">
            {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Share2 className="w-4 h-4 mr-2" />}
            Push Shared Goal
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
