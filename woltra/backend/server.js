require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const path = require('path');
const bcrypt = require('bcryptjs');

const authRoutes = require('./src/routes/authRoutes');
const userRoutes = require('./src/routes/userRoutes');
const driverRoutes = require('./src/routes/driverRoutes');
const deliveryRoutes = require('./src/routes/deliveryRoutes');
const vehicleRoutes = require('./src/routes/vehicleRoutes');
const reportRoutes = require('./src/routes/reportRoutes');
const notificationRoutes = require('./src/routes/notificationRoutes');
const dashboardRoutes = require('./src/routes/dashboardRoutes');
const tripRateRoutes = require('./src/routes/tripRateRoutes');
const vehicleReportRoutes = require('./src/routes/vehicleReportRoutes');

const app = express();

// Run DB migrations for OAuth columns
const pool = require('./src/config/database');

// PostgreSQL: ADD COLUMN IF NOT EXISTS is idempotent — no need to query info_schema
async function addColIfMissing(table, column, definition) {
  try {
    await pool.query(`ALTER TABLE ${table} ADD COLUMN IF NOT EXISTS ${column} ${definition}`);
  } catch (_) {}
}

(async () => {
  // Supabase auth: link public.users to Supabase auth.users via UUID
  await addColIfMissing('users', 'auth_id', 'UUID');
  try { await pool.query('CREATE UNIQUE INDEX IF NOT EXISTS idx_users_auth_id ON users(auth_id)'); } catch (_) {}

  // Multi-tenant scoping: owner_id on fleet tables
  await addColIfMissing('drivers',  'owner_id', 'INTEGER');
  await addColIfMissing('helpers',  'owner_id', 'INTEGER');
  await addColIfMissing('vehicles', 'owner_id', 'INTEGER');
  await addColIfMissing('routes',   'owner_id', 'INTEGER');

  // Make password nullable for OAuth accounts (already nullable in new schema, safe to ignore)
  try { await pool.query(`ALTER TABLE users ALTER COLUMN password DROP NOT NULL`); } catch (_) {}

  // Ensure all columns exist (idempotent on PostgreSQL)
  await addColIfMissing('users', 'oauth_provider', 'VARCHAR(20)');
  await addColIfMissing('users', 'oauth_id', 'VARCHAR(100)');
  await addColIfMissing('users', 'company_name', 'VARCHAR(100)');
  await addColIfMissing('users', 'driver_code', 'VARCHAR(12)');
  await addColIfMissing('vehicles', 'assigned_driver_id', 'INTEGER');
  await addColIfMissing('vehicles', 'claim_code', 'VARCHAR(20)');
  await addColIfMissing('deliveries', 'replacement_driver_name', 'VARCHAR(255)');
  await addColIfMissing('deliveries', 'salary_approved', 'BOOLEAN DEFAULT FALSE');
  await addColIfMissing('deliveries', 'salary_approved_at', 'TIMESTAMP');
  await addColIfMissing('deliveries', 'salary_approved_by', 'INTEGER');
  await addColIfMissing('trip_rates', 'driver_rate', 'DECIMAL(10,2)');
  await addColIfMissing('trip_rates', 'helper_rate', 'DECIMAL(10,2)');
  // wheel_count: 0 = all types, 4/6/8/10/12/14/16 = specific truck type
  await addColIfMissing('trip_rates', 'wheel_count', 'INTEGER NOT NULL DEFAULT 0');
  // Replace old (province,city) unique with (province,city,wheel_count)
  try { await pool.query(`ALTER TABLE trip_rates DROP CONSTRAINT IF EXISTS trip_rates_province_city_key`); } catch (_) {}
  try { await pool.query(`ALTER TABLE trip_rates ADD CONSTRAINT trip_rates_province_city_wheel_key UNIQUE (province, city, wheel_count)`); } catch (_) {}
  await addColIfMissing('vehicles', 'wheel_count', 'INTEGER');

  // Fix deliveries status check to include all statuses the code uses
  try { await pool.query(`ALTER TABLE deliveries DROP CONSTRAINT IF EXISTS deliveries_status_check`); } catch (_) {}
  try { await pool.query(`ALTER TABLE deliveries ADD CONSTRAINT deliveries_status_check
    CHECK (status IN ('pending','in_transit','arrived_unloading','delivered','delayed','cancelled','returned'))`); } catch (_) {}

  // Make driver columns nullable for self-registered drivers
  try { await pool.query('ALTER TABLE drivers ALTER COLUMN phone DROP NOT NULL'); } catch (_) {}
  try { await pool.query('ALTER TABLE drivers ALTER COLUMN license_number DROP NOT NULL'); } catch (_) {}
  try { await pool.query('ALTER TABLE drivers ALTER COLUMN license_expiry DROP NOT NULL'); } catch (_) {}
  try { await pool.query('ALTER TABLE drivers ALTER COLUMN hire_date DROP NOT NULL'); } catch (_) {}

  await addColIfMissing('drivers', 'address', 'VARCHAR(255)');
  await addColIfMissing('drivers', 'emergency_contact', 'VARCHAR(100)');
  await addColIfMissing('drivers', 'emergency_phone', 'VARCHAR(30)');

  // Vehicle reports table (schema.sql handles creation; these are safety adds)
  await addColIfMissing('vehicle_reports', 'scheduled_date', 'DATE');
  await addColIfMissing('vehicle_reports', 'resolved_at', 'TIMESTAMP');
  await addColIfMissing('vehicle_reports', 'progress_photos', 'JSONB');
  await addColIfMissing('vehicle_reports', 'driver_progress_notes', 'TEXT');
  await addColIfMissing('vehicle_reports', 'driver_progress_at', 'TIMESTAMP');

  // ── Extended delivery fields used by the delivery controller (INSERT + list view)
  await addColIfMissing('deliveries', 'location', 'VARCHAR(255)');
  await addColIfMissing('deliveries', 'reject_return', "VARCHAR(50) DEFAULT 'none'");
  await addColIfMissing('deliveries', 'bo', 'INTEGER DEFAULT 0');
  await addColIfMissing('deliveries', 'number_of_bo_boxes', 'INTEGER DEFAULT 0');
  await addColIfMissing('deliveries', 'backlift', 'INTEGER DEFAULT 0');
  await addColIfMissing('deliveries', 'customer_signature', 'VARCHAR(500)');
  await addColIfMissing('deliveries', 'proof_uploaded', 'BOOLEAN DEFAULT FALSE');
  await addColIfMissing('deliveries', 'notes', 'TEXT');
  await addColIfMissing('deliveries', 'eta', 'VARCHAR(100)');
  await addColIfMissing('deliveries', 'actual_start_time', 'TIMESTAMP');
  await addColIfMissing('deliveries', 'assigned_by', 'INTEGER');

  // Driver + vehicle extended fields
  await addColIfMissing('drivers',  'notes', 'TEXT');
  await addColIfMissing('vehicles', 'last_maintenance_date', 'DATE');
  await addColIfMissing('vehicles', 'next_maintenance_date', 'DATE');
  await addColIfMissing('vehicles', 'notes', 'TEXT');
  await addColIfMissing('vehicles', 'make', 'VARCHAR(100)');
  await addColIfMissing('vehicles', 'model', 'VARCHAR(100)');
  await addColIfMissing('vehicles', 'year', 'INTEGER');
  await addColIfMissing('vehicles', 'capacity', 'DECIMAL(10,2)');
  await addColIfMissing('vehicles', 'capacity_unit', "VARCHAR(20) DEFAULT 'boxes'");
  await addColIfMissing('vehicles', 'fuel_type', "VARCHAR(20) DEFAULT 'diesel'");

  // ── Tables the controllers query but the base schema never created ──────────
  const createTable = async (sql) => { try { await pool.query(sql); } catch (e) { console.warn('createTable:', e.message); } };

  await createTable(`CREATE TABLE IF NOT EXISTS delivery_tracking (
    id           SERIAL PRIMARY KEY,
    delivery_id  INTEGER REFERENCES deliveries(id) ON DELETE CASCADE,
    status       VARCHAR(30) NOT NULL,
    notes        TEXT,
    recorded_by  INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at   TIMESTAMP NOT NULL DEFAULT NOW()
  )`);

  await createTable(`CREATE TABLE IF NOT EXISTS attendance_records (
    id         SERIAL PRIMARY KEY,
    user_id    INTEGER REFERENCES users(id) ON DELETE SET NULL,
    driver_id  INTEGER REFERENCES drivers(id) ON DELETE CASCADE,
    date       DATE NOT NULL,
    check_in   TIMESTAMP,
    check_out  TIMESTAMP,
    status     VARCHAR(20) DEFAULT 'present',
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
  )`);

  await createTable(`CREATE TABLE IF NOT EXISTS maintenance_records (
    id                    SERIAL PRIMARY KEY,
    vehicle_id            INTEGER REFERENCES vehicles(id) ON DELETE CASCADE,
    maintenance_type      VARCHAR(100),
    description           TEXT,
    cost                  DECIMAL(10,2),
    performed_by          VARCHAR(150),
    maintenance_date      DATE,
    next_maintenance_date DATE,
    status                VARCHAR(20) DEFAULT 'scheduled',
    created_at            TIMESTAMP NOT NULL DEFAULT NOW()
  )`);

  await createTable(`CREATE INDEX IF NOT EXISTS idx_delivery_tracking_delivery ON delivery_tracking(delivery_id)`);
  await createTable(`CREATE INDEX IF NOT EXISTS idx_attendance_driver ON attendance_records(driver_id)`);
  await createTable(`CREATE INDEX IF NOT EXISTS idx_maintenance_vehicle ON maintenance_records(vehicle_id)`);

  // Seed demo accounts if they don't exist
  const demoPassword = await bcrypt.hash('Admin123!', 10);

  const [[{ ownerexists }]] = await pool.execute(
    'SELECT COUNT(*)::int AS ownerexists FROM users WHERE email = $1', ['owner@trucking.com']
  );
  if (!ownerexists) {
    await pool.execute(
      `INSERT INTO users (name, email, password, role, is_active) VALUES (?, ?, ?, 'owner', TRUE)`,
      ['Demo Owner', 'owner@trucking.com', demoPassword]
    );
    console.log('Demo owner account created: owner@trucking.com / Admin123!');
  }

  const [[{ driverexists }]] = await pool.execute(
    'SELECT COUNT(*)::int AS driverexists FROM users WHERE email = $1', ['mike@trucking.com']
  );
  let mikeUserId;
  if (!driverexists) {
    let driver_code = '';
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    for (let i = 0; i < 8; i++) driver_code += chars[Math.floor(Math.random() * chars.length)];
    const [res] = await pool.execute(
      `INSERT INTO users (name, email, password, role, is_active, driver_code) VALUES (?, ?, ?, 'driver', TRUE, ?) RETURNING id`,
      ['Mike Santos', 'mike@trucking.com', demoPassword, driver_code]
    );
    mikeUserId = res.insertId;
    console.log('Demo driver account created: mike@trucking.com / Admin123!');
  } else {
    const [[mikeRow]] = await pool.execute('SELECT id FROM users WHERE email = ?', ['mike@trucking.com']);
    mikeUserId = mikeRow?.id;
  }

  if (mikeUserId) {
    const [[{ driversexists }]] = await pool.execute(
      'SELECT COUNT(*)::int AS driversexists FROM drivers WHERE user_id = ?', [mikeUserId]
    );
    if (!driversexists) {
      const empId = `DRV-${mikeUserId}`;
      await pool.execute(
        `INSERT INTO drivers (user_id, employee_id, name, email, status) VALUES (?, ?, ?, ?, 'active')`,
        [mikeUserId, empId, 'Mike Santos', 'mike@trucking.com']
      );
      console.log('Demo driver record created for mike@trucking.com');
    }
  }
})().catch(err => console.warn('Startup migration warning:', err.message));

// Security middleware
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' }
}));

// CORS
const allowedOrigins = [
  process.env.FRONTEND_URL,
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:4173',
].filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    // Allow any Vercel preview deployment
    if (/^https:\/\/.*\.vercel\.app$/.test(origin)) return callback(null, true);
    // Allow any localhost/127.0.0.1 port in development
    if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) {
      return callback(null, true);
    }
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Rate limiting — high limit for a small private system
const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 500,
  message: { error: 'Too many requests, please try again later.' }
});
app.use('/api/', limiter);

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Logging
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('dev'));
}

// File uploads go to Supabase Storage — no local static serving needed

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/drivers', driverRoutes);
app.use('/api/deliveries', deliveryRoutes);
app.use('/api/vehicles', vehicleRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/salary', tripRateRoutes);
app.use('/api/vehicle-reports', vehicleReportRoutes);

// Health check — also verifies DB connectivity
app.get('/api/health', async (req, res) => {
  let dbStatus = 'unknown';
  let dbError = null;
  try {
    await pool.query('SELECT 1');
    dbStatus = 'connected';
  } catch (err) {
    dbStatus = 'error';
    dbError = err.message;
  }
  const dbKeys = Object.keys(process.env).filter(k =>
    /db|pg|postgres|database|sql/i.test(k)
  );
  res.json({
    status: dbStatus === 'connected' ? 'OK' : 'DEGRADED',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    db: dbStatus,
    dbError,
    hasDbUrl: !!process.env.DATABASE_URL,
    dbRelatedKeys: dbKeys,
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({ error: 'File size too large. Maximum 5MB allowed.' });
  }
  res.status(err.status || 500).json({
    error: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message
  });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Trucking Management API running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`DATABASE_URL set: ${!!process.env.DATABASE_URL}`);
});

module.exports = app;
