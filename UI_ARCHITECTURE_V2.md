# North Splash OS — UI Architecture V2

This build changes the portal from a long expandable admin menu into a workspace-oriented application shell.

## Main navigation
The permanent Admin sidebar is now organized into seven workspaces:
- Home
- Sales
- Customers
- Operations
- People
- Finance
- Admin

The individual tools inside the selected workspace appear in a secondary navigation bar across the top. Existing page IDs and Supabase workflows are preserved.

Pinned links provide fast access to Command Center, Appointments, and Leads.

## Visual system
- denser CRM-style application canvas
- smaller headers so work appears sooner
- white/off-white work surfaces
- caramel used as a selected/accent state instead of giant form backgrounds
- compact KPI tiles
- cleaner data tables
- improved Kanban columns
- cleaner Customer 360 records
- cleaner Dispatch board
- cleaner Territory Command
- consistent inputs, buttons, empty states, status chips and spacing
- responsive tablet/mobile navigation

## What remains intact
No SQL schema changes are required for this UI release. Existing Supabase tables, authentication, communications, automations, territory data, Mapillary, D2D workflows and employee portals remain in place.

## Verification
- canonical src TypeScript/TSX files parsed with TypeScript compiler parser: 0 parser errors
- missing local imports: 0
- CSS brace balance: valid

Vercel production build remains the final dependency-aware compile check.
