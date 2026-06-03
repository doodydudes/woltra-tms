const pool = require('../config/database');

exports.getStats = async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const isDriver = req.user.role === 'driver';

    if (isDriver) {
      const [driverRows] = await pool.execute(
        'SELECT id FROM drivers WHERE user_id = ?',
        [req.user.id]
      );

      if (!driverRows.length) {
        return res.json({
          deliveryStats: { total: 0, pending: 0, in_transit: 0, delivered: 0, delayed: 0, cancelled: 0, returned: 0 },
          todayStats: { total_today: 0, delivered_today: 0, pending_today: 0 },
          weeklyData: [],
          recentActivity: []
        });
      }

      const driverId = driverRows[0].id;

      const [[deliveryStats]] = await pool.execute(`
        SELECT
          COUNT(*)::int                                         AS total,
          COUNT(*) FILTER (WHERE status = 'pending')::int       AS pending,
          COUNT(*) FILTER (WHERE status = 'in_transit')::int    AS in_transit,
          COUNT(*) FILTER (WHERE status = 'delivered')::int     AS delivered,
          COUNT(*) FILTER (WHERE status = 'delayed')::int       AS delayed,
          COUNT(*) FILTER (WHERE status = 'cancelled')::int     AS cancelled,
          COUNT(*) FILTER (WHERE status = 'returned')::int      AS returned
        FROM deliveries WHERE driver_id = ?
      `, [driverId]);

      const [[todayStats]] = await pool.execute(`
        SELECT
          COUNT(*)::int                                         AS total_today,
          COUNT(*) FILTER (WHERE status = 'delivered')::int     AS delivered_today,
          COUNT(*) FILTER (WHERE status = 'pending')::int       AS pending_today
        FROM deliveries WHERE date = ? AND driver_id = ?
      `, [today, driverId]);

      const [weeklyData] = await pool.execute(`
        SELECT
          DATE(date)                                          AS delivery_date,
          COUNT(*)::int                                       AS total,
          COUNT(*) FILTER (WHERE status = 'delivered')::int  AS delivered,
          COUNT(*) FILTER (WHERE status = 'pending')::int    AS pending,
          COUNT(*) FILTER (WHERE status = 'delayed')::int    AS delayed
        FROM deliveries
        WHERE date >= ? AND driver_id = ?
        GROUP BY DATE(date)
        ORDER BY delivery_date ASC
      `, [weekAgo, driverId]);

      const [recentActivity] = await pool.execute(`
        SELECT
          d.id, d.gate_pass_number, d.outlet, d.status, d.date,
          dr.name AS driver_name,
          d.updated_at
        FROM deliveries d
        LEFT JOIN drivers dr ON d.driver_id = dr.id
        WHERE d.driver_id = ?
        ORDER BY d.updated_at DESC
        LIMIT 10
      `, [driverId]);

      return res.json({ deliveryStats, todayStats, weeklyData, recentActivity });
    }

    // Owner: stats scoped to this owner's own fleet (owner_id / assigned_by)
    const ownerId = req.user.id;

    const [[deliveryStats]] = await pool.execute(`
      SELECT
        COUNT(*)::int                                         AS total,
        COUNT(*) FILTER (WHERE status = 'pending')::int       AS pending,
        COUNT(*) FILTER (WHERE status = 'in_transit')::int    AS in_transit,
        COUNT(*) FILTER (WHERE status = 'delivered')::int     AS delivered,
        COUNT(*) FILTER (WHERE status = 'delayed')::int       AS delayed,
        COUNT(*) FILTER (WHERE status = 'cancelled')::int     AS cancelled,
        COUNT(*) FILTER (WHERE status = 'returned')::int      AS returned
      FROM deliveries WHERE assigned_by = ?
    `, [ownerId]);

    const [[todayStats]] = await pool.execute(`
      SELECT
        COUNT(*)::int                                         AS total_today,
        COUNT(*) FILTER (WHERE status = 'delivered')::int     AS delivered_today,
        COUNT(*) FILTER (WHERE status = 'pending')::int       AS pending_today
      FROM deliveries WHERE date = ? AND assigned_by = ?
    `, [today, ownerId]);

    const [[driverStats]] = await pool.execute(`
      SELECT
        COUNT(*)::int                                       AS total_drivers,
        COUNT(*) FILTER (WHERE status = 'active')::int     AS active_drivers
      FROM drivers WHERE owner_id = ?
    `, [ownerId]);

    const [[vehicleStats]] = await pool.execute(`
      SELECT
        COUNT(*)::int                                           AS total_vehicles,
        COUNT(*) FILTER (WHERE status = 'available')::int      AS available_vehicles,
        COUNT(*) FILTER (WHERE status = 'in_use')::int         AS in_use_vehicles,
        COUNT(*) FILTER (WHERE status = 'maintenance')::int    AS maintenance_vehicles
      FROM vehicles WHERE owner_id = ?
    `, [ownerId]);

    const [weeklyData] = await pool.execute(`
      SELECT
        DATE(date)                                          AS delivery_date,
        COUNT(*)::int                                       AS total,
        COUNT(*) FILTER (WHERE status = 'delivered')::int  AS delivered,
        COUNT(*) FILTER (WHERE status = 'pending')::int    AS pending,
        COUNT(*) FILTER (WHERE status = 'delayed')::int    AS delayed
      FROM deliveries
      WHERE date >= ? AND assigned_by = ?
      GROUP BY DATE(date)
      ORDER BY delivery_date ASC
    `, [weekAgo, ownerId]);

    const [recentActivity] = await pool.execute(`
      SELECT
        d.id, d.gate_pass_number, d.outlet, d.status, d.date,
        dr.name AS driver_name,
        d.updated_at
      FROM deliveries d
      LEFT JOIN drivers dr ON d.driver_id = dr.id
      WHERE d.assigned_by = ?
      ORDER BY d.updated_at DESC
      LIMIT 10
    `, [ownerId]);

    const [topDrivers] = await pool.execute(`
      SELECT
        dr.id, dr.name, dr.employee_id,
        COUNT(d.id)::int                                      AS total_deliveries,
        COUNT(d.id) FILTER (WHERE d.status = 'delivered')::int AS completed,
        COUNT(d.id) FILTER (WHERE d.status = 'delayed')::int   AS delayed
      FROM drivers dr
      LEFT JOIN deliveries d ON dr.id = d.driver_id
      WHERE dr.owner_id = ?
      GROUP BY dr.id
      ORDER BY total_deliveries DESC
      LIMIT 5
    `, [ownerId]);

    res.json({
      deliveryStats,
      todayStats,
      driverStats,
      vehicleStats,
      weeklyData,
      recentActivity,
      topDrivers
    });
  } catch (err) {
    console.error('Dashboard stats error:', err);
    res.status(500).json({ error: 'Failed to fetch dashboard data' });
  }
};
