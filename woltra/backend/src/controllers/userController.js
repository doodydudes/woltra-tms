const pool = require('../config/database');
const bcrypt = require('bcryptjs');

exports.getAll = async (req, res) => {
  const { page = 1, limit = 10, search = '', role = '' } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);

  try {
    let where = 'WHERE 1=1';
    const params = [];

    if (search) {
      where += ' AND (name LIKE ? OR email LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
    }
    if (role) {
      where += ' AND role = ?';
      params.push(role);
    }

    const [[{ total }]] = await pool.execute(
      `SELECT COUNT(*) AS total FROM users ${where}`,
      params
    );

    const [rows] = await pool.execute(
      `SELECT id, name, email, role, phone, avatar, oauth_provider, company_name,
              driver_code, is_active, last_login, created_at
       FROM users ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
      [...params, parseInt(limit), offset]
    );

    res.json({
      data: rows,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (err) {
    console.error('getAll users error:', err);
    res.status(500).json({ error: 'Server error' });
  }
};

exports.getById = async (req, res) => {
  try {
    const [rows] = await pool.execute(
      'SELECT id, name, email, role, phone, avatar, oauth_provider, company_name, driver_code, is_active, last_login, created_at FROM users WHERE id = ?',
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'User not found' });
    res.json({ user: rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
};

exports.create = async (req, res) => {
  const { name, email, password, role = 'driver', phone } = req.body;
  if (!name || !email || !password) {
    return res.status(400).json({ error: 'Name, email, and password are required' });
  }
  try {
    const [existing] = await pool.execute('SELECT id FROM users WHERE email = ?', [email.toLowerCase().trim()]);
    if (existing.length) return res.status(409).json({ error: 'Email already registered' });

    const hashed = await bcrypt.hash(password, 10);
    const [result] = await pool.execute(
      'INSERT INTO users (name, email, password, role, phone) VALUES (?, ?, ?, ?, ?)',
      [name.trim(), email.toLowerCase().trim(), hashed, role, phone || null]
    );
    const [newUser] = await pool.execute(
      'SELECT id, name, email, role, phone, is_active, created_at FROM users WHERE id = ?',
      [result.insertId]
    );
    res.status(201).json({ user: newUser[0] });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
};

exports.update = async (req, res) => {
  const { name, phone, role, is_active } = req.body;
  try {
    const [existing] = await pool.execute('SELECT id FROM users WHERE id = ?', [req.params.id]);
    if (!existing.length) return res.status(404).json({ error: 'User not found' });

    await pool.execute(
      'UPDATE users SET name = ?, phone = ?, role = ?, is_active = ?, updated_at = NOW() WHERE id = ?',
      [name, phone || null, role, is_active !== undefined ? is_active : true, req.params.id]
    );
    const [updated] = await pool.execute(
      'SELECT id, name, email, role, phone, avatar, oauth_provider, is_active, last_login, created_at FROM users WHERE id = ?',
      [req.params.id]
    );
    res.json({ user: updated[0] });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
};

exports.delete = async (req, res) => {
  try {
    const [existing] = await pool.execute('SELECT id FROM users WHERE id = ?', [req.params.id]);
    if (!existing.length) return res.status(404).json({ error: 'User not found' });
    if (parseInt(req.params.id) === req.user.id) {
      return res.status(400).json({ error: 'Cannot delete your own account' });
    }
    await pool.execute('DELETE FROM users WHERE id = ?', [req.params.id]);
    res.json({ message: 'User removed' });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
};

exports.resetPassword = async (req, res) => {
  const { newPassword } = req.body;
  if (!newPassword || newPassword.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters' });
  }
  try {
    const [existing] = await pool.execute('SELECT id FROM users WHERE id = ?', [req.params.id]);
    if (!existing.length) return res.status(404).json({ error: 'User not found' });

    const hashed = await bcrypt.hash(newPassword, 10);
    await pool.execute('UPDATE users SET password = ?, updated_at = NOW() WHERE id = ?', [hashed, req.params.id]);
    res.json({ message: 'Password reset successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
};
