require('dotenv').config();
const pool = require('./src/config/database');
async function migrate() {
  const cols = [
    ['loading_photo', 'VARCHAR(500) NULL'],
    ['arrival_time', 'DATETIME NULL'],
    ['unloading_photo', 'VARCHAR(500) NULL'],
    ['document_photos', 'TEXT NULL']
  ];
  for (const [col, def] of cols) {
    try {
      await pool.execute(`ALTER TABLE deliveries ADD COLUMN ${col} ${def}`);
      console.log('added', col);
    } catch(e) {
      if (e.code === 'ER_DUP_FIELDNAME') console.log(col, 'exists');
      else throw e;
    }
  }
  console.log('Migration done');
  process.exit(0);
}
migrate().catch(e => { console.error(e); process.exit(1); });
