# North Splash OS — Field Intelligence V7

This build upgrades the D2D portal without adding a paid mapping service.

## Added
- New **Field Intel** workspace for D2D reps.
- Live GPS state and accuracy indicator.
- GPS breadcrumb trail cached locally for the active field day.
- Doors/hour and contacts/hour pace metrics.
- Average time between knocks and time since last knock.
- Street-level progress rollups with contacts and appointments.
- Live field alerts for inactivity, weak GPS, follow-ups, and territory completion.
- Knock timeline with one-tap reopening of mapped houses.
- Canvassing health score for coaching context only.
- GPS proximity badge in the house drawer to show how far the rep is from the selected property.
- Responsive iPad/mobile layout for the intelligence workspace.
- Service-worker cache bumped to V7.

## Existing systems preserved
- MapLibre/OpenFreeMap primary renderer and Leaflet fallback.
- Territory house discovery and caching.
- Optimized local walking routes and Next Best House.
- Offline lead queue and automatic re-sync.
- Supabase rep-location history.
- Crew Command Center manager statistics and employee drill-downs.

## No new paid service
V7 uses the existing browser GPS, local storage, current Supabase tables, and the free mapping stack already in the project.

## Validation performed
- Canonical src TS/TSX parser check.
- Local import target check.
- CSS brace balance check.
- ZIP integrity check.

A full Vite dependency build still requires npm packages to be installed by Vercel/your local environment.
