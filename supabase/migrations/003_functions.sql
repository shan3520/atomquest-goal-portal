-- =============================================
-- AtomQuest Goal Portal — Functions & Triggers
-- Run after 002_rls_policies.sql
-- =============================================

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, name, email, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    NEW.email,
    COALESCE((NEW.raw_user_meta_data->>'role')::user_role, 'employee')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Score computation
CREATE OR REPLACE FUNCTION compute_checkin_score(
  p_uom uom_type, p_target NUMERIC, p_actual NUMERIC,
  p_target_date DATE, p_actual_date DATE
) RETURNS NUMERIC AS $$
DECLARE score NUMERIC := 0;
BEGIN
  CASE p_uom
    WHEN 'numeric_min','percent_min' THEN
      IF p_target > 0 AND p_actual IS NOT NULL THEN score := (p_actual/p_target)*100; END IF;
    WHEN 'numeric_max','percent_max' THEN
      IF p_actual > 0 AND p_target IS NOT NULL THEN score := (p_target/p_actual)*100; END IF;
    WHEN 'timeline' THEN
      IF p_target_date IS NOT NULL AND p_actual_date IS NOT NULL THEN
        score := CASE WHEN p_actual_date <= p_target_date THEN 100 ELSE 0 END;
      END IF;
    WHEN 'zero' THEN
      IF p_actual IS NOT NULL THEN score := CASE WHEN p_actual=0 THEN 100 ELSE 0 END; END IF;
  END CASE;
  RETURN LEAST(ROUND(score,2), 100);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Auto-compute score trigger
CREATE OR REPLACE FUNCTION auto_compute_checkin_score()
RETURNS TRIGGER AS $$
DECLARE v_uom uom_type; v_target NUMERIC; v_tdate DATE;
BEGIN
  SELECT uom_type, target_value, target_date INTO v_uom, v_target, v_tdate
  FROM goals WHERE id = NEW.goal_id;
  NEW.computed_score := compute_checkin_score(v_uom, v_target, NEW.actual_value, v_tdate, NEW.actual_date);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER auto_score_checkin BEFORE INSERT OR UPDATE ON quarterly_checkins
  FOR EACH ROW EXECUTE FUNCTION auto_compute_checkin_score();

-- Audit log helper
CREATE OR REPLACE FUNCTION create_audit_log(
  p_table TEXT, p_record UUID, p_action TEXT, p_by UUID,
  p_old JSONB DEFAULT NULL, p_new JSONB DEFAULT NULL
) RETURNS UUID AS $$
DECLARE v_id UUID;
BEGIN
  INSERT INTO audit_logs (table_name,record_id,action,changed_by,old_values,new_values)
  VALUES (p_table,p_record,p_action,p_by,p_old,p_new) RETURNING id INTO v_id;
  RETURN v_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Shared goal check-in sync
CREATE OR REPLACE FUNCTION sync_shared_checkin()
RETURNS TRIGGER AS $$
DECLARE v_shared BOOLEAN; v_linked RECORD;
BEGIN
  SELECT is_shared INTO v_shared FROM goals WHERE id = NEW.goal_id;
  IF v_shared THEN
    FOR v_linked IN SELECT id FROM goals WHERE shared_from = NEW.goal_id LOOP
      INSERT INTO quarterly_checkins (goal_id,quarter,actual_value,actual_date,status)
      VALUES (v_linked.id,NEW.quarter,NEW.actual_value,NEW.actual_date,NEW.status)
      ON CONFLICT (goal_id,quarter) DO UPDATE SET
        actual_value=NEW.actual_value, actual_date=NEW.actual_date, status=NEW.status;
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER sync_shared_goal_checkin AFTER INSERT OR UPDATE ON quarterly_checkins
  FOR EACH ROW EXECUTE FUNCTION sync_shared_checkin();

-- Sheet weightage validation on submit
--
-- IMPORTANT: SECURITY DEFINER is required. Without it the trigger runs as the
-- invoking role (anon/authenticated/service_role). If the invoking role has
-- been REVOKE'd on `goals` (or even just lacks SELECT under RLS), the inner
-- SELECT aborts and Postgres rolls back the outer UPDATE — reported as
-- "permission denied for table goal_sheets" on submit but not on draft saves
-- (the trigger body only runs when status transitions to 'submitted').
CREATE OR REPLACE FUNCTION validate_sheet_weightage()
RETURNS TRIGGER AS $$
DECLARE v_total NUMERIC; v_count INTEGER;
BEGIN
  IF NEW.status='submitted' AND (OLD.status IS NULL OR OLD.status!='submitted') THEN
    SELECT COALESCE(SUM(weightage),0), COUNT(*) INTO v_total, v_count FROM goals WHERE sheet_id=NEW.id;
    IF v_total != 100 THEN RAISE EXCEPTION 'Weightage must equal 100. Current: %', v_total; END IF;
    IF v_count > 8 THEN RAISE EXCEPTION 'Max 8 goals. Current: %', v_count; END IF;
    IF v_count = 0 THEN RAISE EXCEPTION 'At least one goal required'; END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER validate_sheet_before_submit BEFORE UPDATE ON goal_sheets
  FOR EACH ROW EXECUTE FUNCTION validate_sheet_weightage();

-- =============================================
-- RECOVERY BLOCK: re-grant table privileges + re-mark trigger SECURITY DEFINER
-- =============================================
-- Run this in Supabase Dashboard → SQL Editor → New query if you still see
-- "permission denied for table goal_sheets" after deploying this migration.
-- The block is idempotent — safe to run repeatedly on any environment.

-- 1. Re-mark the submit-validation trigger as SECURITY DEFINER so it always
--    runs with owner privileges, regardless of which role invoked the UPDATE.
ALTER FUNCTION validate_sheet_weightage() SECURITY DEFINER;

-- 2. Re-grant table privileges in case anything was REVOKE'd from a Supabase
--    role. service_role gets ALL; authenticated gets the CRUD set (RLS still
--    gates rows); anon gets read-only for the bits the login flow needs.
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;

GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated;

GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon;

-- 3. Defaults for future tables/sequences/functions so new schema objects
--    inherit the same grants.
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT ALL ON TABLES TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT ON TABLES TO anon;
