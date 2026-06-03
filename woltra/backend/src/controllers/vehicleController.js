const pool = require('../config/database');

async function generateClaimCode(ownerId) {
  const [ownerRows] = await pool.execute(
    'SELECT company_name FROM users WHERE id = ?', [ownerId]
  );
  const companyName = ownerRows[0]?.company_name || 'FLEET';
  const prefix = companyName.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6) || 'FLEET';

  const [[{ total }]] = await pool.execute('SELECT COUNT(*) as total FROM vehicles');
  const seq = parseInt(total) + 1;

  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const random = Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');

  return `${prefix}${seq}${random}`;
}

exports.getAll = async (req, res) => {
  try {
    const { page = 1, limit = 10, search = '', status = '' } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    let where = 'WHERE 1=1';
    const params = [];

    if (search) {
      where += ' AND (truck_id LIKE ? OR plate_number LIKE ? OR make LIKE ? OR model LIKE ?)';
      params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
    }
    if (status) { where += ' AND status = ?'; params.push(status); }

    if (req.user.role === 'driver') {
      const [driverRows] = await pool.execute('SELECT id FROM drivers WHERE user_id = ?', [req.user.id]);
      const driverId = driverRows[0]?.id || 0;
      where += ' AND assigned_driver_id = ?';
      params.push(driverId);
    } else {
      // Multi-tenant: an owner only sees vehicles in their own fleet
      where += ' AND owner_id = ?';
      params.push(req.user.id);
    }

    const [[{ total }]] = await pool.execute(`SELECT COUNT(*) as total FROM vehicles ${where}`, params);

    const [rows] = await pool.execute(
      `SELECT v.*,
        dr.name as assigned_driver_name, dr.employee_id as assigned_driver_employee_id,
        (SELECT COUNT(*) FROM deliveries d WHERE d.vehicle_id = v.id) as total_deliveries
       FROM vehicles v
       LEFT JOIN drivers dr ON v.assigned_driver_id = dr.id
       ${where}
       ORDER BY v.created_at DESC LIMIT ${parseInt(limit)} OFFSET ${offset}`,
      params
    );

    res.json({
      data: rows,
      pagination: { total, page: parseInt(page), limit: parseInt(limit), totalPages: Math.ceil(total / parseInt(limit)) }
    });
  } catch (err) {
    console.error('Get vehicles error:', err);
    res.status(500).json({ error: 'Failed to fetch vehicles' });
  }
};

exports.getById = async (req, res) => {
  try {
    const [rows] = await pool.execute(
      `SELECT v.*, dr.name as assigned_driver_name, dr.employee_id as assigned_driver_employee_id
       FROM vehicles v LEFT JOIN drivers dr ON v.assigned_driver_id = dr.id
       WHERE v.id = ?`,
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Vehicle not found' });

    const [maintenance] = await pool.execute(
      'SELECT * FROM maintenance_records WHERE vehicle_id = ? ORDER BY maintenance_date DESC LIMIT 10',
      [req.params.id]
    );
    const [deliveries] = await pool.execute(
      `SELECT d.id, d.date, d.outlet, d.status, dr.name as driver_name
       FROM deliveries d LEFT JOIN drivers dr ON d.driver_id = dr.id
       WHERE d.vehicle_id = ? ORDER BY d.date DESC LIMIT 10`,
      [req.params.id]
    );

    res.json({ vehicle: rows[0], maintenance, deliveries });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch vehicle' });
  }
};

exports.create = async (req, res) => {
  const { truck_id, plate_number, make, model, year, capacity, capacity_unit, fuel_type, wheel_count, notes, assigned_driver_id } = req.body;

  if (!truck_id || !plate_number) {
    return res.status(400).json({ error: 'Truck ID and plate number are required' });
  }

  try {
    const [existing] = await pool.execute(
      'SELECT id FROM vehicles WHERE truck_id = ? OR plate_number = ?',
      [truck_id, plate_number]
    );
    if (existing.length) return res.status(409).json({ error: 'Truck ID or plate number already exists' });

    const claimCode = await generateClaimCode(req.user.id);

    const [result] = await pool.execute(
      `INSERT INTO vehicles (owner_id, truck_id, plate_number, make, model, year, capacity, capacity_unit, fuel_type, wheel_count, notes, assigned_driver_id, claim_code)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`,
      [req.user.id, truck_id, plate_number, make || null, model || null, year || null,
       capacity || null, capacity_unit || 'boxes', fuel_type || 'diesel',
       wheel_count ? parseInt(wheel_count) : null, notes || null,
       assigned_driver_id || null, claimCode]
    );

    if (assigned_driver_id) {
      const [driver] = await pool.execute('SELECT user_id, name FROM drivers WHERE id = ?', [assigned_driver_id]);
      if (driver.length && driver[0].user_id) {
        await pool.execute(
          'INSERT INTO notifications (user_id, title, message, type, related_id, related_type) VALUES (?, ?, ?, ?, ?, ?)',
          [driver[0].user_id, 'Vehicle Assigned to You',
           `Truck ${truck_id} (${plate_number}) has been assigned to you. Your claim code is: ${claimCode}`,
           'vehicle', result.insertId, 'vehicle']
        );
      }
    }

    const [newVehicle] = await pool.execute(
      `SELECT v.*, dr.name as assigned_driver_name FROM vehicles v
       LEFT JOIN drivers dr ON v.assigned_driver_id = dr.id WHERE v.id = ?`,
      [result.insertId]
    );
    res.status(201).json({ vehicle: newVehicle[0], claim_code: claimCode, message: 'Vehicle created successfully' });
  } catch (err) {
    console.error('Create vehicle error:', err);
    res.status(500).json({ error: 'Failed to create vehicle' });
  }
};

exports.update = async (req, res) => {
  const { id } = req.params;
  const { plate_number, make, model, year, capacity, capacity_unit, status, fuel_type, wheel_count, current_mileage,
    last_maintenance_date, next_maintenance_date, notes, assigned_driver_id } = req.body;

  try {
    const [existing] = await pool.execute('SELECT * FROM vehicles WHERE id = ?', [id]);
    if (!existing.length) return res.status(404).json({ error: 'Vehicle not found' });

    const driverChanged = assigned_driver_id !== undefined && parseInt(assigned_driver_id) !== existing[0].assigned_driver_id;
    const newDriverId = assigned_driver_id !== undefined ? assigned_driver_id || null : existing[0].assigned_driver_id;

    const alreadyClaimed = !driverChanged && existing[0].assigned_driver_id && existing[0].claim_code === null;
    let claimCode;
    if (alreadyClaimed) {
      claimCode = null;
    } else if (driverChanged && newDriverId) {
      claimCode = await generateClaimCode(req.user.id);
    } else {
      claimCode = existing[0].claim_code;
    }

    await pool.execute(
      `UPDATE vehicles SET plate_number = ?, make = ?, model = ?, year = ?, capacity = ?,
       capacity_unit = ?, status = ?, fuel_type = ?, wheel_count = ?, current_mileage = ?,
       last_maintenance_date = ?, next_maintenance_date = ?, notes = ?,
       assigned_driver_id = ?, claim_code = ?, updated_at = NOW()
       WHERE id = ?`,
      [
        plate_number || existing[0].plate_number,
        make !== undefined ? make : existing[0].make,
        model !== undefined ? model : existing[0].model,
        year !== undefined ? year : existing[0].year,
        capacity !== undefined ? capacity : existing[0].capacity,
        capacity_unit || existing[0].capacity_unit,
        status || existing[0].status,
        fuel_type || existing[0].fuel_type,
        wheel_count !== undefined ? (parseInt(wheel_count) || null) : existing[0].wheel_count,
        current_mileage !== undefined ? current_mileage : existing[0].current_mileage,
        last_maintenance_date !== undefined ? last_maintenance_date : existing[0].last_maintenance_date,
        next_maintenance_date !== undefined ? next_maintenance_date : existing[0].next_maintenance_date,
        notes !== undefined ? notes : existing[0].notes,
        newDriverId, claimCode, id
      ]
    );

    if (driverChanged && newDriverId && claimCode) {
      const [driver] = await pool.execute('SELECT user_id FROM drivers WHERE id = ?', [newDriverId]);
      if (driver.length && driver[0].user_id) {
        await pool.execute(
          'INSERT INTO notifications (user_id, title, message, type, related_id, related_type) VALUES (?, ?, ?, ?, ?, ?)',
          [driver[0].user_id, 'Vehicle Assigned to You',
           `Truck ${existing[0].truck_id} has been assigned to you. Your claim code is: ${claimCode}`,
           'vehicle', id, 'vehicle']
        );
      }
    }

    const [updated] = await pool.execute(
      `SELECT v.*, dr.name as assigned_driver_name FROM vehicles v
       LEFT JOIN drivers dr ON v.assigned_driver_id = dr.id WHERE v.id = ?`,
      [id]
    );
    res.json({ vehicle: updated[0], claim_code: claimCode, message: 'Vehicle updated successfully' });
  } catch (err) {
    console.error('Update vehicle error:', err);
    res.status(500).json({ error: 'Failed to update vehicle' });
  }
};

exports.delete = async (req, res) => {
  try {
    const [existing] = await pool.execute('SELECT id FROM vehicles WHERE id = ?', [req.params.id]);
    if (!existing.length) return res.status(404).json({ error: 'Vehicle not found' });
    await pool.execute('DELETE FROM vehicles WHERE id = ?', [req.params.id]);
    res.json({ message: 'Vehicle deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete vehicle' });
  }
};

exports.claim = async (req, res) => {
  const { code } = req.body;
  if (!code) return res.status(400).json({ error: 'Claim code is required' });

  try {
    const [vehicles] = await pool.execute(
      'SELECT * FROM vehicles WHERE claim_code = ?',
      [code.toUpperCase().trim()]
    );

    if (!vehicles.length) {
      return res.status(404).json({ error: 'Invalid claim code. Please check the code and try again.' });
    }

    const vehicle = vehicles[0];

    let [driverRows] = await pool.execute('SELECT id FROM drivers WHERE user_id = ?', [req.user.id]);
    let driverId;

    if (!driverRows.length) {
      const empId = `DRV-${req.user.id}`;
      const licNum = `PENDING-${req.user.id}`;
      const tomorrow = new Date();
      tomorrow.setFullYear(tomorrow.getFullYear() + 1);
      const expiry = tomorrow.toISOString().split('T')[0];

      const [newDriver] = await pool.execute(
        `INSERT INTO drivers (user_id, employee_id, name, license_number, license_expiry, phone, email, status, hire_date, notes)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'active', CURRENT_DATE, ?) RETURNING id`,
        [req.user.id, empId, req.user.name, licNum, expiry,
         req.user.phone || '000-0000', req.user.email,
         'Self-registered driver. Please update license number and details.']
      );
      driverId = newDriver.insertId;
    } else {
      driverId = driverRows[0].id;

      const [alreadyOwned] = await pool.execute(
        'SELECT truck_id FROM vehicles WHERE assigned_driver_id = ? AND claim_code IS NULL',
        [driverId]
      );
      if (alreadyOwned.length) {
        return res.status(409).json({
          error: `You already have vehicle ${alreadyOwned[0].truck_id} assigned. Contact your owner to change the assignment.`
        });
      }
    }

    await pool.execute(
      'UPDATE vehicles SET assigned_driver_id = ?, claim_code = NULL, updated_at = NOW() WHERE id = ?',
      [driverId, vehicle.id]
    );

    const [ownerRows] = await pool.execute('SELECT id FROM users WHERE role = ? LIMIT 1', ['owner']);
    if (ownerRows.length) {
      await pool.execute(
        'INSERT INTO notifications (user_id, title, message, type, related_id, related_type) VALUES (?, ?, ?, ?, ?, ?)',
        [ownerRows[0].id, 'Driver Joined Fleet',
         `${req.user.name} has claimed vehicle ${vehicle.truck_id} (${vehicle.plate_number}) using code ${code}.`,
         'info', vehicle.id, 'vehicle']
      );
    }

    const [claimed] = await pool.execute('SELECT * FROM vehicles WHERE id = ?', [vehicle.id]);
    res.json({ vehicle: claimed[0], message: `Vehicle ${vehicle.truck_id} successfully claimed! Welcome to the fleet.` });
  } catch (err) {
    console.error('Claim vehicle error:', err);
    res.status(500).json({ error: 'Failed to claim vehicle' });
  }
};

exports.addMaintenance = async (req, res) => {
  const { maintenance_type, description, cost, performed_by, maintenance_date, next_maintenance_date, status } = req.body;
  if (!maintenance_type || !maintenance_date) {
    return res.status(400).json({ error: 'Maintenance type and date are required' });
  }
  try {
    const [result] = await pool.execute(
      `INSERT INTO maintenance_records (vehicle_id, maintenance_type, description, cost, performed_by, maintenance_date, next_maintenance_date, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`,
      [req.params.id, maintenance_type, description || null, cost || null, performed_by || null,
       maintenance_date, next_maintenance_date || null, status || 'scheduled']
    );
    if (next_maintenance_date) {
      await pool.execute('UPDATE vehicles SET next_maintenance_date = ?, updated_at = NOW() WHERE id = ?', [next_maintenance_date, req.params.id]);
    }
    res.status(201).json({ id: result.insertId, message: 'Maintenance record added successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to add maintenance record' });
  }
};
