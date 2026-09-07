# North Splash Auto Luxe OS

Field-service operating system for North Splash Auto Luxe. Service area is all of North Carolina. One cream-luxury OS — Stripe hierarchy, SalesRabbit D2D, ServiceTitan dispatch — not 15 tools stitched together.

`/` and `/owner` open the live Owner portal (Supabase team, jobs, and cash). `/os` is the demo cream OS with sample data. D2D canvassing is `/d2d`. The detailer portal is `/employee`. Manager dispatch is `/manager`. Sign-in stays at `/login`.

Owners can move between Owner, D2D, Detail, and Manager from the sidebar, the tablet portal chips, or **Back to Owner** on field screens. Tablets (about 721–1180px) use an overlay menu and a dedicated workspace scroller so the page pans instead of locking behind nested overflow.

## Run locally

```bash
npm install
cp env.example .env
# Fill VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY for live data.
npm run dev
```

The app serves at `http://127.0.0.1:43127`. Demo state lives in this browser (`localStorage`). Reset it from **Manage data**.

## Public URLs

- Production (Vercel, branch `main`): https://ns-auto-luxe-os.vercel.app/
- GitHub Pages (updates on every push to `main`): https://northsplash.github.io/NS-Auto-Luxe-OS/?tab=command_center

`vercel.json` runs `npm ci --include=dev` then `npm run build` into `dist`, SPA-rewrites every route to `index.html`, and turns off Vercel builds for `gh-pages`. `gh-pages` is a static snapshot for GitHub Pages only — it has no Vite, so a Vercel build of that branch fails with `vite: command not found`. Add `northsplash.com` or `app.northsplash.com` as the project domain, then point DNS to Vercel. This repository cannot change northsplash.com DNS by itself.

Open **Owner → Command Center**. Each push to `main` rebuilds Vercel and GitHub Pages. Hard-refresh once after a deploy so the service worker drops the previous shell. If a screen says a JavaScript chunk could not load, reload once — the OS now recovers from stale hashed files after a deploy.

Lead, territory, and D2D maps use Google Maps when `VITE_GOOGLE_MAPS_API_KEY` is set on the Vercel project (Maps JavaScript API, Geocoding API, and Places API). OpenStreetMap is the fallback if the key is missing or Google rejects it. Do not paste a Maps key into chat.

## How it is modeled

Visual language is **cream luxury**: ivory paper `#fffdf8` on canvas `#efe8dc`, 14px radius. Gold is for eyebrows, KPI icons, and cash-flow bars. Primary actions are espresso. The More drawer and Owner sidebar stay on cream paper — black panels are leftover dark-theme invert, not the design system. Workspace pages fade in, maps use Google Maps when a Vercel key is in the build (OpenStreetMap otherwise), and phone/tablet chrome uses 44px targets. Home is role-based (Owner / D2D / Detailer / Admin). Command Center leads with exceptions. Phones use a 5-button bar: Home / Chat / Calendar / Team / More.

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

- Owner Command Center (home): exceptions first, then collected / jobs / leads, then today’s run, pipeline, and team
- Admin Overview: Stripe-style balances (gross volume, this month, pending, avg. ticket), cash flow, recent appointments, and team overview
- Rippling-style people directory (search) and Gusto-style onboarding packet (headshot, legal name, tax last-four, deposit, I-9)
- Deputy staff schedule: Sunday–Saturday week grid per person, plus shift editor
- ServiceTitan dispatch: unassigned rail, tech columns, drag-to-assign
- SalesRabbit D2D: tall map, West / Central / East areas, knock outcomes, door list, book-the-door. The sales presentation **Account** tab opens a real customer portal login at the door (email + password) without signing the rep out. Apply writes the household onto the lead and links `converted_customer_id`.
- HubSpot pipeline: exceptions first, New Lead, drag between stages, assign a rep, and book a job from the inspector
- Every Owner/Admin workspace item is on `/os`: Sales (map, pipeline, territories, campaigns, follow-up), Customers (directory, records, photos, calendar, windows, slots, history, fleets), Operations (jobs through approvals), People (team through training), Finance (payroll, ledger, analytics, pay mix), and Admin (access through traffic)
- Client photos: import before/after and portfolio shots onto a customer. Open **Customers → Client photos**, or import from a CRM record. Attach to a visit when the job already exists.
- Jobber appointments (stage filters, customer, address) and job detail with Uber-style live status stepper
- Exterior and interior details each have three selves — Essential, Signature, Elite — on the D2D pitch, customer booker, calendar, and the detailer checklist. Full vehicle packages keep the same three selves.
- Square payments, Gusto hiring pipeline, Stripe settings
- Teams-style messaging (Chat / Teams filters, composer, company channel). Send shows an error instead of failing silently.
- Gusto hiring: Convert / Hire seeds the onboarding packet and opens the hire’s profile.
- New-hire academy: Door-to-door (8 lessons, 3 field drills, 8-question quiz) and Detailing (8 lessons, 3 field drills, 8-question quiz). Opening **People → Training** applies the modules and assigns them by role. New hires also get the academy when they are hired. Preview both courses from demo OS **People → Training**.

## Apply the hire packet in Supabase

After pulling, run `supabase/migrations/20260906120000_v29_employee_onboarding_profiles.sql`, `supabase/migrations/20260906140000_v30_new_hire_academy.sql`, `supabase/migrations/20260906150000_v31_client_photos.sql`, `supabase/migrations/20260906160000_v32_exterior_interior_detail_selves.sql`, `supabase/migrations/20260906233000_v33_customer_referrals.sql`, and `supabase/migrations/20260907013000_v34_owner_profit_settings_grants.sql` on the live project (or `supabase db push`). The last file grants Owner/Admin access to Growth and Profits (`owner_profit_settings`). Customer portal signups can name a referrer by phone or email; a match puts $20 credit on both accounts. Owner, Admin, and Manager see who referred whom under **Customers** and **Referrals**. The Owner UI still saves last-four tax/deposit into `onboarding_tasks` if that table is not applied yet. Full SSNs are never stored. The Training tab also upserts academy lessons if the SQL has not been applied yet. Client photo imports still land in storage and a local fallback if `client_photos` is not applied yet.
- Device shells: phone (≤720) uses the cream bottom bar; tablet (721–1180) uses hamburger + overlay menu + bottom bar; web (≥1181) keeps a persistent sidebar and hides the bar. Hard-refresh after deploy.

## Supabase

SQL lives in `supabase/migrations`. Apply the latest migration for communication template seeds after pulling. Without keys, the OS still runs on demo data.

Live D2D **Apply customer account** calls the `create-customer-account` Edge Function so the rep session is not replaced by the new customer login. Public-site job applications post to `/api/job-application` on Vercel, then fall back to `submit-job-application`, the `submit_website_job_application` RPC, and a guest insert (anon key, not a signed-in portal session). The live project blocked anon inserts (`permission denied for table recruiting_candidates`) and the submit function was not deployed, which is why `/apply` showed the phone fallback. Run `supabase/migrations/20260907180000_website_apply_rpc.sql` in the live SQL editor and deploy the function with `--no-verify-jwt`:

```bash
supabase functions deploy create-customer-account
supabase functions deploy submit-job-application --no-verify-jwt
```

Set GitHub Actions secret `SUPABASE_ACCESS_TOKEN` so push can apply that SQL and deploy the function.

D2D and Owner can create the login. The function refuses emails that already belong to team accounts. Demo OS (`/os`) creates an in-memory customer instead. Website applications from the public apply page appear on Owner **People → Hiring** and Manager **Hiring** as source Website.
