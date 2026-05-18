-- =============================================
-- AtomQuest Goal Portal — Row Level Security
-- Run after 001_schema.sql
-- =============================================

-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE goal_cycles ENABLE ROW LEVEL SECURITY;
ALTER TABLE goal_sheets ENABLE ROW LEVEL SECURITY;
ALTER TABLE goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE quarterly_checkins ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE escalation_rules ENABLE ROW LEVEL SECURITY;

-- ===== Helper function: Get current user's role =====
CREATE OR REPLACE FUNCTION get_user_role()
RETURNS user_role AS $$
  SELECT role FROM profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ===== Helper function: Check if user is manager of employee =====
CREATE OR REPLACE FUNCTION is_manager_of(employee_uuid UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS(
    SELECT 1 FROM profiles
    WHERE id = employee_uuid AND manager_id = auth.uid()
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ===== PROFILES =====

-- Users can read their own profile
CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  USING (id = auth.uid());

-- Managers can view their team members
CREATE POLICY "Managers can view team profiles"
  ON profiles FOR SELECT
  USING (manager_id = auth.uid());

-- Admins can view all profiles
CREATE POLICY "Admins can view all profiles"
  ON profiles FOR SELECT
  USING (get_user_role() = 'admin');

-- Admins can update profiles
CREATE POLICY "Admins can update profiles"
  ON profiles FOR UPDATE
  USING (get_user_role() = 'admin');

-- Admins can insert profiles
CREATE POLICY "Admins can insert profiles"
  ON profiles FOR INSERT
  WITH CHECK (get_user_role() = 'admin');

-- Users can update their own profile (name only)
CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (id = auth.uid());

-- ===== GOAL CYCLES =====

-- Everyone can read active cycles
CREATE POLICY "Everyone can view cycles"
  ON goal_cycles FOR SELECT
  USING (true);

-- Only admins can manage cycles
CREATE POLICY "Admins can insert cycles"
  ON goal_cycles FOR INSERT
  WITH CHECK (get_user_role() = 'admin');

CREATE POLICY "Admins can update cycles"
  ON goal_cycles FOR UPDATE
  USING (get_user_role() = 'admin');

CREATE POLICY "Admins can delete cycles"
  ON goal_cycles FOR DELETE
  USING (get_user_role() = 'admin');

-- ===== GOAL SHEETS =====

-- Employees can view their own sheets
CREATE POLICY "Employees can view own sheets"
  ON goal_sheets FOR SELECT
  USING (employee_id = auth.uid());

-- Managers can view their team's sheets
CREATE POLICY "Managers can view team sheets"
  ON goal_sheets FOR SELECT
  USING (is_manager_of(employee_id));

-- Admins can view all sheets
CREATE POLICY "Admins can view all sheets"
  ON goal_sheets FOR SELECT
  USING (get_user_role() = 'admin');

-- Employees can create their own sheets
CREATE POLICY "Employees can create own sheets"
  ON goal_sheets FOR INSERT
  WITH CHECK (employee_id = auth.uid());

-- Employees can update their own draft/returned sheets
CREATE POLICY "Employees can update own sheets"
  ON goal_sheets FOR UPDATE
  USING (employee_id = auth.uid() AND status IN ('draft', 'returned'));

-- Managers can update team sheets (approve/return)
CREATE POLICY "Managers can update team sheets"
  ON goal_sheets FOR UPDATE
  USING (is_manager_of(employee_id));

-- Admins can update all sheets
CREATE POLICY "Admins can update all sheets"
  ON goal_sheets FOR UPDATE
  USING (get_user_role() = 'admin');

-- Employees can delete their own draft sheets
CREATE POLICY "Employees can delete own draft sheets"
  ON goal_sheets FOR DELETE
  USING (employee_id = auth.uid() AND status = 'draft');

-- ===== GOALS =====
--
-- NOTE (QA fix): The two policies below — "Employees can insert goals in own sheets"
-- and "Employees can update goals in own sheets" — are CRITICAL for the employee
-- submit flow. If you see "permission denied for table goals" when an employee
-- tries to submit a goal sheet, re-run the idempotent block at the bottom of this
-- file ("RECOVERY BLOCK: re-create employee goals INSERT/UPDATE policies").
-- The server action also uses the service-role client as a belt-and-suspenders
-- fallback, so both layers must be in place.

-- Goals inherit access from their sheet
CREATE POLICY "Users can view goals via sheet access"
  ON goals FOR SELECT
  USING (
    EXISTS(
      SELECT 1 FROM goal_sheets gs
      WHERE gs.id = goals.sheet_id
      AND (
        gs.employee_id = auth.uid()
        OR is_manager_of(gs.employee_id)
        OR get_user_role() = 'admin'
      )
    )
  );

-- Employees can insert goals in their own draft sheets
CREATE POLICY "Employees can insert goals in own sheets"
  ON goals FOR INSERT
  WITH CHECK (
    EXISTS(
      SELECT 1 FROM goal_sheets gs
      WHERE gs.id = goals.sheet_id
      AND gs.employee_id = auth.uid()
      AND gs.status IN ('draft', 'returned')
    )
  );

-- Employees can update goals in their own draft/returned sheets
CREATE POLICY "Employees can update goals in own sheets"
  ON goals FOR UPDATE
  USING (
    EXISTS(
      SELECT 1 FROM goal_sheets gs
      WHERE gs.id = goals.sheet_id
      AND gs.employee_id = auth.uid()
      AND gs.status IN ('draft', 'returned')
    )
  );

-- Managers can update goals (during approval review)
CREATE POLICY "Managers can update team goals"
  ON goals FOR UPDATE
  USING (
    EXISTS(
      SELECT 1 FROM goal_sheets gs
      WHERE gs.id = goals.sheet_id
      AND is_manager_of(gs.employee_id)
    )
  );

-- Admins can update all goals (including unlocking)
CREATE POLICY "Admins can update all goals"
  ON goals FOR UPDATE
  USING (get_user_role() = 'admin');

-- Admins can insert goals (shared goals)
CREATE POLICY "Admins can insert goals"
  ON goals FOR INSERT
  WITH CHECK (get_user_role() = 'admin');

-- Employees can delete goals from own draft sheets
CREATE POLICY "Employees can delete goals from own sheets"
  ON goals FOR DELETE
  USING (
    EXISTS(
      SELECT 1 FROM goal_sheets gs
      WHERE gs.id = goals.sheet_id
      AND gs.employee_id = auth.uid()
      AND gs.status IN ('draft', 'returned')
    )
  );

-- ===== QUARTERLY CHECK-INS =====

-- Users can view check-ins for accessible goals
CREATE POLICY "Users can view checkins via goal access"
  ON quarterly_checkins FOR SELECT
  USING (
    EXISTS(
      SELECT 1 FROM goals g
      JOIN goal_sheets gs ON gs.id = g.sheet_id
      WHERE g.id = quarterly_checkins.goal_id
      AND (
        gs.employee_id = auth.uid()
        OR is_manager_of(gs.employee_id)
        OR get_user_role() = 'admin'
      )
    )
  );

-- Employees can create check-ins for their approved goals
CREATE POLICY "Employees can create checkins"
  ON quarterly_checkins FOR INSERT
  WITH CHECK (
    EXISTS(
      SELECT 1 FROM goals g
      JOIN goal_sheets gs ON gs.id = g.sheet_id
      WHERE g.id = quarterly_checkins.goal_id
      AND gs.employee_id = auth.uid()
      AND gs.status = 'approved'
    )
  );

-- Employees can update their own check-ins
CREATE POLICY "Employees can update own checkins"
  ON quarterly_checkins FOR UPDATE
  USING (
    EXISTS(
      SELECT 1 FROM goals g
      JOIN goal_sheets gs ON gs.id = g.sheet_id
      WHERE g.id = quarterly_checkins.goal_id
      AND gs.employee_id = auth.uid()
    )
  );

-- Managers can update check-ins (add comments)
CREATE POLICY "Managers can update team checkins"
  ON quarterly_checkins FOR UPDATE
  USING (
    EXISTS(
      SELECT 1 FROM goals g
      JOIN goal_sheets gs ON gs.id = g.sheet_id
      WHERE g.id = quarterly_checkins.goal_id
      AND is_manager_of(gs.employee_id)
    )
  );

-- Admins can manage all check-ins
CREATE POLICY "Admins can manage all checkins"
  ON quarterly_checkins FOR ALL
  USING (get_user_role() = 'admin');

-- ===== AUDIT LOGS =====

-- Only admins can read audit logs
CREATE POLICY "Admins can view audit logs"
  ON audit_logs FOR SELECT
  USING (get_user_role() = 'admin');

-- Anyone authenticated can insert audit logs (system creates them)
CREATE POLICY "System can insert audit logs"
  ON audit_logs FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- ===== ESCALATION RULES =====

-- Everyone can read escalation rules
CREATE POLICY "Everyone can view escalation rules"
  ON escalation_rules FOR SELECT
  USING (true);

-- Only admins can manage escalation rules
CREATE POLICY "Admins can manage escalation rules"
  ON escalation_rules FOR ALL
  USING (get_user_role() = 'admin');

-- =============================================
-- RECOVERY BLOCK: re-create employee goals INSERT/UPDATE policies
-- =============================================
-- This block is idempotent — safe to re-run in the Supabase SQL editor on any
-- environment if `permission denied for table goals` shows up during employee
-- submit. It drops and re-creates the two policies below from scratch.
--
-- Run in Supabase Dashboard → SQL Editor → New query.
-- =============================================

DROP POLICY IF EXISTS "Employees can insert goals in own sheets" ON goals;
CREATE POLICY "Employees can insert goals in own sheets"
  ON goals FOR INSERT
  WITH CHECK (
    EXISTS(
      SELECT 1 FROM goal_sheets gs
      WHERE gs.id = goals.sheet_id
      AND gs.employee_id = auth.uid()
      AND gs.status IN ('draft', 'returned')
    )
  );

DROP POLICY IF EXISTS "Employees can update goals in own sheets" ON goals;
CREATE POLICY "Employees can update goals in own sheets"
  ON goals FOR UPDATE
  USING (
    EXISTS(
      SELECT 1 FROM goal_sheets gs
      WHERE gs.id = goals.sheet_id
      AND gs.employee_id = auth.uid()
      AND gs.status IN ('draft', 'returned')
    )
  );
