import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { Plus, Search, Truck, Phone, Eye, Edit, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../services/api';
import Badge from '../../components/common/Badge';
import Pagination from '../../components/common/Pagination';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import EmptyState from '../../components/common/EmptyState';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import DriverForm from './DriverForm';

export default function Drivers() {
  const { user } = useSelector(s => s.auth);
  const navigate = useNavigate();
  const [drivers, setDrivers]     = useState([]);
  const [pagination, setPagination] = useState(null);
  const [loading, setLoading]     = useState(true);
  const [params, setParams]       = useState({ page: 1, limit: 10, search: '', status: '' });
  const [showForm, setShowForm]   = useState(false);
  const [editDriver, setEditDriver] = useState(null);
  const [deleteId, setDeleteId]   = useState(null);
  const [deleting, setDeleting]   = useState(false);
  const canManage = user?.role === 'owner';

  const fetchDrivers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get(`/drivers?${new URLSearchParams(params)}`);
      setDrivers(res.data.data);
      setPagination(res.data.pagination);
    } catch {} finally { setLoading(false); }
  }, [params]);

  useEffect(() => { fetchDrivers(); }, [fetchDrivers]);

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await api.delete(`/drivers/${deleteId}`);
      toast.success('Driver removed');
      setDeleteId(null);
      fetchDrivers();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to delete');
    } finally { setDeleting(false); }
  };

  return (
    <div className="space-y-4 fade-in">

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-h)' }}>Drivers</h1>
          <p style={{ fontSize: '12px', color: 'var(--text-3)' }}>Manage driver roster and assignments</p>
        </div>
        {canManage && (
          <button onClick={() => { setEditDriver(null); setShowForm(true); }} className="btn-primary">
            <Plus size={14} />
            Add Driver
          </button>
        )}
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 180 }}>
          <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-3)', pointerEvents: 'none' }} />
          <input
            type="text"
            placeholder="Search name or employee ID..."
            className="input-field"
            style={{ paddingLeft: 32 }}
            value={params.search}
            onChange={e => setParams(p => ({ ...p, search: e.target.value, page: 1 }))}
          />
        </div>
        <select
          className="input-field"
          style={{ width: 150 }}
          value={params.status}
          onChange={e => setParams(p => ({ ...p, status: e.target.value, page: 1 }))}
        >
          <option value="">All Status</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
          <option value="on_leave">On Leave</option>
        </select>
      </div>

      {/* List */}
      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '4rem 0' }}>
          <LoadingSpinner size="lg" />
        </div>
      ) : drivers.length === 0 ? (
        <div className="card">
          <EmptyState
            icon="drivers"
            title="No drivers found"
            message={params.search || params.status ? 'Try adjusting your filters.' : 'Add a driver to get started.'}
            action={(!params.search && !params.status && canManage) ? () => { setEditDriver(null); setShowForm(true); } : undefined}
            actionLabel="Add Driver"
          />
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {drivers.map(d => (
            <div
              key={d.id}
              style={{
                background: 'var(--bg-card)',
                border: '1px solid var(--border)',
                borderRadius: 10,
                padding: '13px 16px',
                display: 'flex', alignItems: 'center', gap: 12,
                transition: 'border-color 0.15s, box-shadow 0.15s',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.borderColor = 'rgba(59,130,246,0.35)';
                e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.07)';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.borderColor = 'var(--border)';
                e.currentTarget.style.boxShadow = 'none';
              }}
            >
              {/* Avatar */}
              <div style={{
                width: 38, height: 38, borderRadius: '50%', flexShrink: 0,
                background: 'rgba(59,130,246,0.12)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '14px', fontWeight: 800, color: 'var(--blue)',
              }}>
                {d.name?.charAt(0)?.toUpperCase()}
              </div>

              {/* Info */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3, flexWrap: 'wrap' }}>
                  <p style={{ fontSize: '13.5px', fontWeight: 700, color: 'var(--text-h)' }}>{d.name}</p>
                  <span style={{
                    fontFamily: '"JetBrains Mono", monospace',
                    fontSize: '10.5px', color: 'var(--text-3)',
                    background: 'var(--bg-card-alt)',
                    padding: '1px 6px', borderRadius: 4,
                    border: '1px solid var(--border)', flexShrink: 0,
                  }}>
                    {d.employee_id}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                  {d.phone && (
                    <span style={{ fontSize: '11.5px', color: 'var(--text-3)', display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Phone size={11} /> {d.phone}
                    </span>
                  )}
                  <span style={{ fontSize: '11.5px', color: 'var(--text-3)', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Truck size={11} />
                    <span style={{ fontFamily: '"JetBrains Mono", monospace' }}>
                      {d.total_deliveries || 0}
                    </span> trips
                    {(d.completed_deliveries > 0) && (
                      <span style={{ color: '#10B981', marginLeft: 2 }}>· {d.completed_deliveries} done</span>
                    )}
                  </span>
                </div>
              </div>

              {/* Status + Actions */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                <Badge status={d.status} />
                <button
                  onClick={() => navigate(`/drivers/${d.id}`)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)', padding: 5, borderRadius: 6, display: 'flex', alignItems: 'center', transition: 'color 0.15s' }}
                  onMouseEnter={e => e.currentTarget.style.color = 'var(--blue)'}
                  onMouseLeave={e => e.currentTarget.style.color = 'var(--text-3)'}
                  title="View"
                >
                  <Eye size={15} />
                </button>
                {canManage && (
                  <>
                    <button
                      onClick={() => { setEditDriver(d); setShowForm(true); }}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)', padding: 5, borderRadius: 6, display: 'flex', alignItems: 'center', transition: 'color 0.15s' }}
                      onMouseEnter={e => e.currentTarget.style.color = 'var(--blue)'}
                      onMouseLeave={e => e.currentTarget.style.color = 'var(--text-3)'}
                      title="Edit"
                    >
                      <Edit size={15} />
                    </button>
                    <button
                      onClick={() => setDeleteId(d.id)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)', padding: 5, borderRadius: 6, display: 'flex', alignItems: 'center', transition: 'color 0.15s' }}
                      onMouseEnter={e => e.currentTarget.style.color = 'var(--red)'}
                      onMouseLeave={e => e.currentTarget.style.color = 'var(--text-3)'}
                      title="Delete"
                    >
                      <Trash2 size={15} />
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <Pagination pagination={pagination} onPageChange={p => setParams(prev => ({ ...prev, page: p }))} />

      {showForm && (
        <DriverForm
          driver={editDriver}
          onClose={() => setShowForm(false)}
          onSuccess={() => { setShowForm(false); fetchDrivers(); }}
        />
      )}
      <ConfirmDialog
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={handleDelete}
        loading={deleting}
        title="Remove Driver"
        message="Are you sure you want to remove this driver?"
      />
    </div>
  );
}
