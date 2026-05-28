const pool = require('../config/database');

exports.getAll = async (req, res) => {
  try {
    const { province, wheel_count } = req.query;
    let where = 'WHERE 1=1';
    const params = [];
    if (province) { where += ' AND province = ?'; params.push(province); }
    if (wheel_count !== undefined) { where += ' AND wheel_count = ?'; params.push(parseInt(wheel_count) || 0); }
    const [rows] = await pool.execute(`SELECT * FROM trip_rates ${where} ORDER BY province, city`, params);
    res.json({ data: rows });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch rates' });
  }
};

exports.upsert = async (req, res) => {
  const { province, city, driver_rate, helper_rate, wheel_count, notes } = req.body;
  if (!province || !city) return res.status(400).json({ error: 'Province and city are required' });
  if (!driver_rate || parseFloat(driver_rate) <= 0) return res.status(400).json({ error: 'Driver rate is required' });

  const wc = parseInt(wheel_count) || 0;
  const dRate = parseFloat(driver_rate);
  const hRate = helper_rate ? parseFloat(helper_rate) : null;

  try {
    await pool.execute(
      `INSERT INTO trip_rates (province, city, wheel_count, rate, driver_rate, helper_rate, notes, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT (province, city, wheel_count) DO UPDATE SET
         rate = EXCLUDED.rate,
         driver_rate = EXCLUDED.driver_rate,
         helper_rate = EXCLUDED.helper_rate,
         notes = EXCLUDED.notes,
         updated_at = NOW()`,
      [province, city, wc, dRate, dRate, hRate, notes || null, req.user.id]
    );
    const [[row]] = await pool.execute(
      'SELECT * FROM trip_rates WHERE province = ? AND city = ? AND wheel_count = ?',
      [province, city, wc]
    );
    res.json({ rate: row, message: 'Rate saved successfully' });
  } catch (err) {
    console.error('Upsert rate error:', err);
    res.status(500).json({ error: 'Failed to save rate' });
  }
};

exports.delete = async (req, res) => {
  try {
    await pool.execute('DELETE FROM trip_rates WHERE id = ?', [req.params.id]);
    res.json({ message: 'Rate deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete rate' });
  }
};

exports.approve = async (req, res) => {
  try {
    const [rows] = await pool.execute(
      "SELECT id, status, salary_approved FROM deliveries WHERE id = ?",
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Delivery not found' });
    if (rows[0].status !== 'delivered') return res.status(400).json({ error: 'Only delivered deliveries can be approved' });

    await pool.execute(
      `UPDATE deliveries SET salary_approved = TRUE, salary_approved_at = NOW(), salary_approved_by = ? WHERE id = ?`,
      [req.user.id, req.params.id]
    );
    res.json({ message: 'Salary approved' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to approve salary' });
  }
};

exports.getPayroll = async (req, res) => {
  try {
    const { date_from, date_to, driver_id, pending } = req.query;
    const showPending = pending === 'true';

    let where = showPending
      ? "WHERE d.status = 'delivered' AND (d.salary_approved IS NULL OR d.salary_approved = FALSE)"
      : "WHERE d.status = 'delivered' AND d.salary_approved = TRUE";
    const params = [];
    if (date_from) { where += ' AND d.date >= ?'; params.push(date_from); }
    if (date_to)   { where += ' AND d.date <= ?'; params.push(date_to); }
    if (driver_id) { where += ' AND dr.id = ?'; params.push(driver_id); }

    const [summary] = await pool.execute(
      `SELECT
        dr.id as driver_id, dr.name as driver_name, dr.employee_id,
        COUNT(d.id)::int as total_trips,
        SUM(COALESCE(d.trip_rate, tr.driver_rate, tr.rate, 0)) as total_earnings,
        SUM(CASE WHEN COALESCE(d.trip_rate, tr.driver_rate, tr.rate) IS NULL THEN 1 ELSE 0 END)::int as unrated_trips
       FROM drivers dr
       LEFT JOIN deliveries d ON dr.id = d.driver_id ${where}
       LEFT JOIN vehicles v ON d.vehicle_id = v.id
       LEFT JOIN LATERAL (
         SELECT driver_rate, helper_rate, rate FROM trip_rates
         WHERE city = d.delivery_city AND province = d.delivery_province
         ORDER BY CASE WHEN wheel_count = COALESCE(v.wheel_count, 0) THEN 0 ELSE 1 END
         LIMIT 1
       ) tr ON TRUE
       GROUP BY dr.id, dr.name, dr.employee_id
       ORDER BY total_earnings DESC`,
      params
    );

    res.json({ data: summary });
  } catch (err) {
    console.error('Payroll error:', err);
    res.status(500).json({ error: 'Failed to fetch payroll' });
  }
};

exports.getDriverTrips = async (req, res) => {
  try {
    const { driver_id, date_from, date_to, pending } = req.query;
    if (!driver_id) return res.status(400).json({ error: 'driver_id required' });
    const showPending = pending === 'true';

    let where = showPending
      ? "WHERE d.driver_id = ? AND d.status = 'delivered' AND (d.salary_approved IS NULL OR d.salary_approved = FALSE)"
      : "WHERE d.driver_id = ? AND d.status = 'delivered' AND d.salary_approved = TRUE";
    const params = [driver_id];
    if (date_from) { where += ' AND d.date >= ?'; params.push(date_from); }
    if (date_to)   { where += ' AND d.date <= ?'; params.push(date_to); }

    const [trips] = await pool.execute(
      `SELECT d.id, d.date, d.gate_pass_number, d.outlet,
        d.delivery_province, d.delivery_city, d.trip_rate,
        d.salary_approved, d.salary_approved_at, d.helper_name,
        COALESCE(d.trip_rate, tr.driver_rate, tr.rate) as effective_rate,
        tr.helper_rate,
        d.completed_delivery_time
       FROM deliveries d
       LEFT JOIN vehicles v ON d.vehicle_id = v.id
       LEFT JOIN LATERAL (
         SELECT driver_rate, helper_rate, rate FROM trip_rates
         WHERE city = d.delivery_city AND province = d.delivery_province
         ORDER BY CASE WHEN wheel_count = COALESCE(v.wheel_count, 0) THEN 0 ELSE 1 END
         LIMIT 1
       ) tr ON TRUE
       ${where}
       ORDER BY d.date DESC`,
      params
    );

    const total = trips.reduce((sum, t) => sum + (parseFloat(t.effective_rate) || 0), 0);
    res.json({ data: trips, total });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch driver trips' });
  }
};

exports.getMyEarnings = async (req, res) => {
  try {
    const { date_from, date_to } = req.query;

    const [driverRows] = await pool.execute('SELECT id FROM drivers WHERE user_id = ?', [req.user.id]);
    if (!driverRows.length) return res.json({ approved: [], pending: [], total: 0 });
    const driverId = driverRows[0].id;

    let where = "WHERE d.driver_id = ? AND d.status = 'delivered'";
    const params = [driverId];
    if (date_from) { where += ' AND d.date >= ?'; params.push(date_from); }
    if (date_to)   { where += ' AND d.date <= ?'; params.push(date_to); }

    const [trips] = await pool.execute(
      `SELECT d.id, d.date, d.gate_pass_number, d.outlet,
        d.delivery_province, d.delivery_city, d.trip_rate,
        d.salary_approved, d.salary_approved_at, d.helper_name,
        COALESCE(d.trip_rate, tr.driver_rate, tr.rate) as effective_rate,
        tr.helper_rate
       FROM deliveries d
       LEFT JOIN vehicles v ON d.vehicle_id = v.id
       LEFT JOIN LATERAL (
         SELECT driver_rate, helper_rate, rate FROM trip_rates
         WHERE city = d.delivery_city AND province = d.delivery_province
         ORDER BY CASE WHEN wheel_count = COALESCE(v.wheel_count, 0) THEN 0 ELSE 1 END
         LIMIT 1
       ) tr ON TRUE
       ${where}
       ORDER BY d.date DESC`,
      params
    );

    const approved = trips.filter(t => t.salary_approved);
    const pending  = trips.filter(t => !t.salary_approved);
    const total = approved.reduce((sum, t) => sum + (parseFloat(t.effective_rate) || 0), 0);

    res.json({ approved, pending, total });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch earnings' });
  }
};

exports.getPendingApprovals = async (req, res) => {
  try {
    const { date_from, date_to } = req.query;

    let where = "WHERE d.status = 'delivered' AND (d.salary_approved IS NULL OR d.salary_approved = FALSE)";
    const params = [];
    if (date_from) { where += ' AND d.date >= ?'; params.push(date_from); }
    if (date_to)   { where += ' AND d.date <= ?'; params.push(date_to); }

    const [rows] = await pool.execute(
      `SELECT d.id, d.date, d.outlet, d.gate_pass_number,
        d.delivery_province, d.delivery_city, d.trip_rate, d.helper_name,
        d.completed_delivery_time,
        dr.id as driver_id, dr.name as driver_name, dr.employee_id,
        v.wheel_count,
        COALESCE(d.trip_rate, tr.driver_rate, tr.rate) as driver_rate,
        tr.helper_rate
       FROM deliveries d
       LEFT JOIN drivers dr ON d.driver_id = dr.id
       LEFT JOIN vehicles v ON d.vehicle_id = v.id
       LEFT JOIN LATERAL (
         SELECT driver_rate, helper_rate, rate FROM trip_rates
         WHERE city = d.delivery_city AND province = d.delivery_province
         ORDER BY CASE WHEN wheel_count = COALESCE(v.wheel_count, 0) THEN 0 ELSE 1 END
         LIMIT 1
       ) tr ON TRUE
       ${where}
       ORDER BY d.date DESC`,
      params
    );

    res.json({ data: rows });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch pending approvals' });
  }
};
