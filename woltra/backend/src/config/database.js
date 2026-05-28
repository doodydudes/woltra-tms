const { Pool, types } = require('pg');

// Parse PostgreSQL bigint (returned by COUNT, etc.) as JS number instead of string
types.setTypeParser(20, val => parseInt(val, 10));

const pool = new Pool(
  process.env.DATABASE_URL
    ? {
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false },
        max: 10,
      }
    : {
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT) || 5432,
        user: process.env.DB_USER || 'postgres',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'postgres',
        ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
        max: 10,
      }
);

pool.connect()
  .then(client => {
    console.log('PostgreSQL (Supabase) connected successfully');
    client.release();
  })
  .catch(err => {
    console.error('Database connection failed:', err.message);
    process.exit(1);
  });

// mysql2 compatibility shim:
//   • Converts ? placeholders → $1..$N (PostgreSQL style)
//   • Returns [rows] where rows is an Array with insertId + affectedRows properties
//     so existing destructuring patterns [[{cnt}]], [rows], [result].insertId all still work
pool.execute = async function (sql, params = []) {
  let i = 0;
  const pgSql = sql.replace(/\?/g, () => `$${++i}`);
  const result = await this.query(pgSql, params);
  const rows = result.rows;
  const meta = Object.assign(Array.from(rows), {
    insertId: rows[0]?.id ?? null,
    affectedRows: result.rowCount,
  });
  return [meta, result.fields || []];
};

module.exports = pool;
