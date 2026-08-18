# North Splash OS — Free Mapping V6

This build upgrades the D2D and territory mapping stack without a paid map provider or trial.

## What changed

- MapLibre GL JS is now the primary browser map engine.
- OpenFreeMap is the primary vector basemap provider (no API key required).
- Streets, Bright, Light, and 3D styles are switchable from the map toolbar.
- Existing Leaflet/OpenStreetMap rendering remains as an automatic compatibility fallback if WebGL or MapLibre cannot start.
- Current-location centering now works in both map engines and uses a fresh high-accuracy browser GPS request.
- Route rendering begins at the rep's current GPS location when available.
- House pins retain one-tap status workflow, selected-house pulse, route order, desktop hover preview, and touch behavior.
- Territory drawing remains click-to-add, drag-to-resize, right-click-to-remove.
- Walking route optimization now adds a local 2-opt cleanup pass to remove obvious route crossings.
- Next Best House uses both distance and lead/status priority.
- Corrected the distance formatter so meters are actually converted to feet.
- Territory doors are cached locally so already-loaded houses can still be shown if a later database read fails or connectivity drops.
- PWA cache version bumped to v9.

## Cost

No paid mapping provider was added. OpenFreeMap requires no API key. Existing Supabase/Mapillary configuration is preserved.

## Fallback behavior

If the modern WebGL map engine cannot initialize, the portal automatically switches to the existing Leaflet compatibility renderer for the current browser session rather than blanking the page.
