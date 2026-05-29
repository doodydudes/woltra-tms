const pool = require('../config/database');
const { uploadToStorage } = require('../middleware/upload');

const deliveryFields = `
  d.id, d.date, d.gate_pass_number, d.outlet, d.location,
  d.completed_delivery_time, d.reject_return, d.number_of_boxes,
  d.bo, d.number_of_bo_boxes, d.backlift, d.status,
  d.delivery_photo, d.customer_signature, d.proof_uploaded,
  d.notes, d.eta, d.actual_start_time,
  d.loading_photo, d.arrival_time, d.unloading_photo, d.document_photos,
  d.delivery_province, d.delivery_city, d.trip_rate,
  d.driver_id, dr.name as driver_name, dr.employee_id as driver_employee_id,
  d.replacement_driver_name, d.helper_name,
  d.vehicle_id, v.truck_id, v.plate_number,
  d.assigned_by, u.name as assigned_by_name,
  d.created_at, d.updated_at
`;

exports.getAll = async (req, res) => {
  try {
    const {
      page = 1, limit = 10, search = '', status = '',
      driver_id = '', date_from = '', date_to = '',
      sort = 'date', order = 'DESC'
    } = req.query;

    const offset = (parseInt(page) - 1) * parseInt(limit);
    const allowedSorts = ['date', 'outlet', 'status', 'created_at', 'gate_pass_number'];
    const sortField = allowedSorts.includes(sort) ? `d.${sort}` : 'd.date';
    const sortOrder = order.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    let where = 'WHERE 1=1';
    const params = [];

    if (search) {
      where += ' AND (d.outlet LIKE ? OR d.gate_pass_number LIKE ? OR dr.name LIKE ?)';
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }
    if (status) { where += ' AND d.status = ?'; params.push(status); }
    if (driver_id) { where += ' AND d.driver_id = ?'; params.push(driver_id); }
    if (date_from) { where += ' AND d.date >= ?'; params.push(date_from); }
    if (date_to) { where += ' AND d.date <= ?'; params.push(date_to); }

    if (req.user.role === 'driver') {
      const [driverRows] = await pool.execute('SELECT id FROM drivers WHERE user_id = ?', [req.user.id]);
      const myDriverId = driverRows[0]?.id || 0;
      where += ' AND d.driver_id = ?';
      params.push(myDriverId);
    }

    const [countResult] = await pool.execute(
      `SELECT COUNT(*) as total FROM deliveries d
       LEFT JOIN drivers dr ON d.driver_id = dr.id ${where}`,
      params
    );
    const total = countResult[0].total;

    const [rows] = await pool.execute(
      `SELECT ${deliveryFields}
       FROM deliveries d
       LEFT JOIN drivers dr ON d.driver_id = dr.id
       LEFT JOIN vehicles v ON d.vehicle_id = v.id

       LEFT JOIN users u ON d.assigned_by = u.id
       ${where}
       ORDER BY ${sortField} ${sortOrder}
       LIMIT ${parseInt(limit)} OFFSET ${offset}`,
      params
    );

    res.json({
      data: rows,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (err) {
    console.error('Get deliveries error:', err);
    res.status(500).json({ error: 'Failed to fetch deliveries' });
  }
};

exports.getById = async (req, res) => {
  try {
    const [rows] = await pool.execute(
      `SELECT ${deliveryFields}
       FROM deliveries d
       LEFT JOIN drivers dr ON d.driver_id = dr.id
       LEFT JOIN vehicles v ON d.vehicle_id = v.id

       LEFT JOIN users u ON d.assigned_by = u.id
       WHERE d.id = ?`,
      [req.params.id]
    );

    if (!rows.length) return res.status(404).json({ error: 'Delivery not found' });

    const [tracking] = await pool.execute(
      `SELECT dt.*, u.name as recorded_by_name
       FROM delivery_tracking dt
       LEFT JOIN users u ON dt.recorded_by = u.id
       WHERE dt.delivery_id = ?
       ORDER BY dt.created_at ASC`,
      [req.params.id]
    );

    res.json({ delivery: rows[0], tracking });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch delivery' });
  }
};

exports.create = async (req, res) => {
  const {
    date, gate_pass_number, outlet, location, number_of_boxes,
    bo, number_of_bo_boxes, backlift, driver_id, replacement_driver_name, helper_name,
    vehicle_id, status, notes, eta, reject_return,
    delivery_province, delivery_city
  } = req.body;

  if (!date || !outlet) {
    return res.status(400).json({ error: 'Date and outlet are required' });
  }

  try {
    let tripRate = null;
    if (delivery_province && delivery_city) {
      let wheelCount = 0;
      if (vehicle_id) {
        const [vRows] = await pool.execute('SELECT wheel_count FROM vehicles WHERE id = ?', [vehicle_id]);
        wheelCount = vRows[0]?.wheel_count || 0;
      }
      const [rateRows] = await pool.execute(
        `SELECT driver_rate, helper_rate, rate FROM trip_rates
         WHERE province = ? AND city = ?
         ORDER BY CASE WHEN wheel_count = ? THEN 0 ELSE 1 END, wheel_count DESC
         LIMIT 1`,
        [delivery_province, delivery_city, wheelCount]
      );
      if (rateRows.length) tripRate = rateRows[0].driver_rate ?? rateRows[0].rate;
    }

    const [result] = await pool.execute(
      `INSERT INTO deliveries (
        date, gate_pass_number, outlet, location, number_of_boxes,
        bo, number_of_bo_boxes, backlift, driver_id, replacement_driver_name, helper_name,
        vehicle_id, status, notes, eta, reject_return,
        delivery_province, delivery_city, trip_rate, assigned_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`,
      [
        date, gate_pass_number || null, outlet, location || null,
        parseInt(number_of_boxes) || 0,
        bo ? 1 : 0, parseInt(number_of_bo_boxes) || 0, backlift ? 1 : 0,
        driver_id || null, replacement_driver_name || null, helper_name || null,
        vehicle_id || null, status || 'pending', notes || null,
        eta || null, reject_return || 'none',
        delivery_province || null, delivery_city || null, tripRate, req.user.id
      ]
    );

    /* Mark vehicle in_use as soon as a delivery is assigned to it */
    if (vehicle_id) {
      await pool.execute("UPDATE vehicles SET status = 'in_use' WHERE id = ?", [vehicle_id]);
    }

    /* Initial tracking entry */
    await pool.execute(
      'INSERT INTO delivery_tracking (delivery_id, status, notes, recorded_by) VALUES (?, ?, ?, ?)',
      [result.insertId, status || 'pending', 'Delivery created', req.user.id]
    );

    if (driver_id) {
      const [driver] = await pool.execute('SELECT user_id FROM drivers WHERE id = ?', [driver_id]);
      if (driver.length && driver[0].user_id) {
        await pool.execute(
          'INSERT INTO notifications (user_id, title, message, type, related_id, related_type) VALUES (?, ?, ?, ?, ?, ?)',
          [driver[0].user_id, 'New Delivery Assigned',
           `You have been assigned delivery to ${outlet}`, 'delivery', result.insertId, 'delivery']
        );
      }
    }

    const [newDelivery] = await pool.execute(
      `SELECT ${deliveryFields}
       FROM deliveries d
       LEFT JOIN drivers dr ON d.driver_id = dr.id

       LEFT JOIN vehicles v ON d.vehicle_id = v.id

       LEFT JOIN users u ON d.assigned_by = u.id
       WHERE d.id = ?`,
      [result.insertId]
    );

    res.status(201).json({ delivery: newDelivery[0], message: 'Delivery created successfully' });
  } catch (err) {
    console.error('Create delivery error:', err);
    res.status(500).json({ error: 'Failed to create delivery' });
  }
};

exports.update = async (req, res) => {
  const { id } = req.params;
  const {
    date, gate_pass_number, outlet, location, number_of_boxes,
    bo, number_of_bo_boxes, backlift, driver_id, replacement_driver_name, helper_name,
    vehicle_id, status, notes, eta, reject_return,
    completed_delivery_time, actual_start_time,
    delivery_province, delivery_city
  } = req.body;

  try {
    const [existing] = await pool.execute('SELECT * FROM deliveries WHERE id = ?', [id]);
    if (!existing.length) return res.status(404).json({ error: 'Delivery not found' });

    const newProvince = delivery_province !== undefined ? delivery_province || null : existing[0].delivery_province;
    const newCity = delivery_city !== undefined ? delivery_city || null : existing[0].delivery_city;

    let newTripRate = existing[0].trip_rate;
    if (delivery_province !== undefined || delivery_city !== undefined) {
      if (newProvince && newCity) {
        const [rateRows] = await pool.execute(
          'SELECT rate FROM trip_rates WHERE province = ? AND city = ?',
          [newProvince, newCity]
        );
        newTripRate = rateRows.length ? rateRows[0].rate : null;
      } else {
        newTripRate = null;
      }
    }

    await pool.execute(
      `UPDATE deliveries SET
        date = ?, gate_pass_number = ?, outlet = ?, location = ?,
        number_of_boxes = ?, bo = ?, number_of_bo_boxes = ?, backlift = ?,
        driver_id = ?, replacement_driver_name = ?, helper_name = ?, vehicle_id = ?,
        status = ?, notes = ?, eta = ?, reject_return = ?,
        completed_delivery_time = ?, actual_start_time = ?,
        delivery_province = ?, delivery_city = ?, trip_rate = ?,
        updated_at = NOW()
      WHERE id = ?`,
      [
        date || existing[0].date,
        gate_pass_number !== undefined ? gate_pass_number : existing[0].gate_pass_number,
        outlet || existing[0].outlet,
        location !== undefined ? location : existing[0].location,
        number_of_boxes !== undefined ? parseInt(number_of_boxes) : existing[0].number_of_boxes,
        bo !== undefined ? (bo ? 1 : 0) : existing[0].bo,
        number_of_bo_boxes !== undefined ? parseInt(number_of_bo_boxes) : existing[0].number_of_bo_boxes,
        backlift !== undefined ? (backlift ? 1 : 0) : existing[0].backlift,
        driver_id !== undefined ? driver_id || null : existing[0].driver_id,
        replacement_driver_name !== undefined ? replacement_driver_name || null : existing[0].replacement_driver_name,
        helper_name !== undefined ? helper_name || null : existing[0].helper_name,
        vehicle_id !== undefined ? vehicle_id || null : existing[0].vehicle_id,
        status || existing[0].status,
        notes !== undefined ? notes : existing[0].notes,
        eta !== undefined ? eta || null : existing[0].eta,
        reject_return || existing[0].reject_return,
        completed_delivery_time !== undefined ? completed_delivery_time || null : existing[0].completed_delivery_time,
        actual_start_time !== undefined ? actual_start_time || null : existing[0].actual_start_time,
        newProvince, newCity, newTripRate,
        id
      ]
    );

    /* Insert tracking entry on status change */
    if (status && status !== existing[0].status) {
      const statusNotes = {
        in_transit:        'Delivery started — goods in transit',
        arrived_unloading: 'Arrived at location — unloading in progress',
        delivered:         'Delivery marked as delivered',
        delayed:           'Delivery marked as delayed',
        returned:          'Returned to warehouse',
        cancelled:         'Delivery cancelled',
      };
      await pool.execute(
        'INSERT INTO delivery_tracking (delivery_id, status, notes, recorded_by) VALUES (?, ?, ?, ?)',
        [id, status, statusNotes[status] || `Status changed to ${status}`, req.user?.id || null]
      );
    }

    const effectiveVehicle = vehicle_id !== undefined ? vehicle_id : existing[0].vehicle_id;
    if (status && status !== existing[0].status && effectiveVehicle) {
      if (['pending', 'in_transit', 'arrived_unloading'].includes(status)) {
        /* Active delivery phases — vehicle is in use */
        await pool.execute("UPDATE vehicles SET status = 'in_use' WHERE id = ?", [effectiveVehicle]);
      } else if (['delivered', 'cancelled', 'returned'].includes(status)) {
        /* Check if any other active deliveries still use this vehicle */
        const [active] = await pool.execute(
          `SELECT COUNT(*) as cnt FROM deliveries
           WHERE vehicle_id = ? AND id != ? AND status IN ('pending','in_transit','arrived_unloading')`,
          [effectiveVehicle, id]
        );
        if ((active[0]?.cnt || 0) === 0) {
          await pool.execute("UPDATE vehicles SET status = 'available' WHERE id = ?", [effectiveVehicle]);
        }
      }
    }

    const [updated] = await pool.execute(
      `SELECT ${deliveryFields}
       FROM deliveries d
       LEFT JOIN drivers dr ON d.driver_id = dr.id

       LEFT JOIN vehicles v ON d.vehicle_id = v.id

       LEFT JOIN users u ON d.assigned_by = u.id
       WHERE d.id = ?`,
      [id]
    );

    res.json({ delivery: updated[0], message: 'Delivery updated successfully' });
  } catch (err) {
    console.error('Update delivery error:', err);
    res.status(500).json({ error: 'Failed to update delivery' });
  }
};

exports.delete = async (req, res) => {
  try {
    const [existing] = await pool.execute('SELECT id FROM deliveries WHERE id = ?', [req.params.id]);
    if (!existing.length) return res.status(404).json({ error: 'Delivery not found' });

    await pool.execute('DELETE FROM deliveries WHERE id = ?', [req.params.id]);
    res.json({ message: 'Delivery deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete delivery' });
  }
};

exports.uploadProof = async (req, res) => {
  const { id } = req.params;
  try {
    const [existing] = await pool.execute('SELECT id FROM deliveries WHERE id = ?', [id]);
    if (!existing.length) return res.status(404).json({ error: 'Delivery not found' });

    const updates = {};
    if (req.files?.photo) updates.delivery_photo = await uploadToStorage(req.files.photo[0]);
    if (req.files?.signature) updates.customer_signature = await uploadToStorage(req.files.signature[0]);

    if (!Object.keys(updates).length) {
      return res.status(400).json({ error: 'No files uploaded' });
    }

    const setClause = Object.keys(updates).map(k => `${k} = ?`).join(', ');
    await pool.execute(
      `UPDATE deliveries SET ${setClause}, proof_uploaded = TRUE, updated_at = NOW() WHERE id = ?`,
      [...Object.values(updates), id]
    );

    res.json({ message: 'Proof uploaded successfully', ...updates });
  } catch (err) {
    res.status(500).json({ error: 'Failed to upload proof' });
  }
};

exports.advancePhase = async (req, res) => {
  const { id } = req.params;
  const { phase, arrival_time } = req.body;

  try {
    const [existing] = await pool.execute('SELECT * FROM deliveries WHERE id = ?', [id]);
    if (!existing.length) return res.status(404).json({ error: 'Delivery not found' });

    // Auto-link driver's vehicle if the delivery has none
    if (!existing[0].vehicle_id && existing[0].driver_id) {
      const [vRows] = await pool.execute(
        'SELECT id FROM vehicles WHERE assigned_driver_id = ? LIMIT 1',
        [existing[0].driver_id]
      );
      if (vRows.length) {
        await pool.execute('UPDATE deliveries SET vehicle_id = ? WHERE id = ?', [vRows[0].id, id]);
        existing[0].vehicle_id = vRows[0].id;
      }
    }

    let updateSql, updateParams, newStatus, trackingStatus, trackingNote;

    if (phase === '1') {
      const file = req.files?.loading_photo?.[0];
      if (!file) return res.status(400).json({ error: 'Loading photo is required' });
      newStatus = 'in_transit';
      trackingStatus = 'in_transit';
      const loadingUrl = await uploadToStorage(file);
      updateSql = 'UPDATE deliveries SET loading_photo = ?, status = ?, actual_start_time = NOW(), updated_at = NOW() WHERE id = ?';
      updateParams = [loadingUrl, newStatus, id];
      trackingNote = 'Loading proof uploaded — goods in transit';

    } else if (phase === '2') {
      const file = req.files?.unloading_photo?.[0];
      if (!file) return res.status(400).json({ error: 'Arrival area photo is required' });
      if (!arrival_time) return res.status(400).json({ error: 'Arrival time is required' });
      newStatus = 'arrived_unloading';
      trackingStatus = 'arrived_unloading';
      const unloadingUrl = await uploadToStorage(file);
      updateSql = 'UPDATE deliveries SET unloading_photo = ?, arrival_time = ?, status = ?, updated_at = NOW() WHERE id = ?';
      updateParams = [unloadingUrl, arrival_time, newStatus, id];
      trackingNote = `Arrived at location — unloading in progress`;

    } else if (phase === '3') {
      /* Delivery proof: photo + optional signature — status stays arrived_unloading */
      const deliveryFile = req.files?.delivery_photo?.[0];
      const sigFile      = req.files?.signature?.[0];
      if (!deliveryFile) return res.status(400).json({ error: 'Delivery photo is required' });
      newStatus = null; // no status change
      trackingStatus = 'delivery_proof';
      const deliveryUrl = await uploadToStorage(deliveryFile);
      const sets   = ['delivery_photo = ?', 'updated_at = NOW()'];
      const vals   = [deliveryUrl];
      if (sigFile) { sets.push('customer_signature = ?'); vals.push(await uploadToStorage(sigFile)); }
      updateSql    = `UPDATE deliveries SET ${sets.join(', ')} WHERE id = ?`;
      updateParams = [...vals, id];
      trackingNote = 'Unloading complete — delivery proof captured';

    } else if (phase === '4') {
      const files = req.files?.document_photos || [];
      if (!files.length) return res.status(400).json({ error: 'At least one document photo is required' });
      const docUrls = await Promise.all(files.map(f => uploadToStorage(f)));
      const docPaths = JSON.stringify(docUrls);
      newStatus = 'delivered';
      trackingStatus = 'delivered';
      updateSql = 'UPDATE deliveries SET document_photos = ?, status = ?, completed_delivery_time = NOW(), proof_uploaded = TRUE, updated_at = NOW() WHERE id = ?';
      updateParams = [docPaths, newStatus, id];
      trackingNote = 'Delivery completed — documents uploaded';

    } else {
      return res.status(400).json({ error: 'Invalid phase number' });
    }

    await pool.execute(updateSql, updateParams);

    if (newStatus && existing[0].vehicle_id) {
      if (newStatus === 'in_transit') {
        await pool.execute("UPDATE vehicles SET status = 'in_use' WHERE id = ?", [existing[0].vehicle_id]);
      } else if (newStatus === 'delivered') {
        const [active] = await pool.execute(
          `SELECT COUNT(*) as cnt FROM deliveries
           WHERE vehicle_id = ? AND id != ? AND status IN ('pending','in_transit','arrived_unloading')`,
          [existing[0].vehicle_id, id]
        );
        if ((active[0]?.cnt || 0) === 0) {
          await pool.execute("UPDATE vehicles SET status = 'available' WHERE id = ?", [existing[0].vehicle_id]);
        }
      }
    }

    /* Insert tracking entry */
    await pool.execute(
      'INSERT INTO delivery_tracking (delivery_id, status, notes, recorded_by) VALUES (?, ?, ?, ?)',
      [id, trackingStatus, trackingNote, req.user?.id || null]
    );

    const [updated] = await pool.execute(
      `SELECT ${deliveryFields}
       FROM deliveries d
       LEFT JOIN drivers dr ON d.driver_id = dr.id
       LEFT JOIN vehicles v ON d.vehicle_id = v.id
       LEFT JOIN users u ON d.assigned_by = u.id
       WHERE d.id = ?`,
      [id]
    );

    res.json({ delivery: updated[0], message: `Phase ${phase} completed successfully` });
  } catch (err) {
    console.error('Advance phase error:', err);
    res.status(500).json({ error: 'Failed to advance delivery phase' });
  }
};
