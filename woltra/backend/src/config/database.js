// Direct PostgreSQL connection to Supabase, with a mysql2-compatible shim.
// Existing controllers use pool.execute(sql, params) with `?` placeholders and
// destructure `[rows]`. We translate `?` -> `$n` and adapt the return shape so
// none of that code needs to change.
const { Pool } = require('pg');

const pgPool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

pgPool.on('error', (err) => {
  console.error('Unexpected error on idle PG client:', err.message);
});

// Convert mysql-style `?` placeholders to postgres `$1, $2, ...`
function toPgPlaceholders(sql) {
  let i = 0;
  return sql.replace(/\?/g, () => `$${++i}`);
}

const pool = {
  // mysql2-style: returns [rows, fields]; rows carries insertId + affectedRows
  execute: async function (sql, params = []) {
    const text = sql.includes('?') ? toPgPlaceholders(sql) : sql;
    const result = await pgPool.query(text, params);
    const rows = result.rows || [];
    const meta = Object.assign(Array.from(rows), {
      insertId: rows[0]?.id ?? null,
      affectedRows: result.rowCount ?? rows.length,
    });
    return [meta, result.fields || []];
  },

  // pg-style: returns { rows, rowCount }. Accepts `?` or `$n` placeholders.
  query: async function (sql, params = []) {
    const text = sql.includes('?') ? toPgPlaceholders(sql) : sql;
    return pgPool.query(text, params);
  },

  // Expose the raw pool for transactions/advanced use
  _pg: pgPool,
};

const dbHost = process.env.DATABASE_URL?.split('@')[1]?.split('/')[0] || 'Supabase';
console.log(`Database: Supabase PostgreSQL @ ${dbHost}`);

module.exports = pool;
