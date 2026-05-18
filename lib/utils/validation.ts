import { z } from "zod";

// ===== Goal Form Schema =====
export const goalFormSchema = z.object({
  title: z
    .string()
    .min(3, "Goal title must be at least 3 characters")
    .max(200, "Goal title must be under 200 characters"),
  description: z.string().max(1000, "Description must be under 1000 characters").optional().default(""),
  thrust_area: z.string().min(1, "Please select a thrust area"),
  uom_type: z.enum([
    "numeric_min",
    "numeric_max",
    "percent_min",
    "percent_max",
    "timeline",
    "zero",
  ]),
  target_value: z.number().nullable(),
  target_date: z.string().nullable(),
  weightage: z
    .number()
    .min(10, "Minimum weightage is 10%")
    .max(100, "Maximum weightage is 100%"),
});

export type GoalFormValues = z.infer<typeof goalFormSchema>;

// ===== Goal Sheet Schema =====
export const goalSheetSchema = z
  .object({
    cycle_id: z.string().uuid("Please select a valid cycle"),
    goals: z
      .array(goalFormSchema)
      .min(1, "At least one goal is required")
      .max(8, "Maximum 8 goals allowed per sheet"),
  })
  .refine(
    (data) => {
      const totalWeightage = data.goals.reduce(
        (sum, goal) => sum + goal.weightage,
        0
      );
      return totalWeightage === 100;
    },
    {
      message: "Total weightage must equal exactly 100%",
      path: ["goals"],
    }
  );

export type GoalSheetFormValues = z.infer<typeof goalSheetSchema>;

// ===== Check-in Form Schema =====
export const checkinFormSchema = z.object({
  goal_id: z.string().uuid(),
  quarter: z.enum(["Q1", "Q2", "Q3", "Q4"]),
  actual_value: z.number().nullable(),
  actual_date: z.string().nullable(),
  status: z.enum(["not_started", "on_track", "completed"]),
  employee_notes: z.string().max(500, "Notes must be under 500 characters").optional().default(""),
});

export type CheckinFormValues = z.infer<typeof checkinFormSchema>;

// ===== Login Schema =====
export const loginSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

export type LoginFormValues = z.infer<typeof loginSchema>;

// ===== Cycle Schema =====
export const cycleFormSchema = z.object({
  name: z.string().min(3, "Cycle name must be at least 3 characters"),
  phase: z.string().min(1, "Please enter a phase"),
  start_date: z.string().min(1, "Start date is required"),
  end_date: z.string().min(1, "End date is required"),
  q1_start: z.string().optional(),
  q1_end: z.string().optional(),
  q2_start: z.string().optional(),
  q2_end: z.string().optional(),
  q3_start: z.string().optional(),
  q3_end: z.string().optional(),
  q4_start: z.string().optional(),
  q4_end: z.string().optional(),
});

export type CycleFormValues = z.infer<typeof cycleFormSchema>;

// ===== Validation Helpers =====

/**
 * Calculate total weightage from a list of goals.
 */
export function calculateTotalWeightage(
  goals: { weightage: number }[]
): number {
  return goals.reduce((sum, goal) => sum + goal.weightage, 0);
}

/**
 * Check if weightage is valid (equals 100%).
 */
export function isWeightageValid(goals: { weightage: number }[]): boolean {
  return calculateTotalWeightage(goals) === 100;
}

/**
 * Get remaining weightage to allocate.
 */
export function getRemainingWeightage(
  goals: { weightage: number }[]
): number {
  return 100 - calculateTotalWeightage(goals);
}

/**
 * Validate that a UoM type has the required target fields.
 */
export function validateTargetForUom(
  uomType: string,
  targetValue: number | null,
  targetDate: string | null
): string | null {
  if (uomType === "timeline") {
    if (!targetDate) return "Target date is required for timeline goals";
  } else {
    if (targetValue === null || targetValue === undefined)
      return "Target value is required";
  }
  return null;
}
