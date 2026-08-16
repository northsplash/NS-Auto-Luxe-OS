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
