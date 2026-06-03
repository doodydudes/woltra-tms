-- =============================================================
-- Woltra TMS — full schema + auth indexes
-- =============================================================

-- ── users ──────────────────────────────────────────────────────
CREATE TABLE users (
  id             SERIAL PRIMARY KEY,
  auth_id        UUID,
  name           VARCHAR(150)  NOT NULL,
  email          VARCHAR(255)  NOT NULL,
  password       VARCHAR(255),
  role           VARCHAR(20)   NOT NULL DEFAULT 'driver'
                   CHECK (role IN ('owner','driver')),
  phone          VARCHAR(30),
  company_name   VARCHAR(100),
  driver_code    VARCHAR(12),
  oauth_provider VARCHAR(20),
  oauth_id       VARCHAR(100),
  avatar         VARCHAR(500),
  is_active      BOOLEAN       NOT NULL DEFAULT TRUE,
  last_login     TIMESTAMP,
  created_at     TIMESTAMP     NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMP     NOT NULL DEFAULT NOW()
);

-- ── drivers ────────────────────────────────────────────────────
CREATE TABLE drivers (
  id                SERIAL PRIMARY KEY,
  user_id           INTEGER REFERENCES users(id) ON DELETE SET NULL,
  owner_id          INTEGER REFERENCES users(id) ON DELETE SET NULL,
  employee_id       VARCHAR(50) NOT NULL,
  name              VARCHAR(150) NOT NULL,
  phone             VARCHAR(30),
  email             VARCHAR(255),
  license_number    VARCHAR(50),
  license_expiry    DATE,
  hire_date         DATE,
  status            VARCHAR(20)  NOT NULL DEFAULT 'active'
                      CHECK (status IN ('active','inactive','suspended')),
  address           VARCHAR(255),
  emergency_contact VARCHAR(100),
  emergency_phone   VARCHAR(30),
  created_at        TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT drivers_employee_id_key UNIQUE (employee_id)
);

-- ── vehicles ───────────────────────────────────────────────────
CREATE TABLE vehicles (
  id                 SERIAL PRIMARY KEY,
  owner_id           INTEGER REFERENCES users(id) ON DELETE SET NULL,
  truck_id           VARCHAR(50) NOT NULL,
  plate_number       VARCHAR(30) NOT NULL,
  type               VARCHAR(100),
  wheel_count        INTEGER,
  status             VARCHAR(20) NOT NULL DEFAULT 'available'
                       CHECK (status IN ('available','in_use','maintenance','inactive')),
  assigned_driver_id INTEGER REFERENCES drivers(id) ON DELETE SET NULL,
  claim_code         VARCHAR(20),
  created_at         TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ── trip_rates ─────────────────────────────────────────────────
CREATE TABLE trip_rates (
  id          SERIAL PRIMARY KEY,
  province    VARCHAR(100)  NOT NULL,
  city        VARCHAR(100)  NOT NULL,
  wheel_count INTEGER       NOT NULL DEFAULT 0,
  rate        DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  driver_rate DECIMAL(10,2),
  helper_rate DECIMAL(10,2),
  notes       VARCHAR(255),
  created_by  INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at  TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT trip_rates_province_city_wheel_key UNIQUE (province, city, wheel_count)
);

-- ── deliveries ─────────────────────────────────────────────────
CREATE TABLE deliveries (
  id                      SERIAL PRIMARY KEY,
  driver_id               INTEGER REFERENCES drivers(id) ON DELETE SET NULL,
  vehicle_id              INTEGER REFERENCES vehicles(id) ON DELETE SET NULL,
  date                    DATE    NOT NULL,
  gate_pass_number        VARCHAR(100),
  outlet                  VARCHAR(255),
  number_of_boxes         INTEGER,
  status                  VARCHAR(30) NOT NULL DEFAULT 'pending'
                            CHECK (status IN ('pending','in_transit','arrived','delivered','cancelled')),
  loading_photo           VARCHAR(500),
  unloading_photo         VARCHAR(500),
  delivery_photo          VARCHAR(500),
  document_photos         JSONB,
  signature               VARCHAR(500),
  arrival_time            TIMESTAMP,
  completed_delivery_time TIMESTAMP,
  delivery_province       VARCHAR(100),
  delivery_city           VARCHAR(100),
  trip_rate               DECIMAL(10,2),
  helper_name             VARCHAR(150),
  helper_rate             DECIMAL(10,2),
  replacement_driver_name VARCHAR(255),
  main_driver_absent      BOOLEAN DEFAULT FALSE,
  salary_approved         BOOLEAN DEFAULT FALSE,
  salary_approved_at      TIMESTAMP,
  salary_approved_by      INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at              TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ── notifications ──────────────────────────────────────────────
CREATE TABLE notifications (
  id           SERIAL PRIMARY KEY,
  user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title        VARCHAR(255) NOT NULL,
  message      TEXT         NOT NULL,
  type         VARCHAR(30)  NOT NULL DEFAULT 'info'
                 CHECK (type IN ('info','warning','error','success')),
  is_read      BOOLEAN NOT NULL DEFAULT FALSE,
  related_id   INTEGER,
  related_type VARCHAR(50),
  created_at   TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ── vehicle_reports ────────────────────────────────────────────
CREATE TABLE vehicle_reports (
  id                    SERIAL PRIMARY KEY,
  vehicle_id            INTEGER REFERENCES vehicles(id) ON DELETE SET NULL,
  driver_id             INTEGER REFERENCES drivers(id) ON DELETE SET NULL,
  user_id               INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type                  VARCHAR(50) NOT NULL DEFAULT 'other',
  title                 VARCHAR(255) NOT NULL,
  description           TEXT,
  location              VARCHAR(255),
  photos                JSONB,
  status                VARCHAR(20) NOT NULL DEFAULT 'pending'
                          CHECK (status IN ('pending','in_progress','resolved')),
  owner_notes           TEXT,
  scheduled_date        DATE,
  resolved_at           TIMESTAMP,
  progress_photos       JSONB,
  driver_progress_notes TEXT,
  driver_progress_at    TIMESTAMP,
  created_at            TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ── routes ─────────────────────────────────────────────────────
CREATE TABLE routes (
  id          SERIAL PRIMARY KEY,
  owner_id    INTEGER REFERENCES users(id) ON DELETE CASCADE,
  name        VARCHAR(255) NOT NULL,
  description TEXT,
  created_at  TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMP NOT NULL DEFAULT NOW()
);


-- =============================================================
-- Indexes — auth lookup & query hot paths
-- =============================================================

-- Auth: InsForge JWT sub (UUID) -> app user row — called on every request
CREATE UNIQUE INDEX idx_users_auth_id ON users(auth_id);
-- Email uniqueness + login lookup
CREATE UNIQUE INDEX idx_users_email ON users(email);
-- driver_code is only set for driver-role accounts; sparse unique avoids collisions
CREATE UNIQUE INDEX idx_users_driver_code ON users(driver_code) WHERE driver_code IS NOT NULL;

-- Multi-tenant owner scoping (filter all fleet queries by owner)
CREATE INDEX idx_drivers_owner_id  ON drivers(owner_id);
CREATE INDEX idx_vehicles_owner_id ON vehicles(owner_id);
CREATE INDEX idx_routes_owner_id   ON routes(owner_id);

-- Driver <-> user join (profile load, salary lookups)
CREATE INDEX idx_drivers_user_id ON drivers(user_id);

-- Delivery query paths
CREATE INDEX idx_deliveries_driver_id  ON deliveries(driver_id);
CREATE INDEX idx_deliveries_vehicle_id ON deliveries(vehicle_id);
CREATE INDEX idx_deliveries_date       ON deliveries(date DESC);
CREATE INDEX idx_deliveries_status     ON deliveries(status);
-- Partial index: pending salary approvals (common owner dashboard query)
CREATE INDEX idx_deliveries_pending_salary
  ON deliveries(driver_id, date)
  WHERE salary_approved = FALSE AND status = 'delivered';
-- LATERAL JOIN target for rate lookups by location
CREATE INDEX idx_deliveries_location ON deliveries(delivery_province, delivery_city);

-- Trip rate LATERAL JOIN: match by city+province then sort by wheel_count specificity
CREATE INDEX idx_trip_rates_location ON trip_rates(city, province, wheel_count);

-- Notifications: unread badge count + list (most common read pattern)
CREATE INDEX idx_notifications_user_unread
  ON notifications(user_id, created_at DESC)
  WHERE is_read = FALSE;
CREATE INDEX idx_notifications_user_all
  ON notifications(user_id, created_at DESC);

-- Vehicle reports
CREATE INDEX idx_vehicle_reports_vehicle ON vehicle_reports(vehicle_id);
CREATE INDEX idx_vehicle_reports_user    ON vehicle_reports(user_id);
CREATE INDEX idx_vehicle_reports_status  ON vehicle_reports(status);
