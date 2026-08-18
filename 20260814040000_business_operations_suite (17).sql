-- North Splash Auto Luxe - Business Operations Suite
-- Adds recruiting, workforce scheduling, timesheets, sales, expenses,
-- inventory, editable pay structure, company valuation, and employee levels.

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS employment_level integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS pay_type text NOT NULL DEFAULT 'hourly',
  ADD COLUMN IF NOT EXISTS hourly_rate numeric NOT NULL DEFAULT 17,
  ADD COLUMN IF NOT EXISTS weekly_base numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS title text,
  ADD COLUMN IF NOT EXISTS start_date date,
  ADD COLUMN IF NOT EXISTS emergency_contact text,
  ADD COLUMN IF NOT EXISTS emergency_phone text;

ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS archived boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS public.recruiting_candidates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name text NOT NULL,
  email text,
  phone text,
  position text NOT NULL DEFAULT 'detailer',
  stage text NOT NULL DEFAULT 'applied',
  source text,
  expected_pay numeric,
  interview_date timestamptz,
  start_date date,
  background_status text NOT NULL DEFAULT 'not_started',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.employee_shifts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  shift_date date NOT NULL,
  start_time time,
  end_time time,
  status text NOT NULL DEFAULT 'scheduled',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.time_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  clock_in timestamptz NOT NULL,
  clock_out timestamptz,
  break_minutes integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'approved',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.sales_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid REFERENCES public.employees(id) ON DELETE SET NULL,
  appointment_id uuid REFERENCES public.appointments(id) ON DELETE SET NULL,
  customer_name text,
  service_name text NOT NULL,
  sale_amount numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'completed',
  sold_at timestamptz NOT NULL DEFAULT now(),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category text NOT NULL DEFAULT 'Other',
  description text NOT NULL,
  amount numeric NOT NULL DEFAULT 0,
  expense_date date NOT NULL DEFAULT CURRENT_DATE,
  recurring boolean NOT NULL DEFAULT false,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.inventory_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  category text NOT NULL DEFAULT 'Supplies',
  quantity numeric NOT NULL DEFAULT 0,
  reorder_level numeric NOT NULL DEFAULT 0,
  unit_cost numeric NOT NULL DEFAULT 0,
  supplier text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.pay_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role_key text NOT NULL,
  employment_level integer NOT NULL DEFAULT 1,
  label text NOT NULL,
  pay_type text NOT NULL DEFAULT 'hourly',
  hourly_rate numeric NOT NULL DEFAULT 0,
  weekly_base numeric NOT NULL DEFAULT 0,
  commission_rate numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(role_key, employment_level)
);

CREATE TABLE IF NOT EXISTS public.company_settings (
  id text PRIMARY KEY DEFAULT 'main',
  company_value numeric NOT NULL DEFAULT 0,
  valuation_note text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.pay_settings
  (role_key, employment_level, label, pay_type, hourly_rate, weekly_base, commission_rate)
VALUES
  ('detailer', 1, 'Detailer - Level 1', 'hourly', 17, 0, 0),
  ('detailer', 2, 'Detailer - Level 2', 'hourly', 18, 0, 0),
  ('detailer', 3, 'Detailer - Level 3', 'hourly', 19, 0, 0),
  ('manager', 1, 'Manager - Level 1', 'hourly', 22, 0, 0),
  ('manager', 2, 'Manager - Level 2', 'hourly', 24, 0, 0),
  ('manager', 3, 'Manager - Level 3', 'hourly', 26, 0, 0),
  ('d2d_agent', 1, 'D2D Sales - Level 1', 'base_commission', 0, 300, 10),
  ('d2d_agent', 2, 'D2D Sales - Level 2', 'base_commission', 0, 350, 12.5),
  ('d2d_agent', 3, 'D2D Sales - Level 3', 'base_commission', 0, 400, 15)
ON CONFLICT (role_key, employment_level) DO NOTHING;

INSERT INTO public.company_settings (id, company_value, valuation_note)
VALUES ('main', 0, 'Manual owner-entered company value')
ON CONFLICT (id) DO NOTHING;

-- Align existing Level 1 employees with the approved starting pay structure.
UPDATE public.employees SET pay_type='hourly', hourly_rate=17, weekly_base=0, commission_rate=0 WHERE role='detailer' AND employment_level=1;
UPDATE public.employees SET pay_type='hourly', hourly_rate=22, weekly_base=0, commission_rate=0 WHERE role='manager' AND employment_level=1;
UPDATE public.employees SET pay_type='base_commission', hourly_rate=0, weekly_base=300, commission_rate=10 WHERE role='d2d_agent' AND employment_level=1;

CREATE INDEX IF NOT EXISTS idx_recruiting_stage ON public.recruiting_candidates(stage);
CREATE INDEX IF NOT EXISTS idx_employee_shifts_date ON public.employee_shifts(shift_date);
CREATE INDEX IF NOT EXISTS idx_employee_shifts_employee ON public.employee_shifts(employee_id);
CREATE INDEX IF NOT EXISTS idx_time_entries_employee ON public.time_entries(employee_id);
CREATE INDEX IF NOT EXISTS idx_time_entries_clock_in ON public.time_entries(clock_in);
CREATE INDEX IF NOT EXISTS idx_sales_employee ON public.sales_records(employee_id);
CREATE INDEX IF NOT EXISTS idx_sales_sold_at ON public.sales_records(sold_at);
CREATE INDEX IF NOT EXISTS idx_expenses_date ON public.expenses(expense_date);
CREATE INDEX IF NOT EXISTS idx_inventory_name ON public.inventory_items(name);
CREATE INDEX IF NOT EXISTS idx_appointments_archived ON public.appointments(archived);

ALTER TABLE public.recruiting_candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.time_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pay_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_settings ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.recruiting_candidates TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.employee_shifts TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.time_entries TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.sales_records TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.expenses TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.inventory_items TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.pay_settings TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.company_settings TO authenticated;

DROP POLICY IF EXISTS "admin_all_recruiting_candidates" ON public.recruiting_candidates;
CREATE POLICY "admin_all_recruiting_candidates" ON public.recruiting_candidates
FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "admin_all_employee_shifts" ON public.employee_shifts;
CREATE POLICY "admin_all_employee_shifts" ON public.employee_shifts
FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "admin_all_time_entries" ON public.time_entries;
CREATE POLICY "admin_all_time_entries" ON public.time_entries
FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "admin_all_sales_records" ON public.sales_records;
CREATE POLICY "admin_all_sales_records" ON public.sales_records
FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "admin_all_expenses" ON public.expenses;
CREATE POLICY "admin_all_expenses" ON public.expenses
FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "admin_all_inventory_items" ON public.inventory_items;
CREATE POLICY "admin_all_inventory_items" ON public.inventory_items
FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "admin_all_pay_settings" ON public.pay_settings;
CREATE POLICY "admin_all_pay_settings" ON public.pay_settings
FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "admin_all_company_settings" ON public.company_settings;
CREATE POLICY "admin_all_company_settings" ON public.company_settings
FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
