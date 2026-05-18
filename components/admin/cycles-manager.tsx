"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { format, parseISO, isValid } from "date-fns";
import { createCycle, updateCycle } from "@/app/actions/admin";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { Plus, Settings, Loader2, CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import type { GoalCycle } from "@/types";

// === DateField helper ===
// Local state stays as "yyyy-MM-dd" strings (DB format). The picker converts to/from Date
// and the trigger displays in "dd MMM yyyy" for the admin.

function isoToDate(iso: string): Date | undefined {
  if (!iso) return undefined;
  const d = parseISO(iso);
  return isValid(d) ? d : undefined;
}

function dateToIso(d: Date | undefined): string {
  return d ? format(d, "yyyy-MM-dd") : "";
}

function DateField({
  value,
  onChange,
  placeholder = "Pick a date",
  triggerClassName,
}: {
  value: string;
  onChange: (iso: string) => void;
  placeholder?: string;
  triggerClassName?: string;
}) {
  const selected = isoToDate(value);
  const display = selected ? format(selected, "dd MMM yyyy") : placeholder;

  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button
            type="button"
            variant="outline"
            // h-11 = 44px touch target. justify-between with a chevron-style
            // hint reads more like a real date picker than a free-floating button.
            className={cn(
              "w-full justify-start gap-2 font-normal h-11",
              !selected && "text-muted-foreground",
              triggerClassName
            )}
          >
            <CalendarIcon className="w-4 h-4 shrink-0" aria-hidden />
            {display}
          </Button>
        }
      />
      {/*
        align="start" so the popover hugs the left edge of the trigger; combined
        with the max-width clamp it can't overflow a 360px phone viewport.
      */}
      <PopoverContent
        align="start"
        className="w-auto p-0 max-w-[calc(100vw-2rem)]"
      >
        <Calendar
          mode="single"
          selected={selected}
          onSelect={(d) => onChange(dateToIso(d))}
          autoFocus
        />
      </PopoverContent>
    </Popover>
  );
}

// === Main component ===

export function CyclesManager({ initialCycles }: { initialCycles: GoalCycle[] }) {
  const router = useRouter();
  const [cycles] = useState(initialCycles);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [confirmDeactivate, setConfirmDeactivate] = useState<GoalCycle | null>(null);
  const [form, setForm] = useState({
    name: "", phase: "goal_setting", start_date: "", end_date: "",
    q1_start: "", q1_end: "", q2_start: "", q2_end: "",
    q3_start: "", q3_end: "", q4_start: "", q4_end: "",
  });

  async function handleCreate() {
    setLoading(true);
    const result = await createCycle(form);
    if (result.error) {
      toast.error(result.error);
      setLoading(false);
      return;
    }
    toast.success("Cycle created!");
    setDialogOpen(false);
    setLoading(false);
    router.refresh();
  }

  async function toggleActive(cycle: GoalCycle) {
    if (cycle.is_active) {
      setConfirmDeactivate(cycle);
      return;
    }
    await performToggle(cycle, false);
  }

  async function performToggle(cycle: GoalCycle, currentlyActive: boolean) {
    setTogglingId(cycle.id);
    const result = await updateCycle(cycle.id, { is_active: !currentlyActive });
    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success(currentlyActive ? "Cycle deactivated" : "Cycle activated");
      router.refresh();
    }
    setTogglingId(null);
    setConfirmDeactivate(null);
  }

  // Format helper for displaying dates on the cycle cards
  function fmt(iso?: string): string {
    if (!iso) return "—";
    const d = parseISO(iso);
    return isValid(d) ? format(d, "dd MMM yyyy") : iso;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Goal cycles</h1>
          <p className="text-muted-foreground mt-1">Manage annual goal cycles and quarter windows</p>
        </div>
        <Button onClick={() => setDialogOpen(true)}><Plus className="w-4 h-4 mr-2" />New cycle</Button>
      </div>

      <div className="grid gap-4">
        {cycles.length === 0 && (
          <Card className="glass-card border-dashed">
            <CardContent className="py-12 text-center">
              <Settings className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
              <p className="font-medium">No goal cycles yet</p>
              <p className="text-sm text-muted-foreground mt-1">
                Create a cycle so employees can start setting goals.
              </p>
              <Button className="mt-4" onClick={() => setDialogOpen(true)}>
                <Plus className="w-4 h-4 mr-2" />Create First Cycle
              </Button>
            </CardContent>
          </Card>
        )}
        {cycles.map((cycle) => (
          <Card key={cycle.id} className="glass-card">
            <CardContent className="py-5">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <h3 className="font-semibold">{cycle.name}</h3>
                  {cycle.is_active && <Badge className="status-approved">Active</Badge>}
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => toggleActive(cycle)}
                  disabled={togglingId === cycle.id}
                >
                  {togglingId === cycle.id && <Loader2 className="w-3 h-3 mr-1 animate-spin" />}
                  {cycle.is_active ? "Deactivate" : "Activate"}
                </Button>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                <div><span className="text-muted-foreground">Start: </span>{fmt(cycle.start_date)}</div>
                <div><span className="text-muted-foreground">End: </span>{fmt(cycle.end_date)}</div>
                <div><span className="text-muted-foreground">Phase: </span>{cycle.phase}</div>
              </div>
              {cycle.q1_start && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-3 text-xs text-muted-foreground">
                  <div>Q1: {fmt(cycle.q1_start)} → {fmt(cycle.q1_end)}</div>
                  <div>Q2: {fmt(cycle.q2_start)} → {fmt(cycle.q2_end)}</div>
                  <div>Q3: {fmt(cycle.q3_start)} → {fmt(cycle.q3_end)}</div>
                  <div>Q4: {fmt(cycle.q4_start)} → {fmt(cycle.q4_end)}</div>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Create Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Create goal cycle</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Cycle name</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g., FY 2025-26" />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Start date</Label>
                <DateField
                  value={form.start_date}
                  onChange={(iso) => setForm({ ...form, start_date: iso })}
                />
              </div>
              <div className="space-y-2">
                <Label>End date</Label>
                <DateField
                  value={form.end_date}
                  onChange={(iso) => setForm({ ...form, end_date: iso })}
                />
              </div>
            </div>

            <p className="text-xs font-medium text-muted-foreground tracking-wider uppercase pt-2">Quarter windows</p>
            {(["q1", "q2", "q3", "q4"] as const).map((q) => (
              <div key={q} className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label className="text-xs">{q.toUpperCase()} Start</Label>
                  <DateField
                    value={form[`${q}_start`]}
                    onChange={(iso) => setForm({ ...form, [`${q}_start`]: iso })}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">{q.toUpperCase()} End</Label>
                  <DateField
                    value={form[`${q}_end`]}
                    onChange={(iso) => setForm({ ...form, [`${q}_end`]: iso })}
                  />
                </div>
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={loading}>
              {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Deactivate Confirm */}
      <AlertDialog open={!!confirmDeactivate} onOpenChange={(o) => !o && setConfirmDeactivate(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Deactivate {confirmDeactivate?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              Employees in this cycle will no longer be able to submit new goal sheets or
              check-ins. Existing data is preserved. You can reactivate it anytime.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => confirmDeactivate && performToggle(confirmDeactivate, true)}
              disabled={!!togglingId}
            >
              {togglingId && <Loader2 className="w-3 h-3 mr-1 animate-spin" />}
              Deactivate
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
