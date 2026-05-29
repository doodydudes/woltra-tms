import { useState, useEffect, useRef, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import {
  ArrowLeft, Edit, Camera, CheckCircle, MapPin, Clock,
  Truck, User, Package, Trash2, Upload,
} from 'lucide-react';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import api from '../../services/api';
import Badge from '../../components/common/Badge';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import DeliveryForm from './DeliveryForm';
import DeliveryWorkflow from './DeliveryWorkflow';

/* ── Helpers ─────────────────────────────────────────────────── */
function getPhase(statusText) {
  const s = (statusText || '').toLowerCase();
  if (s.includes('pending') || s.includes('created')) return 'created';
  if (s === 'delivery_proof')  return 'delivery_proof';
  if (s.includes('arrived') || s.includes('unload')) return 'arrived_unloading';
  if (s.includes('in_transit') || s.includes('in transit') || s.includes('loading') || s.includes('transit')) return 'in_transit';
  if (s.includes('delivered')) return 'delivered';
  if (s.includes('return')) return 'returned';
  if (s.includes('cancel')) return 'cancelled';
  if (s.includes('delay')) return 'delayed';
  return 'other';
}

const PHASE_LABELS = {
  created:           'Delivery Created',
  in_transit:        'In Transit',
  arrived_unloading: 'Arrived & Unloading',
  delivery_proof:    'Unloading Proof Captured',
  delivered:         'Delivered',
  cancelled:         'Cancelled',
  delayed:           'Delayed',
  returned:          'Returned to Warehouse',
};

const PHASE_COLORS = {
  created:           { dot: 'var(--blue)', ring: 'var(--blue)' },
  in_transit:        { dot: '#6366F1', ring: '#6366F1' },
  arrived_unloading: { dot: '#8B5CF6', ring: '#8B5CF6' },
  delivery_proof:    { dot: '#D97706', ring: '#D97706' },
  delivered:         { dot: '#10B981', ring: '#10B981' },
  cancelled:         { dot: '#EF4444', ring: '#EF4444' },
  delayed:           { dot: '#F59E0B', ring: '#F59E0B' },
  returned:          { dot: '#F97316', ring: '#F97316' },
};

function PhotoGrid({ photos }) {
  if (!photos || !photos.length) return null;
  return (
    <div style={{ display: 'grid', gridTemplateColumns: photos.length === 1 ? '1fr' : 'repeat(auto-fill, minmax(120px, 1fr))', gap: 8, marginTop: 10 }}>
      {photos.map((p, i) => (
        <div key={i}>
          <p style={{ fontSize: '10.5px', color: 'var(--text-3)', marginBottom: 4 }}>{p.label}</p>
          <img
            src={p.src?.startsWith('http') ? p.src : `${(import.meta.env.VITE_API_URL || 'http://localhost:5000/api').replace('/api', '')}${p.src}`}
            alt={p.label}
            style={{
              width: '100%', height: p.isSignature ? 80 : 120,
              objectFit: p.isSignature ? 'contain' : 'cover',
              borderRadius: 8, border: '1px solid var(--border)',
              background: p.isSignature ? '#fff' : 'var(--bg-card-alt)',
              cursor: 'pointer',
            }}
            onClick={() => window.open(p.src?.startsWith('http') ? p.src : `${(import.meta.env.VITE_API_URL || 'http://localhost:5000/api').replace('/api', '')}${p.src}`, '_blank')}
            onError={e => { e.target.style.display = 'none'; }}
          />
        </div>
      ))}
    </div>
  );
}

export default function DeliveryDetail({ deliveryId: propId, compact = false, onDeleted } = {}) {
  const params   = useParams();
  const id       = propId ?? params.id;
  const navigate = useNavigate();
  const { user } = useSelector(s => s.auth);
  const [delivery, setDelivery]       = useState(null);
  const [tracking, setTracking]       = useState([]);
  const [loading, setLoading]         = useState(true);
  const [showEdit, setShowEdit]       = useState(false);
  const [showWorkflow, setShowWorkflow] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting]       = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [confirmStatus, setConfirmStatus] = useState(null); // 'delayed' | 'returned'

  const fetchDelivery = async () => {
    try {
      const res = await api.get(`/deliveries/${id}`);
      setDelivery(res.data.delivery);
      setTracking(res.data.tracking ?? []);
    } catch {
      if (!compact) navigate('/deliveries');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchDelivery(); }, [id]);

  const handleStatusUpdate = async (status) => {
    try {
      const body = { status };
      if (status === 'in_transit') body.actual_start_time = new Date().toISOString();
      if (status === 'delivered')  body.completed_delivery_time = new Date().toISOString();
      await api.put(`/deliveries/${id}`, body);
      const messages = {
        in_transit:        'Delivery resumed — back in transit',
        arrived_unloading: 'Delivery resumed — back at unloading',
        delivered:         'Marked as delivered',
        delayed:           'Delivery marked as delayed',
        returned:          'Delivery marked as returned to warehouse',
        cancelled:         'Delivery cancelled',
      };
      toast.success(messages[status] || 'Status updated');
      window.dispatchEvent(new CustomEvent('woltra:delivery-updated'));
      if (!compact && ['delayed', 'cancelled', 'returned'].includes(status)) {
        navigate('/deliveries');
      } else {
        fetchDelivery();
      }
    } catch {
      toast.error('Failed to update delivery');
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await api.delete(`/deliveries/${id}`);
      toast.success('Delivery deleted');
      if (onDeleted) onDeleted();
      else navigate('/deliveries');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to delete');
    } finally { setDeleting(false); }
  };

  // Enrich tracking entries with clean labels and inline photos
  const enrichedTracking = useMemo(() => {
    if (!delivery || !tracking.length) return [];
    const shownPhotos = new Set();

    return tracking.map(t => {
      const phase = getPhase(t.status);
      const photos = [];

      if (phase === 'in_transit' && delivery.loading_photo && !shownPhotos.has('loading')) {
        photos.push({ src: delivery.loading_photo, label: 'Loading Photo' });
        shownPhotos.add('loading');
      }
      if (phase === 'arrived_unloading' && delivery.unloading_photo && !shownPhotos.has('unloading')) {
        photos.push({ src: delivery.unloading_photo, label: 'Arrival Area Photo' });
        shownPhotos.add('unloading');
      }
      if (phase === 'delivery_proof') {
        if (delivery.delivery_photo && !shownPhotos.has('delivery')) {
          photos.push({ src: delivery.delivery_photo, label: 'Delivery Photo' });
          shownPhotos.add('delivery');
        }
        if (delivery.customer_signature && !shownPhotos.has('signature')) {
          photos.push({ src: delivery.customer_signature, label: 'Customer Signature', isSignature: true });
          shownPhotos.add('signature');
        }
      }
      if (phase === 'delivered') {
        if (delivery.document_photos && !shownPhotos.has('documents')) {
          const docs = Array.isArray(delivery.document_photos)
            ? delivery.document_photos
            : (typeof delivery.document_photos === 'string' ? JSON.parse(delivery.document_photos) : [delivery.document_photos]);
          docs.filter(Boolean).forEach((src, i) => photos.push({ src, label: `Document ${i + 1}` }));
          shownPhotos.add('documents');
        }
      }

      return {
        ...t,
        phase,
        cleanLabel: PHASE_LABELS[phase] || t.status.replace(/_/g, ' '),
        photos,
      };
    });
  }, [tracking, delivery]);

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 240 }}>
      <LoadingSpinner size="lg" />
    </div>
  );
  if (!delivery) return null;

  const canManage = user?.role === 'owner';
  const isDriver  = user?.role === 'driver';
  const isDone    = ['delivered', 'cancelled', 'returned'].includes(delivery.status);
  const isActive  = ['in_transit', 'arrived_unloading'].includes(delivery.status);

  /* arrived_unloading has 2 sub-phases: proof (no delivery_photo) and docs (has delivery_photo) */
  const hasWorkflowPhase = ['pending', 'in_transit', 'arrived_unloading'].includes(delivery.status);

  return (
    <div className="space-y-4 fade-in" style={compact ? {} : { maxWidth: 860, margin: '0 auto' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
        {!compact && (
          <button onClick={() => navigate('/deliveries')} style={{
            background: 'var(--bg-card)', border: '1px solid var(--border)',
            borderRadius: 8, width: 36, height: 36, flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', color: 'var(--text-2)',
          }}>
            <ArrowLeft size={16} />
          </button>
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <h1 style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-h)', marginBottom: 3 }}>{delivery.outlet}</h1>
          <p style={{ fontSize: '12px', color: 'var(--text-3)', fontFamily: '"JetBrains Mono", monospace' }}>
            {delivery.gate_pass_number || `#${delivery.id}`} · {format(new Date(delivery.date), 'dd/MM/yyyy')}
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <Badge status={delivery.status} />
          {canManage && (
            <button onClick={() => setShowEdit(true)} className="btn-secondary" style={{ fontSize: '13px' }}>
              <Edit size={14} /> Edit
            </button>
          )}
          {canManage && (
            <button onClick={() => setConfirmDelete(true)} style={{
              display: 'flex', alignItems: 'center', gap: 6,
              background: 'none', border: '1px solid var(--border)',
              borderRadius: 7, padding: '6px 12px', fontSize: '13px', fontWeight: 600,
              color: 'var(--red)', cursor: 'pointer',
            }}>
              <Trash2 size={14} /> Delete
            </button>
          )}
          {isDriver && hasWorkflowPhase && (
            <button onClick={() => setShowWorkflow(true)} className="btn-primary" style={{ fontSize: '13px' }}>
              <Upload size={14} />
              {delivery.status === 'pending' ? 'Start Delivery' : 'Continue'}
            </button>
          )}

          {isDriver && delivery.status === 'delayed' && (
            <button
              onClick={() => {
                const resumeStatus = [...tracking].reverse()
                  .find(t => ['pending', 'in_transit', 'arrived_unloading'].includes(t.status))
                  ?.status || 'in_transit';
                handleStatusUpdate(resumeStatus);
              }}
              className="btn-primary"
              style={{ fontSize: '13px' }}
            >
              <Truck size={14} /> Resume Delivery
            </button>
          )}

          {/* More actions dropdown — delayed / returned, hidden to avoid accidental clicks */}
          {isActive && (
            <div style={{ position: 'relative' }}>
              <button
                onClick={() => setShowMoreMenu(v => !v)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 5,
                  background: 'var(--bg-card)', border: '1px solid var(--border)',
                  borderRadius: 7, padding: '6px 12px', fontSize: '13px', fontWeight: 600,
                  color: 'var(--text-2)', cursor: 'pointer',
                }}
              >
                ··· More
              </button>
              {showMoreMenu && (
                <>
                  {/* backdrop */}
                  <div onClick={() => setShowMoreMenu(false)} style={{ position: 'fixed', inset: 0, zIndex: 40 }} />
                  <div style={{
                    position: 'absolute', right: 0, top: 'calc(100% + 6px)', zIndex: 50,
                    background: 'var(--bg-card)', border: '1px solid var(--border)',
                    borderRadius: 10, padding: '6px', minWidth: 180,
                    boxShadow: 'var(--shadow-modal)',
                  }}>
                    <button
                      onClick={() => { setShowMoreMenu(false); setConfirmStatus('delayed'); }}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 8, width: '100%',
                        background: 'none', border: 'none', borderRadius: 7,
                        padding: '9px 12px', fontSize: '13px', fontWeight: 600,
                        color: '#F59E0B', cursor: 'pointer', textAlign: 'left',
                      }}
                    >
                      <Clock size={14} /> Mark as Delayed
                    </button>
                    <button
                      onClick={() => { setShowMoreMenu(false); setConfirmStatus('returned'); }}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 8, width: '100%',
                        background: 'none', border: 'none', borderRadius: 7,
                        padding: '9px 12px', fontSize: '13px', fontWeight: 600,
                        color: '#F97316', cursor: 'pointer', textAlign: 'left',
                      }}
                    >
                      <ArrowLeft size={14} /> Mark as Returned
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 12 }}>
        {/* Delivery Info */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <p style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-h)' }}>Delivery Information</p>
          {[
            { icon: MapPin,  label: 'Location',  value: [delivery.delivery_city, delivery.delivery_province].filter(Boolean).join(', ') || delivery.location || '—' },
            { icon: Package, label: 'Boxes',     value: `${delivery.number_of_boxes} boxes${delivery.bo ? ` + ${delivery.number_of_bo_boxes} BO` : ''}` },
            { icon: Clock,   label: 'ETA',       value: delivery.eta ? format(new Date(delivery.eta), 'dd/MM/yyyy HH:mm') : '—' },
            { icon: Clock,   label: 'Completed', value: delivery.completed_delivery_time ? format(new Date(delivery.completed_delivery_time), 'dd/MM/yyyy HH:mm') : '—' },
          ].map(({ icon: Icon, label, value }) => (
            <div key={label} style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
              <div style={{ width: 28, height: 28, borderRadius: 7, background: 'var(--bg-card-alt)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Icon size={13} color="var(--text-3)" />
              </div>
              <div>
                <p style={{ fontSize: '10.5px', color: 'var(--text-3)', marginBottom: 2 }}>{label}</p>
                <p style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text)' }}>{value}</p>
              </div>
            </div>
          ))}
          {delivery.trip_rate && (
            <div style={{ paddingTop: 10, borderTop: '1px solid var(--border)' }}>
              <p style={{ fontSize: '10.5px', color: 'var(--text-3)', marginBottom: 2 }}>Trip Rate</p>
              <p style={{ fontSize: '14px', fontWeight: 800, color: '#10B981', fontFamily: 'monospace' }}>
                ₱{Number(delivery.trip_rate).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
              </p>
            </div>
          )}
          {delivery.notes && (
            <div style={{ paddingTop: 10, borderTop: '1px solid var(--border)' }}>
              <p style={{ fontSize: '10.5px', color: 'var(--text-3)', marginBottom: 4 }}>Notes</p>
              <p style={{ fontSize: '13px', color: 'var(--text-2)', lineHeight: 1.55 }}>{delivery.notes}</p>
            </div>
          )}
        </div>

        {/* Assigned Team */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <p style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-h)' }}>Assigned Team</p>
          {[
            { icon: User,  label: 'Driver',  name: delivery.driver_name,  sub: delivery.driver_employee_id },
            { icon: User,  label: 'Helper',  name: delivery.helper_name,  sub: null },
            { icon: Truck, label: 'Vehicle', name: delivery.plate_number || delivery.truck_id, sub: delivery.truck_id },
          ].map(({ icon: Icon, label, name, sub }) => (
            <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: 'var(--bg)', borderRadius: 8, border: '1px solid var(--border)' }}>
              <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'rgba(59,130,246,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Icon size={14} color="var(--blue)" />
              </div>
              <div>
                <p style={{ fontSize: '10.5px', color: 'var(--text-3)', marginBottom: 1 }}>{label}</p>
                <p style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text)' }}>{name || 'Unassigned'}</p>
                {sub && <p style={{ fontSize: '11px', color: 'var(--text-3)', fontFamily: '"JetBrains Mono", monospace' }}>{sub}</p>}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Timeline (with inline photos) */}
      <div className="card">
        <p style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-h)', marginBottom: 18 }}>Delivery Timeline</p>
        {enrichedTracking.length ? (
          <div style={{ position: 'relative', paddingLeft: 28 }}>
            <div style={{ position: 'absolute', left: 9, top: 6, bottom: 6, width: 2, background: 'var(--border)' }} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
              {enrichedTracking.map((t, i) => {
                const colors = PHASE_COLORS[t.phase] || PHASE_COLORS.created;
                const isLast = i === enrichedTracking.length - 1;
                return (
                  <div key={t.id} style={{ position: 'relative' }}>
                    {/* Dot */}
                    <div style={{
                      position: 'absolute', left: -24, top: 3,
                      width: 16, height: 16, borderRadius: '50%',
                      background: isLast ? colors.dot : 'var(--bg-card)',
                      border: `2.5px solid ${colors.ring}`,
                      boxShadow: isLast ? `0 0 0 3px ${colors.dot}22` : 'none',
                    }} />

                    {/* Label */}
                    <p style={{ fontSize: '13.5px', fontWeight: 700, color: 'var(--text-h)' }}>
                      {t.cleanLabel}
                    </p>

                    {/* Timestamp + recorder */}
                    <p style={{ fontSize: '11px', color: 'var(--text-3)', fontFamily: '"JetBrains Mono", monospace', marginTop: 2 }}>
                      {format(new Date(t.created_at), 'dd/MM/yyyy HH:mm')}
                      {t.recorded_by_name && ` · ${t.recorded_by_name}`}
                    </p>

                    {/* Inline photos */}
                    {t.photos.length > 0 && <PhotoGrid photos={t.photos} />}

                    {/* Driver upload prompt for active phase */}
                    {isDriver && hasWorkflowPhase && isLast && t.phase !== 'created' && t.photos.length === 0 && (
                      <button
                        onClick={() => setShowWorkflow(true)}
                        style={{
                          marginTop: 8, display: 'flex', alignItems: 'center', gap: 6,
                          background: 'var(--bg-card-alt)', border: '1.5px dashed var(--border-strong)',
                          borderRadius: 8, padding: '8px 14px', fontSize: '12.5px', fontWeight: 600,
                          color: 'var(--text-3)', cursor: 'pointer',
                        }}
                      >
                        <Camera size={14} /> Upload proof photo
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <p style={{ fontSize: '13px', color: 'var(--text-3)', textAlign: 'center', padding: '1rem 0' }}>No tracking history yet</p>
        )}
      </div>

      {showEdit && (
        <DeliveryForm delivery={delivery} onClose={() => setShowEdit(false)} onSuccess={() => { setShowEdit(false); fetchDelivery(); }} />
      )}

      {showWorkflow && !isDone && (
        <DeliveryWorkflow delivery={delivery} onClose={() => setShowWorkflow(false)} onSuccess={() => { setShowWorkflow(false); fetchDelivery(); }} />
      )}

      <ConfirmDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={handleDelete}
        loading={deleting}
        title="Delete Delivery"
        message={`Delete delivery for "${delivery.outlet}"? This cannot be undone.`}
      />

      <ConfirmDialog
        open={confirmStatus === 'delayed'}
        onClose={() => setConfirmStatus(null)}
        onConfirm={() => { setConfirmStatus(null); handleStatusUpdate('delayed'); }}
        title="Mark as Delayed"
        message={`Mark "${delivery.outlet}" as delayed? The delivery will remain active and can be resumed.`}
      />

      <ConfirmDialog
        open={confirmStatus === 'returned'}
        onClose={() => setConfirmStatus(null)}
        onConfirm={() => { setConfirmStatus(null); handleStatusUpdate('returned'); }}
        title="Mark as Returned"
        message={`Mark "${delivery.outlet}" as returned to warehouse? The vehicle will be freed and this delivery will be closed.`}
      />
    </div>
  );
}
