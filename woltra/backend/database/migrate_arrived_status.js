require('dotenv').config();
const mysql = require('mysql2/promise');

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
    console.log('Running migration: add arrived_unloading to delivery status ENUM...\n');

    await connection.query(`
      ALTER TABLE deliveries
      MODIFY COLUMN status ENUM('pending','in_transit','arrived_unloading','delivered','delayed','cancelled','returned') DEFAULT 'pending'
    `);
    console.log("✓ Added 'arrived_unloading' to deliveries.status ENUM");

    // Add phase columns if they don't exist yet
    const [[cols]] = await connection.query(`
      SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'deliveries'
      AND COLUMN_NAME IN ('loading_photo','unloading_photo','arrival_time','document_photos','helper_name','delivery_province','delivery_city','trip_rate')
    `);

    const existing = Array.isArray(cols) ? cols.map(r => r.COLUMN_NAME) : (cols ? [cols.COLUMN_NAME] : []);

    const toAdd = [
      { name: 'loading_photo',     sql: 'VARCHAR(500) NULL' },
      { name: 'unloading_photo',   sql: 'VARCHAR(500) NULL' },
      { name: 'arrival_time',      sql: 'DATETIME NULL' },
      { name: 'document_photos',   sql: 'JSON NULL' },
      { name: 'helper_name',       sql: 'VARCHAR(255) NULL' },
      { name: 'delivery_province', sql: 'VARCHAR(100) NULL' },
      { name: 'delivery_city',     sql: 'VARCHAR(100) NULL' },
      { name: 'trip_rate',         sql: 'DECIMAL(10,2) NULL' },
    ].filter(c => !existing.includes(c.name));

    for (const col of toAdd) {
      await connection.query(`ALTER TABLE deliveries ADD COLUMN ${col.name} ${col.sql}`);
      console.log(`✓ Added column deliveries.${col.name}`);
    }

    if (toAdd.length === 0) {
      console.log('✓ All phase columns already present');
    }

    console.log('\n✅ Migration complete!');
  } catch (err) {
    console.error('Migration error:', err.message);
    process.exit(1);
  } finally {
    await connection.end();
  }
}

migrate();
