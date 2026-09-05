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

The app serves at `http://127.0.0.1:43127`.

- Without Supabase credentials, `/` opens the **North Splash OS** preview (`/os`) with demo data.
- With credentials, `/` opens login. Admin, employee, D2D, and customer portals stay on their existing routes.

## What is in this slice

- **Flexible hire / pay** — custom job title, system role, and a mix of hourly, salary, weekly draw, commission, per-job, and extra rules. Admins and other roles are not locked to one pay type.
- **iPhone + desktop OS** — left rail like Teams, chat like Google Chat (Chats / Spaces), bottom tabs on phone: Home, Chat, Leads, Jobs, More.
- **Product-modeled workspaces** — Stripe owner dashboard, Homebase/Rippling people, Deputy hours, Jobber calendar, ServiceTitan dispatch, SalesRabbit D2D, SPOTIO/HubSpot pipeline, HubSpot CRM, Housecall Pro jobs, Square payments, Gusto hiring, Stripe settings.
- **Customer email + SMS** — Housecall Pro lifecycle, Jobber templates, Square payment messages, Uber-style day-of updates, with a shared Appointment → Confirmed → En Route → In Progress → Complete status bar.

## Supabase

SQL lives in `supabase/migrations`. Apply the latest migration for communication template seeds after pulling.
