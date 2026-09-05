# North Splash Auto Luxe OS

Field-service operating system for North Splash Auto Luxe. One dark, Stripe-like product — not 15 tools stitched together.

`/` and `/os` open the Admin OS. D2D canvassing is `/d2d`. The detailer portal is `/employee`. Sign-in stays at `/login`.

## Run locally

```bash
npm install
cp env.example .env
# Fill VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY for live data.
npm run dev
```

The app serves at `http://127.0.0.1:43127`. Demo state lives in this browser (`localStorage`). Reset it from **Manage data**.

## How it is modeled

Visual language is **Stripe** everywhere: dark surfaces, tight spacing, strong KPI hierarchy, restrained gold, simple charts.

Workflows follow the product that already does that job well:

| Workspace | Modeled after |
|---|---|
| Owner Command Center / Dashboard | Stripe Dashboard |
| Employees / profiles / pay | Rippling + Gusto |
| Scheduling | Deputy |
| Appointments / job detail | Jobber |
| Dispatch board | ServiceTitan |
| D2D portal, map, territories | SalesRabbit |
| Lead pipeline | HubSpot + SPOTIO |
| Customers / CRM | HubSpot |
| Detailer jobs | Housecall Pro |
| Live job status | Uber |
| Team messaging | Microsoft Teams |
| Payments | Square |
| Reports | Stripe |
| Hiring / onboarding | Gusto |
| Communications | Housecall Pro + Jobber |
| Settings | Stripe |
| Phone navigation | Microsoft Teams |

The two cores: **SalesRabbit** for territory maps, pins, knocks, and canvassing; **ServiceTitan** for technicians, job cards, assignment, and live job progression.

## What you can do in this slice

- Owner Command Center with glance KPIs, revenue, today’s schedule, attention, team, and booking flow
- Rippling-style people directory and profile tabs
- ServiceTitan dispatch: unassigned rail, tech columns, drag-to-assign
- SalesRabbit D2D: tall map, West / Central / East areas, knock outcomes, book-the-door
- HubSpot pipeline and customer records
- Jobber appointments and job detail with Uber-style live status
- Square payments, Gusto hiring checklists, Stripe settings
- Phones: Home / Chat / Jobs / Map / More. Tablets use a labeled drawer.

## Supabase

SQL lives in `supabase/migrations`. Apply the latest migration for communication template seeds after pulling. Without keys, the OS still runs on demo data.
