/*
# North Splash Auto Luxe — Full Schema

## Overview
Creates the complete database schema for the North Splash Auto Luxe platform,
including customer profiles, subscriptions, appointments, payments, employee/agent
management, and site analytics.

## Tables Created

### profiles
Extends auth.users with display info and role-based access.
- id: matches auth.users id
- full_name, phone, email
- role: 'customer' | 'admin' | 'employee' | 'detailer' | 'd2d_agent'
- vehicle_info: customer's vehicle details

### subscriptions
Membership plans customers sign up for.
- plan_name, plan_price, status
- next_detail_date: when the next scheduled detail is
- billing_cycle_start: when the monthly cycle started

### appointments
Individual service bookings.
- user_id, service_name, package_name
- add_ons: array of selected add-ons
- vehicle_info, scheduled_at, status, price, notes
- assigned_detailer_id: which detailer handles it

### payments
Payment records tied to appointments or subscriptions.
- amount, payment_method, status
- metadata for lifetime value calculations

### employees
Staff directory for admin management.
- name, role (detailer/d2d_agent/manager), phone, email
- hire_date, status, commission_rate

### site_visits
Anonymous page view analytics for admin dashboard.
- page, referrer, session_id
- visited_at

## Security
- RLS enabled on all tables
- Customers see only their own data
- Admins bypass via service role key
- Anon can insert site_visits for analytics
*/

-- Profiles
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text,
  phone text,
  email text,
  role text NOT NULL DEFAULT 'customer',
  vehicle_info text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_profile" ON profiles;
CREATE POLICY "select_own_profile" ON profiles FOR SELECT
  TO authenticated USING (auth.uid() = id);

DROP POLICY IF EXISTS "insert_own_profile" ON profiles;
CREATE POLICY "insert_own_profile" ON profiles FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "update_own_profile" ON profiles;
CREATE POLICY "update_own_profile" ON profiles FOR UPDATE
  TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "admin_select_profiles" ON profiles;
CREATE POLICY "admin_select_profiles" ON profiles FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

-- Subscriptions
CREATE TABLE IF NOT EXISTS subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_name text NOT NULL,
  plan_price numeric NOT NULL,
  status text NOT NULL DEFAULT 'active',
  next_detail_date date,
  billing_cycle_start date DEFAULT CURRENT_DATE,
  cancelled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_subscriptions" ON subscriptions;
CREATE POLICY "select_own_subscriptions" ON subscriptions FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_subscriptions" ON subscriptions;
CREATE POLICY "insert_own_subscriptions" ON subscriptions FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_subscriptions" ON subscriptions;
CREATE POLICY "update_own_subscriptions" ON subscriptions FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_subscriptions" ON subscriptions;
CREATE POLICY "delete_own_subscriptions" ON subscriptions FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "admin_select_subscriptions" ON subscriptions;
CREATE POLICY "admin_select_subscriptions" ON subscriptions FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

-- Appointments
CREATE TABLE IF NOT EXISTS appointments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  service_name text NOT NULL,
  package_name text,
  add_ons text[] DEFAULT '{}',
  vehicle_info text,
  scheduled_at timestamptz,
  completed_at timestamptz,
  status text NOT NULL DEFAULT 'pending',
  price numeric NOT NULL DEFAULT 0,
  notes text,
  assigned_detailer_id uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_appointments" ON appointments;
CREATE POLICY "select_own_appointments" ON appointments FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_appointments" ON appointments;
CREATE POLICY "insert_own_appointments" ON appointments FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_appointments" ON appointments;
CREATE POLICY "update_own_appointments" ON appointments FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_appointments" ON appointments;
CREATE POLICY "delete_own_appointments" ON appointments FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "admin_all_appointments" ON appointments;
CREATE POLICY "admin_all_appointments" ON appointments FOR ALL
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

-- Payments
CREATE TABLE IF NOT EXISTS payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  appointment_id uuid REFERENCES appointments(id) ON DELETE SET NULL,
  subscription_id uuid REFERENCES subscriptions(id) ON DELETE SET NULL,
  amount numeric NOT NULL,
  payment_method text DEFAULT 'card',
  status text NOT NULL DEFAULT 'completed',
  description text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_payments" ON payments;
CREATE POLICY "select_own_payments" ON payments FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_payments" ON payments;
CREATE POLICY "insert_own_payments" ON payments FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "admin_all_payments" ON payments;
CREATE POLICY "admin_all_payments" ON payments FOR ALL
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

-- Employees
CREATE TABLE IF NOT EXISTS employees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  role text NOT NULL DEFAULT 'detailer',
  phone text,
  email text,
  hire_date date DEFAULT CURRENT_DATE,
  status text NOT NULL DEFAULT 'active',
  commission_rate numeric DEFAULT 0,
  jobs_completed integer DEFAULT 0,
  total_earnings numeric DEFAULT 0,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE employees ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_all_employees" ON employees;
CREATE POLICY "admin_all_employees" ON employees FOR ALL
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

-- Site visits (anonymous analytics)
CREATE TABLE IF NOT EXISTS site_visits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  page text NOT NULL DEFAULT '/',
  referrer text,
  session_id text,
  user_agent text,
  visited_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE site_visits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_insert_visits" ON site_visits;
CREATE POLICY "anon_insert_visits" ON site_visits FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "admin_select_visits" ON site_visits;
CREATE POLICY "admin_select_visits" ON site_visits FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_appointments_user_id ON appointments(user_id);
CREATE INDEX IF NOT EXISTS idx_appointments_status ON appointments(status);
CREATE INDEX IF NOT EXISTS idx_appointments_scheduled_at ON appointments(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_payments_user_id ON payments(user_id);
CREATE INDEX IF NOT EXISTS idx_payments_created_at ON payments(created_at);
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_site_visits_visited_at ON site_visits(visited_at);
CREATE INDEX IF NOT EXISTS idx_site_visits_page ON site_visits(page);

-- Trigger to auto-update profiles.updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS profiles_updated_at ON profiles;
CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
