// ===== Enums =====

export type Role = "employee" | "manager" | "admin";

export type SheetStatus = "draft" | "submitted" | "approved" | "returned";

export type GoalStatus = "not_started" | "on_track" | "completed";

export type UomType =
  | "numeric_min"
  | "numeric_max"
  | "percent_min"
  | "percent_max"
  | "timeline"
  | "zero";

export type Quarter = "Q1" | "Q2" | "Q3" | "Q4";

// ===== Database Models =====

export interface Profile {
  id: string;
  name: string;
  email: string;
  role: Role;
  manager_id: string | null;
  department: string | null;
  created_at: string;
}

export interface GoalCycle {
  id: string;
  name: string;
  phase: string;
  start_date: string;
  end_date: string;
  is_active: boolean;
  created_by: string;
  q1_start?: string;
  q1_end?: string;
  q2_start?: string;
  q2_end?: string;
  q3_start?: string;
  q3_end?: string;
  q4_start?: string;
  q4_end?: string;
}

export interface GoalSheet {
  id: string;
  employee_id: string;
  cycle_id: string;
  status: SheetStatus;
  submitted_at: string | null;
  approved_at: string | null;
  approved_by: string | null;
  return_reason: string | null;
  created_at: string;
  updated_at: string;
  // Joined fields
  employee?: Profile;
  cycle?: GoalCycle;
  goals?: Goal[];
  approver?: Profile;
}

export interface Goal {
  id: string;
  sheet_id: string;
  title: string;
  description: string | null;
  thrust_area: string;
  uom_type: UomType;
  target_value: number | null;
  target_date: string | null;
  weightage: number;
  status: GoalStatus;
  is_shared: boolean;
  shared_from: string | null;
  created_at: string;
  updated_at: string;
  // Joined fields
  checkins?: QuarterlyCheckin[];
  sheet?: GoalSheet;
}

export interface QuarterlyCheckin {
  id: string;
  goal_id: string;
  quarter: Quarter;
  actual_value: number | null;
  actual_date: string | null;
  status: GoalStatus;
  employee_notes: string | null;
  manager_comment: string | null;
  manager_id: string | null;
  computed_score: number | null;
  checked_in_at: string;
  // Joined
  goal?: Goal;
  manager?: Profile;
}

export interface AuditLog {
  id: string;
  table_name: string;
  record_id: string;
  action: string;
  changed_by: string;
  old_values: Record<string, unknown> | null;
  new_values: Record<string, unknown> | null;
  created_at: string;
  // Joined
  changed_by_profile?: Profile;
}

export interface EscalationRule {
  id: string;
  rule_type: string;
  threshold_days: number;
  is_active: boolean;
}

// ===== Form Types =====

export interface GoalFormData {
  title: string;
  description: string;
  thrust_area: string;
  uom_type: UomType;
  target_value: number | null;
  target_date: string | null;
  weightage: number;
  // Optional fields for editing an existing draft. When a goal was pushed by
  // admin/manager as a Shared Goal (is_shared on the primary, or shared_from
  // set on a child), the recipient may only adjust `weightage` — title,
  // description, thrust area, UoM, and target are read-only per BRD §2.1.
  id?: string;
  is_shared?: boolean;
  shared_from?: string | null;
}

export interface GoalSheetFormData {
  cycle_id: string;
  goals: GoalFormData[];
}

export interface CheckinFormData {
  goal_id: string;
  quarter: Quarter;
  actual_value: number | null;
  actual_date: string | null;
  status: GoalStatus;
  employee_notes: string;
}

// ===== UI Types =====

export interface NavItem {
  title: string;
  href: string;
  icon: string;
  roles: Role[];
  badge?: string;
}

export interface StatusConfig {
  label: string;
  className: string;
  icon?: string;
}

// ===== UoM Type Descriptions =====

export const UOM_TYPE_OPTIONS: {
  value: UomType;
  label: string;
  description: string;
  example: string;
}[] = [
  {
    value: "numeric_min",
    label: "Numeric (higher is better)",
    description: "Achievement increases as actual value goes up",
    example: "e.g., revenue target ₹10Cr, actual ₹8Cr scores 80%",
  },
  {
    value: "numeric_max",
    label: "Numeric (lower is better)",
    description: "Achievement increases as actual value goes down",
    example: "e.g., defect rate target 5%, actual 4% scores 100% (capped)",
  },
  {
    value: "percent_min",
    label: "Percentage (higher is better)",
    description: "Percentage target where higher actual is better",
    example: "e.g., CSAT target 90%, actual 85% scores 94%",
  },
  {
    value: "percent_max",
    label: "Percentage (lower is better)",
    description: "Percentage target where lower actual is better",
    example: "e.g., attrition target 10%, actual 8% scores 100% (capped)",
  },
  {
    value: "timeline",
    label: "Timeline (date-based)",
    description: "Score 100% if completed on or before target date, else 0%",
    example: "e.g., deadline 31 Dec, completed 28 Dec scores 100%",
  },
  {
    value: "zero",
    label: "Zero tolerance",
    description: "Score 100% only if actual value is exactly 0",
    example: "e.g., safety incidents target 0, actual 0 scores 100%",
  },
];

export const THRUST_AREAS = [
  "Business Growth",
  "Customer Experience",
  "Operational Excellence",
  "People & Culture",
  "Innovation & Technology",
  "Quality & Compliance",
  "Cost Optimization",
  "Sustainability",
] as const;

export const STATUS_CONFIG: Record<SheetStatus, StatusConfig> = {
  draft: { label: "Draft", className: "status-draft" },
  submitted: { label: "Submitted", className: "status-submitted" },
  approved: { label: "Approved", className: "status-approved" },
  returned: { label: "Returned", className: "status-returned" },
};

export const GOAL_STATUS_CONFIG: Record<GoalStatus, StatusConfig> = {
  not_started: { label: "Not Started", className: "status-not_started" },
  on_track: { label: "On Track", className: "status-on_track" },
  completed: { label: "Completed", className: "status-completed" },
};
