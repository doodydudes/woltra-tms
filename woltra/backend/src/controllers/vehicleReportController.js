const pool = require('../config/database');

exports.create = async (req, res) => {
  const { type, title, description, location, vehicle_id } = req.body;
  if (!title) return res.status(400).json({ error: 'Title is required' });

  try {
    const [driverRows] = await pool.execute('SELECT id FROM drivers WHERE user_id = ?', [req.user.id]);
    const driver_id = driverRows[0]?.id || null;

    const photos = req.files ? req.files.map(f => `/uploads/vehicle-reports/${f.filename}`) : [];

    const [result] = await pool.execute(
      `INSERT INTO vehicle_reports (vehicle_id, driver_id, user_id, type, title, description, location, photos)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`,
      [vehicle_id || null, driver_id, req.user.id,
       type || 'other', title, description || null, location || null, JSON.stringify(photos)]
    );

    // Notify all active owners
    const [owners] = await pool.execute("SELECT id FROM users WHERE role = 'owner' AND is_active = TRUE");
    for (const owner of owners) {
      await pool.execute(
        `INSERT INTO notifications (user_id, title, message, type, related_type, related_id)
         VALUES (?, ?, ?, 'warning', 'vehicle_report', ?)`,
        [owner.id, 'Vehicle Incident Report',
         `${req.user.name} reported a vehicle issue: ${title}`, result.insertId]
      );
    }

    const [report] = await pool.execute(
      `SELECT vr.*, u.name as driver_name, v.truck_id, v.plate_number
       FROM vehicle_reports vr
       LEFT JOIN users u ON vr.user_id = u.id
       LEFT JOIN vehicles v ON vr.vehicle_id = v.id
       WHERE vr.id = ?`,
      [result.insertId]
    );
    res.status(201).json({ report: report[0], message: 'Report submitted successfully' });
  } catch (err) {
    console.error('Create vehicle report error:', err);
    res.status(500).json({ error: 'Failed to submit report' });
  }
};

exports.getAll = async (req, res) => {
  try {
    const { status, date_from, date_to } = req.query;
    let where = 'WHERE 1=1';
    const params = [];
    if (status) { where += ' AND vr.status = ?'; params.push(status); }
    if (date_from) { where += ' AND DATE(vr.created_at) >= ?'; params.push(date_from); }
    if (date_to) { where += ' AND DATE(vr.created_at) <= ?'; params.push(date_to); }

    const [reports] = await pool.execute(
      `SELECT vr.*, u.name as driver_name, v.truck_id, v.plate_number
       FROM vehicle_reports vr
       LEFT JOIN users u ON vr.user_id = u.id
       LEFT JOIN vehicles v ON vr.vehicle_id = v.id
       ${where}
       ORDER BY vr.created_at DESC`,
      params
    );
    res.json({ data: reports });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch reports' });
  }
};

exports.getMyReports = async (req, res) => {
  try {
    const [reports] = await pool.execute(
      `SELECT vr.*, v.truck_id, v.plate_number
       FROM vehicle_reports vr
       LEFT JOIN vehicles v ON vr.vehicle_id = v.id
       WHERE vr.user_id = ?
       ORDER BY vr.created_at DESC`,
      [req.user.id]
    );
    res.json({ data: reports });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch reports' });
  }
};

exports.updateStatus = async (req, res) => {
  const { status, owner_notes, scheduled_date } = req.body;
  const validStatuses = ['in_progress', 'resolved'];
  if (!validStatuses.includes(status)) {
    return res.status(400).json({ error: 'Invalid status' });
  }

  try {
    const resolved_at = status === 'resolved' ? new Date() : null;

    await pool.execute(
      `UPDATE vehicle_reports
       SET status = ?, owner_notes = ?, scheduled_date = ?,
           resolved_at = ?, updated_at = NOW()
       WHERE id = ?`,
      [status, owner_notes ?? null, scheduled_date || null, resolved_at, req.params.id]
    );

    const [rows] = await pool.execute(
      `SELECT vr.*, u.name as driver_name, v.truck_id
       FROM vehicle_reports vr
       LEFT JOIN users u ON vr.user_id = u.id
       LEFT JOIN vehicles v ON vr.vehicle_id = v.id
       WHERE vr.id = ?`,
      [req.params.id]
    );
    const report = rows[0];

    if (report.vehicle_id) {
      if (status === 'in_progress') {
        await pool.execute("UPDATE vehicles SET status = 'maintenance' WHERE id = ?", [report.vehicle_id]);
      } else if (status === 'resolved') {
        await pool.execute("UPDATE vehicles SET status = 'available' WHERE id = ?", [report.vehicle_id]);
      }
    }

    const notifMessages = {
      in_progress: `Your report "${report.title}" is now being repaired${scheduled_date ? ` — scheduled for ${scheduled_date}` : ''}.`,
      resolved:    `Your report "${report.title}" has been marked as fixed/resolved.`,
    };
    await pool.execute(
      `INSERT INTO notifications (user_id, title, message, type, related_type, related_id)
       VALUES (?, ?, ?, 'info', 'vehicle_report', ?)`,
      [report.user_id, 'Vehicle Report Update', notifMessages[status], report.id]
    );

    res.json({ report, message: 'Status updated' });
  } catch (err) {
    console.error('Update status error:', err);
    res.status(500).json({ error: 'Failed to update status' });
  }
};

exports.submitProgress = async (req, res) => {
  try {
    const [rows] = await pool.execute(
      'SELECT * FROM vehicle_reports WHERE id = ? AND user_id = ?',
      [req.params.id, req.user.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Report not found' });
    const report = rows[0];
    if (report.status !== 'in_progress') {
      return res.status(400).json({ error: 'Report must be in progress before submitting work photos' });
    }

    const newPhotos = req.files ? req.files.map(f => `/uploads/vehicle-reports/${f.filename}`) : [];
    const existing = report.progress_photos ? JSON.parse(report.progress_photos) : [];
    const progress_photos = [...existing, ...newPhotos];

    const { driver_progress_notes } = req.body;

    await pool.execute(
      `UPDATE vehicle_reports
       SET progress_photos = ?, driver_progress_notes = ?, driver_progress_at = NOW(), updated_at = NOW()
       WHERE id = ?`,
      [JSON.stringify(progress_photos), driver_progress_notes || null, req.params.id]
    );

    // Notify owners
    const [owners] = await pool.execute("SELECT id FROM users WHERE role = 'owner' AND is_active = TRUE");
    for (const owner of owners) {
      await pool.execute(
        `INSERT INTO notifications (user_id, title, message, type, related_type, related_id)
         VALUES (?, ?, ?, 'info', 'vehicle_report', ?)`,
        [owner.id, 'Repair Progress Update',
         `${req.user.name} submitted repair photos for: ${report.title}`, report.id]
      );
    }

    const [updated] = await pool.execute(
      `SELECT vr.*, v.truck_id, v.plate_number
       FROM vehicle_reports vr
       LEFT JOIN vehicles v ON vr.vehicle_id = v.id
       WHERE vr.id = ?`,
      [req.params.id]
    );
    res.json({ report: updated[0], message: 'Progress submitted' });
  } catch (err) {
    console.error('Submit progress error:', err);
    res.status(500).json({ error: 'Failed to submit progress' });
  }
};
