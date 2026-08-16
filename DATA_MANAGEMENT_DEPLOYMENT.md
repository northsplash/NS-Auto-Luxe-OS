# Admin Data Management

This build adds a context-aware **Manage data** button to every Admin workspace.

## Required deployment step
Deploy the new Supabase Edge Function:

`supabase/functions/admin-data-manager/index.ts`

No SQL migration is required. The function uses the existing Supabase server credentials and verifies that the caller is an Admin/Owner.

## Safety
Financial, payroll, audit, timecard, subscription, and delivery-log records are read-only in Data Management. Other test records can be deleted by an Admin. Leads, territories, communication templates, and automation rules also support Archive/Disable.
