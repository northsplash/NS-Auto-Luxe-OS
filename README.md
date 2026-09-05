# North Splash Auto Luxe OS

Field-service operating system for North Splash Auto Luxe: owner dashboard, team, dispatch, D2D, jobs, payments, and customer communications.

The previous GitHub dump included dozens of duplicate `File (12).tsx` uploads. This repo keeps the real app (`src/`, `public/`, `supabase/`) and the Admin OS at `/` and `/os`.

## Run locally

```bash
npm install
cp env.example .env
# Fill VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY for live data.
npm run dev
```

The app serves at `http://127.0.0.1:43127`. `/` and `/os` open the **North Splash Admin** OS. Owner lands on a Stripe-style dashboard. People, Operations, Sales, Customers, Finance, and Admin map to the product models below. Sign-in stays at `/login`.
- OS demo state is saved in the browser (`localStorage`). Reset it from **Manage data**.

Search the header for people, jobs, chats, and workspaces. Book appointments from Calendar. Collect and refund send payment templates. New D2D doors land on the map.

## What is in this slice

- **Admin chrome** — owner workspaces, pinned Command Center / Appointments / Leads Tracker, gold **+ New work**, and Team Messages with a white chat canvas.
- **Product-modeled workspaces**
  - Owner dashboard → Stripe KPIs, revenue, payouts, live activity
  - People → Homebase / Rippling directory and profile tabs
  - Hours → Deputy drag-and-drop shifts, availability, time-off
  - Appointments → Jobber calendar; jobs attached to customers
  - Jobs → Housecall Pro mobile-first list with En Route / Arrived / Finish
  - Dispatch → ServiceTitan crew columns (drag jobs)
  - D2D → SalesRabbit pins, knock notes, book-the-door
  - Pipeline → SPOTIO / HubSpot stages (drag cards)
  - Customers → HubSpot record + timeline
  - Job detail → Jobber: status bar, notes, photos, collect pay, SMS log, customer portal card
  - Payments → Square filters, collect, refund, retry
  - Reports → Stripe KPI hierarchy
  - Hiring → Gusto checklists
  - Settings → Stripe-style left nav
- **Customer email + SMS** — Housecall Pro automation + Jobber email structure + Square confirmations/payments + Uber day-of updates. Appointment → Confirmed → En Route → In Progress → Complete. Admin → Communications has enable/disable, email/SMS, timing, variables, Preview Email, Preview SMS, and Send Test.
- **Customer email + SMS** — advancing Appointment → Confirmed → En Route → In Progress → Complete sends the matching Housecall / Jobber / Uber-style template (if enabled) and logs it on the job.

## Supabase

SQL lives in `supabase/migrations`. Apply the latest migration for communication template seeds after pulling.
