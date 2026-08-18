-- North Splash Auto Luxe - Enterprise Operations Platform
-- Adds role-based portals, permissions, job assignment, CRM lead/territory tracking,
-- tasks, equipment, time-off, documents, notifications, audit logs and payroll approvals.

-- ---------------------------------------------------------------------------
-- PORTAL ACCESS + PERMISSIONS
-- ---------------------------------------------------------------------------
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS portal_role text NOT NULL DEFAULT 'customer',
  ADD COLUMN IF NOT EXISTS permissions jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

UPDATE public.profiles
SET portal_role = CASE
  WHEN role = 'admin' THEN 'owner'
  WHEN role IN ('employee','detailer','d2d_agent') THEN
    CASE WHEN role = 'd2d_agent' THEN 'd2d' ELSE 'employee' END
  ELSE 'customer'
END
WHERE portal_role = 'customer' AND role <> 'customer';

CREATE OR REPLACE FUNCTION public.has_permission(permission_key text)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT
      CASE
        WHEN p.role = 'admin' OR p.portal_role = 'owner' THEN true
        ELSE COALESCE((p.permissions ->> permission_key)::boolean, false)
      END
     FROM public.profiles p
     WHERE p.id = auth.uid()),
    false
  );
$$;

GRANT EXECUTE ON FUNCTION public.has_permission(text) TO authenticated;

-- ---------------------------------------------------------------------------
-- EMPLOYEE ACCOUNTS + JOB ASSIGNMENT
-- ---------------------------------------------------------------------------
ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS manager_employee_id uuid REFERENCES public.employees(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS department text,
  ADD COLUMN IF NOT EXISTS work_location text,
  ADD COLUMN IF NOT EXISTS pto_hours numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS training_status text NOT NULL DEFAULT 'not_started';

CREATE UNIQUE INDEX IF NOT EXISTS idx_employees_user_id_unique
ON public.employees(user_id)
WHERE user_id IS NOT NULL;

ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS assigned_employee_id uuid REFERENCES public.employees(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS assigned_manager_id uuid REFERENCES public.employees(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS sales_rep_employee_id uuid REFERENCES public.employees(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS estimated_duration_minutes integer,
  ADD COLUMN IF NOT EXISTS actual_duration_minutes integer,
  ADD COLUMN IF NOT EXISTS internal_notes text;

CREATE INDEX IF NOT EXISTS idx_appointments_assigned_employee ON public.appointments(assigned_employee_id);
CREATE INDEX IF NOT EXISTS idx_appointments_assigned_manager ON public.appointments(assigned_manager_id);
CREATE INDEX IF NOT EXISTS idx_appointments_sales_rep ON public.appointments(sales_rep_employee_id);

CREATE OR REPLACE FUNCTION public.current_employee_id()
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT id FROM public.employees WHERE user_id = auth.uid() LIMIT 1;
$$;
GRANT EXECUTE ON FUNCTION public.current_employee_id() TO authenticated;

-- ---------------------------------------------------------------------------
-- TERRITORIES + LEADS (FIELD SALES / D2D)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.lead_territories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  assigned_employee_id uuid REFERENCES public.employees(id) ON DELETE SET NULL,
  center_lat numeric,
  center_lng numeric,
  radius_meters integer NOT NULL DEFAULT 1200,
  status text NOT NULL DEFAULT 'active',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assigned_employee_id uuid REFERENCES public.employees(id) ON DELETE SET NULL,
  territory_id uuid REFERENCES public.lead_territories(id) ON DELETE SET NULL,
  customer_name text,
  address text,
  city text,
  state text DEFAULT 'NC',
  postal_code text,
  phone text,
  email text,
  latitude numeric,
  longitude numeric,
  status text NOT NULL DEFAULT 'new',
  source text NOT NULL DEFAULT 'd2d',
  service_interest text,
  vehicle_info text,
  estimated_value numeric NOT NULL DEFAULT 0,
  actual_sale_amount numeric NOT NULL DEFAULT 0,
  follow_up_at timestamptz,
  appointment_id uuid REFERENCES public.appointments(id) ON DELETE SET NULL,
  notes text,
  last_contacted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.lead_activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  employee_id uuid REFERENCES public.employees(id) ON DELETE SET NULL,
  activity_type text NOT NULL,
  previous_status text,
  new_status text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.rep_locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  latitude numeric NOT NULL,
  longitude numeric NOT NULL,
  accuracy_meters numeric,
  captured_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_leads_assigned_employee ON public.leads(assigned_employee_id);
CREATE INDEX IF NOT EXISTS idx_leads_status ON public.leads(status);
CREATE INDEX IF NOT EXISTS idx_leads_followup ON public.leads(follow_up_at);
CREATE INDEX IF NOT EXISTS idx_leads_territory ON public.leads(territory_id);
CREATE INDEX IF NOT EXISTS idx_lead_activity_lead ON public.lead_activities(lead_id);
CREATE INDEX IF NOT EXISTS idx_rep_locations_employee ON public.rep_locations(employee_id, captured_at DESC);

-- ---------------------------------------------------------------------------
-- TASKS, TIME OFF, EQUIPMENT, DOCUMENTS, NOTIFICATIONS, AUDIT
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.business_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  assigned_employee_id uuid REFERENCES public.employees(id) ON DELETE SET NULL,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL DEFAULT auth.uid(),
  related_appointment_id uuid REFERENCES public.appointments(id) ON DELETE SET NULL,
  priority text NOT NULL DEFAULT 'normal',
  status text NOT NULL DEFAULT 'open',
  due_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.time_off_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  start_date date NOT NULL,
  end_date date NOT NULL,
  request_type text NOT NULL DEFAULT 'unpaid',
  hours_requested numeric,
  reason text,
  status text NOT NULL DEFAULT 'pending',
  manager_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.equipment_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  category text NOT NULL DEFAULT 'Equipment',
  serial_number text,
  purchase_date date,
  purchase_cost numeric NOT NULL DEFAULT 0,
  assigned_employee_id uuid REFERENCES public.employees(id) ON DELETE SET NULL,
  condition text NOT NULL DEFAULT 'good',
  status text NOT NULL DEFAULT 'available',
  next_maintenance_at date,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.employee_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid REFERENCES public.employees(id) ON DELETE CASCADE,
  candidate_id uuid REFERENCES public.recruiting_candidates(id) ON DELETE CASCADE,
  document_type text NOT NULL DEFAULT 'other',
  title text NOT NULL,
  file_url text,
  expires_at date,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.business_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  target_user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  target_employee_id uuid REFERENCES public.employees(id) ON DELETE CASCADE,
  target_portal_role text,
  title text NOT NULL,
  message text NOT NULL,
  notification_type text NOT NULL DEFAULT 'info',
  link text,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL DEFAULT auth.uid(),
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id text,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.payroll_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  period_start date NOT NULL,
  period_end date NOT NULL,
  status text NOT NULL DEFAULT 'draft',
  gross_pay numeric NOT NULL DEFAULT 0,
  notes text,
  approved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  approved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_business_tasks_employee ON public.business_tasks(assigned_employee_id);
CREATE INDEX IF NOT EXISTS idx_business_tasks_due ON public.business_tasks(due_at);
CREATE INDEX IF NOT EXISTS idx_time_off_employee ON public.time_off_requests(employee_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON public.business_notifications(target_user_id, read_at);
CREATE INDEX IF NOT EXISTS idx_audit_created ON public.audit_logs(created_at DESC);

-- ---------------------------------------------------------------------------
-- ENHANCE EXISTING TABLES
-- ---------------------------------------------------------------------------
ALTER TABLE public.time_entries
  ADD COLUMN IF NOT EXISTS approved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS adjustment_reason text;

ALTER TABLE public.expenses
  ADD COLUMN IF NOT EXISTS vendor text,
  ADD COLUMN IF NOT EXISTS payment_method text,
  ADD COLUMN IF NOT EXISTS receipt_url text,
  ADD COLUMN IF NOT EXISTS employee_id uuid REFERENCES public.employees(id) ON DELETE SET NULL;

ALTER TABLE public.inventory_items
  ADD COLUMN IF NOT EXISTS sku text,
  ADD COLUMN IF NOT EXISTS storage_location text,
  ADD COLUMN IF NOT EXISTS last_purchased_at date;

ALTER TABLE public.recruiting_candidates
  ADD COLUMN IF NOT EXISTS desired_schedule text,
  ADD COLUMN IF NOT EXISTS interviewer text,
  ADD COLUMN IF NOT EXISTS candidate_rating integer,
  ADD COLUMN IF NOT EXISTS offer_amount numeric,
  ADD COLUMN IF NOT EXISTS offer_date date,
  ADD COLUMN IF NOT EXISTS resume_url text;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
ALTER TABLE public.lead_territories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rep_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.time_off_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.equipment_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payroll_runs ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.lead_territories TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.leads TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lead_activities TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.rep_locations TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.business_tasks TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.time_off_requests TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.equipment_assets TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.employee_documents TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.business_notifications TO authenticated;
GRANT SELECT, INSERT ON public.audit_logs TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payroll_runs TO authenticated;

-- Profiles: owner can administer portal access. Staff can still read themselves via existing policy.
DROP POLICY IF EXISTS "staff_read_profiles" ON public.profiles;
CREATE POLICY "staff_read_profiles" ON public.profiles
FOR SELECT TO authenticated
USING (public.has_permission('crm.view') OR public.has_permission('permissions.manage'));

DROP POLICY IF EXISTS "owner_update_profiles_permissions" ON public.profiles;
CREATE POLICY "owner_update_profiles_permissions" ON public.profiles
FOR UPDATE TO authenticated
USING (public.has_permission('permissions.manage'))
WITH CHECK (public.has_permission('permissions.manage'));

-- Appointments: operational staff can view/manage all, customers keep existing own-row policies.
DROP POLICY IF EXISTS "staff_select_appointments" ON public.appointments;
CREATE POLICY "staff_select_appointments" ON public.appointments
FOR SELECT TO authenticated USING (public.has_permission('appointments.view'));
DROP POLICY IF EXISTS "staff_update_appointments" ON public.appointments;
CREATE POLICY "staff_update_appointments" ON public.appointments
FOR UPDATE TO authenticated USING (public.has_permission('appointments.manage')) WITH CHECK (public.has_permission('appointments.manage'));

-- Employees
DROP POLICY IF EXISTS "staff_read_employees" ON public.employees;
CREATE POLICY "staff_read_employees" ON public.employees
FOR SELECT TO authenticated USING (
  public.has_permission('employees.view') OR user_id = auth.uid()
);
DROP POLICY IF EXISTS "staff_manage_employees" ON public.employees;
CREATE POLICY "staff_manage_employees" ON public.employees
FOR ALL TO authenticated USING (public.has_permission('employees.manage')) WITH CHECK (public.has_permission('employees.manage'));

-- Recruiting
DROP POLICY IF EXISTS "staff_recruiting" ON public.recruiting_candidates;
CREATE POLICY "staff_recruiting" ON public.recruiting_candidates
FOR ALL TO authenticated USING (public.has_permission('recruiting.manage')) WITH CHECK (public.has_permission('recruiting.manage'));

-- Employee shifts: employees see their own; scheduling staff manage all.
DROP POLICY IF EXISTS "staff_shifts_select" ON public.employee_shifts;
CREATE POLICY "staff_shifts_select" ON public.employee_shifts
FOR SELECT TO authenticated USING (
  employee_id = public.current_employee_id() OR public.has_permission('schedule.view') OR public.has_permission('schedule.manage')
);
DROP POLICY IF EXISTS "staff_shifts_manage" ON public.employee_shifts;
CREATE POLICY "staff_shifts_manage" ON public.employee_shifts
FOR ALL TO authenticated USING (public.has_permission('schedule.manage')) WITH CHECK (public.has_permission('schedule.manage'));

-- Time entries: own clock-in/out + manager approval.
DROP POLICY IF EXISTS "time_entries_self_select" ON public.time_entries;
CREATE POLICY "time_entries_self_select" ON public.time_entries
FOR SELECT TO authenticated USING (employee_id = public.current_employee_id() OR public.has_permission('timecards.view'));
DROP POLICY IF EXISTS "time_entries_self_insert" ON public.time_entries;
CREATE POLICY "time_entries_self_insert" ON public.time_entries
FOR INSERT TO authenticated WITH CHECK (employee_id = public.current_employee_id() OR public.has_permission('timecards.manage'));
DROP POLICY IF EXISTS "time_entries_self_update" ON public.time_entries;
CREATE POLICY "time_entries_self_update" ON public.time_entries
FOR UPDATE TO authenticated USING (employee_id = public.current_employee_id() OR public.has_permission('timecards.manage'))
WITH CHECK (employee_id = public.current_employee_id() OR public.has_permission('timecards.manage'));

-- Sales / leads
DROP POLICY IF EXISTS "sales_records_staff_select" ON public.sales_records;
CREATE POLICY "sales_records_staff_select" ON public.sales_records
FOR SELECT TO authenticated USING (employee_id = public.current_employee_id() OR public.has_permission('sales.view'));
DROP POLICY IF EXISTS "sales_records_staff_manage" ON public.sales_records;
CREATE POLICY "sales_records_staff_manage" ON public.sales_records
FOR ALL TO authenticated USING (employee_id = public.current_employee_id() OR public.has_permission('sales.manage'))
WITH CHECK (employee_id = public.current_employee_id() OR public.has_permission('sales.manage'));

DROP POLICY IF EXISTS "territories_staff_select" ON public.lead_territories;
CREATE POLICY "territories_staff_select" ON public.lead_territories
FOR SELECT TO authenticated USING (assigned_employee_id = public.current_employee_id() OR public.has_permission('leads.view_all') OR public.has_permission('territories.manage'));
DROP POLICY IF EXISTS "territories_staff_manage" ON public.lead_territories;
CREATE POLICY "territories_staff_manage" ON public.lead_territories
FOR ALL TO authenticated USING (public.has_permission('territories.manage')) WITH CHECK (public.has_permission('territories.manage'));

DROP POLICY IF EXISTS "leads_staff_select" ON public.leads;
CREATE POLICY "leads_staff_select" ON public.leads
FOR SELECT TO authenticated USING (assigned_employee_id = public.current_employee_id() OR public.has_permission('leads.view_all'));
DROP POLICY IF EXISTS "leads_staff_insert" ON public.leads;
CREATE POLICY "leads_staff_insert" ON public.leads
FOR INSERT TO authenticated WITH CHECK (assigned_employee_id = public.current_employee_id() OR public.has_permission('leads.manage'));
DROP POLICY IF EXISTS "leads_staff_update" ON public.leads;
CREATE POLICY "leads_staff_update" ON public.leads
FOR UPDATE TO authenticated USING (assigned_employee_id = public.current_employee_id() OR public.has_permission('leads.manage'))
WITH CHECK (assigned_employee_id = public.current_employee_id() OR public.has_permission('leads.manage'));

DROP POLICY IF EXISTS "lead_activities_staff" ON public.lead_activities;
CREATE POLICY "lead_activities_staff" ON public.lead_activities
FOR ALL TO authenticated USING (
  employee_id = public.current_employee_id() OR public.has_permission('leads.view_all') OR public.has_permission('leads.manage')
) WITH CHECK (employee_id = public.current_employee_id() OR public.has_permission('leads.manage'));

DROP POLICY IF EXISTS "rep_locations_staff" ON public.rep_locations;
CREATE POLICY "rep_locations_staff" ON public.rep_locations
FOR ALL TO authenticated USING (employee_id = public.current_employee_id() OR public.has_permission('leads.view_all'))
WITH CHECK (employee_id = public.current_employee_id() OR public.has_permission('leads.manage'));

-- Tasks
DROP POLICY IF EXISTS "tasks_staff_select" ON public.business_tasks;
CREATE POLICY "tasks_staff_select" ON public.business_tasks
FOR SELECT TO authenticated USING (assigned_employee_id = public.current_employee_id() OR public.has_permission('tasks.view_all'));
DROP POLICY IF EXISTS "tasks_staff_manage" ON public.business_tasks;
CREATE POLICY "tasks_staff_manage" ON public.business_tasks
FOR ALL TO authenticated USING (assigned_employee_id = public.current_employee_id() OR public.has_permission('tasks.manage'))
WITH CHECK (assigned_employee_id = public.current_employee_id() OR public.has_permission('tasks.manage'));

-- Time off
DROP POLICY IF EXISTS "time_off_staff_select" ON public.time_off_requests;
CREATE POLICY "time_off_staff_select" ON public.time_off_requests
FOR SELECT TO authenticated USING (employee_id = public.current_employee_id() OR public.has_permission('schedule.manage'));
DROP POLICY IF EXISTS "time_off_staff_insert" ON public.time_off_requests;
CREATE POLICY "time_off_staff_insert" ON public.time_off_requests
FOR INSERT TO authenticated WITH CHECK (employee_id = public.current_employee_id() OR public.has_permission('schedule.manage'));
DROP POLICY IF EXISTS "time_off_manager_update" ON public.time_off_requests;
CREATE POLICY "time_off_manager_update" ON public.time_off_requests
FOR UPDATE TO authenticated USING (public.has_permission('schedule.manage')) WITH CHECK (public.has_permission('schedule.manage'));

-- Inventory and equipment
DROP POLICY IF EXISTS "inventory_staff_select" ON public.inventory_items;
CREATE POLICY "inventory_staff_select" ON public.inventory_items
FOR SELECT TO authenticated USING (public.has_permission('inventory.view') OR public.has_permission('inventory.manage'));
DROP POLICY IF EXISTS "inventory_staff_manage" ON public.inventory_items;
CREATE POLICY "inventory_staff_manage" ON public.inventory_items
FOR ALL TO authenticated USING (public.has_permission('inventory.manage')) WITH CHECK (public.has_permission('inventory.manage'));

DROP POLICY IF EXISTS "equipment_staff_select" ON public.equipment_assets;
CREATE POLICY "equipment_staff_select" ON public.equipment_assets
FOR SELECT TO authenticated USING (assigned_employee_id = public.current_employee_id() OR public.has_permission('equipment.view'));
DROP POLICY IF EXISTS "equipment_staff_manage" ON public.equipment_assets;
CREATE POLICY "equipment_staff_manage" ON public.equipment_assets
FOR ALL TO authenticated USING (public.has_permission('equipment.manage')) WITH CHECK (public.has_permission('equipment.manage'));

-- Expenses / finance / payroll
DROP POLICY IF EXISTS "expenses_staff_select" ON public.expenses;
CREATE POLICY "expenses_staff_select" ON public.expenses
FOR SELECT TO authenticated USING (public.has_permission('finance.view'));
DROP POLICY IF EXISTS "expenses_staff_manage" ON public.expenses;
CREATE POLICY "expenses_staff_manage" ON public.expenses
FOR ALL TO authenticated USING (public.has_permission('finance.manage')) WITH CHECK (public.has_permission('finance.manage'));

DROP POLICY IF EXISTS "pay_settings_staff_select" ON public.pay_settings;
CREATE POLICY "pay_settings_staff_select" ON public.pay_settings
FOR SELECT TO authenticated USING (public.has_permission('pay.view'));
DROP POLICY IF EXISTS "pay_settings_staff_manage" ON public.pay_settings;
CREATE POLICY "pay_settings_staff_manage" ON public.pay_settings
FOR ALL TO authenticated USING (public.has_permission('pay.manage')) WITH CHECK (public.has_permission('pay.manage'));

DROP POLICY IF EXISTS "company_settings_staff" ON public.company_settings;
CREATE POLICY "company_settings_staff" ON public.company_settings
FOR ALL TO authenticated USING (public.has_permission('company_value.manage')) WITH CHECK (public.has_permission('company_value.manage'));

DROP POLICY IF EXISTS "payroll_runs_staff" ON public.payroll_runs;
CREATE POLICY "payroll_runs_staff" ON public.payroll_runs
FOR ALL TO authenticated USING (public.has_permission('payroll.approve')) WITH CHECK (public.has_permission('payroll.approve'));

-- Documents
DROP POLICY IF EXISTS "employee_documents_staff" ON public.employee_documents;
CREATE POLICY "employee_documents_staff" ON public.employee_documents
FOR ALL TO authenticated USING (
  public.has_permission('documents.manage') OR employee_id = public.current_employee_id()
) WITH CHECK (public.has_permission('documents.manage'));

-- Notifications
DROP POLICY IF EXISTS "notifications_select" ON public.business_notifications;
CREATE POLICY "notifications_select" ON public.business_notifications
FOR SELECT TO authenticated USING (
  target_user_id = auth.uid() OR target_employee_id = public.current_employee_id() OR
  target_portal_role = (SELECT portal_role FROM public.profiles WHERE id = auth.uid()) OR
  public.has_permission('notifications.manage')
);
DROP POLICY IF EXISTS "notifications_manage" ON public.business_notifications;
CREATE POLICY "notifications_manage" ON public.business_notifications
FOR ALL TO authenticated USING (
  target_user_id = auth.uid() OR target_employee_id = public.current_employee_id() OR public.has_permission('notifications.manage')
) WITH CHECK (public.has_permission('notifications.manage'));

-- Audit log: everyone can write their own audit event, owner/authorized managers can read.
DROP POLICY IF EXISTS "audit_insert" ON public.audit_logs;
CREATE POLICY "audit_insert" ON public.audit_logs
FOR INSERT TO authenticated WITH CHECK (actor_user_id = auth.uid());
DROP POLICY IF EXISTS "audit_select" ON public.audit_logs;
CREATE POLICY "audit_select" ON public.audit_logs
FOR SELECT TO authenticated USING (public.has_permission('audit.view'));

-- Ensure owner accounts have full access through portal role.
UPDATE public.profiles SET portal_role = 'owner' WHERE role = 'admin';

-- Default permission templates are applied by the Admin Permissions UI when assigning a portal.

-- Assigned staff can see jobs assigned to them without receiving full appointment-management permission.
DROP POLICY IF EXISTS "assigned_staff_select_appointments" ON public.appointments;
CREATE POLICY "assigned_staff_select_appointments" ON public.appointments
FOR SELECT TO authenticated USING (
  assigned_employee_id = public.current_employee_id()
  OR assigned_manager_id = public.current_employee_id()
  OR sales_rep_employee_id = public.current_employee_id()
);

-- Prevent customers/staff from escalating their own portal role or permissions through the generic profile update policy.
CREATE OR REPLACE FUNCTION public.protect_profile_security_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.id = auth.uid() AND NOT public.has_permission('permissions.manage') THEN
    NEW.role := OLD.role;
    NEW.portal_role := OLD.portal_role;
    NEW.permissions := OLD.permissions;
    NEW.is_active := OLD.is_active;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_profile_security_fields_trigger ON public.profiles;
CREATE TRIGGER protect_profile_security_fields_trigger
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.protect_profile_security_fields();

-- Employees can clock themselves in/out, but cannot self-approve payroll timecards.
CREATE OR REPLACE FUNCTION public.protect_timecard_approval_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_permission('timecards.manage') THEN
    IF TG_OP = 'INSERT' THEN
      NEW.status := 'pending';
      NEW.approved_by := NULL;
      NEW.approved_at := NULL;
    ELSE
      NEW.status := OLD.status;
      NEW.approved_by := OLD.approved_by;
      NEW.approved_at := OLD.approved_at;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS protect_timecard_approval_fields_trigger ON public.time_entries;
CREATE TRIGGER protect_timecard_approval_fields_trigger
BEFORE INSERT OR UPDATE ON public.time_entries
FOR EACH ROW EXECUTE FUNCTION public.protect_timecard_approval_fields();
