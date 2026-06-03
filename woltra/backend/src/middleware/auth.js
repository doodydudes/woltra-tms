const pool = require('../config/database');
const authService = require('../services/authService');

// Verify custom JWT token
const authenticate = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Access token required' });

  // Verify JWT token
  const decoded = authService.verifyJWT(token);
  if (!decoded) return res.status(401).json({ error: 'Invalid token' });

  try {
    // Get user from database
    const [rows] = await pool.execute(
      'SELECT id, name, email, role, is_active FROM users WHERE id = ?',
      [decoded.user_id]
    );

    if (!rows.length || !rows[0].is_active) {
      return res.status(401).json({ error: 'User not found or inactive' });
    }

    req.user = rows[0];
    req.userId = decoded.user_id;
    req.userEmail = decoded.email;
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

  const decoded = authService.verifyJWT(token);
  if (!decoded) return res.status(401).json({ error: 'Invalid token' });

  req.userId = decoded.user_id;
  req.userEmail = decoded.email;
  next();
};

module.exports = { authenticate, verifyToken };
