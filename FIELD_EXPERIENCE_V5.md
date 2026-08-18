# North Splash OS — Field Experience V5

This build focuses on the three reported field-work issues: current-location navigation, the D2D lead/territory experience, team messaging, and Territory Command street imagery.

## Changes

- Current-location actions now request a fresh high-accuracy GPS fix and fly the Leaflet map to the user's position at zoom 19. The location control is always available instead of only appearing while a route/clock session already supplied a location.
- The manual Outside Territory Lead "Use Current Location" action also emits a map-center event so the map moves to the captured position.
- D2D field work now has a compact territory command strip, Next Best House preview, Start/Rebuild Route action, stronger KPI hierarchy, refined filters, and clearer residential property pins with a selected-house pulse.
- On desktop/iPad landscape, the selected-house panel behaves as a non-blocking inspector so the field map remains usable behind it. Smaller devices retain the bottom-sheet interaction.
- Team Messaging was rebuilt into an operations-first three-pane workspace: channel rail, live thread, optional channel/field context rail, favorites, conversation search, quick field workflows, grouped message rendering, improved composer, keyboard send, and responsive tablet/phone behavior. Existing Supabase message/channel tables remain unchanged.
- Territory Street View now uses progressive Mapillary searches at 35m, 80m, 160m, 320m, and 600m, reports API/token/rate-limit errors more specifically, prefers nearby panoramic captures, and initializes MapillaryJS without binding to a possibly-failing first image before calling `moveTo`.

## Deployment note

`VITE_MAPILLARY_ACCESS_TOKEN` must still be configured in the Vercel OS project's Production environment and the project redeployed. No database migration is required for this V5 pass.

## Validation performed

- Parsed all canonical `src` TypeScript/TSX source files with the TypeScript parser: 0 syntax errors.
- Checked local `@/` imports: 0 missing local imports.
- CSS structural brace check: balanced.
- ZIP integrity checked after packaging.
- A full Vite production build could not be run because the uploaded archive does not include installed dependencies and package installation did not complete within the execution window.
