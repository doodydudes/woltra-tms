require('dotenv').config();
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');

async function migrate() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'trucking_db',
    multipleStatements: true
  });

  try {
    console.log('Running migration: owner/driver roles only...\n');

    // 1. Delete old non-driver users first (must happen before ENUM change)
    await connection.query(`
      DELETE FROM users WHERE role IN ('admin', 'dispatcher', 'helper')
    `);
    console.log('✓ Removed old admin/dispatcher/helper login accounts');

    // 2. Now alter the ENUM (no conflicting rows remain)
    await connection.query(`
      ALTER TABLE users
      MODIFY COLUMN role ENUM('owner', 'driver') NOT NULL DEFAULT 'driver'
    `);
    console.log('✓ Updated role ENUM to (owner, driver)');

    // 3. Insert owner account (skip if already exists)
    const hash = await bcrypt.hash('Admin123!', 10);
    await connection.query(`
      INSERT IGNORE INTO users (name, email, password, role, phone)
      VALUES ('Business Owner', 'owner@trucking.com', ?, 'owner', '555-9000')
    `, [hash]);
    console.log('✓ Owner account ready: owner@trucking.com');

    // 4. Ensure Mike Santos driver account exists and is linked (user_id=2)
    const [ownerRows] = await connection.query(`SELECT id FROM users WHERE email = 'owner@trucking.com'`);
    const [mikeRows] = await connection.query(`SELECT id FROM users WHERE email = 'mike@trucking.com'`);

    if (!mikeRows.length) {
      await connection.query(`
        INSERT INTO users (name, email, password, role, phone)
        VALUES ('Mike Santos', 'mike@trucking.com', ?, 'driver', '555-0001')
      `, [hash]);
      console.log('✓ Driver account created: mike@trucking.com');
    } else {
      await connection.query(`UPDATE users SET role = 'driver' WHERE email = 'mike@trucking.com'`);
      console.log('✓ Driver account ready: mike@trucking.com');
    }

    // 5. Fix helper user_id to NULL (helpers are field staff, not login users)
    await connection.query(`UPDATE helpers SET user_id = NULL WHERE user_id IS NOT NULL`);
    console.log('✓ Helpers unlinked from login accounts');

    // 6. Link Mike Santos driver record to his user account
    const [mikeUser] = await connection.query(`SELECT id FROM users WHERE email = 'mike@trucking.com'`);
    if (mikeUser.length) {
      await connection.query(
        `UPDATE drivers SET user_id = ? WHERE email = 'mike@trucking.com'`,
        [mikeUser[0].id]
      );
      console.log('✓ Mike Santos driver record linked to login account');
    }

    // 7. Fix assigned_by references — set to owner's user id
    if (ownerRows.length) {
      await connection.query(
        `UPDATE deliveries SET assigned_by = ? WHERE assigned_by NOT IN (SELECT id FROM users)`,
        [ownerRows[0].id]
      );
      console.log('✓ Delivery assigned_by references fixed');
    }

    console.log('\n✅ Migration complete!\n');
    console.log('Login accounts (password: Admin123!):');
    console.log('  Owner:  owner@trucking.com');
    console.log('  Driver: mike@trucking.com');

  } catch (err) {
    console.error('Migration error:', err.message);
    process.exit(1);
  } finally {
    await connection.end();
  }
}

migrate();
