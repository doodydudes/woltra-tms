// Uses InsForge's raw SQL API instead of a direct PostgreSQL connection.
// This works from any hosting since it calls InsForge over HTTPS with the API key.
// No DATABASE_URL needed.

const INSFORGE_URL = process.env.INSFORGE_URL;
const INSFORGE_API_KEY = process.env.INSFORGE_API_KEY;

// Safely serialize a JS value into a SQL literal
function sqlLiteral(val) {
  if (val === null || val === undefined) return 'NULL';
  if (typeof val === 'boolean') return val ? 'TRUE' : 'FALSE';
  if (typeof val === 'number') return Number.isFinite(val) ? String(val) : 'NULL';
  // Escape single quotes and wrap in quotes
  return `'${String(val).replace(/'/g, "''")}'`;
}

// Replace ? and $N placeholders with serialized values
function buildSql(sql, params = []) {
  let i = 0;
  // Replace ? sequentially
  let result = sql.replace(/\?/g, () => sqlLiteral(params[i++]));
  // Replace $N (1-based) — used by server.js startup code
  result = result.replace(/\$(\d+)/g, (_, n) => sqlLiteral(params[parseInt(n, 10) - 1]));
  return result;
}

async function runSql(sql, params = []) {
  const query = buildSql(sql, params);
  const res = await fetch(`${INSFORGE_URL}/api/database/advance/rawsql`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${INSFORGE_API_KEY}`,
    },
    body: JSON.stringify({ query }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || err.error || `InsForge SQL API ${res.status}`);
  }

  const data = await res.json();
  return data.rows ?? data.data ?? [];
}

// Pool-compatible shim — keeps all existing controller code working unchanged
const pool = {
  // mysql2-style: returns [rows, fields] where rows has .insertId and .affectedRows
  execute: async function (sql, params = []) {
    const rows = await runSql(sql, params);
    const meta = Object.assign(Array.from(rows), {
      insertId: rows[0]?.id ?? null,
      affectedRows: rows.length,
    });
    return [meta, []];
  },

  // pg-style: returns { rows, rowCount }
  query: async function (sql, params = []) {
    const rows = await runSql(sql, params);
    return { rows, rowCount: rows.length };
  },
};

console.log(`Database: InsForge SQL API @ ${INSFORGE_URL}`);

module.exports = pool;
