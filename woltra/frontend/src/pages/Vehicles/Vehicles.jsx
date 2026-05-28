import { useState, useEffect, useCallback } from 'react';
import { useSelector } from 'react-redux';
import { useSearchParams } from 'react-router-dom';
import { Plus, Search, Edit, Trash2, ChevronDown, Wrench, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { format, differenceInDays } from 'date-fns';
import api from '../../services/api';
import Badge from '../../components/common/Badge';
import Pagination from '../../components/common/Pagination';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import EmptyState from '../../components/common/EmptyState';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import VehicleForm from './VehicleForm';
import VehicleReports from '../VehicleReports/VehicleReports';

const SUB_NAVS = [
  { id: 'fleet',       label: 'Fleet' },
  { id: 'maintenance', label: 'Maintenance' },
  { id: 'reports',     label: 'Truck Reports' },
];

// ── Maintenance quick-edit modal ──────────────────────────────────────────────
function MaintenanceModal({ vehicle, onClose, onSaved }) {
  const [form, setForm] = useState({
    current_mileage:       vehicle.current_mileage || '',
    last_maintenance_date: vehicle.last_maintenance_date?.split('T')[0] || '',
    next_maintenance_date: vehicle.next_maintenance_date?.split('T')[0] || '',
  });
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      await api.put(`/vehicles/${vehicle.id}`, form);
      toast.success('Maintenance updated');
      onSaved();
    } catch {
      toast.error('Failed to update');
    } finally { setSaving(false); }
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 50,
      background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem',
    }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{
        background: 'var(--bg-card)', borderRadius: 14, padding: '1.5rem',
        width: '100%', maxWidth: 420, boxShadow: 'var(--shadow-modal)',
        border: '1px solid var(--border)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
          <div>
            <p style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-h)' }}>Update Maintenance</p>
            <p style={{ fontSize: '12px', color: 'var(--text-3)', marginTop: 2, fontFamily: '"JetBrains Mono", monospace' }}>
              {vehicle.truck_id} · {vehicle.plate_number}
            </p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)', padding: 4 }}>
            <X size={18} />
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div>
            <label className="label">Current Mileage (km)</label>
            <input type="number" className="input-field" value={form.current_mileage}
              onChange={e => setForm(f => ({ ...f, current_mileage: e.target.value }))} />
          </div>
          <div>
            <label className="label">Last Maintenance Date</label>
            <input type="date" className="input-field" value={form.last_maintenance_date}
              onChange={e => setForm(f => ({ ...f, last_maintenance_date: e.target.value }))} />
          </div>
          <div>
            <label className="label">Next Maintenance Date</label>
            <input type="date" className="input-field" value={form.next_maintenance_date}
              onChange={e => setForm(f => ({ ...f, next_maintenance_date: e.target.value }))} />
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: '1.25rem' }}>
          <button onClick={onClose} className="btn-secondary" disabled={saving}>Cancel</button>
          <button onClick={save} className="btn-primary" disabled={saving}>
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Maintenance tab ───────────────────────────────────────────────────────────
function MaintenanceTab() {
  const [vehicles, setVehicles]     = useState([]);
  const [loading, setLoading]       = useState(true);
  const [editVehicle, setEditVehicle] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/vehicles?limit=100');
      setVehicles(res.data.data || []);
    } catch {} finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const getMaintStatus = (vehicle) => {
    if (!vehicle.next_maintenance_date) return null;
    const days = differenceInDays(new Date(vehicle.next_maintenance_date), new Date());
    if (days < 0)   return { label: `Overdue by ${Math.abs(days)}d`, color: '#EF4444', bg: 'rgba(239,68,68,0.1)',  border: 'rgba(239,68,68,0.25)' };
    if (days <= 14) return { label: `Due in ${days}d`,               color: '#F59E0B', bg: 'rgba(245,158,11,0.1)', border: 'rgba(245,158,11,0.25)' };
    return              { label: 'On Schedule',                        color: '#10B981', bg: 'rgba(16,185,129,0.1)', border: 'rgba(16,185,129,0.25)' };
  };

  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}>
      <LoadingSpinner size="xl" />
    </div>
  );

  if (vehicles.length === 0) return (
    <div className="card">
      <EmptyState icon="trucks" title="No vehicles" message="Add vehicles to track maintenance." />
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {vehicles.map(v => {
        const ms = getMaintStatus(v);
        return (
          <div key={v.id} className="card" style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
            <div style={{ minWidth: 110, flex: '0 0 auto' }}>
              <p style={{ fontSize: '13.5px', fontWeight: 700, color: 'var(--text-h)' }}>{v.truck_id}</p>
              <p style={{ fontSize: '11.5px', color: 'var(--text-3)', fontFamily: '"JetBrains Mono", monospace' }}>{v.plate_number}</p>
            </div>

            <div style={{ flex: 1, minWidth: 90 }}>
              <p style={{ fontSize: '11px', color: 'var(--text-3)', marginBottom: 2 }}>Mileage</p>
              <p style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text)', fontFamily: '"JetBrains Mono", monospace' }}>
                {v.current_mileage ? `${Number(v.current_mileage).toLocaleString()} km` : '—'}
              </p>
            </div>

            <div style={{ flex: 1, minWidth: 110 }}>
              <p style={{ fontSize: '11px', color: 'var(--text-3)', marginBottom: 2 }}>Last Service</p>
              <p style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text)', fontFamily: '"JetBrains Mono", monospace' }}>
                {v.last_maintenance_date ? format(new Date(v.last_maintenance_date), 'dd/MM/yyyy') : '—'}
              </p>
            </div>

            <div style={{ flex: 1, minWidth: 110 }}>
              <p style={{ fontSize: '11px', color: 'var(--text-3)', marginBottom: 2 }}>Next Service</p>
              <p style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text)', fontFamily: '"JetBrains Mono", monospace' }}>
                {v.next_maintenance_date ? format(new Date(v.next_maintenance_date), 'dd/MM/yyyy') : '—'}
              </p>
            </div>

            <div style={{ flex: '0 0 auto' }}>
              {ms ? (
                <span style={{
                  fontSize: '11px', fontWeight: 700, padding: '3px 9px', borderRadius: 99,
                  color: ms.color, background: ms.bg, border: `1px solid ${ms.border}`,
                }}>
                  {ms.label}
                </span>
              ) : (
                <span style={{ fontSize: '11px', color: 'var(--text-3)' }}>No date set</span>
              )}
            </div>

            <button
              onClick={() => setEditVehicle(v)}
              className="btn-secondary"
              style={{ fontSize: '12px', padding: '6px 14px', flex: '0 0 auto' }}
            >
              <Wrench size={13} />
              Update
            </button>
          </div>
        );
      })}

      {editVehicle && (
        <MaintenanceModal
          vehicle={editVehicle}
          onClose={() => setEditVehicle(null)}
          onSaved={() => { setEditVehicle(null); load(); }}
        />
      )}
    </div>
  );
}

// ── Status stat tiles ─────────────────────────────────────────────────────────
const STATUS_TILES = [
  { status: '',            label: 'All',         color: 'var(--text-3)',  bg: 'var(--bg-card-alt)' },
  { status: 'available',  label: 'Available',   color: '#10B981',       bg: 'rgba(16,185,129,0.1)'  },
  { status: 'in_use',     label: 'In Use',      color: 'var(--blue)',   bg: 'rgba(59,130,246,0.1)'  },
  { status: 'maintenance', label: 'Maintenance', color: 'var(--orange)', bg: 'rgba(240,140,46,0.1)'  },
];

// ── Fleet tab ─────────────────────────────────────────────────────────────────
function FleetTab() {
  const { user } = useSelector(s => s.auth);
  const [vehicles, setVehicles]       = useState([]);
  const [allVehicles, setAllVehicles] = useState([]);
  const [pagination, setPagination]   = useState(null);
  const [loading, setLoading]         = useState(true);
  const [params, setParams]           = useState({ page: 1, limit: 10, search: '', status: '' });
  const [showForm, setShowForm]       = useState(false);
  const [editVehicle, setEditVehicle] = useState(null);
  const [deleteId, setDeleteId]       = useState(null);
  const [deleting, setDeleting]       = useState(false);
  const [expandedId, setExpandedId]   = useState(null);
  const canManage = user?.role === 'owner';

  const fetchVehicles = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get(`/vehicles?${new URLSearchParams(params)}`);
      setVehicles(res.data.data);
      setPagination(res.data.pagination);
    } catch {} finally { setLoading(false); }
  }, [params]);

  useEffect(() => { fetchVehicles(); }, [fetchVehicles]);

  useEffect(() => {
    api.get('/vehicles?limit=200').then(r => setAllVehicles(r.data.data || [])).catch(() => {});
  }, []);

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await api.delete(`/vehicles/${deleteId}`);
      toast.success('Vehicle deleted');
      setDeleteId(null);
      fetchVehicles();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to delete');
    } finally { setDeleting(false); }
  };

  const countFor = (s) => s ? allVehicles.filter(v => v.status === s).length : allVehicles.length;

  return (
    <>
      {/* Stat tiles */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 12 }}>
        {STATUS_TILES.map(({ status, label, color, bg }) => (
          <button
            key={status}
            onClick={() => setParams(p => ({ ...p, status, page: 1 }))}
            style={{
              padding: '10px 14px', borderRadius: 9, textAlign: 'left',
              background: params.status === status ? bg : 'var(--bg-card)',
              border: `1px solid ${params.status === status ? color + '50' : 'var(--border)'}`,
              cursor: 'pointer', transition: 'all 0.15s',
            }}
          >
            <p style={{ fontSize: '1.1rem', fontWeight: 800, color: params.status === status ? color : 'var(--text-h)', fontFamily: '"JetBrains Mono", monospace', lineHeight: 1 }}>
              {countFor(status)}
            </p>
            <p style={{ fontSize: '11px', color: params.status === status ? color : 'var(--text-3)', marginTop: 3, fontWeight: 600 }}>{label}</p>
          </button>
        ))}
      </div>

      {/* Search + Add */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <div style={{ position: 'relative', flex: 1 }}>
          <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-3)', pointerEvents: 'none' }} />
          <input
            type="text"
            placeholder="Search truck ID, plate, make..."
            className="input-field"
            style={{ paddingLeft: 32 }}
            value={params.search}
            onChange={e => setParams(p => ({ ...p, search: e.target.value, page: 1 }))}
          />
        </div>
        {canManage && (
          <button onClick={() => { setEditVehicle(null); setShowForm(true); }} className="btn-primary">
            <Plus size={14} />
            Add Vehicle
          </button>
        )}
      </div>

      {/* Vehicle cards */}
      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '3rem 0' }}>
          <LoadingSpinner size="lg" />
        </div>
      ) : vehicles.length === 0 ? (
        <div className="card">
          <EmptyState
            icon="trucks"
            title="No vehicles found"
            message={params.search || params.status ? 'Try adjusting your filters.' : 'Add a vehicle to get started.'}
            action={(!params.search && !params.status && canManage) ? () => { setEditVehicle(null); setShowForm(true); } : undefined}
            actionLabel="Add Vehicle"
          />
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {vehicles.map(v => {
            const isOpen = expandedId === v.id;
            return (
              <div key={v.id} style={{
                background: 'var(--bg-card)', border: '1px solid var(--border)',
                borderRadius: 10, overflow: 'hidden',
                transition: 'border-color 0.15s',
              }}>
                {/* Row */}
                <button
                  type="button"
                  onClick={() => setExpandedId(isOpen ? null : v.id)}
                  style={{
                    width: '100%', padding: '13px 16px',
                    background: 'none', border: 'none', cursor: 'pointer',
                    textAlign: 'left', display: 'flex', alignItems: 'center', gap: 12,
                  }}
                >
                  {/* Status dot */}
                  <div style={{
                    width: 36, height: 36, borderRadius: 8, flexShrink: 0,
                    background: 'var(--bg-card-alt)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Wrench size={16} color="var(--text-3)" />
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                      <p style={{ fontSize: '13.5px', fontWeight: 700, color: 'var(--text-h)' }}>{v.truck_id}</p>
                      <span style={{
                        fontFamily: '"JetBrains Mono", monospace',
                        fontSize: '10.5px', color: 'var(--text-3)',
                        background: 'var(--bg-card-alt)',
                        padding: '1px 6px', borderRadius: 4,
                        border: '1px solid var(--border)', flexShrink: 0,
                      }}>
                        {v.plate_number}
                      </span>
                    </div>
                    <p style={{ fontSize: '11.5px', color: 'var(--text-3)' }}>
                      {[v.make, v.model, v.year].filter(Boolean).join(' ') || 'No make/model'}
                      {v.assigned_driver_name && ` · ${v.assigned_driver_name}`}
                    </p>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                    <Badge status={v.status} />
                    <ChevronDown size={14} color="var(--text-3)" style={{ transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
                  </div>
                </button>

                {/* Expanded detail */}
                {isOpen && (
                  <div style={{ padding: '12px 16px 14px', borderTop: '1px solid var(--border)', background: 'var(--bg)' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px 24px', marginBottom: 12 }}>
                      {[
                        { label: 'Fuel Type',        value: v.fuel_type ? v.fuel_type.charAt(0).toUpperCase() + v.fuel_type.slice(1) : '—' },
                        { label: 'Capacity',         value: v.capacity ? `${v.capacity} ${v.capacity_unit}` : '—' },
                        { label: 'Mileage',          value: v.current_mileage ? `${Number(v.current_mileage).toLocaleString()} km` : '—' },
                        { label: 'Assigned Driver',  value: v.assigned_driver_name || '—' },
                      ].map(({ label, value }) => (
                        <div key={label}>
                          <p style={{ fontSize: '10.5px', color: 'var(--text-3)', marginBottom: 1 }}>{label}</p>
                          <p style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text)' }}>{value}</p>
                        </div>
                      ))}
                    </div>

                    {v.claim_code && (
                      <div style={{ marginBottom: 12, padding: '8px 12px', background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.2)', borderRadius: 8 }}>
                        <p style={{ fontSize: '10.5px', fontWeight: 700, color: 'var(--blue)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 3 }}>Vehicle Code</p>
                        <p style={{ fontFamily: '"JetBrains Mono", monospace', fontWeight: 800, fontSize: '1.1rem', color: 'var(--blue)', letterSpacing: '0.12em' }}>{v.claim_code}</p>
                        <p style={{ fontSize: '11px', color: 'var(--text-3)', marginTop: 2 }}>Share with driver to link this vehicle</p>
                      </div>
                    )}

                    {canManage && (
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button
                          onClick={() => { setEditVehicle(v); setShowForm(true); setExpandedId(null); }}
                          className="btn-secondary"
                          style={{ fontSize: '12px' }}
                        >
                          <Edit size={13} /> Edit
                        </button>
                        <button
                          onClick={() => setDeleteId(v.id)}
                          style={{
                            background: 'none', border: '1px solid var(--border)', cursor: 'pointer',
                            borderRadius: 7, padding: '6px 12px', fontSize: '12px', fontWeight: 600,
                            color: 'var(--red)', display: 'flex', alignItems: 'center', gap: 5,
                            transition: 'background 0.15s',
                          }}
                          onMouseEnter={e => e.currentTarget.style.background = 'rgba(239,68,68,0.08)'}
                          onMouseLeave={e => e.currentTarget.style.background = 'none'}
                        >
                          <Trash2 size={13} /> Delete
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <Pagination pagination={pagination} onPageChange={p => setParams(prev => ({ ...prev, page: p }))} />

      {showForm && (
        <VehicleForm
          vehicle={editVehicle}
          onClose={() => setShowForm(false)}
          onSuccess={() => { setShowForm(false); fetchVehicles(); }}
        />
      )}
      <ConfirmDialog
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={handleDelete}
        loading={deleting}
        title="Delete Vehicle"
        message="Are you sure you want to delete this vehicle?"
      />
    </>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────
export default function Vehicles() {
  const [searchParams] = useSearchParams();
  const [subNav, setSubNav] = useState(searchParams.get('tab') || 'fleet');

  return (
    <div className="space-y-4 fade-in">
      {/* Page header */}
      <div>
        <h1 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-h)' }}>Vehicles</h1>
        <p style={{ fontSize: '12px', color: 'var(--text-3)' }}>Fleet management and tracking</p>
      </div>

      {/* Sub-navigation */}
      <div className="tab-strip" style={{ width: 'fit-content' }}>
        {SUB_NAVS.map(({ id, label }) => (
          <button key={id} onClick={() => setSubNav(id)} className={`tab-item${subNav === id ? ' tab-item-active' : ''}`}>
            {label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {subNav === 'fleet'       && <FleetTab />}
      {subNav === 'maintenance' && <MaintenanceTab />}
      {subNav === 'reports'     && <VehicleReports />}
    </div>
  );
}
