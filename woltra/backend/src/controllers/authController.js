const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const https = require('https');
const pool = require('../config/database');

function generateDriverCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 8; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

const generateToken = (user) => {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
  );
};

function httpsGet(url, headers = {}) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const options = {
      hostname: urlObj.hostname,
      path: urlObj.pathname + urlObj.search,
      method: 'GET',
      headers: { 'User-Agent': 'WoltraTMS/1.0', Accept: 'application/json', ...headers }
    };
    https.get(options, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, data: JSON.parse(data) }); }
        catch (e) { reject(new Error('Invalid JSON response')); }
      });
    }).on('error', reject);
  });
}

function httpsPost(url, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const postData = new URLSearchParams(body).toString();
    const options = {
      hostname: urlObj.hostname,
      path: urlObj.pathname + urlObj.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(postData),
        'User-Agent': 'WoltraTMS/1.0',
        Accept: 'application/json',
        ...headers
      }
    };
    const req = https.request(options, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, data: JSON.parse(data) }); }
        catch (e) { reject(new Error('Invalid JSON response')); }
      });
    });
    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

exports.login = async (req, res) => {
  const { email, password, role: expectedRole } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  try {
    const [users] = await pool.execute(
      'SELECT * FROM users WHERE email = ? AND is_active = TRUE',
      [email.toLowerCase().trim()]
    );

    if (!users.length) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const user = users[0];

    if (!user.password) {
      return res.status(401).json({ error: 'This account uses Google or GitHub sign-in. Please use the social login button.' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    if (expectedRole && user.role !== expectedRole) {
      return res.status(403).json({
        error: user.role === 'owner'
          ? 'This is an owner account. Please use the Owner tab to sign in.'
          : 'This is a driver account. Please use the Driver tab to sign in.',
      });
    }

    await pool.execute('UPDATE users SET last_login = NOW() WHERE id = ?', [user.id]);
    const token = generateToken(user);
    const { password: _, ...userWithoutPassword } = user;

    res.json({ token, user: userWithoutPassword, message: 'Login successful' });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Server error during login' });
  }
};

exports.register = async (req, res) => {
  const { name, email, password, phone, license_number, license_expiry, company_name, role: reqRole } = req.body;
  const role = reqRole === 'owner' ? 'owner' : 'driver';

  if (!name || !email || !password) {
    return res.status(400).json({ error: 'Name, email, and password are required' });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters' });
  }
  if (role === 'owner') {
    if (!company_name || company_name.trim().length < 2) {
      return res.status(400).json({ error: 'Short company name is required (2–10 characters)' });
    }
  }

  try {
    const [existing] = await pool.execute('SELECT id FROM users WHERE email = ?', [email.toLowerCase().trim()]);
    if (existing.length) {
      return res.status(409).json({ error: 'Email already registered' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    let userId;

    if (role === 'owner') {
      const shortName = company_name.trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10);
      const [result] = await pool.execute(
        'INSERT INTO users (name, email, password, role, phone, company_name) VALUES (?, ?, ?, ?, ?, ?) RETURNING id',
        [name.trim(), email.toLowerCase().trim(), hashedPassword, 'owner', phone || null, shortName]
      );
      userId = result.insertId;
    } else {
      // Generate a unique driver code
      let driver_code;
      let codeExists = true;
      while (codeExists) {
        driver_code = generateDriverCode();
        const [[{ cnt }]] = await pool.execute('SELECT COUNT(*)::int AS cnt FROM users WHERE driver_code = ?', [driver_code]);
        codeExists = cnt > 0;
      }

      const [result] = await pool.execute(
        'INSERT INTO users (name, email, password, role, phone, driver_code) VALUES (?, ?, ?, ?, ?, ?) RETURNING id',
        [name.trim(), email.toLowerCase().trim(), hashedPassword, 'driver', phone || null, driver_code]
      );
      userId = result.insertId;

      // Create the driver record so the owner can see their info when looking up by code
      const empId = `DRV-${userId}`;
      try {
        await pool.execute(
          `INSERT INTO drivers (user_id, employee_id, name, phone, email, license_number, license_expiry, status)
           VALUES (?, ?, ?, ?, ?, ?, ?, 'active')
           ON CONFLICT (employee_id) DO UPDATE SET name = EXCLUDED.name`,
          [userId, empId, name.trim(), phone || null, email.toLowerCase().trim(),
           license_number || null, license_expiry || null]
        );
      } catch (driverErr) {
        console.warn('Driver record creation skipped (will be created on vehicle claim):', driverErr.message);
      }
    }

    const [newUser] = await pool.execute(
      'SELECT id, name, email, role, phone, company_name, driver_code, is_active, created_at FROM users WHERE id = ?',
      [userId]
    );

    const token = generateToken(newUser[0]);
    res.status(201).json({ token, user: newUser[0], message: 'Account created successfully' });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ error: 'Server error during registration' });
  }
};

exports.googleAuth = async (req, res) => {
  const { credential, role: reqRole, company_name } = req.body;
  const role = reqRole === 'owner' ? 'owner' : 'driver';
  if (!credential) return res.status(400).json({ error: 'Google credential is required' });

  try {
    const { status, data } = await httpsGet(
      `https://oauth2.googleapis.com/tokeninfo?id_token=${credential}`
    );

    if (status !== 200 || data.error) {
      return res.status(401).json({ error: 'Invalid Google credential' });
    }

    const clientId = process.env.GOOGLE_CLIENT_ID;
    if (clientId && data.aud !== clientId) {
      return res.status(401).json({ error: 'Google credential audience mismatch' });
    }

    const { sub: oauthId, email, name, picture } = data;
    if (!email) return res.status(400).json({ error: 'Google account has no email' });

    await pool.execute(
      `UPDATE users SET oauth_provider = 'google', oauth_id = ?, last_login = NOW(), avatar = COALESCE(avatar, ?) WHERE email = ?`,
      [oauthId, picture || null, email.toLowerCase()]
    );

    let [users] = await pool.execute('SELECT * FROM users WHERE email = ?', [email.toLowerCase()]);

    if (!users.length) {
      let newUserId;
      if (role === 'owner') {
        const shortName = company_name
          ? company_name.trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10)
          : (name || '').toUpperCase().replace(/[^A-Z0-9\s]/g, '').split(' ').map(w => w[0]).join('').slice(0, 8) || 'FLEET';
        const [result] = await pool.execute(
          'INSERT INTO users (name, email, password, role, oauth_provider, oauth_id, avatar, company_name) VALUES (?, ?, NULL, ?, ?, ?, ?, ?) RETURNING id',
          [name || email.split('@')[0], email.toLowerCase(), 'owner', 'google', oauthId, picture || null, shortName]
        );
        newUserId = result.insertId;
      } else {
        let driver_code;
        let codeExists = true;
        while (codeExists) {
          driver_code = generateDriverCode();
          const [[{ cnt }]] = await pool.execute('SELECT COUNT(*)::int AS cnt FROM users WHERE driver_code = ?', [driver_code]);
          codeExists = cnt > 0;
        }
        const [result] = await pool.execute(
          'INSERT INTO users (name, email, password, role, oauth_provider, oauth_id, avatar, driver_code) VALUES (?, ?, NULL, ?, ?, ?, ?, ?) RETURNING id',
          [name || email.split('@')[0], email.toLowerCase(), 'driver', 'google', oauthId, picture || null, driver_code]
        );
        newUserId = result.insertId;
        const empId = `DRV-${newUserId}`;
        try {
          await pool.execute(
            `INSERT INTO drivers (user_id, employee_id, name, email, status)
             VALUES (?, ?, ?, ?, 'active')
             ON CONFLICT (employee_id) DO UPDATE SET name = EXCLUDED.name`,
            [newUserId, empId, name || email.split('@')[0], email.toLowerCase()]
          );
        } catch (driverErr) {
          console.warn('Driver record creation skipped:', driverErr.message);
        }
      }
      [users] = await pool.execute('SELECT * FROM users WHERE id = ?', [newUserId]);
    }

    const user = users[0];
    if (!user.is_active) return res.status(403).json({ error: 'Account is disabled' });

    if (user.role !== role) {
      const correctTab = user.role === 'owner' ? 'Owner' : 'Driver';
      return res.status(403).json({
        error: `This Google account is registered as a ${user.role}. Please select the "${correctTab}" tab to sign in.`
      });
    }

    const token = generateToken(user);
    const { password: _, ...userWithoutPassword } = user;
    res.json({ token, user: userWithoutPassword, message: 'Google sign-in successful' });
  } catch (err) {
    console.error('Google auth error:', err);
    res.status(500).json({ error: 'Google authentication failed' });
  }
};

exports.githubAuth = async (req, res) => {
  const { code } = req.body;
  if (!code) return res.status(400).json({ error: 'GitHub code is required' });

  const clientId = process.env.GITHUB_CLIENT_ID;
  const clientSecret = process.env.GITHUB_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return res.status(503).json({ error: 'GitHub OAuth is not configured on this server' });
  }

  try {
    const tokenRes = await httpsPost(
      'https://github.com/login/oauth/access_token',
      { client_id: clientId, client_secret: clientSecret, code }
    );

    const accessToken = tokenRes.data?.access_token;
    if (!accessToken) {
      return res.status(401).json({ error: tokenRes.data?.error_description || 'Failed to get GitHub access token' });
    }

    const [userRes, emailRes] = await Promise.all([
      httpsGet('https://api.github.com/user', { Authorization: `token ${accessToken}` }),
      httpsGet('https://api.github.com/user/emails', { Authorization: `token ${accessToken}` })
    ]);

    const ghUser = userRes.data;
    const emails = Array.isArray(emailRes.data) ? emailRes.data : [];
    const primaryEmail = (emails.find(e => e.primary && e.verified) || emails.find(e => e.verified) || emails[0])?.email
      || ghUser.email;

    if (!primaryEmail) return res.status(400).json({ error: 'GitHub account has no accessible email' });

    const oauthId = String(ghUser.id);
    const name = ghUser.name || ghUser.login || primaryEmail.split('@')[0];
    const avatar = ghUser.avatar_url || null;

    await pool.execute(
      `UPDATE users SET oauth_provider = 'github', oauth_id = ?, last_login = NOW(), avatar = COALESCE(avatar, ?) WHERE email = ?`,
      [oauthId, avatar, primaryEmail.toLowerCase()]
    );

    let [users] = await pool.execute('SELECT * FROM users WHERE email = ?', [primaryEmail.toLowerCase()]);

    if (!users.length) {
      const [result] = await pool.execute(
        'INSERT INTO users (name, email, password, role, oauth_provider, oauth_id, avatar) VALUES (?, ?, NULL, ?, ?, ?, ?) RETURNING id',
        [name, primaryEmail.toLowerCase(), 'driver', 'github', oauthId, avatar]
      );
      [users] = await pool.execute('SELECT * FROM users WHERE id = ?', [result.insertId]);
    }

    const user = users[0];
    if (!user.is_active) return res.status(403).json({ error: 'Account is disabled' });

    const token = generateToken(user);
    const { password: _, ...userWithoutPassword } = user;
    res.json({ token, user: userWithoutPassword, message: 'GitHub sign-in successful' });
  } catch (err) {
    console.error('GitHub auth error:', err);
    res.status(500).json({ error: 'GitHub authentication failed' });
  }
};

exports.getProfile = async (req, res) => {
  try {
    const [rows] = await pool.execute(
      'SELECT id, name, email, role, phone, avatar, company_name, driver_code, is_active, last_login, created_at FROM users WHERE id = ?',
      [req.user.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'User not found' });
    const user = rows[0];

    if (user.role === 'driver') {
      // Auto-generate driver_code if missing (legacy accounts)
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

    res.json({ user });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
};

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

exports.changePassword = async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: 'Current and new passwords are required' });
  }
  if (newPassword.length < 8) {
    return res.status(400).json({ error: 'New password must be at least 8 characters' });
  }

  try {
    const [users] = await pool.execute('SELECT password FROM users WHERE id = ?', [req.user.id]);
    if (!users[0].password) {
      return res.status(400).json({ error: 'This account uses social login and has no password to change' });
    }
    const isMatch = await bcrypt.compare(currentPassword, users[0].password);
    if (!isMatch) return res.status(400).json({ error: 'Current password is incorrect' });

    const hashed = await bcrypt.hash(newPassword, 10);
    await pool.execute('UPDATE users SET password = ?, updated_at = NOW() WHERE id = ?', [hashed, req.user.id]);
    res.json({ message: 'Password changed successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
};
