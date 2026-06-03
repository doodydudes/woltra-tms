const pool = require('../config/database');

exports.getAll = async (req, res) => {
  try {
    const { page = 1, limit = 10, search = '', status = '' } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    // Multi-tenant: an owner only sees drivers they have claimed (owner_id = their id)
    let where = 'WHERE d.owner_id = ?';
    const params = [req.user.id];

    if (search) {
      where += ' AND (d.name LIKE ? OR d.employee_id LIKE ? OR d.phone LIKE ? OR d.license_number LIKE ?)';
      params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
    }
    if (status) { where += ' AND d.status = ?'; params.push(status); }

    const [[{ total }]] = await pool.execute(
      `SELECT COUNT(*) as total FROM drivers d ${where}`, params
    );

    const [rows] = await pool.execute(
      `SELECT d.*,
        u.email as user_email,
        COUNT(del.id)::int as total_deliveries,
        COUNT(del.id) FILTER (WHERE del.status = 'delivered')::int as completed_deliveries
       FROM drivers d
       LEFT JOIN users u ON d.user_id = u.id
       LEFT JOIN deliveries del ON d.id = del.driver_id
       ${where}
       GROUP BY d.id, u.email
       ORDER BY d.created_at DESC
       LIMIT ${parseInt(limit)} OFFSET ${offset}`,
      params
    );

    res.json({
      data: rows,
      pagination: { total, page: parseInt(page), limit: parseInt(limit), totalPages: Math.ceil(total / parseInt(limit)) }
    });
  } catch (err) {
    console.error('Get drivers error:', err);
    res.status(500).json({ error: 'Failed to fetch drivers' });
  }
};

exports.getById = async (req, res) => {
  try {
    const [rows] = await pool.execute(
      `SELECT d.*, u.email as user_email FROM drivers d
       LEFT JOIN users u ON d.user_id = u.id WHERE d.id = ? AND d.owner_id = ?`,
      [req.params.id, req.user.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Driver not found' });

    const [deliveries] = await pool.execute(
      `SELECT id, date, gate_pass_number, outlet, status, number_of_boxes, created_at
       FROM deliveries WHERE driver_id = ? ORDER BY date DESC LIMIT 20`,
      [req.params.id]
    );

    const [[stats]] = await pool.execute(
      `SELECT
        COUNT(*)::int                                          AS total,
        COUNT(*) FILTER (WHERE status = 'delivered')::int     AS delivered,
        COUNT(*) FILTER (WHERE status = 'delayed')::int       AS delayed,
        COUNT(*) FILTER (WHERE status = 'returned')::int      AS returned,
        COALESCE(SUM(number_of_boxes), 0)                     AS total_boxes
       FROM deliveries WHERE driver_id = ?`,
      [req.params.id]
    );

    const [attendance] = await pool.execute(
      `SELECT * FROM attendance_records WHERE driver_id = ? ORDER BY date DESC LIMIT 30`,
      [req.params.id]
    );

    res.json({ driver: rows[0], deliveries, stats, attendance });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch driver' });
  }
};

exports.lookupByCode = async (req, res) => {
  const { code } = req.query;
  if (!code) return res.status(400).json({ error: 'code is required' });

  try {
    const [users] = await pool.execute(
      'SELECT id, name, email, phone, driver_code FROM users WHERE driver_code = ? AND role = ?',
      [code.toUpperCase().trim(), 'driver']
    );
    if (!users.length) return res.status(404).json({ error: 'No driver account found with that code' });

    const user = users[0];
    const [drivers] = await pool.execute('SELECT * FROM drivers WHERE user_id = ?', [user.id]);
    res.json({ user, driver: drivers[0] || null });
  } catch (err) {
    res.status(500).json({ error: 'Lookup failed' });
  }
};

exports.create = async (req, res) => {
  const { driver_code, employee_id, hire_date, notes } = req.body;

  if (!driver_code) {
    return res.status(400).json({ error: 'Driver account code is required' });
  }
  if (!employee_id) {
    return res.status(400).json({ error: 'Employee ID is required' });
  }

  try {
    // Find the user by driver_code
    const [users] = await pool.execute(
      'SELECT id FROM users WHERE driver_code = ? AND role = ?',
      [driver_code.toUpperCase().trim(), 'driver']
    );
    if (!users.length) return res.status(404).json({ error: 'No driver account found with that code' });
    const userId = users[0].id;

    // Check employee_id uniqueness
    const [empCheck] = await pool.execute(
      'SELECT id FROM drivers WHERE employee_id = ? AND user_id != ?',
      [employee_id, userId]
    );
    if (empCheck.length) return res.status(409).json({ error: 'Employee ID already in use' });

    // Update the driver record that was created at registration
    const [existing] = await pool.execute('SELECT id, owner_id FROM drivers WHERE user_id = ?', [userId]);
    if (existing.length) {
      // Reject if this driver is already claimed by a different owner
      if (existing[0].owner_id && existing[0].owner_id !== req.user.id) {
        return res.status(409).json({ error: 'This driver is already part of another fleet' });
      }
      await pool.execute(
        'UPDATE drivers SET employee_id = ?, hire_date = ?, notes = ?, owner_id = ?, updated_at = NOW() WHERE user_id = ?',
        [employee_id, hire_date || null, notes || null, req.user.id, userId]
      );
      const [updated] = await pool.execute('SELECT * FROM drivers WHERE user_id = ?', [userId]);
      return res.json({ driver: updated[0], message: 'Driver added to fleet' });
    }

    // Fallback: create record if somehow missing
    const [userInfo] = await pool.execute('SELECT name, email, phone FROM users WHERE id = ?', [userId]);
    const u = userInfo[0];
    const [result] = await pool.execute(
      `INSERT INTO drivers (user_id, owner_id, employee_id, name, phone, email, hire_date, notes, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active') RETURNING id`,
      [userId, req.user.id, employee_id, u.name, u.phone || null, u.email, hire_date || null, notes || null]
    );
    const [newDriver] = await pool.execute('SELECT * FROM drivers WHERE id = ?', [result.insertId]);
    res.status(201).json({ driver: newDriver[0], message: 'Driver added to fleet' });
  } catch (err) {
    console.error('Create driver error:', err);
    res.status(500).json({ error: 'Failed to add driver' });
  }
};

exports.update = async (req, res) => {
  const { id } = req.params;
  const { name, license_number, license_expiry, phone, email, address, hire_date, status, emergency_contact, emergency_phone, notes } = req.body;

  try {
    const [existing] = await pool.execute('SELECT * FROM drivers WHERE id = ? AND owner_id = ?', [id, req.user.id]);
    if (!existing.length) return res.status(404).json({ error: 'Driver not found' });

    await pool.execute(
      `UPDATE drivers SET name = ?, license_number = ?, license_expiry = ?, phone = ?,
       email = ?, address = ?, hire_date = ?, status = ?, emergency_contact = ?,
       emergency_phone = ?, notes = ?, updated_at = NOW() WHERE id = ?`,
      [
        name || existing[0].name, license_number || existing[0].license_number,
        license_expiry || existing[0].license_expiry, phone || existing[0].phone,
        email !== undefined ? email : existing[0].email,
        address !== undefined ? address : existing[0].address,
        hire_date !== undefined ? hire_date : existing[0].hire_date,
        status || existing[0].status,
        emergency_contact !== undefined ? emergency_contact : existing[0].emergency_contact,
        emergency_phone !== undefined ? emergency_phone : existing[0].emergency_phone,
        notes !== undefined ? notes : existing[0].notes, id
      ]
    );

    const [updated] = await pool.execute('SELECT * FROM drivers WHERE id = ?', [id]);
    res.json({ driver: updated[0], message: 'Driver updated successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update driver' });
  }
};

exports.delete = async (req, res) => {
  try {
    const [existing] = await pool.execute('SELECT id FROM drivers WHERE id = ? AND owner_id = ?', [req.params.id, req.user.id]);
    if (!existing.length) return res.status(404).json({ error: 'Driver not found' });
    await pool.execute('DELETE FROM drivers WHERE id = ? AND owner_id = ?', [req.params.id, req.user.id]);
    res.json({ message: 'Driver deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete driver' });
  }
};

exports.checkIn = async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const [driver] = await pool.execute('SELECT user_id FROM drivers WHERE id = ?', [req.params.id]);
    if (!driver.length) return res.status(404).json({ error: 'Driver not found' });

    const [existing] = await pool.execute(
      'SELECT id FROM attendance_records WHERE driver_id = ? AND date = ?',
      [req.params.id, today]
    );

    if (existing.length) {
      await pool.execute(
        'UPDATE attendance_records SET check_in = NOW() WHERE id = ?',
        [existing[0].id]
      );
    } else {
      await pool.execute(
        'INSERT INTO attendance_records (user_id, driver_id, date, check_in, status) VALUES (?, ?, ?, NOW(), ?)',
        [driver[0].user_id || req.user.id, req.params.id, today, 'present']
      );
    }

    res.json({ message: 'Check-in recorded successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to record check-in' });
  }
};

exports.checkOut = async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const [existing] = await pool.execute(
      'SELECT id FROM attendance_records WHERE driver_id = ? AND date = ?',
      [req.params.id, today]
    );

    if (!existing.length) return res.status(400).json({ error: 'No check-in found for today' });

    await pool.execute(
      'UPDATE attendance_records SET check_out = NOW() WHERE id = ?',
      [existing[0].id]
    );

    res.json({ message: 'Check-out recorded successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to record check-out' });
  }
};
