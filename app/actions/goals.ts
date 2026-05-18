"use server";

import { createClient, createServiceClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { notifySheetSubmitted } from "@/lib/email/resend";
import { teamsNotifySubmitted } from "@/lib/teams/webhook";
import type { GoalFormData } from "@/types";

/**
 * Writes to `goal_sheets` and `goals` use the service-role client because some
 * production projects ship with overly-strict RLS on those tables. Ownership
 * is always re-verified against the authenticated user above the write call,
 * so bypassing RLS here is safe.
 */

export type ActionResult<T = { success: true }> =
  | { data: T; error?: never }
  | { data?: never; error: string };

const MIN_WEIGHTAGE = 10;
const MAX_GOALS = 8;

function validateGoals(
  goals: GoalFormData[],
  { requireFullWeightage }: { requireFullWeightage: boolean }
): string | null {
  if (goals.length === 0) return "At least one goal is required";
  if (goals.length > MAX_GOALS) return `Maximum ${MAX_GOALS} goals allowed`;

  for (let i = 0; i < goals.length; i++) {
    const g = goals[i];
    if (!g.title?.trim()) return `Goal ${i + 1}: title is required`;
    if (!g.thrust_area?.trim()) return `Goal ${i + 1}: thrust area is required`;
    if (g.weightage < MIN_WEIGHTAGE)
      return `Goal ${i + 1}: minimum weightage is ${MIN_WEIGHTAGE}%`;
    if (g.weightage > 100)
      return `Goal ${i + 1}: weightage cannot exceed 100%`;
    if (g.uom_type === "timeline") {
      if (!g.target_date) return `Goal ${i + 1}: target date is required`;
    } else {
      if (g.target_value === null || g.target_value === undefined)
        return `Goal ${i + 1}: target value is required`;
    }
  }

  if (requireFullWeightage) {
    const total = goals.reduce((s, g) => s + g.weightage, 0);
    if (total !== 100) return `Total weightage must equal exactly 100% (currently ${total}%)`;
  }
  return null;
}

export async function createGoalSheet(
  cycleId: string,
  goals: GoalFormData[],
  submit: boolean = false
): Promise<ActionResult<{ id: string }>> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: "Unauthorized" };

    const validationError = validateGoals(goals, { requireFullWeightage: submit });
    if (validationError) return { error: validationError };

    const service = await createServiceClient();

    // Check for existing sheet in this cycle (service client so we always see it
    // even if SELECT RLS is misconfigured)
    const { data: existing, error: existingErr } = await service
      .from("goal_sheets")
      .select("id, status, employee_id")
      .eq("employee_id", user.id)
      .eq("cycle_id", cycleId)
      .maybeSingle();
    if (existingErr) {
      console.error("[createGoalSheet] read existing failed:", existingErr);
      return { error: existingErr.message };
    }

    let sheetId: string;
    let isUpdate = false;

    if (existing) {
      if (existing.employee_id !== user.id) return { error: "Unauthorized" };
      if (existing.status !== "draft" && existing.status !== "returned") {
        return { error: "A sheet already exists for this cycle and cannot be edited" };
      }
      sheetId = existing.id;
      isUpdate = true;
    } else {
      const { data: sheet, error: sheetError } = await service
        .from("goal_sheets")
        .insert({ employee_id: user.id, cycle_id: cycleId, status: "draft" })
        .select("id")
        .single();
      if (sheetError || !sheet) {
        console.error("[createGoalSheet] insert sheet failed:", sheetError);
        return { error: sheetError?.message || "Failed to create sheet" };
      }
      sheetId = sheet.id;
    }

    // Reconcile existing rows instead of delete-then-insert so we don't orphan
    // the shared_from parent/child link on Shared Goals (BRD §2.1).
    // - Goals with an `id` → UPDATE in place. If the row is shared, only
    //   weightage is allowed to change; title/target/etc are forced back to
    //   their DB values to defend against a tampered client payload.
    // - Goals without an `id` → INSERT as fresh non-shared rows.
    // - Existing DB rows the user has removed from the form → DELETE (but
    //   shared rows are never deletable from the UI, so this can't drop them).
    const formIds = new Set(goals.map((g) => g.id).filter((id): id is string => !!id));

    let existingRows: Array<{
      id: string;
      is_shared: boolean | null;
      shared_from: string | null;
      title: string;
      description: string | null;
      thrust_area: string;
      uom_type: string;
      target_value: number | null;
      target_date: string | null;
    }> = [];
    if (isUpdate) {
      const { data: rows, error: readErr } = await service
        .from("goals")
        .select("id, is_shared, shared_from, title, description, thrust_area, uom_type, target_value, target_date")
        .eq("sheet_id", sheetId);
      if (readErr) {
        console.error("[createGoalSheet] read existing goals failed:", readErr);
        return { error: readErr.message };
      }
      existingRows = rows ?? [];

      // Delete rows the form no longer references. Block deletion of shared
      // rows server-side; the UI also disables their delete button.
      const toDelete = existingRows.filter((r) => !formIds.has(r.id));
      const sharedDelete = toDelete.find((r) => r.is_shared || r.shared_from);
      if (sharedDelete) {
        return { error: "Shared goals cannot be removed" };
      }
      if (toDelete.length > 0) {
        const { error: delErr } = await service
          .from("goals")
          .delete()
          .in("id", toDelete.map((r) => r.id));
        if (delErr) {
          console.error("[createGoalSheet] delete removed goals failed:", delErr);
          return { error: delErr.message };
        }
      }
    }

    const existingById = new Map(existingRows.map((r) => [r.id, r]));

    // UPDATE pass for existing goals
    for (const g of goals) {
      if (!g.id) continue;
      const dbRow = existingById.get(g.id);
      if (!dbRow) continue; // id supplied but row not found — skip (stale)

      const locked = !!(dbRow.is_shared || dbRow.shared_from);
      const patch = locked
        ? { weightage: g.weightage } // shared: only weightage editable
        : {
            title: g.title,
            description: g.description,
            thrust_area: g.thrust_area,
            uom_type: g.uom_type,
            target_value: g.target_value,
            target_date: g.target_date,
            weightage: g.weightage,
          };
      const { error: updErr } = await service
        .from("goals")
        .update(patch)
        .eq("id", g.id);
      if (updErr) {
        console.error("[createGoalSheet] update goal failed:", updErr);
        return { error: updErr.message };
      }
    }

    // INSERT pass for new goals (always non-shared)
    const goalsToInsert = goals
      .filter((g) => !g.id)
      .map((g) => ({
        sheet_id: sheetId,
        title: g.title,
        description: g.description,
        thrust_area: g.thrust_area,
        uom_type: g.uom_type,
        target_value: g.target_value,
        target_date: g.target_date,
        weightage: g.weightage,
      }));
    if (goalsToInsert.length > 0) {
      const { error: goalsError } = await service.from("goals").insert(goalsToInsert);
      if (goalsError) {
        console.error("[createGoalSheet] insert goals failed:", goalsError);
        return { error: goalsError.message };
      }
    }

    // Status transition. The SECURITY DEFINER trigger validate_sheet_weightage
    // fires here on submit and verifies the goals sum to exactly 100.
    const newStatus = submit ? "submitted" : "draft";
    const updatePayload: Record<string, unknown> = { status: newStatus, return_reason: null };
    if (submit) updatePayload.submitted_at = new Date().toISOString();

    const { error: updErr } = await service
      .from("goal_sheets")
      .update(updatePayload)
      .eq("id", sheetId);
    if (updErr) {
      console.error("[createGoalSheet] update status failed:", {
        target: sheetId,
        newStatus,
        error: updErr,
      });
      // If we see the GRANT-level error, surface a more actionable message.
      if (updErr.message?.includes("permission denied")) {
        return {
          error:
            `${updErr.message}. ` +
            "Run the RECOVERY BLOCK in supabase/migrations/003_functions.sql " +
            "to re-grant privileges + mark validate_sheet_weightage as SECURITY DEFINER.",
        };
      }
      return { error: updErr.message };
    }

    // Notify manager on submit. Wrapped so a Resend outage never breaks the action.
    if (submit) {
      try {
        const { data: profile } = await supabase
          .from("profiles")
          .select("name, manager_id")
          .eq("id", user.id)
          .single();

        if (profile?.manager_id) {
          const { data: manager } = await supabase
            .from("profiles")
            .select("name, email")
            .eq("id", profile.manager_id)
            .single();

          if (manager?.email) {
            await notifySheetSubmitted(
              { id: user.id, name: profile.name, email: user.email ?? "" },
              { name: manager.name, email: manager.email },
              sheetId
            );
          }
          // Also fan out to Teams (no-op if TEAMS_WEBHOOK_URL is unset).
          if (profile?.name) {
            await teamsNotifySubmitted(
              { name: profile.name },
              { name: manager?.name ?? "Manager" },
              sheetId
            );
          }
        }
      } catch (notifyErr) {
        console.error("[Notify] sheet submitted fan-out failed:", notifyErr);
      }
    }

    revalidatePath("/dashboard");
    revalidatePath("/goals");
    revalidatePath(`/goals/${sheetId}`);
    return { data: { id: sheetId } };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "An unexpected error occurred" };
  }
}

export async function updateGoalSheet(
  sheetId: string,
  goals: GoalFormData[],
  submit: boolean = false
): Promise<ActionResult> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: "Unauthorized" };

    const service = await createServiceClient();

    const { data: sheet } = await service
      .from("goal_sheets")
      .select("id, status, employee_id")
      .eq("id", sheetId)
      .single();

    if (!sheet) return { error: "Sheet not found" };
    if (sheet.employee_id !== user.id) return { error: "Unauthorized" };
    if (sheet.status !== "draft" && sheet.status !== "returned") {
      return { error: "Sheet cannot be edited in its current status" };
    }

    const validationError = validateGoals(goals, { requireFullWeightage: submit });
    if (validationError) return { error: validationError };

    const { error: delErr } = await service.from("goals").delete().eq("sheet_id", sheetId);
    if (delErr) return { error: delErr.message };

    const goalsToInsert = goals.map((g) => ({
      sheet_id: sheetId,
      title: g.title,
      description: g.description,
      thrust_area: g.thrust_area,
      uom_type: g.uom_type,
      target_value: g.target_value,
      target_date: g.target_date,
      weightage: g.weightage,
    }));

    const { error: insErr } = await service.from("goals").insert(goalsToInsert);
    if (insErr) return { error: insErr.message };

    const newStatus = submit ? "submitted" : "draft";
    const updatePayload: Record<string, unknown> = { status: newStatus, return_reason: null };
    if (submit) updatePayload.submitted_at = new Date().toISOString();

    const { error: updErr } = await service
      .from("goal_sheets")
      .update(updatePayload)
      .eq("id", sheetId);
    if (updErr) return { error: updErr.message };

    revalidatePath(`/goals/${sheetId}`);
    revalidatePath("/dashboard");
    revalidatePath("/goals");
    return { data: { success: true } };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "An unexpected error occurred" };
  }
}

export async function submitGoalSheet(sheetId: string): Promise<ActionResult> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: "Unauthorized" };

    const service = await createServiceClient();

    const { data: sheet } = await service
      .from("goal_sheets")
      .select("id, status, employee_id, goals(weightage, title, thrust_area, uom_type, target_value, target_date)")
      .eq("id", sheetId)
      .single();

    if (!sheet) return { error: "Sheet not found" };
    if (sheet.employee_id !== user.id) return { error: "Unauthorized" };
    if (sheet.status !== "draft" && sheet.status !== "returned") {
      return { error: "Sheet is already submitted or approved" };
    }

    const goals = (sheet.goals || []) as GoalFormData[];
    const validationError = validateGoals(goals, { requireFullWeightage: true });
    if (validationError) return { error: validationError };

    const { error } = await service
      .from("goal_sheets")
      .update({
        status: "submitted",
        submitted_at: new Date().toISOString(),
        return_reason: null,
      })
      .eq("id", sheetId);

    if (error) return { error: error.message };

    revalidatePath("/dashboard");
    revalidatePath(`/goals/${sheetId}`);
    revalidatePath("/goals");
    return { data: { success: true } };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "An unexpected error occurred" };
  }
}

export async function deleteGoalSheet(sheetId: string): Promise<ActionResult> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: "Unauthorized" };

    const service = await createServiceClient();

    // Re-verify ownership + status before deleting with the service client
    const { data: existing } = await service
      .from("goal_sheets")
      .select("id, employee_id, status")
      .eq("id", sheetId)
      .single();
    if (!existing) return { error: "Sheet not found" };
    if (existing.employee_id !== user.id) return { error: "Unauthorized" };
    if (existing.status !== "draft") return { error: "Only draft sheets can be deleted" };

    const { error } = await service
      .from("goal_sheets")
      .delete()
      .eq("id", sheetId);

    if (error) return { error: error.message };

    revalidatePath("/dashboard");
    revalidatePath("/goals");
    return { data: { success: true } };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "An unexpected error occurred" };
  }
}
