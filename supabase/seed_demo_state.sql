-- ============================================================
-- AtomQuest Goal Portal — Demo State Patch
-- ============================================================
-- Idempotent fix-up to apply BEFORE a demo / evaluation. Safe to
-- re-run any time the demo state has drifted from `seed.sql` after
-- testing.
--
-- Run AFTER `seed.sql` has executed at least once.
-- Run in: Supabase SQL Editor (or `psql` against the project).
--
-- This script handles two demo-breakers:
--
--   1. Amit Patel (employee2) should have a SUBMITTED sheet so
--      evaluators can exercise the Approve / Return / Inline-edit
--      flow as the manager. Testing tends to leave Amit's sheet in
--      `draft` with bad weightage, which makes the entire approval
--      workflow look dead on first load.
--
--   2. The active cycle's quarter check-in windows must include
--      today so the BRD §2.3 enforcement code actually opens at
--      least one window. We extend Q4 to cover the rest of the
--      fiscal year. (Adjust dates below if you re-demo later.)
--
-- ============================================================

DO $$
DECLARE
  v_manager_id UUID;
  v_emp2_id UUID;
  v_cycle_id UUID;
  v_sheet_id UUID;
  v_goal_count INT;
  v_total INT;
BEGIN
  -- Look up IDs from profiles (created by the auth signup trigger).
  SELECT id INTO v_manager_id FROM profiles WHERE email = 'manager@atomberg.com';
  SELECT id INTO v_emp2_id    FROM profiles WHERE email = 'employee2@atomberg.com';

  IF v_manager_id IS NULL OR v_emp2_id IS NULL THEN
    RAISE NOTICE 'Skipping: required users not yet created — run seed.sql first.';
    RETURN;
  END IF;

  -- Make sure Amit reports to the manager and is on the right team.
  UPDATE profiles
    SET manager_id = v_manager_id, department = COALESCE(department, 'Engineering')
    WHERE id = v_emp2_id;

  -- ----------------------------------------------------------
  -- FIX 1: Amit Patel's sheet → submitted with valid weightage
  -- ----------------------------------------------------------
  SELECT id INTO v_cycle_id FROM goal_cycles WHERE is_active = true LIMIT 1;

  IF v_cycle_id IS NULL THEN
    RAISE NOTICE 'Skipping Amit fix-up: no active cycle.';
  ELSE
    SELECT id INTO v_sheet_id
      FROM goal_sheets
      WHERE employee_id = v_emp2_id AND cycle_id = v_cycle_id
      LIMIT 1;

    IF v_sheet_id IS NULL THEN
      -- No sheet yet — create a brand-new submittable one with two goals
      -- that sum to exactly 100%.
      INSERT INTO goal_sheets (employee_id, cycle_id, status, submitted_at)
        VALUES (v_emp2_id, v_cycle_id, 'submitted', NOW() - interval '2 days')
        RETURNING id INTO v_sheet_id;

      INSERT INTO goals
        (sheet_id, title, description, thrust_area, uom_type, target_value, weightage)
      VALUES
        (v_sheet_id, 'Achieve 100% Sales Growth',
         'Drive aggressive sales expansion across all product lines for FY25-26.',
         'Business Growth', 'numeric_min', 100, 70),
        (v_sheet_id, 'Achieve 98% Customer Satisfaction',
         'Maintain CSAT above 98% through proactive support and quality checks.',
         'Customer Experience', 'percent_min', 98, 30);
    ELSE
      -- Sheet exists — normalise it back to a clean submitted state.
      -- Strategy: if total weightage isn't 100, redistribute proportionally
      -- so the validate_sheet_weightage trigger won't reject the status
      -- transition. We keep titles intact so a tester sees their edits.
      SELECT COUNT(*), COALESCE(SUM(weightage), 0)
        INTO v_goal_count, v_total
        FROM goals WHERE sheet_id = v_sheet_id;

      IF v_goal_count = 0 THEN
        INSERT INTO goals
          (sheet_id, title, description, thrust_area, uom_type, target_value, weightage)
        VALUES
          (v_sheet_id, 'Achieve 100% Sales Growth',
           'Drive aggressive sales expansion across all product lines for FY25-26.',
           'Business Growth', 'numeric_min', 100, 70),
          (v_sheet_id, 'Achieve 98% Customer Satisfaction',
           'Maintain CSAT above 98% through proactive support and quality checks.',
           'Customer Experience', 'percent_min', 98, 30);
      ELSIF v_total <> 100 THEN
        -- Reset to two known-good rows so we don't have to do tricky proportional math.
        DELETE FROM goals WHERE sheet_id = v_sheet_id AND COALESCE(is_shared, false) = false;
        -- Re-check after deleting non-shared rows. If shared rows are present, leave them
        -- and top them up with one fresh row so the total reaches 100%.
        SELECT COALESCE(SUM(weightage), 0) INTO v_total FROM goals WHERE sheet_id = v_sheet_id;
        IF v_total = 0 THEN
          INSERT INTO goals
            (sheet_id, title, description, thrust_area, uom_type, target_value, weightage)
          VALUES
            (v_sheet_id, 'Achieve 100% Sales Growth',
             'Drive aggressive sales expansion across all product lines for FY25-26.',
             'Business Growth', 'numeric_min', 100, 70),
            (v_sheet_id, 'Achieve 98% Customer Satisfaction',
             'Maintain CSAT above 98% through proactive support and quality checks.',
             'Customer Experience', 'percent_min', 98, 30);
        ELSIF v_total < 100 THEN
          INSERT INTO goals
            (sheet_id, title, description, thrust_area, uom_type, target_value, weightage)
          VALUES
            (v_sheet_id, 'Cut Quarterly Operating Cost',
             'Reduce avg quarterly opex by the gap-fill amount.',
             'Cost Optimization', 'numeric_max', 100, 100 - v_total);
        END IF;
      END IF;

      UPDATE goal_sheets
        SET status = 'submitted',
            submitted_at = COALESCE(submitted_at, NOW() - interval '2 days'),
            approved_at = NULL, approved_by = NULL, return_reason = NULL
        WHERE id = v_sheet_id;
    END IF;

    RAISE NOTICE 'Amit Patel sheet ready for approval demo (id=%).', v_sheet_id;
  END IF;

  -- ----------------------------------------------------------
  -- FIX 2: Extend the active cycle's quarter windows so today
  -- falls inside Q4. Without this, BRD §2.3 enforcement (which
  -- we just added) will refuse every check-in attempt.
  -- ----------------------------------------------------------
  IF v_cycle_id IS NOT NULL THEN
    UPDATE goal_cycles
      SET q4_end = GREATEST(q4_end, (CURRENT_DATE + interval '60 days')::date),
          q4_start = LEAST(q4_start, CURRENT_DATE::date - 1)
      WHERE id = v_cycle_id;
    RAISE NOTICE 'Active cycle Q4 window extended to include today.';
  END IF;
END $$;
