# AtomQuest Goal Portal

**In-House Goal Setting & Tracking Portal** for Atomberg Technologies.

Built with **Next.js 16** (App Router, Server Actions), **Supabase** (PostgreSQL + Auth + RLS), **Tailwind CSS**, **shadcn/ui**, **Recharts**, and **Resend** for transactional email.

---

## 🚀 Quick Start (Local)

### 1. Install dependencies
```bash
npm install
```

### 2. Set up Supabase

1. Create a project at [supabase.com](https://supabase.com).
2. Copy `.env.example` → `.env.local` and fill in:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY` (server-only)
   - `NEXT_PUBLIC_APP_URL` = `http://localhost:3000`

### 3. Run database migrations

In **Supabase → SQL Editor**, run these in order:
1. `supabase/migrations/001_schema.sql` — Tables, enums, indexes
2. `supabase/migrations/002_rls_policies.sql` — Row Level Security
3. `supabase/migrations/003_functions.sql` — Triggers (weightage validation, shared-goal sync, audit)

### 4. Create demo users

In **Supabase → Authentication → Users**:
| Email | Password | Role |
|---|---|---|
| `admin@atomberg.com` | `Admin@123` | admin |
| `manager@atomberg.com` | `Manager@123` | manager |
| `employee1@atomberg.com` | `Employee@123` | employee |
| `employee2@atomberg.com` | `Employee@123` | employee |

Then run `supabase/seed.sql` in the SQL Editor.

### 5. (Recommended before demo) Prep demo state

Run `supabase/seed_demo_state.sql`. It is **idempotent** — re-run any time you want to:
- Put Amit Patel's sheet into `submitted` state so the manager can demo Approve / Return / inline-edit.
- Extend the active cycle's Q4 window so today is inside a valid check-in window (BRD §2.3 enforcement otherwise rejects out-of-window check-ins).

### 6. Start the dev server
```bash
npm run dev
```
Open <http://localhost:3000>.

---

## 🌐 Deploy to Vercel

1. **Push** the repo to GitHub.
2. In Vercel → **New Project** → import the repo.
3. Add Environment Variables (from `.env.example`):
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `NEXT_PUBLIC_APP_URL` = your Vercel URL once known (e.g. `https://atomquest.vercel.app`)
   - `RESEND_API_KEY` *(optional)* — emails no-op silently if absent
   - `CRON_SECRET` *(optional, recommended)* — random 32-char string. Used to auth `/api/cron/escalations`.
4. **Deploy**. After first deploy, set `NEXT_PUBLIC_APP_URL` to the live URL and redeploy.
5. `vercel.json` already declares a daily cron at **09:00 UTC** hitting `/api/cron/escalations`. No extra config needed.

---

## 🎯 BRD coverage

Phase 1 — Goal Creation & Approval:
- Goal sheet creation with Thrust Area, UoM (Numeric / % / Timeline / Zero), Target, Description
- Validation: total weightage = 100%, min 10% per goal, max 8 goals
- Submit → Approve / Return workflow with auto-locking on approval
- **Manager inline-edit during approval** — edit target/weightage/title without bouncing the sheet
- **Shared Goals** — admin OR manager can push a KPI; recipients can only adjust weightage (title / UoM / target locked); achievement syncs from primary → children via DB trigger

Phase 2 — Achievement Tracking:
- Quarterly check-ins with Actual vs Target + Status (Not Started / On Track / Completed)
- Live score per goal using BRD-specified formulas for all 4 UoM types
- Manager check-in comments per row
- Quarter-window enforcement reads `goal_cycles.qN_start/qN_end` and rejects out-of-window check-ins

Reporting & Governance:
- Achievement Report with CSV export
- Completion dashboards (employee + manager scope)
- Full audit trail of post-lock changes

Good-to-have implemented:
- Email notifications (Resend) for submit / approve / return / overdue
- **Escalation rules** (approval pending, check-in overdue, submission reminder) with admin-configurable thresholds + working Vercel Cron + manual "Run now" button
- **Analytics** — QoQ trend, status distribution, department completion, manager check-in completion (all real aggregation, no placeholders)

Not implemented:
- MS Entra ID / Azure AD SSO
- MS Teams bot / adaptive cards

---

## 📁 Folder structure
```
├── app/
│   ├── (auth)/login/          # Login page
│   ├── (dashboard)/           # Protected routes (employee / manager / admin)
│   ├── actions/               # Server actions (goals, manager, admin, checkins)
│   └── api/cron/escalations/  # Daily escalation tick (Vercel Cron)
├── components/
│   ├── ui/                    # shadcn/ui primitives
│   ├── layout/                # Sidebar
│   ├── goals/                 # Goal sheet form, check-in form
│   ├── manager/               # Approval panel (with inline edit)
│   ├── admin/                 # Cycles, users, shared goals, escalations, unlock
│   └── charts/                # Recharts analytics
├── lib/
│   ├── supabase/              # SSR + service-role clients
│   ├── utils/                 # Score calculator, CSV export, validation
│   └── email/                 # Resend templates
├── supabase/
│   ├── migrations/            # Schema · RLS · functions
│   ├── seed.sql               # Initial demo data
│   └── seed_demo_state.sql    # Idempotent pre-demo patch
└── atomquest_architecture_diagram.svg
```

---

## 🔐 Demo credentials
- **Admin** — `admin@atomberg.com` / `Admin@123`
- **Manager** (Rajesh Kumar) — `manager@atomberg.com` / `Manager@123`
- **Employee 1** (Priya Sharma, approved sheet) — `employee1@atomberg.com` / `Employee@123`
- **Employee 2** (Amit Patel, submitted sheet for approval demo) — `employee2@atomberg.com` / `Employee@123`

---

## 🧪 Demo walkthrough (one journey per role)

1. **Admin** (`/admin/dashboard`) — see org-wide stats, open Cycles, push a Shared Goal to multiple employees, click "Run now" on Escalations, export the Achievement CSV from Reports.
2. **Manager** (`/manager/dashboard`) — Amit Patel's sheet is `submitted`: click **Review** → inline-edit a target / weightage → **Approve** (or **Return** with a reason).
3. **Employee** (`/dashboard` as Priya) — open the approved Goal Sheet, click **Check-in**, enter an Actual value → live score updates → save (window is open thanks to `seed_demo_state.sql`).
