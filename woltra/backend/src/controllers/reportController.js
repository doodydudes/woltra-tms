const pool = require('../config/database');

exports.getDeliveryReport = async (req, res) => {
  const { date_from, date_to, driver_id, status, type = 'daily' } = req.query;

  try {
    let where = 'WHERE 1=1';
    const params = [];

    if (date_from) { where += ' AND d.date >= ?'; params.push(date_from); }
    if (date_to) { where += ' AND d.date <= ?'; params.push(date_to); }
    if (driver_id) { where += ' AND d.driver_id = ?'; params.push(driver_id); }
    if (status) { where += ' AND d.status = ?'; params.push(status); }

    const [deliveries] = await pool.execute(
      `SELECT d.*, dr.name as driver_name, v.plate_number
       FROM deliveries d
       LEFT JOIN drivers dr ON d.driver_id = dr.id
       LEFT JOIN vehicles v ON d.vehicle_id = v.id
       ${where}
       ORDER BY d.date DESC`,
      params
    );

    const [[summary]] = await pool.execute(
      `SELECT
        COUNT(*)::int                                          AS total,
        COUNT(*) FILTER (WHERE status = 'delivered')::int     AS delivered,
        COUNT(*) FILTER (WHERE status = 'pending')::int       AS pending,
        COUNT(*) FILTER (WHERE status = 'delayed')::int       AS delayed,
        COUNT(*) FILTER (WHERE status = 'returned')::int      AS returned,
        COUNT(*) FILTER (WHERE status = 'cancelled')::int     AS cancelled,
        COALESCE(SUM(number_of_boxes), 0)                     AS total_boxes,
        COUNT(*) FILTER (WHERE bo = TRUE)::int                AS bo_deliveries,
        COALESCE(SUM(number_of_bo_boxes), 0)                  AS total_bo_boxes,
        COUNT(*) FILTER (WHERE backlift = TRUE)::int          AS backlift_deliveries
       FROM deliveries d ${where}`,
      params
    );

    res.json({ deliveries, summary, reportType: type });
  } catch (err) {
    console.error('Report error:', err);
    res.status(500).json({ error: 'Failed to generate report' });
  }
};

exports.getDriverReport = async (req, res) => {
  const { date_from, date_to, driver_id } = req.query;

  try {
    let dateWhere = '';
    const params = [];

    if (date_from) { dateWhere += ' AND d.date >= ?'; params.push(date_from); }
    if (date_to) { dateWhere += ' AND d.date <= ?'; params.push(date_to); }

    let driverWhere = driver_id ? 'WHERE dr.id = ?' : '';
    const driverParams = driver_id ? [driver_id, ...params] : params;

    const [drivers] = await pool.execute(
      `SELECT
        dr.id, dr.employee_id, dr.name, dr.phone, dr.status,
        COUNT(d.id)::int                                          AS total_deliveries,
        COUNT(d.id) FILTER (WHERE d.status = 'delivered')::int    AS delivered,
        COUNT(d.id) FILTER (WHERE d.status = 'delayed')::int      AS delayed,
        COUNT(d.id) FILTER (WHERE d.status = 'returned')::int     AS returned,
        COALESCE(SUM(d.number_of_boxes), 0)                       AS total_boxes,
        ROUND(
          COUNT(d.id) FILTER (WHERE d.status = 'delivered')::numeric
          / NULLIF(COUNT(d.id), 0) * 100, 2
        )                                                         AS success_rate
       FROM drivers dr
       LEFT JOIN deliveries d ON dr.id = d.driver_id ${dateWhere}
       ${driverWhere}
       GROUP BY dr.id
       ORDER BY total_deliveries DESC`,
      driverParams
    );

    res.json({ drivers });
  } catch (err) {
    res.status(500).json({ error: 'Failed to generate driver report' });
  }
};

exports.getBOReport = async (req, res) => {
  const { date_from, date_to } = req.query;

  try {
    let where = 'WHERE bo = TRUE';
    const params = [];

    if (date_from) { where += ' AND d.date >= ?'; params.push(date_from); }
    if (date_to) { where += ' AND d.date <= ?'; params.push(date_to); }

    const [deliveries] = await pool.execute(
      `SELECT d.*, dr.name as driver_name
       FROM deliveries d
       LEFT JOIN drivers dr ON d.driver_id = dr.id
       ${where}
       ORDER BY d.date DESC`,
      params
    );

    const [[summary]] = await pool.execute(
      `SELECT COUNT(*)::int AS total_bo_deliveries, COALESCE(SUM(number_of_bo_boxes), 0) AS total_bo_boxes
       FROM deliveries d ${where}`,
      params
    );

    res.json({ deliveries, summary });
  } catch (err) {
    res.status(500).json({ error: 'Failed to generate BO report' });
  }
};

exports.getReturnReport = async (req, res) => {
  const { date_from, date_to } = req.query;

  try {
    let where = "WHERE d.reject_return != 'none' OR d.status = 'returned'";
    const params = [];

    if (date_from) { where += ' AND d.date >= ?'; params.push(date_from); }
    if (date_to) { where += ' AND d.date <= ?'; params.push(date_to); }

    const [deliveries] = await pool.execute(
      `SELECT d.*, dr.name as driver_name
       FROM deliveries d
       LEFT JOIN drivers dr ON d.driver_id = dr.id
       ${where}
       ORDER BY d.date DESC`,
      params
    );

    res.json({ deliveries, total: deliveries.length });
  } catch (err) {
    res.status(500).json({ error: 'Failed to generate return report' });
  }
};

exports.exportCSV = async (req, res) => {
  const { date_from, date_to } = req.query;

  try {
    let where = 'WHERE 1=1';
    const params = [];
    if (date_from) { where += ' AND d.date >= ?'; params.push(date_from); }
    if (date_to) { where += ' AND d.date <= ?'; params.push(date_to); }

    const [rows] = await pool.execute(
      `SELECT d.id, d.date, d.gate_pass_number, d.outlet, d.location, d.status,
        d.number_of_boxes, d.bo, d.number_of_bo_boxes, d.backlift, d.reject_return,
        dr.name as driver, d.helper_name as helper, v.plate_number as vehicle,
        d.completed_delivery_time, d.notes
       FROM deliveries d
       LEFT JOIN drivers dr ON d.driver_id = dr.id
       LEFT JOIN vehicles v ON d.vehicle_id = v.id
       ${where} ORDER BY d.date DESC`,
      params
    );

    const headers = ['ID', 'Date', 'Gate Pass', 'Outlet', 'Location', 'Status',
      'Boxes', 'BO', 'BO Boxes', 'Backlift', 'Reject/Return',
      'Driver', 'Helper', 'Vehicle', 'Completed Time', 'Notes'];

    const csvRows = [
      headers.join(','),
      ...rows.map(r => [
        r.id, r.date, r.gate_pass_number || '', `"${r.outlet}"`, `"${r.location || ''}"`,
        r.status, r.number_of_boxes, r.bo ? 'Yes' : 'No', r.number_of_bo_boxes,
        r.backlift ? 'Yes' : 'No', r.reject_return, r.driver || '', r.helper || '',
        r.vehicle || '', r.completed_delivery_time || '', `"${r.notes || ''}"`
      ].join(','))
    ];

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=delivery-report-${Date.now()}.csv`);
    res.send(csvRows.join('\n'));
  } catch (err) {
    res.status(500).json({ error: 'Failed to export CSV' });
  }
};
