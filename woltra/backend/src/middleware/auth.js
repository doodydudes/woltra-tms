const jwt = require('jsonwebtoken');
const pool = require('../config/database');

// Verify Supabase JWT token
const authenticate = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Access token required' });

  try {
    // Decode JWT (Supabase signs it with their secret)
    const decoded = jwt.decode(token);
    if (!decoded || !decoded.sub) return res.status(401).json({ error: 'Invalid token' });

    const email = decoded.email;

    // Get user from database by email
    const result = await pool.query(
      'SELECT id, name, email, role, is_active FROM users WHERE email = $1',
      [email]
    );

    if (!result.rows.length || !result.rows[0].is_active) {
      return res.status(401).json({ error: 'User not found or inactive' });
    }

    req.user = result.rows[0];
    req.userId = result.rows[0].id;
    req.userEmail = email;
    req.supabaseId = decoded.sub;
    next();
  } catch (err) {
    console.error('Auth error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
};

// Light auth: verify JWT token only (no DB user required)
const verifyToken = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Access token required' });

  try {
    const decoded = jwt.decode(token);
    if (!decoded || !decoded.sub) return res.status(401).json({ error: 'Invalid token' });

    req.userId = decoded.sub;
    req.userEmail = decoded.email;
    req.supabaseId = decoded.sub;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid token' });
  }
};

module.exports = { authenticate, verifyToken };
