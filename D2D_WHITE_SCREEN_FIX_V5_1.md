# North Splash OS — D2D White Screen Fix V5.1

- Fixed a React hook-order crash in `src/pages/D2D/index.tsx` introduced by the new Next Best House calculation.
- The calculation now runs without adding a hook after the page's early loading returns.
- Added a route-level error boundary so a future runtime problem shows a recovery screen instead of a blank page.
- Bumped the service worker cache from v7 to v8 to force fresh app assets after deployment.
- All Field Experience V5 location, leads, messaging, and Street View changes remain included.
