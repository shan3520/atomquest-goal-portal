"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { computeScore } from "@/lib/utils/score-calculator";
import type { UomType, Quarter, GoalStatus } from "@/types";
import type { ActionResult } from "@/app/actions/goals";

interface CheckinInput {
  goal_id: string;
  quarter: Quarter;
  actual_value: number | null;
  actual_date: string | null;
  status: GoalStatus;
  employee_notes: string;
}

export async function createOrUpdateCheckin(
  data: CheckinInput
): Promise<ActionResult<{ id: string; computed_score: number }>> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: "Unauthorized" };

    if (!["Q1", "Q2", "Q3", "Q4"].includes(data.quarter)) {
      return { error: "Invalid quarter" };
    }

    const { data: goal } = await supabase
      .from("goals")
      .select(
        "id, sheet_id, uom_type, target_value, target_date, sheet:goal_sheets!inner(employee_id, status, cycle:goal_cycles(q1_start, q1_end, q2_start, q2_end, q3_start, q3_end, q4_start, q4_end))"
      )
      .eq("id", data.goal_id)
      .single();

    if (!goal) return { error: "Goal not found" };

    const sheet = goal.sheet as unknown as {
      employee_id: string;
      status: string;
      cycle?: {
        q1_start?: string | null; q1_end?: string | null;
        q2_start?: string | null; q2_end?: string | null;
        q3_start?: string | null; q3_end?: string | null;
        q4_start?: string | null; q4_end?: string | null;
      };
    };
    if (sheet.employee_id !== user.id) return { error: "Unauthorized" };
    if (sheet.status !== "approved") {
      return { error: "Goal sheet must be approved before check-ins" };
    }

    // BRD §2.3: each quarter has a configured window on the goal cycle. Refuse
    // check-ins outside it. If the window dates are blank (legacy cycles),
    // we skip enforcement so the action stays usable.
    const windowKey = data.quarter.toLowerCase() as "q1" | "q2" | "q3" | "q4";
    const startStr = sheet.cycle?.[`${windowKey}_start` as const];
    const endStr = sheet.cycle?.[`${windowKey}_end` as const];
    if (startStr && endStr) {
      const now = new Date();
      const start = new Date(startStr);
      const end = new Date(endStr);
      end.setHours(23, 59, 59, 999); // include the full last day
      if (now < start || now > end) {
        const fmt = (d: Date) =>
          d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
        return {
          error: `${data.quarter} check-in window is ${fmt(start)} → ${fmt(end)}. It is currently closed.`,
        };
      }
    }

    const score = computeScore(
      goal.uom_type as UomType,
      goal.target_value as number | null,
      data.actual_value,
      goal.target_date as string | null,
      data.actual_date
    );

    const { data: checkin, error } = await supabase
      .from("quarterly_checkins")
      .upsert(
        {
          goal_id: data.goal_id,
          quarter: data.quarter,
          actual_value: data.actual_value,
          actual_date: data.actual_date,
          status: data.status,
          employee_notes: data.employee_notes,
          computed_score: score,
          checked_in_at: new Date().toISOString(),
        },
        { onConflict: "goal_id,quarter" }
      )
      .select("id")
      .single();

    if (error || !checkin) return { error: error?.message || "Failed to save check-in" };

    // Update goal status based on latest check-in
    await supabase
      .from("goals")
      .update({ status: data.status })
      .eq("id", data.goal_id);

    revalidatePath(`/goals/${goal.sheet_id}`);
    revalidatePath(`/goals/${goal.sheet_id}/checkin`);
    revalidatePath("/manager/checkins");
    return { data: { id: checkin.id, computed_score: score } };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "An unexpected error occurred" };
  }
}
