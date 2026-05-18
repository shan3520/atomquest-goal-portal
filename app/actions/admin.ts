"use server";

import { createClient, createServiceClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/app/actions/goals";

async function requireAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { supabase: null, user: null, ok: false as const, error: "Unauthorized" };
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (profile?.role !== "admin") {
    return { supabase: null, user: null, ok: false as const, error: "Admin access required" };
  }
  return { supabase, user, ok: true as const, error: null };
}

export async function createCycle(data: {
  name: string; phase: string; start_date: string; end_date: string;
  q1_start?: string; q1_end?: string; q2_start?: string; q2_end?: string;
  q3_start?: string; q3_end?: string; q4_start?: string; q4_end?: string;
}): Promise<ActionResult> {
  try {
    const auth = await requireAdmin();
    if (!auth.ok) return { error: auth.error };
    if (!data.name?.trim() || !data.start_date || !data.end_date) {
      return { error: "Name, start date, and end date are required" };
    }
    if (new Date(data.start_date) >= new Date(data.end_date)) {
      return { error: "End date must be after start date" };
    }

    // Clean optional empty-string dates -> null so DB accepts them
    const cleaned: Record<string, unknown> = { ...data, created_by: auth.user.id };
    for (const k of ["q1_start", "q1_end", "q2_start", "q2_end", "q3_start", "q3_end", "q4_start", "q4_end"]) {
      if (cleaned[k] === "") cleaned[k] = null;
    }

    const { error } = await auth.supabase.from("goal_cycles").insert(cleaned);
    if (error) return { error: error.message };
    revalidatePath("/admin/cycles");
    return { data: { success: true } };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "An unexpected error occurred" };
  }
}

export async function updateCycle(id: string, data: Record<string, unknown>): Promise<ActionResult> {
  try {
    const auth = await requireAdmin();
    if (!auth.ok) return { error: auth.error };
    const { error } = await auth.supabase.from("goal_cycles").update(data).eq("id", id);
    if (error) return { error: error.message };
    revalidatePath("/admin/cycles");
    return { data: { success: true } };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "An unexpected error occurred" };
  }
}

export async function updateUserRole(
  userId: string,
  role: string,
  managerId?: string | null
): Promise<ActionResult> {
  try {
    const auth = await requireAdmin();
    if (!auth.ok) return { error: auth.error };
    if (!["employee", "manager", "admin"].includes(role)) {
      return { error: "Invalid role" };
    }
    const updateData: Record<string, unknown> = { role };
    if (managerId !== undefined) updateData.manager_id = managerId;

    const { error } = await auth.supabase.from("profiles").update(updateData).eq("id", userId);
    if (error) return { error: error.message };

    await auth.supabase.from("audit_logs").insert({
      table_name: "profiles",
      record_id: userId,
      action: "role_updated",
      changed_by: auth.user.id,
      new_values: updateData,
    });

    revalidatePath("/admin/users");
    return { data: { success: true } };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "An unexpected error occurred" };
  }
}

export async function unlockGoal(goalId: string): Promise<ActionResult> {
  try {
    const auth = await requireAdmin();
    if (!auth.ok) return { error: auth.error };

    const { data: goal } = await auth.supabase
      .from("goals")
      .select("id, sheet_id, sheet:goal_sheets!inner(id, status)")
      .eq("id", goalId)
      .single();

    if (!goal) return { error: "Goal not found" };

    const sheet = goal.sheet as unknown as { id: string; status: string };
    const previousStatus = sheet.status;

    const { error } = await auth.supabase
      .from("goal_sheets")
      .update({ status: "draft", approved_at: null, approved_by: null })
      .eq("id", goal.sheet_id);

    if (error) return { error: error.message };

    await auth.supabase.from("audit_logs").insert({
      table_name: "goals",
      record_id: goalId,
      action: "unlocked",
      changed_by: auth.user.id,
      old_values: { sheet_status: previousStatus },
      new_values: { sheet_status: "draft" },
    });

    revalidatePath("/admin/goals/unlock");
    return { data: { success: true } };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "An unexpected error occurred" };
  }
}

export async function createSharedGoal(data: {
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
    const auth = await requireAdmin();
    if (!auth.ok) return { error: auth.error };
    if (!data.title?.trim() || !data.thrust_area || data.employee_ids.length === 0) {
      return { error: "Title, thrust area, and at least one employee are required" };
    }
    if (!data.cycle_id) return { error: "Cycle is required" };

    let pushed = 0;
    let skipped = 0;
    // Parent/child wiring: the first successful insert becomes the "primary"
    // (is_shared=true, shared_from=null). Every subsequent recipient gets a
    // child goal with shared_from = primary.id. The DB trigger
    // sync_shared_checkin then propagates the primary's check-ins to children.
    let primaryGoalId: string | null = null;

    for (const empId of data.employee_ids) {
      const { data: existingSheet } = await auth.supabase
        .from("goal_sheets")
        .select("id, status")
        .eq("employee_id", empId)
        .eq("cycle_id", data.cycle_id)
        .maybeSingle();

      let sheetId: string;
      if (existingSheet) {
        // Skip employees whose sheets are locked (submitted/approved)
        if (existingSheet.status !== "draft" && existingSheet.status !== "returned") {
          skipped++;
          continue;
        }
        sheetId = existingSheet.id;
      } else {
        const { data: newSheet, error: sheetErr } = await auth.supabase
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
      const insertRes: { data: { id: string } | null; error: unknown } = await auth.supabase
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
          is_shared: isPrimary, // only the primary holds the flag — trigger uses it as the propagation source
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

    await auth.supabase.from("audit_logs").insert({
      table_name: "goals",
      record_id: auth.user.id,
      action: "shared_goal_created",
      changed_by: auth.user.id,
      new_values: { title: data.title, pushed, skipped },
    });

    revalidatePath("/admin/shared-goals");
    return { data: { pushed, skipped } };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "An unexpected error occurred" };
  }
}

export async function updateEscalationRule(
  id: string,
  data: { threshold_days?: number; is_active?: boolean }
): Promise<ActionResult> {
  try {
    const auth = await requireAdmin();
    if (!auth.ok) return { error: auth.error };
    const { error } = await auth.supabase.from("escalation_rules").update(data).eq("id", id);
    if (error) return { error: error.message };
    revalidatePath("/admin/escalations");
    return { data: { success: true } };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "An unexpected error occurred" };
  }
}

export async function createUser(
  email: string,
  password: string,
  name: string,
  role: string,
  department: string,
  managerId?: string
): Promise<ActionResult<{ userId: string }>> {
  try {
    const auth = await requireAdmin();
    if (!auth.ok) return { error: auth.error };
    if (!email || !password || !name) return { error: "Email, password, and name are required" };
    if (!["employee", "manager", "admin"].includes(role)) return { error: "Invalid role" };

    const serviceClient = await createServiceClient();
    const { data: authData, error: authError } = await serviceClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { name, role },
    });
    if (authError) return { error: authError.message };
    if (!authData.user) return { error: "Failed to create user" };

    const { error: profileErr } = await serviceClient
      .from("profiles")
      .update({
        name,
        role,
        department,
        manager_id: managerId || null,
      })
      .eq("id", authData.user.id);
    if (profileErr) return { error: profileErr.message };

    revalidatePath("/admin/users");
    return { data: { userId: authData.user.id } };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "An unexpected error occurred" };
  }
}
