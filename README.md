# North Splash Auto Luxe OS

Field-service operating system for North Splash Auto Luxe: owner dashboard, team, dispatch, D2D, jobs, payments, and customer communications.

The previous GitHub dump included dozens of duplicate `File (12).tsx` uploads. This repo keeps the real app (`src/`, `public/`, `supabase/`) and a Teams-style iPhone shell at `/os`.

## Run locally

```bash
npm install
cp env.example .env
# Fill VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY for live data.
npm run dev
```

The app serves at `http://127.0.0.1:43127`. `/` and `/os` open the **North Splash Admin** workspace (People → Team Messages by default), using the same dark-gold chrome as the live Admin portal. Sign-in stays at `/login`. Admin, employee, D2D, and customer portals keep their existing routes.
- OS demo state is saved in the browser (`localStorage`). Reset it from **Manage data** or Settings.

Search the header for people, jobs, chats, and workspaces. Book appointments from Calendar. Collect and refund send payment templates. New D2D doors land on the map.

## What is in this slice

- **Admin chrome** — owner workspaces, pinned Command Center / Appointments / Leads Tracker, gold **+ New work**, and Team Messages with a white chat canvas.
- **Flexible hire / pay** — custom job title, system role, and a mix of hourly, salary, weekly draw, commission, per-job, and extra rules. Admins and other roles are not locked to one pay type. Hiring checklists convert into that same add-employee flow.
- **Product-modeled workspaces**
  - Owner → Stripe KPIs, revenue, live activity
  - People → Team Messages, Homebase / Rippling directory, Deputy hours
  - Appointments → Jobber job list
  - Dispatch → ServiceTitan crew columns (drag jobs)
  - D2D → SalesRabbit pins, knock notes, book-the-door
  - Pipeline → SPOTIO / HubSpot stages (drag cards)
  - Customers → HubSpot record + timeline
  - Jobs → Housecall / Jobber detail: status bar, notes, photos, collect pay, SMS log
  - Payments → Square filters, collect, refund, retry
  - Reports → live job / lead KPIs
  - Hiring → Gusto checklists
  - Settings → Stripe-style left nav
- **Customer email + SMS** — advancing Appointment → Confirmed → En Route → In Progress → Complete sends the matching Housecall / Jobber / Uber-style template (if enabled) and logs it on the job.

## Supabase

SQL lives in `supabase/migrations`. Apply the latest migration for communication template seeds after pulling.
