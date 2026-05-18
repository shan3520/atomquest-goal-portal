-- =============================================
-- AtomQuest Goal Portal — Database Schema
-- Run this in your Supabase SQL Editor
-- =============================================

-- ===== Custom Enum Types =====
CREATE TYPE user_role AS ENUM ('employee', 'manager', 'admin');
CREATE TYPE sheet_status AS ENUM ('draft', 'submitted', 'approved', 'returned');
CREATE TYPE goal_status AS ENUM ('not_started', 'on_track', 'completed');
CREATE TYPE uom_type AS ENUM ('numeric_min', 'numeric_max', 'percent_min', 'percent_max', 'timeline', 'zero');
CREATE TYPE quarter_type AS ENUM ('Q1', 'Q2', 'Q3', 'Q4');

-- ===== 1. Profiles =====
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  role user_role NOT NULL DEFAULT 'employee',
  manager_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  department TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_profiles_role ON profiles(role);
CREATE INDEX idx_profiles_manager ON profiles(manager_id);
CREATE INDEX idx_profiles_department ON profiles(department);

-- ===== 2. Goal Cycles =====
CREATE TABLE goal_cycles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  phase TEXT NOT NULL DEFAULT 'goal_setting',
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT false,
  created_by UUID REFERENCES profiles(id),
  q1_start DATE,
  q1_end DATE,
  q2_start DATE,
  q2_end DATE,
  q3_start DATE,
  q3_end DATE,
  q4_start DATE,
  q4_end DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_goal_cycles_active ON goal_cycles(is_active);

-- ===== 3. Goal Sheets =====
CREATE TABLE goal_sheets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  cycle_id UUID NOT NULL REFERENCES goal_cycles(id) ON DELETE CASCADE,
  status sheet_status NOT NULL DEFAULT 'draft',
  submitted_at TIMESTAMPTZ,
  approved_at TIMESTAMPTZ,
  approved_by UUID REFERENCES profiles(id),
  return_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(employee_id, cycle_id)
);

CREATE INDEX idx_goal_sheets_employee ON goal_sheets(employee_id);
CREATE INDEX idx_goal_sheets_cycle ON goal_sheets(cycle_id);
CREATE INDEX idx_goal_sheets_status ON goal_sheets(status);

-- ===== 4. Goals =====
CREATE TABLE goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sheet_id UUID NOT NULL REFERENCES goal_sheets(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  thrust_area TEXT NOT NULL,
  uom_type uom_type NOT NULL,
  target_value NUMERIC,
  target_date DATE,
  weightage NUMERIC NOT NULL CHECK (weightage >= 10 AND weightage <= 100),
  status goal_status NOT NULL DEFAULT 'not_started',
  is_shared BOOLEAN NOT NULL DEFAULT false,
  shared_from UUID REFERENCES goals(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_goals_sheet ON goals(sheet_id);
CREATE INDEX idx_goals_shared ON goals(shared_from) WHERE shared_from IS NOT NULL;
CREATE INDEX idx_goals_is_shared ON goals(is_shared) WHERE is_shared = true;

-- ===== 5. Quarterly Check-ins =====
CREATE TABLE quarterly_checkins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  goal_id UUID NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
  quarter quarter_type NOT NULL,
  actual_value NUMERIC,
  actual_date DATE,
  status goal_status NOT NULL DEFAULT 'not_started',
  employee_notes TEXT,
  manager_comment TEXT,
  manager_id UUID REFERENCES profiles(id),
  computed_score NUMERIC,
  checked_in_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(goal_id, quarter)
);

CREATE INDEX idx_checkins_goal ON quarterly_checkins(goal_id);
CREATE INDEX idx_checkins_quarter ON quarterly_checkins(quarter);

-- ===== 6. Audit Logs =====
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name TEXT NOT NULL,
  record_id UUID NOT NULL,
  action TEXT NOT NULL,
  changed_by UUID REFERENCES profiles(id),
  old_values JSONB,
  new_values JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_logs_table ON audit_logs(table_name);
CREATE INDEX idx_audit_logs_record ON audit_logs(record_id);
CREATE INDEX idx_audit_logs_changed_by ON audit_logs(changed_by);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at DESC);

-- ===== 7. Escalation Rules =====
CREATE TABLE escalation_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_type TEXT NOT NULL,
  threshold_days INTEGER NOT NULL DEFAULT 7,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ===== Trigger: Auto-update updated_at =====
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_goal_sheets_updated_at
  BEFORE UPDATE ON goal_sheets
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_goals_updated_at
  BEFORE UPDATE ON goals
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
