const jwt = require('jsonwebtoken');
const pool = require('../config/database');

// Full auth: verify InsForge JWT + require public.users profile row
const authenticate = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Access token required' });

  try {
    const decoded = jwt.verify(token, process.env.INSFORGE_JWT_SECRET);
    if (!decoded.sub) return res.status(401).json({ error: 'Invalid token' });

    const [rows] = await pool.execute(
      'SELECT id, name, email, role, is_active FROM users WHERE auth_id = ?',
      [decoded.sub]
    );
    if (!rows.length || !rows[0].is_active) {
      return res.status(401).json({ error: 'Profile not found or inactive' });
    }

    req.user = rows[0];
    req.authId = decoded.sub;
    req.authEmail = decoded.email || '';
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired' });
    }
    return res.status(401).json({ error: 'Invalid token' });
  }
};

// Light auth: verify InsForge JWT only (for profile setup — no DB user required yet)
const verifyToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Access token required' });

  try {
    const decoded = jwt.verify(token, process.env.INSFORGE_JWT_SECRET);
    if (!decoded.sub) return res.status(401).json({ error: 'Invalid token' });
    req.authId = decoded.sub;
    req.authEmail = decoded.email || '';
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid token' });
  }
};

module.exports = { authenticate, verifyToken };
