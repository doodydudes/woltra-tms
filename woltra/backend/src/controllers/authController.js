const pool = require('../config/database');

function generateDriverCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 8; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

// POST /auth/setup-profile
// Called once after InsForge signup to create the app-level user profile.
exports.setupProfile = async (req, res) => {
  const { role: reqRole, company_name, phone, license_number, license_expiry, name } = req.body;
  const role = reqRole === 'owner' ? 'owner' : 'driver';

  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Name is required' });
  }
  if (role === 'owner' && (!company_name || company_name.trim().length < 2)) {
    return res.status(400).json({ error: 'Company short name is required (2–10 chars)' });
  }

  try {
    const [existing] = await pool.execute(
      'SELECT id FROM users WHERE auth_id = ?',
      [req.authId]
    );
    if (existing.length) {
      // Already set up — return existing profile
      const [found] = await pool.execute(
        'SELECT id, name, email, role, phone, company_name, driver_code, is_active, created_at FROM users WHERE auth_id = ?',
        [req.authId]
      );
      return res.json({ user: found[0], message: 'Profile already exists' });
    }

    let userId;
    if (role === 'owner') {
      const shortName = company_name.trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10);
      const [result] = await pool.execute(
        'INSERT INTO users (auth_id, name, email, role, phone, company_name) VALUES (?, ?, ?, ?, ?, ?) RETURNING id',
        [req.authId, name.trim(), req.authEmail, 'owner', phone || null, shortName]
      );
      userId = result.insertId;
    } else {
      let driver_code;
      let codeExists = true;
      while (codeExists) {
        driver_code = generateDriverCode();
        const [[{ cnt }]] = await pool.execute(
          'SELECT COUNT(*)::int AS cnt FROM users WHERE driver_code = ?',
          [driver_code]
        );
        codeExists = cnt > 0;
      }
      const [result] = await pool.execute(
        'INSERT INTO users (auth_id, name, email, role, phone, driver_code) VALUES (?, ?, ?, ?, ?, ?) RETURNING id',
        [req.authId, name.trim(), req.authEmail, 'driver', phone || null, driver_code]
      );
      userId = result.insertId;

      const empId = `DRV-${userId}`;
      try {
        await pool.execute(
          `INSERT INTO drivers (user_id, employee_id, name, phone, email, license_number, license_expiry, status)
           VALUES (?, ?, ?, ?, ?, ?, ?, 'active')
           ON CONFLICT (employee_id) DO UPDATE SET name = EXCLUDED.name`,
          [userId, empId, name.trim(), phone || null, req.authEmail,
           license_number || null, license_expiry || null]
        );
      } catch (driverErr) {
        console.warn('Driver record creation failed:', driverErr.message);
      }
    }

    const [newUser] = await pool.execute(
      'SELECT id, name, email, role, phone, company_name, driver_code, is_active, created_at FROM users WHERE id = ?',
      [userId]
    );
    res.status(201).json({ user: newUser[0], message: 'Profile created' });
  } catch (err) {
    console.error('Setup profile error:', err);
    res.status(500).json({ error: 'Server error during profile setup' });
  }
};

// GET /auth/profile
exports.getProfile = async (req, res) => {
  try {
    const [rows] = await pool.execute(
      'SELECT id, name, email, role, phone, avatar, company_name, driver_code, is_active, last_login, created_at FROM users WHERE id = ?',
      [req.user.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'User not found' });
    const user = rows[0];

    if (user.role === 'driver') {
      if (!user.driver_code) {
        let driver_code;
        let codeExists = true;
        while (codeExists) {
          driver_code = generateDriverCode();
          const [[{ cnt }]] = await pool.execute('SELECT COUNT(*)::int AS cnt FROM users WHERE driver_code = ?', [driver_code]);
          codeExists = cnt > 0;
        }
        await pool.execute('UPDATE users SET driver_code = ? WHERE id = ?', [driver_code, user.id]);
        user.driver_code = driver_code;
      }
      try {
        const [driverRows] = await pool.execute(
          'SELECT license_number, license_expiry, address, emergency_contact, emergency_phone FROM drivers WHERE user_id = ?',
          [user.id]
        );
        if (driverRows.length) Object.assign(user, driverRows[0]);
      } catch (_) {}
    }

    await pool.execute('UPDATE users SET last_login = NOW() WHERE id = ?', [user.id]);
    res.json({ user });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
};

// PUT /auth/profile
exports.updateProfile = async (req, res) => {
  const { name, phone, company_name, license_number, license_expiry, address, emergency_contact, emergency_phone } = req.body;
  try {
    await pool.execute(
      'UPDATE users SET name = ?, phone = ?, company_name = ?, updated_at = NOW() WHERE id = ?',
      [name || req.user.name, phone || null, company_name !== undefined ? company_name : null, req.user.id]
    );
    if (req.user.role === 'driver') {
      await pool.execute(
        `UPDATE drivers SET name = ?, phone = ?, license_number = ?, license_expiry = ?,
         address = ?, emergency_contact = ?, emergency_phone = ?, updated_at = NOW()
         WHERE user_id = ?`,
        [name || req.user.name, phone || null, license_number || null,
         license_expiry || null, address || null, emergency_contact || null,
         emergency_phone || null, req.user.id]
      );
    }
    const [updated] = await pool.execute(
      'SELECT id, name, email, role, phone, avatar, company_name, driver_code, created_at FROM users WHERE id = ?',
      [req.user.id]
    );
    const user = updated[0];
    if (user.role === 'driver') {
      const [driverRows] = await pool.execute(
        'SELECT license_number, license_expiry, address, emergency_contact, emergency_phone FROM drivers WHERE user_id = ?',
        [user.id]
      );
      if (driverRows.length) Object.assign(user, driverRows[0]);
    }
    res.json({ user, message: 'Profile updated' });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
};
