-- ============================================================
-- InsForge Auth + RLS Migration
-- Links public.users to auth.users, adds owner_id scoping,
-- and enables Row Level Security on all tables.
-- ============================================================

-- ── Link public.users to InsForge auth.users ─────────────────────────────────
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS auth_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_users_auth_id ON public.users(auth_id);

-- ── Owner ID columns for multi-tenant scoping ────────────────────────────────
ALTER TABLE public.drivers  ADD COLUMN IF NOT EXISTS owner_id INTEGER REFERENCES public.users(id) ON DELETE CASCADE;
ALTER TABLE public.helpers  ADD COLUMN IF NOT EXISTS owner_id INTEGER REFERENCES public.users(id) ON DELETE CASCADE;
ALTER TABLE public.vehicles ADD COLUMN IF NOT EXISTS owner_id INTEGER REFERENCES public.users(id) ON DELETE CASCADE;
ALTER TABLE public.routes   ADD COLUMN IF NOT EXISTS owner_id INTEGER REFERENCES public.users(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_drivers_owner_id  ON public.drivers(owner_id);
CREATE INDEX IF NOT EXISTS idx_helpers_owner_id  ON public.helpers(owner_id);
CREATE INDEX IF NOT EXISTS idx_vehicles_owner_id ON public.vehicles(owner_id);
CREATE INDEX IF NOT EXISTS idx_routes_owner_id   ON public.routes(owner_id);

-- ── SECURITY DEFINER helpers (bypass RLS inside policies) ───────────────────
-- These run as the function owner (postgres), bypassing RLS on queried tables
-- to prevent infinite recursion between chained RLS policies.

CREATE OR REPLACE FUNCTION public.get_current_app_user_id()
RETURNS INTEGER AS $$
  SELECT id FROM public.users WHERE auth_id = (SELECT auth.uid()) LIMIT 1
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, auth;

CREATE OR REPLACE FUNCTION public.get_current_app_user_role()
RETURNS TEXT AS $$
  SELECT role FROM public.users WHERE auth_id = (SELECT auth.uid()) LIMIT 1
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, auth;

CREATE OR REPLACE FUNCTION public.current_user_driver_id()
RETURNS INTEGER AS $$
  SELECT d.id FROM public.drivers d
  JOIN public.users u ON u.id = d.user_id
  WHERE u.auth_id = (SELECT auth.uid())
  LIMIT 1
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, auth;

CREATE OR REPLACE FUNCTION public.current_user_owns_vehicle(vid INTEGER)
RETURNS BOOLEAN AS $$
  SELECT EXISTS(
    SELECT 1 FROM public.vehicles v
    JOIN public.users u ON u.id = v.owner_id
    WHERE v.id = vid AND u.auth_id = (SELECT auth.uid())
  )
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, auth;

CREATE OR REPLACE FUNCTION public.current_user_can_access_delivery(did INTEGER)
RETURNS BOOLEAN AS $$
  SELECT EXISTS(
    SELECT 1 FROM public.deliveries d
    JOIN public.users u ON u.id = d.assigned_by
    WHERE d.id = did AND u.auth_id = (SELECT auth.uid())
  ) OR EXISTS(
    SELECT 1 FROM public.deliveries d
    JOIN public.drivers dr ON dr.id = d.driver_id
    JOIN public.users u ON u.id = dr.user_id
    WHERE d.id = did AND u.auth_id = (SELECT auth.uid())
  )
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, auth;

-- ── GRANTS ───────────────────────────────────────────────────────────────────
GRANT USAGE ON SCHEMA public TO anon, authenticated;

-- ── users ────────────────────────────────────────────────────────────────────
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

GRANT SELECT, UPDATE ON public.users TO authenticated;

CREATE POLICY "users_own_row_select" ON public.users
  FOR SELECT TO authenticated
  USING (auth_id = (SELECT auth.uid()));

CREATE POLICY "users_own_row_update" ON public.users
  FOR UPDATE TO authenticated
  USING  (auth_id = (SELECT auth.uid()))
  WITH CHECK (auth_id = (SELECT auth.uid()));

-- ── drivers ──────────────────────────────────────────────────────────────────
ALTER TABLE public.drivers ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.drivers TO authenticated;

CREATE POLICY "drivers_owner_all" ON public.drivers
  FOR ALL TO authenticated
  USING     (owner_id = (SELECT public.get_current_app_user_id()))
  WITH CHECK (owner_id = (SELECT public.get_current_app_user_id()));

CREATE POLICY "drivers_self_select" ON public.drivers
  FOR SELECT TO authenticated
  USING (user_id = (SELECT public.get_current_app_user_id()));

-- ── helpers ──────────────────────────────────────────────────────────────────
ALTER TABLE public.helpers ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.helpers TO authenticated;

CREATE POLICY "helpers_owner_all" ON public.helpers
  FOR ALL TO authenticated
  USING     (owner_id = (SELECT public.get_current_app_user_id()))
  WITH CHECK (owner_id = (SELECT public.get_current_app_user_id()));

-- ── vehicles ─────────────────────────────────────────────────────────────────
ALTER TABLE public.vehicles ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.vehicles TO authenticated;

CREATE POLICY "vehicles_owner_all" ON public.vehicles
  FOR ALL TO authenticated
  USING     (owner_id = (SELECT public.get_current_app_user_id()))
  WITH CHECK (owner_id = (SELECT public.get_current_app_user_id()));

CREATE POLICY "vehicles_assigned_driver_select" ON public.vehicles
  FOR SELECT TO authenticated
  USING (assigned_driver_id = (SELECT public.current_user_driver_id()));

-- ── routes ───────────────────────────────────────────────────────────────────
ALTER TABLE public.routes ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.routes TO authenticated;

CREATE POLICY "routes_owner_all" ON public.routes
  FOR ALL TO authenticated
  USING     (owner_id = (SELECT public.get_current_app_user_id()))
  WITH CHECK (owner_id = (SELECT public.get_current_app_user_id()));

CREATE POLICY "routes_driver_select" ON public.routes
  FOR SELECT TO authenticated
  USING ((SELECT public.get_current_app_user_role()) = 'driver');

-- ── trip_rates ───────────────────────────────────────────────────────────────
ALTER TABLE public.trip_rates ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.trip_rates TO authenticated;

CREATE POLICY "trip_rates_owner_all" ON public.trip_rates
  FOR ALL TO authenticated
  USING     (created_by = (SELECT public.get_current_app_user_id()))
  WITH CHECK (created_by = (SELECT public.get_current_app_user_id()));

CREATE POLICY "trip_rates_driver_select" ON public.trip_rates
  FOR SELECT TO authenticated
  USING ((SELECT public.get_current_app_user_role()) = 'driver');

-- ── deliveries ───────────────────────────────────────────────────────────────
ALTER TABLE public.deliveries ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.deliveries TO authenticated;

CREATE POLICY "deliveries_owner_all" ON public.deliveries
  FOR ALL TO authenticated
  USING     (assigned_by = (SELECT public.get_current_app_user_id()))
  WITH CHECK (assigned_by = (SELECT public.get_current_app_user_id()));

CREATE POLICY "deliveries_driver_select" ON public.deliveries
  FOR SELECT TO authenticated
  USING (driver_id = (SELECT public.current_user_driver_id()));

CREATE POLICY "deliveries_driver_update" ON public.deliveries
  FOR UPDATE TO authenticated
  USING     (driver_id = (SELECT public.current_user_driver_id()))
  WITH CHECK (driver_id = (SELECT public.current_user_driver_id()));

-- ── delivery_tracking ────────────────────────────────────────────────────────
ALTER TABLE public.delivery_tracking ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT ON public.delivery_tracking TO authenticated;

CREATE POLICY "delivery_tracking_access" ON public.delivery_tracking
  FOR ALL TO authenticated
  USING     (public.current_user_can_access_delivery(delivery_id))
  WITH CHECK (public.current_user_can_access_delivery(delivery_id));

-- ── notifications ─────────────────────────────────────────────────────────────
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.notifications TO authenticated;

CREATE POLICY "notifications_own_user" ON public.notifications
  FOR ALL TO authenticated
  USING     (user_id = (SELECT public.get_current_app_user_id()))
  WITH CHECK (user_id = (SELECT public.get_current_app_user_id()));

-- ── reports ──────────────────────────────────────────────────────────────────
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT ON public.reports TO authenticated;

CREATE POLICY "reports_own_user" ON public.reports
  FOR ALL TO authenticated
  USING     (generated_by = (SELECT public.get_current_app_user_id()))
  WITH CHECK (generated_by = (SELECT public.get_current_app_user_id()));

-- ── vehicle_reports ───────────────────────────────────────────────────────────
ALTER TABLE public.vehicle_reports ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.vehicle_reports TO authenticated;

CREATE POLICY "vehicle_reports_submitter_all" ON public.vehicle_reports
  FOR ALL TO authenticated
  USING     (user_id = (SELECT public.get_current_app_user_id()))
  WITH CHECK (user_id = (SELECT public.get_current_app_user_id()));

CREATE POLICY "vehicle_reports_owner_select" ON public.vehicle_reports
  FOR SELECT TO authenticated
  USING (public.current_user_owns_vehicle(vehicle_id));

CREATE POLICY "vehicle_reports_owner_update" ON public.vehicle_reports
  FOR UPDATE TO authenticated
  USING     (public.current_user_owns_vehicle(vehicle_id))
  WITH CHECK (public.current_user_owns_vehicle(vehicle_id));

-- ── fuel_logs ─────────────────────────────────────────────────────────────────
ALTER TABLE public.fuel_logs ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.fuel_logs TO authenticated;

CREATE POLICY "fuel_logs_owner_all" ON public.fuel_logs
  FOR ALL TO authenticated
  USING     (public.current_user_owns_vehicle(vehicle_id))
  WITH CHECK (public.current_user_owns_vehicle(vehicle_id));

CREATE POLICY "fuel_logs_driver_select" ON public.fuel_logs
  FOR SELECT TO authenticated
  USING (driver_id = (SELECT public.current_user_driver_id()));

-- ── maintenance_records ───────────────────────────────────────────────────────
ALTER TABLE public.maintenance_records ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.maintenance_records TO authenticated;

CREATE POLICY "maintenance_owner_all" ON public.maintenance_records
  FOR ALL TO authenticated
  USING     (public.current_user_owns_vehicle(vehicle_id))
  WITH CHECK (public.current_user_owns_vehicle(vehicle_id));

CREATE POLICY "maintenance_driver_select" ON public.maintenance_records
  FOR SELECT TO authenticated
  USING (
    vehicle_id IN (
      SELECT v.id FROM public.vehicles v
      WHERE v.assigned_driver_id = (SELECT public.current_user_driver_id())
    )
  );

-- ── attendance_records ────────────────────────────────────────────────────────
ALTER TABLE public.attendance_records ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.attendance_records TO authenticated;

CREATE POLICY "attendance_own_user" ON public.attendance_records
  FOR ALL TO authenticated
  USING     (user_id = (SELECT public.get_current_app_user_id()))
  WITH CHECK (user_id = (SELECT public.get_current_app_user_id()));

CREATE POLICY "attendance_owner_select" ON public.attendance_records
  FOR SELECT TO authenticated
  USING (
    driver_id IN (
      SELECT id FROM public.drivers
      WHERE owner_id = (SELECT public.get_current_app_user_id())
    )
  );
