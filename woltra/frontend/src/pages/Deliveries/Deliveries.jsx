import { useState, useEffect, useCallback } from 'react';
import { useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { Search, Download, RefreshCw, Plus, ChevronRight, X, Package } from 'lucide-react';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import api from '../../services/api';
import StatusPill from '../../components/common/StatusPill';
import Pagination from '../../components/common/Pagination';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import EmptyState from '../../components/common/EmptyState';
import DeliveryWorkflow from './DeliveryWorkflow';
import DeliveryForm from './DeliveryForm';
import DeliveryDetail from './DeliveryDetail';

const STATUSES = ['', 'pending', 'in_transit', 'arrived_unloading', 'delivered', 'delayed', 'cancelled', 'returned'];
const ACTIVE_PHASES = ['pending', 'in_transit', 'arrived_unloading'];

/* CSS token-based accent per status */
const STATUS_ACCENT = {
  delivered:         'var(--s-delivered)',
  in_transit:        'var(--s-transit)',
  pending:           'var(--s-pending)',
  delayed:           'var(--s-delayed)',
  returned:          'var(--s-returned)',
  cancelled:         'var(--s-cancelled)',
  arrived_unloading: 'var(--s-unloading)',
};

export default function Deliveries() {
  const { user } = useSelector(s => s.auth);
  const navigate  = useNavigate();

  const [isDesktop, setIsDesktop]   = useState(() => window.innerWidth >= 1024);
  const [isMobile, setIsMobile]     = useState(() => window.innerWidth < 640);
  const [deliveries, setDeliveries] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [loading, setLoading]       = useState(true);
  const [params, setParams]         = useState({ page: 1, limit: 15, search: '', status: '', sort: 'date', order: 'DESC' });
  const [selectedId, setSelectedId] = useState(null);
  const [workflowDelivery, setWorkflowDelivery] = useState(null);
  const [showForm, setShowForm]     = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [exportFrom, setExportFrom] = useState('');
  const [exportTo, setExportTo]     = useState('');

  const isOwner  = user?.role === 'owner';
  const isDriver = user?.role === 'driver';

  useEffect(() => {
    const onResize = () => {
      setIsDesktop(window.innerWidth >= 1024);
      setIsMobile(window.innerWidth < 640);
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const fetchDeliveries = useCallback(async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams(Object.fromEntries(Object.entries(params).filter(([, v]) => v !== ''))).toString();
      const res = await api.get(`/deliveries?${qs}`);
      setDeliveries(res.data.data);
      setPagination(res.data.pagination);
    } catch {} finally { setLoading(false); }
  }, [params]);

  useEffect(() => { fetchDeliveries(); }, [fetchDeliveries]);
  useEffect(() => {
    const h = () => fetchDeliveries();
    window.addEventListener('woltra:delivery-created', h);
    window.addEventListener('woltra:delivery-updated', h);
    return () => {
      window.removeEventListener('woltra:delivery-created', h);
      window.removeEventListener('woltra:delivery-updated', h);
    };
  }, [fetchDeliveries]);

  const handleExport = async () => {
    if (!exportFrom || !exportTo) { toast.error('Select a date range first'); return; }
    if (exportFrom > exportTo)    { toast.error('Start date must be before end date'); return; }
    try {
      const qs = new URLSearchParams({ date_from: exportFrom, date_to: exportTo }).toString();
      const res = await api.get(`/reports/export/csv?${qs}`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement('a'); a.href = url;
      a.download = `deliveries-${exportFrom}-to-${exportTo}.csv`; a.click();
      setShowExport(false);
    } catch { toast.error('Export failed'); }
  };

  const handleRowClick = d => {
    if (isDriver && ACTIVE_PHASES.includes(d.status)) { setWorkflowDelivery(d); return; }
    if (isDesktop) setSelectedId(d.id);
    else navigate(`/deliveries/${d.id}`);
  };

  /* ── Delivery row ── */
  const DeliveryRow = ({ d }) => {
    const accent     = STATUS_ACCENT[d.status] || 'var(--border-strong)';
    const isSelected = selectedId === d.id;
    const isActive   = isDriver && ACTIVE_PHASES.includes(d.status);

    return (
      <div
        onClick={() => handleRowClick(d)}
        style={{
          padding: '13px 16px',
          borderBottom: '1px solid var(--border)',
          borderLeft: `3px solid ${accent}`,
          cursor: 'pointer',
          display: 'flex', alignItems: 'center', gap: 12,
          background: isSelected ? 'rgba(245,184,0,0.05)' : 'transparent',
          transition: 'background var(--dur-fast)',
        }}
        onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = 'var(--bg-card-alt)'; }}
        onMouseLeave={e => { e.currentTarget.style.background = isSelected ? 'rgba(245,184,0,0.05)' : 'transparent'; }}
      >
        {/* Content */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{
            fontSize: 14, fontWeight: 700, color: 'var(--text-h)',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            marginBottom: 5,
          }}>
            {d.outlet}
          </p>

          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 7 }}>
            {d.gate_pass_number && (
              <span className="code-chip" style={{ fontSize: 10.5, padding: '1px 6px' }}>
                {d.gate_pass_number}
              </span>
            )}
            <span style={{ fontSize: 11, color: 'var(--text-3)', fontFamily: '"JetBrains Mono", monospace' }}>
              {format(new Date(d.date), 'dd/MM/yyyy')}
            </span>
            {(d.delivery_city || d.location) && (
              <span style={{ fontSize: 11, color: 'var(--text-3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 150 }}>
                · {d.delivery_city || d.location}
              </span>
            )}
          </div>

          <StatusPill status={d.status} />
        </div>

        {/* Right action */}
        {isActive ? (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 4,
            background: 'var(--primary)', color: 'var(--primary-text)',
            padding: '6px 12px', borderRadius: 'var(--r-sm)',
            fontSize: 12.5, fontWeight: 700, flexShrink: 0,
            whiteSpace: 'nowrap',
          }}>
            {d.status === 'pending' ? 'Start' : 'Continue'} <ChevronRight size={13} strokeWidth={2.5} />
          </div>
        ) : (
          <ChevronRight size={15} color="var(--text-4)" style={{ flexShrink: 0 }} />
        )}
      </div>
    );
  };

  /* ── List pane ── */
  const listPane = (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>

      {/* Header */}
      <div style={{
        padding: isDesktop ? '14px 16px 12px' : '16px 16px 12px',
        borderBottom: '1px solid var(--border)',
        flexShrink: 0,
      }}>
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          gap: 8, marginBottom: 12, flexWrap: 'wrap',
        }}>
          <div>
            <h1 style={{ fontSize: isDesktop ? '14px' : '1.2rem', fontWeight: 800, color: 'var(--text-h)', lineHeight: 1.2 }}>
              {isOwner ? 'Deliveries' : 'My Loads'}
            </h1>
            {pagination && (
              <p style={{ fontSize: 11, color: 'var(--text-3)', fontFamily: '"JetBrains Mono", monospace', marginTop: 2 }}>
                {pagination.total} {pagination.total === 1 ? 'record' : 'records'}
              </p>
            )}
          </div>

          <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
            <button onClick={fetchDeliveries} className="btn-secondary"
              style={{ padding: '0 10px', height: 36 }} title="Refresh">
              <RefreshCw size={13} />
            </button>
            {isOwner && (
              <div style={{ position: 'relative' }}>
                <button onClick={() => setShowExport(v => !v)} className="btn-secondary"
                  style={{ fontSize: 12, height: 36, padding: '0 12px', gap: 5 }}>
                  <Download size={13} />
                  {!isMobile && 'Export'}
                </button>
                {showExport && (
                  <div style={{
                    position: 'absolute', top: 42, right: 0, zIndex: 99,
                    background: 'var(--bg-card)', border: '1px solid var(--border)',
                    borderRadius: 10, padding: '14px 16px', boxShadow: 'var(--shadow-modal)',
                    display: 'flex', flexDirection: 'column', gap: 10, minWidth: 240,
                  }}>
                    <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-h)', margin: 0 }}>Export by Date Range</p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <label style={{ fontSize: 11, color: 'var(--text-3)', fontWeight: 600 }}>From</label>
                      <input type="date" className="input-field" value={exportFrom}
                        onChange={e => setExportFrom(e.target.value)}
                        style={{ height: 34, fontSize: 13 }} />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <label style={{ fontSize: 11, color: 'var(--text-3)', fontWeight: 600 }}>To</label>
                      <input type="date" className="input-field" value={exportTo}
                        onChange={e => setExportTo(e.target.value)}
                        style={{ height: 34, fontSize: 13 }} />
                    </div>
                    <div style={{ display: 'flex', gap: 6, marginTop: 2 }}>
                      <button onClick={() => setShowExport(false)} className="btn-secondary"
                        style={{ flex: 1, height: 34, fontSize: 12 }}>Cancel</button>
                      <button onClick={handleExport} className="btn-primary"
                        style={{ flex: 1, height: 34, fontSize: 12, gap: 5 }}>
                        <Download size={12} /> Download
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
            {isDriver && (
              <button onClick={() => setShowForm(true)} className="btn-primary"
                style={{ height: 36, fontSize: 13, padding: '0 14px', gap: 5 }}>
                <Plus size={14} /> New
              </button>
            )}
          </div>
        </div>

        {/* Search + filter */}
        <div style={{ display: 'flex', gap: 8, flexWrap: isMobile ? 'wrap' : 'nowrap' }}>
          <div className="input-icon-wrap" style={{ flex: 1, minWidth: isMobile ? '100%' : 0 }}>
            <Search size={13} className="input-icon" />
            <input
              type="text"
              placeholder="Search store, gate pass…"
              className="input-field"
              style={{ height: 36, fontSize: 13 }}
              value={params.search}
              onChange={e => setParams(p => ({ ...p, search: e.target.value, page: 1 }))}
            />
          </div>
          <select
            className="input-field"
            style={{ width: isMobile ? '100%' : 150, height: 36, fontSize: 13 }}
            value={params.status}
            onChange={e => setParams(p => ({ ...p, status: e.target.value, page: 1 }))}
          >
            {STATUSES.map(s => (
              <option key={s} value={s}>
                {s ? s.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) : 'All Statuses'}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Row list */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {loading ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '4rem' }}>
            <LoadingSpinner size="lg" />
          </div>
        ) : deliveries.length === 0 ? (
          <div style={{ padding: '1.5rem' }}>
            <EmptyState
              icon="deliveries"
              title="No deliveries found"
              message={
                params.search || params.status
                  ? 'Try adjusting your filters.'
                  : isDriver
                    ? 'Tap + New to log your first trip.'
                    : 'Deliveries created by drivers will appear here.'
              }
              action={(!params.search && !params.status && isDriver) ? () => setShowForm(true) : undefined}
              actionLabel="New Delivery"
            />
          </div>
        ) : (
          <div>
            {deliveries.map(d => <DeliveryRow key={d.id} d={d} />)}
          </div>
        )}
      </div>

      {/* Pagination */}
      {pagination && pagination.totalPages > 1 && (
        <div style={{ padding: '8px 16px', borderTop: '1px solid var(--border)', flexShrink: 0 }}>
          <Pagination pagination={pagination} onPageChange={p => setParams(prev => ({ ...prev, page: p }))} />
        </div>
      )}
    </div>
  );

  /* ── Modals ── */
  const modals = (
    <>
      {workflowDelivery && (
        <DeliveryWorkflow
          delivery={workflowDelivery}
          onClose={() => setWorkflowDelivery(null)}
          onSuccess={() => { setWorkflowDelivery(null); fetchDeliveries(); }}
        />
      )}
      {showForm && (
        <DeliveryForm
          onClose={() => setShowForm(false)}
          onSuccess={() => { setShowForm(false); fetchDeliveries(); }}
        />
      )}
    </>
  );

  /* ── Desktop master-detail layout ── */
  if (isDesktop) {
    return (
      <div className="fade-in" style={{
        height: 'calc(100vh - 130px)',
        display: 'flex',
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--r-md)',
        overflow: 'hidden',
        boxShadow: 'var(--shadow-card)',
      }}>
        {/* List pane */}
        <div style={{
          width: 'clamp(300px, 33%, 420px)', flexShrink: 0,
          borderRight: '1px solid var(--border)',
          display: 'flex', flexDirection: 'column', overflow: 'hidden',
        }}>
          {listPane}
        </div>

        {/* Detail pane */}
        <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', position: 'relative' }}>
          {selectedId ? (
            <>
              <button
                onClick={() => setSelectedId(null)}
                style={{
                  position: 'absolute', top: 12, right: 12, zIndex: 10,
                  background: 'var(--bg-card-alt)', border: '1px solid var(--border)',
                  borderRadius: 'var(--r-sm)', width: 30, height: 30,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer', color: 'var(--text-3)',
                }}
              >
                <X size={14} />
              </button>
              <div style={{ flex: 1, overflowY: 'auto', padding: '1.25rem' }}>
                <DeliveryDetail
                  deliveryId={selectedId}
                  compact
                  onDeleted={() => { setSelectedId(null); fetchDeliveries(); }}
                />
              </div>
            </>
          ) : (
            <div style={{
              flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexDirection: 'column', gap: 12,
            }}>
              <div style={{
                width: 52, height: 52, borderRadius: 'var(--r-lg)',
                background: 'var(--bg-card-alt)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                border: '1px solid var(--border)',
              }}>
                <Package size={22} color="var(--text-3)" />
              </div>
              <p style={{ fontSize: 13, color: 'var(--text-3)' }}>Select a delivery to view details</p>
            </div>
          )}
        </div>

        {modals}
      </div>
    );
  }

  /* ── Mobile stacked layout ── */
  return (
    <div className="fade-in">
      <div style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border-card)',
        borderRadius: 'var(--r-lg)',
        overflow: 'hidden',
        boxShadow: 'var(--shadow-card)',
      }}>
        {listPane}
      </div>
      {modals}
    </div>
  );
}
