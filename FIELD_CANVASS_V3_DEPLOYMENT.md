# North Splash OS — Field Canvass V3 Deployment

## What changed
- D2D territory maps automatically discover mapped residential buildings when an assigned territory has no house records.
- Residential doors use clickable house-shaped markers with hover previews and status colors.
- The field house sheet starts in a fast-mark mode and supports Save & Next House.
- Customer/lead fields are collapsed until needed.
- Map fullscreen uses the browser Fullscreen API and Leaflet invalidation so the map actually fills the viewport.
- Territory house discovery is server-side only through the `territory-house-search` Edge Function.
- House discovery retries multiple free Overpass instances.
- Portal visual backgrounds received subtle warm grid/gradient depth instead of flat empty cream.
- Permissions were rebuilt with lighter account cards, role presets, collapsible access groups, and a cleaner employee-link control.
- Availability and legacy black panels are softened to the OS cream/graphite/bronze system.
- Admin Data Manager can fall back to RLS-governed direct reads/actions for normal tables if the Edge Function is temporarily unavailable. Auth profile deletion remains Edge-Function-only.

## Required Supabase Edge Function deployment
Deploy/update this function after the Vercel build:

- `territory-house-search` → `supabase/functions/territory-house-search/index.ts`

Also keep the existing `admin-data-manager` function deployed if you want customer-account/Auth deletion through Data Management.

Do not replace a known-working `send-communication` deployment just for this UI release.

## Vercel
No new environment variable is required by this release.
The OS continues to use its existing Supabase and Mapillary environment variables.

## First tests after deploy
1. D2D → Territory: choose an assigned territory with a saved polygon.
2. Wait for automatic “Mapping residential doors…” or click Refresh Houses.
3. Confirm individual house icons appear over mapped properties.
4. Hover a house on desktop; confirm address/status preview.
5. Click a house; choose an outcome; use Save & Next House.
6. Test Full Screen; the map should occupy the full viewport and restore correctly on exit.
7. Admin → Portal Permissions: test role preset, permission group collapse, and Save Access.
8. Admin → Data Management: list records and delete/archive a non-protected test record.
