#!/usr/bin/env node
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function runMigrations() {
  const migrationsDir = path.join(__dirname, 'migrations');
  const files = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql')).sort();

  console.log(`Found ${files.length} migration(s)\n`);

  for (const file of files) {
    const filePath = path.join(migrationsDir, file);
    const sql = fs.readFileSync(filePath, 'utf-8');

    console.log(`Running: ${file}`);
    try {
      await pool.query(sql);
      console.log(`✅ ${file} completed\n`);
    } catch (err) {
      // Ignore "already exists" errors
      if (err.message.includes('already exists')) {
        console.log(`⚠️  ${file} skipped (already exists)\n`);
      } else {
        console.error(`❌ ${file} failed:`, err.message);
        process.exit(1);
      }
    }
  }

  console.log('✅ All migrations completed!');
  await pool.end();
}

runMigrations().catch(err => {
  console.error('Migration error:', err);
  process.exit(1);
});
