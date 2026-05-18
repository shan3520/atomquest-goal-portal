-- =============================================
-- AtomQuest Goal Portal — Seed Data
-- Run AFTER creating auth users via Supabase dashboard or API
-- =============================================
-- IMPORTANT: First create these users in Supabase Auth:
--   admin@atomberg.com / Admin@123
--   manager@atomberg.com / Manager@123
--   employee1@atomberg.com / Employee@123
--   employee2@atomberg.com / Employee@123
-- Then replace the UUIDs below with the actual auth.users IDs.

-- Placeholder UUIDs (replace with actual auth user IDs)
-- You can find them in Supabase Dashboard > Authentication > Users

DO $$
DECLARE
  v_admin_id UUID;
  v_manager_id UUID;
  v_emp1_id UUID;
  v_emp2_id UUID;
  v_cycle_id UUID;
  v_sheet_id UUID;
  v_goal1_id UUID;
  v_goal2_id UUID;
  v_goal3_id UUID;
BEGIN
  -- Get user IDs from profiles (created by trigger on auth signup)
  SELECT id INTO v_admin_id FROM profiles WHERE email = 'admin@atomberg.com';
  SELECT id INTO v_manager_id FROM profiles WHERE email = 'manager@atomberg.com';
  SELECT id INTO v_emp1_id FROM profiles WHERE email = 'employee1@atomberg.com';
  SELECT id INTO v_emp2_id FROM profiles WHERE email = 'employee2@atomberg.com';

  -- Update profiles with roles and relationships
  UPDATE profiles SET role = 'admin', name = 'Admin User', department = 'Management'
    WHERE id = v_admin_id;
  UPDATE profiles SET role = 'manager', name = 'Rajesh Kumar', department = 'Engineering'
    WHERE id = v_manager_id;
  UPDATE profiles SET role = 'employee', name = 'Priya Sharma', department = 'Engineering',
    manager_id = v_manager_id WHERE id = v_emp1_id;
  UPDATE profiles SET role = 'employee', name = 'Amit Patel', department = 'Engineering',
    manager_id = v_manager_id WHERE id = v_emp2_id;

  -- Create goal cycle: FY 2025-26
  INSERT INTO goal_cycles (id, name, phase, start_date, end_date, is_active, created_by,
    q1_start, q1_end, q2_start, q2_end, q3_start, q3_end, q4_start, q4_end)
  VALUES (
    gen_random_uuid(), 'FY 2025-26', 'active', '2025-04-01', '2026-03-31', true, v_admin_id,
    '2025-07-01','2025-07-31', '2025-10-01','2025-10-31',
    '2026-01-01','2026-01-31', '2026-03-01','2026-04-30'
  ) RETURNING id INTO v_cycle_id;

  -- Create approved goal sheet for employee1
  INSERT INTO goal_sheets (id, employee_id, cycle_id, status, submitted_at, approved_at, approved_by)
  VALUES (gen_random_uuid(), v_emp1_id, v_cycle_id, 'approved', NOW()-interval '30 days',
    NOW()-interval '28 days', v_manager_id)
  RETURNING id INTO v_sheet_id;

  -- Goals for employee1
  INSERT INTO goals (id, sheet_id, title, description, thrust_area, uom_type, target_value,
    weightage, status)
  VALUES (gen_random_uuid(), v_sheet_id, 'Increase Monthly Active Users',
    'Drive MAU growth through feature launches and marketing campaigns',
    'Business Growth', 'numeric_min', 50000, 30, 'on_track')
  RETURNING id INTO v_goal1_id;

  INSERT INTO goals (id, sheet_id, title, description, thrust_area, uom_type, target_value,
    weightage, status)
  VALUES (gen_random_uuid(), v_sheet_id, 'Reduce Customer Churn Rate',
    'Implement retention strategies to reduce monthly churn below target',
    'Customer Experience', 'percent_max', 5, 25, 'on_track')
  RETURNING id INTO v_goal2_id;

  INSERT INTO goals (id, sheet_id, title, description, thrust_area, uom_type, target_value,
    target_date, weightage, status)
  VALUES (gen_random_uuid(), v_sheet_id, 'Launch Mobile App v2.0',
    'Complete development and launch of redesigned mobile application',
    'Innovation & Technology', 'timeline', NULL, '2025-12-31', 25, 'not_started')
  RETURNING id INTO v_goal3_id;

  INSERT INTO goals (sheet_id, title, description, thrust_area, uom_type, target_value,
    weightage, status)
  VALUES (v_sheet_id, 'Zero Production Incidents',
    'Maintain zero critical production incidents throughout the year',
    'Operational Excellence', 'zero', 0, 20, 'completed');

  -- Q1 Check-in data for employee1
  INSERT INTO quarterly_checkins (goal_id, quarter, actual_value, status, employee_notes)
  VALUES (v_goal1_id, 'Q1', 38000, 'on_track', 'Good progress, 76% of target achieved in Q1');

  INSERT INTO quarterly_checkins (goal_id, quarter, actual_value, status, employee_notes,
    manager_comment, manager_id)
  VALUES (v_goal2_id, 'Q1', 4.2, 'on_track', 'Churn reduced from 6.1% to 4.2%',
    'Great improvement! Keep focusing on onboarding flow.', v_manager_id);

  INSERT INTO quarterly_checkins (goal_id, quarter, actual_value, status, employee_notes)
  VALUES (v_goal3_id, 'Q1', NULL, 'not_started', 'Design phase initiated, development starts Q2');

  -- ============================================================
  -- Amit Patel (employee2): SUBMITTED sheet so the manager can
  -- exercise the Approve / Return flow on the demo.
  -- Weightages must sum to 100; status='submitted' triggers the
  -- validate_sheet_weightage check in 003_functions.sql.
  -- ============================================================
  DECLARE
    v_emp2_sheet_id UUID;
  BEGIN
    INSERT INTO goal_sheets (id, employee_id, cycle_id, status, submitted_at)
    VALUES (
      gen_random_uuid(), v_emp2_id, v_cycle_id, 'submitted',
      NOW() - interval '2 days'
    )
    RETURNING id INTO v_emp2_sheet_id;

    INSERT INTO goals (sheet_id, title, description, thrust_area, uom_type, target_value, weightage, status)
    VALUES (
      v_emp2_sheet_id,
      'Ship Smart Fan Firmware v3.0',
      'Lead firmware release for the next-gen smart fan line including OTA pipeline',
      'Innovation & Technology', 'numeric_min', 4, 35, 'not_started'
    );

    INSERT INTO goals (sheet_id, title, description, thrust_area, uom_type, target_value, weightage, status)
    VALUES (
      v_emp2_sheet_id,
      'Reduce Firmware Bug Backlog',
      'Bring open P1/P2 firmware defects below the team threshold by EoY',
      'Quality & Compliance', 'numeric_max', 8, 30, 'not_started'
    );

    INSERT INTO goals (sheet_id, title, description, thrust_area, uom_type, target_value, weightage, status)
    VALUES (
      v_emp2_sheet_id,
      'Mentor Two Junior Engineers',
      'Run weekly 1:1s, drive their goal sheets, support release ownership',
      'People & Culture', 'numeric_min', 2, 20, 'not_started'
    );

    INSERT INTO goals (sheet_id, title, description, thrust_area, uom_type, target_value, weightage, status)
    VALUES (
      v_emp2_sheet_id,
      'Zero Critical Field Incidents',
      'Maintain zero P0/P1 production firmware incidents through the year',
      'Operational Excellence', 'zero', 0, 15, 'not_started'
    );
  END;

  -- Default escalation rules
  INSERT INTO escalation_rules (rule_type, threshold_days, is_active) VALUES
    ('checkin_overdue', 7, true),
    ('approval_pending', 5, true),
    ('submission_reminder', 3, true);

END $$;
