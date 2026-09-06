# North Splash Auto Luxe OS

Field-service operating system for North Splash Auto Luxe. One cream-luxury OS — Stripe hierarchy, SalesRabbit D2D, ServiceTitan dispatch — not 15 tools stitched together.

`/` and `/os` open the Admin OS. D2D canvassing is `/d2d`. The detailer portal is `/employee`. Sign-in stays at `/login`.

## Run locally

```bash
npm install
cp env.example .env
# Fill VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY for live data.
npm run dev
```

The app serves at `http://127.0.0.1:43127`. Demo state lives in this browser (`localStorage`). Reset it from **Manage data**.

## Public URLs

- GitHub Pages (updates on every push to `main`): https://northsplash.github.io/NS-Auto-Luxe-OS/?tab=dashboard
- Vercel: import **this GitHub repo**, production branch **`main`** (not `gh-pages`). `vercel.json` runs `npm ci --include=dev` then `npm run build` into `dist`. `gh-pages` is a static snapshot for GitHub Pages only — it has no Vite, so a Vercel build of that branch fails with `vite: command not found`. Add `northsplash.com` or `app.northsplash.com` as the project domain, then point DNS to Vercel. This repository cannot change northsplash.com DNS by itself.

Open **Owner → Dashboard**. Each push to `main` rebuilds GitHub Pages.

## How it is modeled

Visual language is **cream luxury**: ivory cards, espresso sidebar, tight type, 14px radius, gold only for primary actions, KPIs, and active states. Home is role-based (Owner / D2D / Detailer / Admin). Command Center leads with exceptions. Phones use a 5-button bar: Home / Chat / Calendar / Team / More, with bottom sheets instead of desktop popups.

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

- Owner Dashboard: six KPIs, monthly cash flow, recent appointments, and team overview (Stripe layout)
- Owner Command Center with glance KPIs, exceptions, today’s schedule, and booking flow
- Rippling-style people directory and Gusto-style onboarding packet (headshot, legal name, tax last-four, deposit, I-9)
- ServiceTitan dispatch: unassigned rail, tech columns, drag-to-assign
- SalesRabbit D2D: tall map, West / Central / East areas, knock outcomes, door list, book-the-door
- HubSpot pipeline and customer records
- Jobber appointments (week strip + day board) and job detail with Uber-style live status
- Square payments, Gusto hiring pipeline, Stripe settings
- Teams-style messaging (Chat / Teams filters, composer, company channel)
- Phones: Home / Chat / Calendar / Team / More. Tablets use split map/list, chat, and dispatch.

## Supabase

SQL lives in `supabase/migrations`. Apply the latest migration for communication template seeds after pulling. Without keys, the OS still runs on demo data.
