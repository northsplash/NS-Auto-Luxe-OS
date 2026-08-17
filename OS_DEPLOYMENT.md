# North Splash OS deployment

Deploy this project to `app.northsplash.com`.

Required Vercel variables:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_SITE_URL=https://www.northsplash.com`
- `VITE_MAPILLARY_ACCESS_TOKEN`

Deploy this new Supabase Edge Function:
- `supabase/functions/territory-house-search/index.ts`
- `supabase/functions/claim-customer-history/index.ts`

The function proxies house discovery through server-side Overpass requests and automatically tries multiple providers if one public service is overloaded.

No new SQL migration is required for this release.

`claim-customer-history` links older guest bookings to a customer account after the customer signs in with the same email.

## Field Canvass V3
After deploying this project to Vercel, deploy/update `territory-house-search` from `supabase/functions/territory-house-search/index.ts`.
See `FIELD_CANVASS_V3_DEPLOYMENT.md` for the verification sequence.
