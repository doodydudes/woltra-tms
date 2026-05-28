require('dotenv').config();
const pool = require('./src/config/database');

async function migrate() {
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS trip_rates (
      id INT AUTO_INCREMENT PRIMARY KEY,
      province VARCHAR(100) NOT NULL,
      city VARCHAR(100) NOT NULL,
      rate DECIMAL(10,2) NOT NULL DEFAULT 0.00,
      notes VARCHAR(255) NULL,
      created_by INT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY unique_location (province, city),
      INDEX idx_province (province)
    )
  `);
  console.log('trip_rates table ready');

  const cols = [
    ['delivery_province', 'VARCHAR(100) NULL'],
    ['delivery_city', 'VARCHAR(100) NULL'],
    ['trip_rate', 'DECIMAL(10,2) NULL'],
  ];
  for (const [col, def] of cols) {
    try {
      await pool.execute(`ALTER TABLE deliveries ADD COLUMN ${col} ${def}`);
      console.log('added', col);
    } catch (e) {
      if (e.code === 'ER_DUP_FIELDNAME') console.log(col, 'exists');
      else throw e;
    }
  }
  console.log('Migration done');
  process.exit(0);
}
migrate().catch(e => { console.error(e); process.exit(1); });
