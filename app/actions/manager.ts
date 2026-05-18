"use server";

import { createClient, createServiceClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { notifySheetApproved, notifySheetReturned } from "@/lib/email/resend";
import type { ActionResult } from "@/app/actions/goals";

async function getCurrentUserRole() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, role: null as null };
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  return { supabase, user, role: (profile?.role as string) || null };
}

export async function approveGoalSheet(sheetId: string): Promise<ActionResult> {
  try {
    const { supabase, user, role } = await getCurrentUserRole();
    if (!user) return { error: "Unauthorized" };
    if (role !== "manager" && role !== "admin") {
      return { error: "Only managers and admins can approve sheets" };
    }

    const { data: sheet } = await supabase
      .from("goal_sheets")
      .select("id, employee_id, status, employee:profiles!goal_sheets_employee_id_fkey(name, email)")
      .eq("id", sheetId)
      .single();
    if (!sheet) return { error: "Sheet not found" };
    if (sheet.status !== "submitted") {
      return { error: "Only submitted sheets can be approved" };
    }

    const { error } = await supabase
      .from("goal_sheets")
      .update({
        status: "approved",
        approved_at: new Date().toISOString(),
        approved_by: user.id,
      })
      .eq("id", sheetId);
    if (error) return { error: error.message };

    await supabase.from("audit_logs").insert({
      table_name: "goal_sheets",
      record_id: sheetId,
      action: "approved",
      changed_by: user.id,
      new_values: { status: "approved" },
    });

    // Notify employee. Wrapped so a Resend outage never breaks approval.
    try {
      const employee = sheet.employee as unknown as { name: string; email: string } | null;
      if (employee?.email) {
        await notifySheetApproved(
          { name: employee.name, email: employee.email },
          sheet.id
        );
      }
    } catch (emailErr) {
      console.error("[Email] notifySheetApproved failed:", emailErr);
    }

    revalidatePath("/manager/dashboard");
    revalidatePath("/manager/checkins");
    revalidatePath(`/manager/team/${sheet.employee_id}/goals`);
    return { data: { success: true } };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "An unexpected error occurred" };
  }
}

export async function returnGoalSheet(sheetId: string, reason: string): Promise<ActionResult> {
  try {
    const { supabase, user, role } = await getCurrentUserRole();
    if (!user) return { error: "Unauthorized" };
    if (role !== "manager" && role !== "admin") {
      return { error: "Only managers and admins can return sheets" };
    }
    if (!reason.trim()) return { error: "Return reason is required" };

    const trimmedReason = reason.trim();

    const { data: sheet } = await supabase
      .from("goal_sheets")
      .select("id, employee_id, status, employee:profiles!goal_sheets_employee_id_fkey(name, email)")
      .eq("id", sheetId)
      .single();
    if (!sheet) return { error: "Sheet not found" };
    if (sheet.status !== "submitted") {
      return { error: "Only submitted sheets can be returned" };
    }

    const { error } = await supabase
      .from("goal_sheets")
      .update({ status: "returned", return_reason: trimmedReason })
      .eq("id", sheetId);
    if (error) return { error: error.message };

    await supabase.from("audit_logs").insert({
      table_name: "goal_sheets",
      record_id: sheetId,
      action: "returned",
      changed_by: user.id,
      new_values: { status: "returned", return_reason: trimmedReason },
    });

    // Notify employee. Wrapped so a Resend outage never breaks the return action.
    try {
      const employee = sheet.employee as unknown as { name: string; email: string } | null;
      if (employee?.email) {
        await notifySheetReturned(
          { name: employee.name, email: employee.email },
          trimmedReason,
          sheet.id
        );
      }
    } catch (emailErr) {
      console.error("[Email] notifySheetReturned failed:", emailErr);
    }

    revalidatePath("/manager/dashboard");
    revalidatePath(`/manager/team/${sheet.employee_id}/goals`);
    return { data: { success: true } };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "An unexpected error occurred" };
  }
}

/**
 * Manager inline-edit of a goal during approval.
 *
 * Per the BRD §2.1: "Review submitted goals; ability to edit targets / weightages
 * inline or return for rework." Only allowed while the sheet is in `submitted`
 * status (i.e. the manager is actively reviewing). The DB trigger
 * `validate_sheet_weightage` will reject the eventual approval if the manager's
 * edits leave the sheet outside 100%, so we don't re-validate the sum here.
 */
export async function managerUpdateGoal(
  goalId: string,
  updates: {
    title?: string;
    description?: string | null;
    thrust_area?: string;
    uom_type?: string;
    target_value?: number | null;
    target_date?: string | null;
    weightage?: number;
  }
): Promise<ActionResult> {
  try {
    const { supabase, user, role } = await getCurrentUserRole();
    if (!user) return { error: "Unauthorized" };
    if (role !== "manager" && role !== "admin") {
      return { error: "Only managers and admins can edit goals during approval" };
    }

    // Look up the goal + its sheet + the sheet's owner so we can verify the
    // manager has authority over this employee AND the sheet is reviewable.
    const { data: goal } = await supabase
      .from("goals")
      .select(
        "id, sheet_id, weightage, sheet:goal_sheets!inner(id, employee_id, status, employee:profiles!goal_sheets_employee_id_fkey(manager_id))"
      )
      .eq("id", goalId)
      .single();
    if (!goal) return { error: "Goal not found" };

    const sheet = (goal as unknown as {
      sheet?: {
        id: string;
        employee_id: string;
        status: string;
        employee?: { manager_id: string | null };
      };
    }).sheet;
    if (!sheet) return { error: "Sheet not found" };
    if (sheet.status !== "submitted") {
      return { error: "Inline edit only allowed while the sheet is under review (submitted)" };
    }
    if (role === "manager" && sheet.employee?.manager_id !== user.id) {
      return { error: "You can only edit goals for your direct reports" };
    }

    if (updates.weightage !== undefined) {
      if (updates.weightage < 10) return { error: "Minimum weightage is 10%" };
      if (updates.weightage > 100) return { error: "Weightage cannot exceed 100%" };
    }
    if (updates.title !== undefined && !updates.title.trim()) {
      return { error: "Title cannot be empty" };
    }

    // Service client to bypass RLS — ownership and status already verified.
    const service = await createServiceClient();
    const patch: Record<string, unknown> = {};
    if (updates.title !== undefined) patch.title = updates.title;
    if (updates.description !== undefined) patch.description = updates.description;
    if (updates.thrust_area !== undefined) patch.thrust_area = updates.thrust_area;
    if (updates.uom_type !== undefined) patch.uom_type = updates.uom_type;
    if (updates.target_value !== undefined) patch.target_value = updates.target_value;
    if (updates.target_date !== undefined) patch.target_date = updates.target_date;
    if (updates.weightage !== undefined) patch.weightage = updates.weightage;

    const { error: updErr } = await service
      .from("goals")
      .update(patch)
      .eq("id", goalId);
    if (updErr) return { error: updErr.message };

    await supabase.from("audit_logs").insert({
      table_name: "goals",
      record_id: goalId,
      action: "manager_edit",
      changed_by: user.id,
      new_values: patch,
    });

    revalidatePath(`/manager/team/${sheet.employee_id}/goals`);
    revalidatePath("/manager/dashboard");
    return { data: { success: true } };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "An unexpected error occurred" };
  }
}

/**
 * Manager-side Shared Goals push (BRD §2.1 — "Admin or manager can push a
 * departmental KPI to multiple employees"). Mirrors admin.createSharedGoal
 * but restricts recipients to the manager's direct reports.
 */
export async function createManagerSharedGoal(data: {
  title: string;
  description: string;
  thrust_area: string;
  uom_type: string;
  target_value: number | null;
  target_date: string | null;
  employee_ids: string[];
  cycle_id: string;
}): Promise<ActionResult<{ pushed: number; skipped: number }>> {
  try {
    const { supabase, user, role } = await getCurrentUserRole();
    if (!user) return { error: "Unauthorized" };
    if (role !== "manager") return { error: "Manager access required" };
    if (!data.title?.trim() || !data.thrust_area || data.employee_ids.length === 0) {
      return { error: "Title, thrust area, and at least one employee are required" };
    }
    if (!data.cycle_id) return { error: "Cycle is required" };

    // Enforce team scope: only direct reports may receive a manager's shared goal.
    const { data: team } = await supabase
      .from("profiles")
      .select("id")
      .eq("manager_id", user.id);
    const teamIds = new Set((team ?? []).map((t: { id: string }) => t.id));
    const targetIds = data.employee_ids.filter((id) => teamIds.has(id));
    if (targetIds.length === 0) {
      return { error: "Selected employees are not in your team" };
    }

    const service = await createServiceClient();
    let pushed = 0;
    let skipped = 0;
    // Same parent/child wiring as admin.createSharedGoal: first successful
    // insert is the primary (is_shared=true), the rest carry shared_from=<primary>.
    let primaryGoalId: string | null = null;

    for (const empId of targetIds) {
      const { data: existingSheet } = await service
        .from("goal_sheets")
        .select("id, status")
        .eq("employee_id", empId)
        .eq("cycle_id", data.cycle_id)
        .maybeSingle();

      let sheetId: string;
      if (existingSheet) {
        if (existingSheet.status !== "draft" && existingSheet.status !== "returned") {
          skipped++;
          continue;
        }
        sheetId = existingSheet.id;
      } else {
        const { data: newSheet, error: sheetErr } = await service
          .from("goal_sheets")
          .insert({ employee_id: empId, cycle_id: data.cycle_id, status: "draft" })
          .select("id")
          .single();
        if (sheetErr || !newSheet) {
          skipped++;
          continue;
        }
        sheetId = newSheet.id;
      }

      const isPrimary: boolean = primaryGoalId === null;
      const insertRes: { data: { id: string } | null; error: unknown } = await service
        .from("goals")
        .insert({
          sheet_id: sheetId,
          title: data.title,
          description: data.description,
          thrust_area: data.thrust_area,
          uom_type: data.uom_type,
          target_value: data.target_value,
          target_date: data.target_date,
          weightage: 10,
          is_shared: isPrimary,
          shared_from: isPrimary ? null : primaryGoalId,
        })
        .select("id")
        .single();
      if (insertRes.error || !insertRes.data) {
        skipped++;
        continue;
      }
      if (isPrimary) primaryGoalId = insertRes.data.id;
      pushed++;
    }

    await supabase.from("audit_logs").insert({
      table_name: "goals",
      record_id: user.id,
      action: "shared_goal_created",
      changed_by: user.id,
      new_values: { title: data.title, pushed, skipped, scope: "manager_team" },
    });

    revalidatePath("/manager/dashboard");
    revalidatePath("/manager/shared-goals");
    return { data: { pushed, skipped } };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "An unexpected error occurred" };
  }
}

export async function addManagerComment(checkinId: string, comment: string): Promise<ActionResult> {
  try {
    const { supabase, user, role } = await getCurrentUserRole();
    if (!user) return { error: "Unauthorized" };
    if (role !== "manager" && role !== "admin") {
      return { error: "Only managers and admins can comment" };
    }

    const { error } = await supabase
      .from("quarterly_checkins")
      .update({ manager_comment: comment, manager_id: user.id })
      .eq("id", checkinId);

    if (error) return { error: error.message };

    revalidatePath("/manager/dashboard");
    revalidatePath("/manager/checkins");
    return { data: { success: true } };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "An unexpected error occurred" };
  }
}
