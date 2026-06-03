// Direct PostgreSQL connection to Supabase
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
});

// Extract host from DATABASE_URL for logging
const dbHost = process.env.DATABASE_URL?.split('@')[1]?.split('/')[0] || 'Supabase';

console.log(`Database: Supabase PostgreSQL @ ${dbHost}`);

module.exports = pool;
