import { NextResponse, type NextRequest } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { notifyOverdue } from "@/lib/email/resend";

/**
 * Escalation tick — evaluates each active rule in `escalation_rules` and emails
 * the appropriate recipient when a condition is met. Designed to be hit by a
 * cron (Vercel cron / GitHub Action / external scheduler) once daily.
 *
 * Auth: accepts EITHER
 *   - `Authorization: Bearer <CRON_SECRET>` header (for cron services), OR
 *   - an authenticated admin session (so admins can "Run now" from the UI).
 *
 * Rule types handled:
 *   - approval_pending     — sheets in `submitted` for ≥ thresholdDays
 *   - checkin_overdue      — approved sheets where the current quarter window
 *                            opened ≥ thresholdDays ago and no check-in exists
 *   - submission_reminder  — employees with no goal sheet in the active cycle
 *                            ≥ thresholdDays since cycle started
 */

interface Outcome {
  rule_type: string;
  threshold_days: number;
  matched: number;
  emailed: number;
}

export async function GET(request: NextRequest) {
  // --- Auth ---
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");
  const fromCron =
    !!cronSecret && authHeader === `Bearer ${cronSecret}`;

  if (!fromCron) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();
    if (profile?.role !== "admin") {
      return NextResponse.json({ error: "Admin only" }, { status: 403 });
    }
  }

  const service = await createServiceClient();

  const { data: rules } = await service
    .from("escalation_rules")
    .select("rule_type, threshold_days, is_active")
    .eq("is_active", true);

  const outcomes: Outcome[] = [];
  const now = new Date();

  for (const rule of rules ?? []) {
    const threshold = rule.threshold_days as number;
    const cutoff = new Date(now);
    cutoff.setDate(cutoff.getDate() - threshold);
    let matched = 0;
    let emailed = 0;

    if (rule.rule_type === "approval_pending") {
      // Sheets stuck in `submitted` past threshold — email the manager.
      const { data: sheets } = await service
        .from("goal_sheets")
        .select(
          "id, submitted_at, employee:profiles!goal_sheets_employee_id_fkey(name, manager_id)"
        )
        .eq("status", "submitted")
        .lt("submitted_at", cutoff.toISOString());

      for (const s of sheets ?? []) {
        matched++;
        const emp = (s as unknown as { employee?: { name: string; manager_id: string | null } })
          .employee;
        if (!emp?.manager_id) continue;
        const { data: mgr } = await service
          .from("profiles")
          .select("email")
          .eq("id", emp.manager_id)
          .single();
        if (!mgr?.email) continue;
        const res = await notifyOverdue(mgr.email, `Approval for ${emp.name}`);
        if (res.success) emailed++;
      }
    } else if (rule.rule_type === "checkin_overdue") {
      // Active cycle's current quarter window. If today >= window_start + threshold,
      // find approved sheets whose goals have no check-in for that quarter.
      const { data: cycles } = await service
        .from("goal_cycles")
        .select("id, q1_start, q1_end, q2_start, q2_end, q3_start, q3_end, q4_start, q4_end")
        .eq("is_active", true);

      const active = cycles?.[0];
      if (!active) {
        outcomes.push({ rule_type: rule.rule_type, threshold_days: threshold, matched, emailed });
        continue;
      }

      const quarters: Array<{ q: "Q1" | "Q2" | "Q3" | "Q4"; start?: string | null; end?: string | null }> = [
        { q: "Q1", start: active.q1_start, end: active.q1_end },
        { q: "Q2", start: active.q2_start, end: active.q2_end },
        { q: "Q3", start: active.q3_start, end: active.q3_end },
        { q: "Q4", start: active.q4_start, end: active.q4_end },
      ];
      const openQuarter = quarters.find((q) => {
        if (!q.start || !q.end) return false;
        const s = new Date(q.start);
        const e = new Date(q.end);
        e.setHours(23, 59, 59, 999);
        return now >= s && now <= e;
      });
      if (!openQuarter || !openQuarter.start) {
        outcomes.push({ rule_type: rule.rule_type, threshold_days: threshold, matched, emailed });
        continue;
      }
      const windowOpened = new Date(openQuarter.start);
      const overdueSince = new Date(windowOpened);
      overdueSince.setDate(overdueSince.getDate() + threshold);
      if (now < overdueSince) {
        outcomes.push({ rule_type: rule.rule_type, threshold_days: threshold, matched, emailed });
        continue;
      }

      const { data: approvedSheets } = await service
        .from("goal_sheets")
        .select("id, employee:profiles!goal_sheets_employee_id_fkey(name, email), goals(id, checkins:quarterly_checkins(quarter))")
        .eq("status", "approved")
        .eq("cycle_id", active.id);

      for (const sheet of approvedSheets ?? []) {
        const emp = (sheet as unknown as { employee?: { name: string; email: string } }).employee;
        if (!emp?.email) continue;
        const goals = (sheet as unknown as { goals?: Array<{ checkins?: Array<{ quarter: string }> }> }).goals ?? [];
        const missing = goals.some(
          (g) => !g.checkins?.some((c) => c.quarter === openQuarter.q)
        );
        if (!missing) continue;
        matched++;
        const res = await notifyOverdue(emp.email, `${openQuarter.q} check-in`);
        if (res.success) emailed++;
      }
    } else if (rule.rule_type === "submission_reminder") {
      // Employees who don't have a draft/submitted sheet in the active cycle
      // and the cycle started ≥ threshold days ago.
      const { data: cycles } = await service
        .from("goal_cycles")
        .select("id, start_date")
        .eq("is_active", true);
      const active = cycles?.[0];
      if (!active) {
        outcomes.push({ rule_type: rule.rule_type, threshold_days: threshold, matched, emailed });
        continue;
      }
      const cycleStart = new Date(active.start_date);
      cycleStart.setDate(cycleStart.getDate() + threshold);
      if (now < cycleStart) {
        outcomes.push({ rule_type: rule.rule_type, threshold_days: threshold, matched, emailed });
        continue;
      }

      const { data: employees } = await service
        .from("profiles")
        .select("id, email, name")
        .eq("role", "employee");

      const { data: sheets } = await service
        .from("goal_sheets")
        .select("employee_id")
        .eq("cycle_id", active.id);
      const hasSheet = new Set((sheets ?? []).map((s: { employee_id: string }) => s.employee_id));

      for (const emp of employees ?? []) {
        if (hasSheet.has(emp.id)) continue;
        if (!emp.email) continue;
        matched++;
        const res = await notifyOverdue(emp.email, "Goal submission");
        if (res.success) emailed++;
      }
    }

    outcomes.push({ rule_type: rule.rule_type, threshold_days: threshold, matched, emailed });

    // Audit a single row per tick so we can see escalation history in /admin/audit.
    if (matched > 0) {
      await service.from("audit_logs").insert({
        table_name: "escalation_rules",
        record_id: rule.rule_type,
        action: "escalation_fired",
        new_values: { matched, emailed, threshold_days: threshold },
      });
    }
  }

  return NextResponse.json({ ok: true, ranAt: now.toISOString(), outcomes });
}
