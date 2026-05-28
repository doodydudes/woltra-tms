require('dotenv').config();
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

async function setup() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    multipleStatements: true
  });

  try {
    console.log('Setting up database...');
    const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
    await connection.query(schema);
    console.log('Schema created.');

    const seed = fs.readFileSync(path.join(__dirname, 'seed.sql'), 'utf8');
    await connection.query(seed);
    console.log('Seed data inserted.');

    console.log('\nDatabase setup complete!');
    console.log('Default accounts (password: Admin123!):');
    console.log('  Owner:  owner@trucking.com');
    console.log('  Driver: mike@trucking.com');
  } catch (err) {
    console.error('Setup error:', err.message);
    process.exit(1);
  } finally {
    await connection.end();
  }
}

setup();
