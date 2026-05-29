-- ============================================================
-- Woltra TMS — Full Schema (InsForge PostgreSQL)
-- ============================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- USERS
CREATE TABLE IF NOT EXISTS users (
    id             SERIAL PRIMARY KEY,
    name           VARCHAR(255) NOT NULL,
    email          VARCHAR(255) UNIQUE NOT NULL,
    password       VARCHAR(255),
    role           VARCHAR(10)  NOT NULL DEFAULT 'driver' CHECK (role IN ('owner', 'driver')),
    phone          VARCHAR(20),
    avatar         VARCHAR(500),
    oauth_provider VARCHAR(20),
    oauth_id       VARCHAR(100),
    company_name   VARCHAR(100),
    driver_code    VARCHAR(12),
    is_active      BOOLEAN DEFAULT TRUE,
    last_login     TIMESTAMP,
    created_at     TIMESTAMP DEFAULT NOW(),
    updated_at     TIMESTAMP DEFAULT NOW()
);
CREATE OR REPLACE TRIGGER users_updated_at
  BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- DRIVERS
CREATE TABLE IF NOT EXISTS drivers (
    id                SERIAL PRIMARY KEY,
    user_id           INTEGER REFERENCES users(id) ON DELETE SET NULL,
    employee_id       VARCHAR(50) UNIQUE NOT NULL,
    name              VARCHAR(255) NOT NULL,
    license_number    VARCHAR(100),
    license_expiry    DATE,
    phone             VARCHAR(20),
    email             VARCHAR(255),
    address           VARCHAR(255),
    status            VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'on_leave')),
    hire_date         DATE,
    emergency_contact VARCHAR(100),
    emergency_phone   VARCHAR(30),
    total_deliveries  INTEGER DEFAULT 0,
    notes             TEXT,
    created_at        TIMESTAMP DEFAULT NOW(),
    updated_at        TIMESTAMP DEFAULT NOW()
);
CREATE OR REPLACE TRIGGER drivers_updated_at
  BEFORE UPDATE ON drivers FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- HELPERS
CREATE TABLE IF NOT EXISTS helpers (
    id                SERIAL PRIMARY KEY,
    user_id           INTEGER REFERENCES users(id) ON DELETE SET NULL,
    employee_id       VARCHAR(50) UNIQUE NOT NULL,
    name              VARCHAR(255) NOT NULL,
    phone             VARCHAR(20),
    email             VARCHAR(255),
    address           TEXT,
    status            VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'on_leave')),
    hire_date         DATE,
    emergency_contact VARCHAR(255),
    emergency_phone   VARCHAR(20),
    notes             TEXT,
    created_at        TIMESTAMP DEFAULT NOW(),
    updated_at        TIMESTAMP DEFAULT NOW()
);
CREATE OR REPLACE TRIGGER helpers_updated_at
  BEFORE UPDATE ON helpers FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- VEHICLES
CREATE TABLE IF NOT EXISTS vehicles (
    id                    SERIAL PRIMARY KEY,
    truck_id              VARCHAR(50) UNIQUE NOT NULL,
    plate_number          VARCHAR(50) UNIQUE NOT NULL,
    make                  VARCHAR(100),
    model                 VARCHAR(100),
    year                  INTEGER,
    capacity              DECIMAL(10,2),
    capacity_unit         VARCHAR(10) DEFAULT 'boxes' CHECK (capacity_unit IN ('kg', 'tons', 'boxes')),
    status                VARCHAR(20) DEFAULT 'available' CHECK (status IN ('available', 'in_use', 'maintenance', 'retired')),
    fuel_type             VARCHAR(15) DEFAULT 'diesel' CHECK (fuel_type IN ('diesel', 'gasoline', 'electric', 'hybrid')),
    current_mileage       DECIMAL(10,2) DEFAULT 0,
    last_maintenance_date DATE,
    next_maintenance_date DATE,
    assigned_driver_id    INTEGER,
    claim_code            VARCHAR(20),
    wheel_count           INTEGER,
    notes                 TEXT,
    created_at            TIMESTAMP DEFAULT NOW(),
    updated_at            TIMESTAMP DEFAULT NOW()
);
CREATE OR REPLACE TRIGGER vehicles_updated_at
  BEFORE UPDATE ON vehicles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ROUTES
CREATE TABLE IF NOT EXISTS routes (
    id                 SERIAL PRIMARY KEY,
    name               VARCHAR(255) NOT NULL,
    origin             VARCHAR(255) NOT NULL,
    destination        VARCHAR(255) NOT NULL,
    distance           DECIMAL(10,2),
    estimated_duration INTEGER,
    waypoints          JSONB,
    notes              TEXT,
    is_active          BOOLEAN DEFAULT TRUE,
    created_at         TIMESTAMP DEFAULT NOW(),
    updated_at         TIMESTAMP DEFAULT NOW()
);
CREATE OR REPLACE TRIGGER routes_updated_at
  BEFORE UPDATE ON routes FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- DELIVERIES
CREATE TABLE IF NOT EXISTS deliveries (
    id                      SERIAL PRIMARY KEY,
    date                    DATE NOT NULL,
    gate_pass_number        VARCHAR(100),
    outlet                  VARCHAR(255) NOT NULL,
    location                TEXT,
    completed_delivery_time TIMESTAMP,
    reject_return           VARCHAR(15) DEFAULT 'none' CHECK (reject_return IN ('none', 'rejected', 'returned')),
    number_of_boxes         INTEGER DEFAULT 0,
    bo                      BOOLEAN DEFAULT FALSE,
    number_of_bo_boxes      INTEGER DEFAULT 0,
    backlift                BOOLEAN DEFAULT FALSE,
    driver_id               INTEGER REFERENCES drivers(id) ON DELETE SET NULL,
    helper_id               INTEGER REFERENCES helpers(id) ON DELETE SET NULL,
    helper_name             VARCHAR(255),
    vehicle_id              INTEGER REFERENCES vehicles(id) ON DELETE SET NULL,
    route_id                INTEGER REFERENCES routes(id) ON DELETE SET NULL,
    status                  VARCHAR(25) DEFAULT 'pending' CHECK (status IN ('pending','in_transit','arrived_unloading','delivered','delayed','cancelled','returned')),
    delivery_photo          VARCHAR(500),
    customer_signature      VARCHAR(500),
    proof_uploaded          BOOLEAN DEFAULT FALSE,
    assigned_by             INTEGER REFERENCES users(id) ON DELETE SET NULL,
    notes                   TEXT,
    eta                     TIMESTAMP,
    actual_start_time       TIMESTAMP,
    loading_photo           VARCHAR(500),
    unloading_photo         VARCHAR(500),
    arrival_time            TIMESTAMP,
    document_photos         JSONB,
    delivery_province       VARCHAR(100),
    delivery_city           VARCHAR(100),
    trip_rate               DECIMAL(10,2),
    replacement_driver_name VARCHAR(255),
    salary_approved         BOOLEAN DEFAULT FALSE,
    salary_approved_at      TIMESTAMP,
    salary_approved_by      INTEGER,
    created_at              TIMESTAMP DEFAULT NOW(),
    updated_at              TIMESTAMP DEFAULT NOW()
);
CREATE OR REPLACE TRIGGER deliveries_updated_at
  BEFORE UPDATE ON deliveries FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- DELIVERY TRACKING
CREATE TABLE IF NOT EXISTS delivery_tracking (
    id          SERIAL PRIMARY KEY,
    delivery_id INTEGER NOT NULL REFERENCES deliveries(id) ON DELETE CASCADE,
    status      VARCHAR(100) NOT NULL,
    location    VARCHAR(255),
    latitude    DECIMAL(10,8),
    longitude   DECIMAL(11,8),
    notes       TEXT,
    recorded_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at  TIMESTAMP DEFAULT NOW()
);

-- FUEL LOGS
CREATE TABLE IF NOT EXISTS fuel_logs (
    id              SERIAL PRIMARY KEY,
    vehicle_id      INTEGER NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
    driver_id       INTEGER REFERENCES drivers(id) ON DELETE SET NULL,
    fuel_amount     DECIMAL(10,2) NOT NULL,
    fuel_cost       DECIMAL(10,2),
    mileage_at_fill DECIMAL(10,2),
    fill_date       DATE NOT NULL,
    notes           TEXT,
    created_at      TIMESTAMP DEFAULT NOW()
);

-- MAINTENANCE RECORDS
CREATE TABLE IF NOT EXISTS maintenance_records (
    id                     SERIAL PRIMARY KEY,
    vehicle_id             INTEGER NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
    maintenance_type       VARCHAR(100) NOT NULL,
    description            TEXT,
    cost                   DECIMAL(10,2),
    performed_by           VARCHAR(255),
    maintenance_date       DATE NOT NULL,
    next_maintenance_date  DATE,
    mileage_at_maintenance DECIMAL(10,2),
    status                 VARCHAR(20) DEFAULT 'scheduled' CHECK (status IN ('scheduled','in_progress','completed','cancelled')),
    notes                  TEXT,
    created_at             TIMESTAMP DEFAULT NOW(),
    updated_at             TIMESTAMP DEFAULT NOW()
);
CREATE OR REPLACE TRIGGER maintenance_records_updated_at
  BEFORE UPDATE ON maintenance_records FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ATTENDANCE RECORDS
CREATE TABLE IF NOT EXISTS attendance_records (
    id         SERIAL PRIMARY KEY,
    user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    driver_id  INTEGER REFERENCES drivers(id) ON DELETE SET NULL,
    helper_id  INTEGER REFERENCES helpers(id) ON DELETE SET NULL,
    date       DATE NOT NULL,
    check_in   TIMESTAMP,
    check_out  TIMESTAMP,
    status     VARCHAR(15) DEFAULT 'present' CHECK (status IN ('present','absent','late','on_leave')),
    notes      TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- NOTIFICATIONS
CREATE TABLE IF NOT EXISTS notifications (
    id           SERIAL PRIMARY KEY,
    user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title        VARCHAR(255) NOT NULL,
    message      TEXT NOT NULL,
    type         VARCHAR(20) DEFAULT 'info' CHECK (type IN ('info','warning','error','success','delivery','maintenance')),
    is_read      BOOLEAN DEFAULT FALSE,
    related_id   INTEGER,
    related_type VARCHAR(50),
    created_at   TIMESTAMP DEFAULT NOW()
);

-- REPORTS
CREATE TABLE IF NOT EXISTS reports (
    id           SERIAL PRIMARY KEY,
    name         VARCHAR(255) NOT NULL,
    type         VARCHAR(20) NOT NULL CHECK (type IN ('daily','weekly','monthly','driver','delivery','bo','return','custom')),
    parameters   JSONB,
    generated_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    file_path    VARCHAR(500),
    created_at   TIMESTAMP DEFAULT NOW()
);

-- VEHICLE REPORTS
CREATE TABLE IF NOT EXISTS vehicle_reports (
    id                    SERIAL PRIMARY KEY,
    vehicle_id            INTEGER REFERENCES vehicles(id) ON DELETE SET NULL,
    driver_id             INTEGER REFERENCES drivers(id) ON DELETE SET NULL,
    user_id               INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type                  VARCHAR(50) DEFAULT 'other',
    title                 VARCHAR(200) NOT NULL,
    description           TEXT,
    location              VARCHAR(200),
    photos                JSONB,
    status                VARCHAR(30) DEFAULT 'pending',
    owner_notes           TEXT,
    scheduled_date        DATE,
    resolved_at           TIMESTAMP,
    progress_photos       JSONB,
    driver_progress_notes TEXT,
    driver_progress_at    TIMESTAMP,
    created_at            TIMESTAMP DEFAULT NOW(),
    updated_at            TIMESTAMP DEFAULT NOW()
);
CREATE OR REPLACE TRIGGER vehicle_reports_updated_at
  BEFORE UPDATE ON vehicle_reports FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- TRIP RATES
CREATE TABLE IF NOT EXISTS trip_rates (
    id          SERIAL PRIMARY KEY,
    province    VARCHAR(100) NOT NULL,
    city        VARCHAR(100) NOT NULL,
    rate        DECIMAL(10,2) NOT NULL,
    driver_rate DECIMAL(10,2),
    helper_rate DECIMAL(10,2),
    wheel_count INTEGER NOT NULL DEFAULT 0,
    notes       TEXT,
    created_by  INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at  TIMESTAMP DEFAULT NOW(),
    updated_at  TIMESTAMP DEFAULT NOW(),
    UNIQUE (province, city, wheel_count)
);
CREATE OR REPLACE TRIGGER trip_rates_updated_at
  BEFORE UPDATE ON trip_rates FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- INDEXES
CREATE INDEX IF NOT EXISTS idx_deliveries_date     ON deliveries(date);
CREATE INDEX IF NOT EXISTS idx_deliveries_status   ON deliveries(status);
CREATE INDEX IF NOT EXISTS idx_deliveries_driver   ON deliveries(driver_id);
CREATE INDEX IF NOT EXISTS idx_deliveries_helper   ON deliveries(helper_id);
CREATE INDEX IF NOT EXISTS idx_deliveries_vehicle  ON deliveries(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user  ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read  ON notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_attendance_date     ON attendance_records(date);
CREATE INDEX IF NOT EXISTS idx_fuel_logs_vehicle   ON fuel_logs(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_maintenance_vehicle ON maintenance_records(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_tracking_delivery   ON delivery_tracking(delivery_id);
