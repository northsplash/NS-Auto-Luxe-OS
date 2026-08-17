# North Splash OS — Device Experience V4

This pass is designed around three operating modes:

- Desktop: full CRM workspace with a compact right-side canvass inspector.
- iPad/tablet: touch-first workspace with the sidebar converted to an overlay drawer and a larger map surface.
- Phone: one-thumb field workflow, bottom-sheet house marking, safe-area support, compact KPIs, card-based data rows and full-screen map support.

## D2D changes
- House markers remain individually clickable and expose desktop hover detail.
- Touch devices use tap instead of hover and increase marker target size.
- Desktop house detail no longer stretches across the top of the map; it is a compact right inspector.
- iPad portrait and phones use a bottom sheet.
- Save & Next remains sticky while marking doors.
- Fullscreen map uses dynamic viewport height and iOS safe-area offsets.

## Portal-wide responsive changes
- iPad sidebar becomes an overlay so content gets the full screen width.
- Tables collapse to readable cards on phones.
- Kanban/dispatch boards retain horizontal touch scrolling.
- Permission controls collapse cleanly on narrow screens.
- Forms become one-column on phones.
- Notch/home-indicator safe areas are respected.
- Background treatment uses subtle North Splash cream/bronze gradients rather than flat empty canvas.

The existing Vite environment variables and Supabase configuration are unchanged.
