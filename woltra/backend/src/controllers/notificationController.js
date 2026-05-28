const pool = require('../config/database');

exports.getAll = async (req, res) => {
  try {
    const { page = 1, limit = 20, unread_only = '' } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    let where = 'WHERE user_id = ?';
    const params = [req.user.id];

    if (unread_only === 'true') { where += ' AND is_read = FALSE'; }

    const [[{ total }]] = await pool.execute(
      `SELECT COUNT(*) as total FROM notifications ${where}`, params
    );

    const [rows] = await pool.execute(
      `SELECT * FROM notifications ${where} ORDER BY created_at DESC LIMIT ${parseInt(limit)} OFFSET ${offset}`,
      params
    );

    const [[{ unread_count }]] = await pool.execute(
      'SELECT COUNT(*) as unread_count FROM notifications WHERE user_id = ? AND is_read = FALSE',
      [req.user.id]
    );

    res.json({
      data: rows,
      unread_count,
      pagination: { total, page: parseInt(page), limit: parseInt(limit), totalPages: Math.ceil(total / parseInt(limit)) }
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
};

exports.markRead = async (req, res) => {
  try {
    await pool.execute(
      'UPDATE notifications SET is_read = TRUE WHERE id = ? AND user_id = ?',
      [req.params.id, req.user.id]
    );
    res.json({ message: 'Notification marked as read' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update notification' });
  }
};

exports.markAllRead = async (req, res) => {
  try {
    await pool.execute(
      'UPDATE notifications SET is_read = TRUE WHERE user_id = ?',
      [req.user.id]
    );
    res.json({ message: 'All notifications marked as read' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update notifications' });
  }
};

exports.delete = async (req, res) => {
  try {
    await pool.execute(
      'DELETE FROM notifications WHERE id = ? AND user_id = ?',
      [req.params.id, req.user.id]
    );
    res.json({ message: 'Notification deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete notification' });
  }
};

exports.create = async (req, res) => {
  const { user_id, title, message, type, related_id, related_type } = req.body;
  if (!user_id || !title || !message) {
    return res.status(400).json({ error: 'User ID, title, and message are required' });
  }
  try {
    const [result] = await pool.execute(
      'INSERT INTO notifications (user_id, title, message, type, related_id, related_type) VALUES (?, ?, ?, ?, ?, ?) RETURNING id',
      [user_id, title, message, type || 'info', related_id || null, related_type || null]
    );
    res.status(201).json({ id: result.insertId, message: 'Notification created' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to create notification' });
  }
};
