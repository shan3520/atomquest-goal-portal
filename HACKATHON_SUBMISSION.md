# AtomQuest Hackathon 1.0 Submission Pack

## 1) Submission Deliverables

- Live Demo URL: https://atomquest-goal-portal-lime.vercel.app
- Source Code Repository: https://github.com/shan3520/atomquest-goal-portal
- Architecture Diagram: atomquest_architecture_diagram.svg
- Login Credentials:
  - Admin: admin@atomberg.com / Admin@123
  - Manager: manager@atomberg.com / Manager@123
  - Employee 1: employee1@atomberg.com / Employee@123
  - Employee 2: employee2@atomberg.com / Employee@123

## 2) Problem Statement Alignment (BRD Coverage)

### Phase 1: Goal Creation & Approval (Must-Have)

Implemented:
- Employee goal sheet creation with Thrust Area, Goal Title, Description, UoM, Target, Weightage.
- UoM support: Numeric, Percentage, Timeline, Zero-based.
- Validation rules enforced:
  - Total weightage = 100%
  - Minimum 10% per goal
  - Maximum 8 goals per employee
- Manager approval workflow:
  - Review submitted goals
  - Inline edit target/weightage during approval
  - Approve or return for rework
- Lock-on-approval behavior with admin unlock support.
- Shared goals:
  - Admin/Manager can push KPI to multiple employees
  - Recipients can adjust weightage only
  - Primary-owner achievement syncs to linked goals

### Phase 2: Achievement Tracking & Check-ins (Must-Have)

Implemented:
- Quarterly check-in interface for planned vs actual achievement.
- Per-goal status: Not Started / On Track / Completed.
- Manager check-in module with structured comments.
- System-computed progress formulas for all UoM types:
  - Min (higher is better): achievement / target
  - Max (lower is better): target / achievement
  - Timeline: completion date vs deadline
  - Zero: if 0 then 100%, else 0%
- Quarter window enforcement from cycle configuration.

### User Roles & Personas

Implemented:
- Employee: create/submit goals, perform quarterly updates.
- Manager (L1): review/inline edit/approve goals, add check-in comments.
- Admin/HR: cycle management, user management, completion oversight, unlock capability.

### Reporting & Governance

Implemented:
- Achievement report with CSV export.
- Completion dashboards for employee and manager completion visibility.
- Audit trail for post-lock changes including actor and timestamp.

## 3) Good-to-Have Features (Bonus)

Implemented:
- Email notifications for submit/approve/return/reminders.
- Microsoft Teams adaptive card notifications with deep links.
- Rule-based escalation module with configurable thresholds and daily cron.
- Analytics module:
  - QoQ trends
  - Status distribution
  - Department completion
  - Manager check-in completion

Partially implemented / Not implemented:
- Microsoft Entra ID (Azure AD) SSO is not implemented (email/password auth used).

## 4) Evaluation Criteria Mapping

### 1. Functionality of the Portal
- End-to-end flow demonstrated for all 3 roles.
- Goal lifecycle, approval, check-ins, and reporting are functional.

### 2. Adherence to BRD
- All Phase 1 and Phase 2 must-haves covered.
- Validation rules and role-based behavior enforced.

### 3. User Friendliness
- Role-specific dashboards and focused workflows.
- Guardrails and validation messages prevent incorrect input.

### 4. Presence of Bugs
- Server-side validation and guarded workflow transitions.
- Locking and audit controls reduce data inconsistency risk.

### 5. Good-to-Have Features
- Multiple bonus modules implemented (email, Teams, escalations, analytics).

### 6. Cost Optimisation
- Lean architecture with managed services and server actions.
- Cost-aware stack suitable for hackathon-to-production progression.

## 5) Demo Script (Judge-Friendly, 3 to 5 Minutes)

### Admin Flow
1. Open admin dashboard.
2. Show active cycle and thresholds.
3. Push a shared goal to employees.
4. Run escalations manually and show notification trail.
5. Export achievement report (CSV).

### Manager Flow
1. Open manager dashboard.
2. Open a submitted sheet.
3. Inline edit one target/weightage.
4. Approve or return with reason.

### Employee Flow
1. Open employee dashboard.
2. Open approved goal sheet.
3. Perform check-in with actual value and status.
4. Show computed score update.

## 6) Architecture Summary (for Viva)

- Frontend: Next.js 16 App Router, React 19, Tailwind CSS, shadcn/ui.
- Backend: Next.js Server Actions + Supabase PostgreSQL.
- Security: Supabase RLS policy-based access control.
- Notifications: Resend email + Teams workflow webhook adaptive cards.
- Scheduling: Vercel Cron for escalation jobs.
- Charts/Reporting: Recharts + CSV export.

## 7) Known Constraints and Honest Declaration

- Entra ID SSO is intentionally out of scope for this submission timeline.
- Teams integration uses adaptive cards via webhook (not conversational bot).
- This satisfies the problem statement bonus path for Teams notifications.

## 8) Final Checklist Before Submission

- Add hosted URL and repository URL in Section 1.
- Attach architecture diagram file in the submission portal.
- Verify all credentials are active.
- Re-run demo journey once before recording/submission.
- Keep one backup recording of the full role-wise demo.
