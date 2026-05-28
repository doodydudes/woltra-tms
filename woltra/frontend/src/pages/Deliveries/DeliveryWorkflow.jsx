import { useState, useRef } from 'react';
import { Camera, CheckCircle, Clock, FileText, Upload, Package, ChevronDown } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../services/api';
import Modal from '../../components/common/Modal';
import ConfirmDialog from '../../components/common/ConfirmDialog';

const PHASES = [
  { num: 1, label: 'Loading',   icon: Upload,   },
  { num: 2, label: 'Arrival',   icon: Clock,    },
  { num: 3, label: 'Unloading', icon: Package,  },
  { num: 4, label: 'Docs',      icon: FileText, },
];

/* Determine which phase the delivery is currently waiting for */
function getActivePhase(delivery) {
  const { status, delivery_photo } = delivery;
  if (status === 'pending')           return 1;
  if (status === 'in_transit')        return 2;
  if (status === 'arrived_unloading' && !delivery_photo) return 3;
  if (status === 'arrived_unloading' && delivery_photo)  return 4;
  return null;
}

function PhotoUploadArea({ multiple = false, onChange, previews }) {
  const inputRef = useRef(null);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div
        onClick={() => inputRef.current?.click()}
        style={{
          border: '2px dashed var(--border-strong)',
          borderRadius: 'var(--r-md)',
          padding: '24px 16px',
          textAlign: 'center',
          cursor: 'pointer',
          transition: 'border-color var(--dur-fast), background var(--dur-fast)',
        }}
        onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--primary)'; e.currentTarget.style.background = 'rgba(245,184,0,0.04)'; }}
        onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-strong)'; e.currentTarget.style.background = 'transparent'; }}
      >
        <Camera size={28} color="var(--text-4)" style={{ margin: '0 auto 8px' }} />
        <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-2)', marginBottom: 3 }}>
          Tap to take photo or browse
        </p>
        <p style={{ fontSize: 11.5, color: 'var(--text-4)' }}>
          {multiple ? 'Select multiple photos' : 'Select one photo'}
        </p>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple={multiple}
          style={{ display: 'none' }}
          onChange={onChange}
        />
      </div>

      {previews.length > 0 && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: previews.length > 1 ? '1fr 1fr' : '1fr',
          gap: 8,
        }}>
          {previews.map((src, i) => (
            <div key={i} style={{ position: 'relative', borderRadius: 10, overflow: 'hidden', aspectRatio: '4/3', background: 'var(--bg-card-alt)' }}>
              <img src={src} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              <div style={{
                position: 'absolute', top: 5, right: 5,
                background: '#16A34A', borderRadius: '50%', padding: 3,
                display: 'flex',
              }}>
                <CheckCircle size={12} color="#fff" />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const PHASE_CONFIG = {
  1: {
    title:    'Phase 1 — Proof of Loading',
    subtitle: 'Take a photo of the loaded goods before leaving the warehouse.',
    button:   'Complete Loading → In Transit',
    color:    '#2563EB',
  },
  2: {
    title:    'Phase 2 — Arrived at Location',
    subtitle: 'Log your arrival time and take a photo of the arrival area.',
    button:   'Mark Arrived → Arrived & Unloading',
    color:    '#7C3AED',
  },
  3: {
    title:    'Phase 3 — Unloading Proof',
    subtitle: 'Take a photo of the unloaded goods / delivery area and capture the customer signature.',
    button:   'Confirm Unloading',
    color:    '#D97706',
  },
  4: {
    title:    'Phase 4 — Delivery Documents',
    subtitle: 'Upload photos of gate pass, PO papers, and any delivery receipts.',
    button:   'Complete Delivery → Delivered',
    color:    '#16A34A',
  },
};

export default function DeliveryWorkflow({ delivery, onClose, onSuccess }) {
  const activePhase = getActivePhase(delivery);
  const [submitting, setSubmitting]       = useState(false);
  const [photos, setPhotos]               = useState([]);
  const [previews, setPreviews]           = useState([]);
  const [sigPhotos, setSigPhotos]         = useState([]);
  const [sigPreviews, setSigPreviews]     = useState([]);
  const [confirmStatus, setConfirmStatus] = useState(null); // 'delayed' | 'cancelled'
  const [updating, setUpdating]           = useState(false);
  const [moreOpen, setMoreOpen]           = useState(false);
  const [arrivalTime, setArrivalTime]     = useState(() => {
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    return now.toISOString().slice(0, 16);
  });

  if (!activePhase) return null;

  const handleStatusChange = async (status) => {
    setUpdating(true);
    try {
      await api.put(`/deliveries/${delivery.id}`, { status });
      const labels = { delayed: 'Delivery marked as delayed', cancelled: 'Delivery cancelled' };
      toast.success(labels[status] || 'Status updated');
      window.dispatchEvent(new CustomEvent('woltra:delivery-updated'));
      onSuccess();
    } catch {
      toast.error('Failed to update delivery status');
    } finally {
      setUpdating(false);
      setConfirmStatus(null);
    }
  };

  const cfg = PHASE_CONFIG[activePhase];

  const handleFileChange = (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;
    setPhotos(files);
    setPreviews(files.map(f => URL.createObjectURL(f)));
  };

  const handleSigChange = (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;
    setSigPhotos(files);
    setSigPreviews(files.map(f => URL.createObjectURL(f)));
  };

  const handleSubmit = async () => {
    if (!photos.length) {
      toast.error('Please upload at least one photo');
      return;
    }
    if (activePhase === 2 && !arrivalTime) {
      toast.error('Please enter your arrival time');
      return;
    }

    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('phase', String(activePhase));

      if (activePhase === 1) {
        formData.append('loading_photo', photos[0]);
      } else if (activePhase === 2) {
        formData.append('unloading_photo', photos[0]);
        formData.append('arrival_time', arrivalTime);
      } else if (activePhase === 3) {
        formData.append('delivery_photo', photos[0]);
        if (sigPhotos.length) formData.append('signature', sigPhotos[0]);
      } else {
        photos.forEach(f => formData.append('document_photos', f));
      }

      await api.post(`/deliveries/${delivery.id}/phase`, formData, {
        headers: { 'Content-Type': undefined }
      });

      const messages = [
        'Goods loaded! Delivery is now In Transit.',
        'Arrived! Now in Arrived & Unloading.',
        'Unloading confirmed! Upload documents to complete.',
        'Delivery completed! Documents saved.',
      ];
      toast.success(messages[activePhase - 1]);
      window.dispatchEvent(new CustomEvent('woltra:delivery-updated'));
      onSuccess();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to complete this phase');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
    <Modal
      open
      onClose={onClose}
      title={delivery.outlet}
      size="md"
      footer={
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%' }}>

          {/* Left: hidden "More" dropdown for risky actions */}
          <div style={{ position: 'relative', flex: 1 }}>
            <button
              onClick={() => setMoreOpen(v => !v)}
              disabled={submitting || updating}
              style={{
                display: 'flex', alignItems: 'center', gap: 4,
                background: 'none', border: '1px solid var(--border)',
                borderRadius: 'var(--r-sm)', padding: '6px 10px',
                fontSize: 12, fontWeight: 600, color: 'var(--text-3)',
                cursor: 'pointer',
              }}
            >
              ··· More
            </button>

            {moreOpen && (
              <>
                <div
                  onClick={() => setMoreOpen(false)}
                  style={{ position: 'fixed', inset: 0, zIndex: 60 }}
                />
                <div style={{
                  position: 'absolute', bottom: 'calc(100% + 8px)', left: 0,
                  zIndex: 70, minWidth: 180,
                  background: 'var(--bg-card)', border: '1px solid var(--border)',
                  borderRadius: 'var(--r-md)', padding: 6,
                  boxShadow: 'var(--shadow-modal)',
                }}>
                  <button
                    onClick={() => { setMoreOpen(false); setConfirmStatus('delayed'); }}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 8, width: '100%',
                      background: 'none', border: 'none', borderRadius: 'var(--r-sm)',
                      padding: '9px 12px', fontSize: 13, fontWeight: 600,
                      color: 'var(--s-pending)', cursor: 'pointer', textAlign: 'left',
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-card-alt)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'none'}
                  >
                    Mark as Delayed
                  </button>
                  <button
                    onClick={() => { setMoreOpen(false); setConfirmStatus('cancelled'); }}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 8, width: '100%',
                      background: 'none', border: 'none', borderRadius: 'var(--r-sm)',
                      padding: '9px 12px', fontSize: 13, fontWeight: 600,
                      color: 'var(--s-delayed)', cursor: 'pointer', textAlign: 'left',
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-card-alt)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'none'}
                  >
                    Cancel Delivery
                  </button>
                </div>
              </>
            )}
          </div>

          {/* Right: main actions */}
          <button onClick={onClose} className="btn-secondary" disabled={submitting || updating}>
            Close
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting || updating || !photos.length}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '8px 16px', borderRadius: 'var(--r-sm)',
              background: cfg.color, color: '#fff',
              fontSize: 13, fontWeight: 700, border: 'none', cursor: 'pointer',
              opacity: submitting || updating || !photos.length ? 0.55 : 1,
              transition: 'opacity var(--dur-fast)', whiteSpace: 'nowrap',
            }}
          >
            {submitting ? 'Uploading…' : cfg.button}
          </button>
        </div>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>

        {/* Phase stepper */}
        <div style={{ display: 'flex', alignItems: 'center' }}>
          {PHASES.map((p, idx) => {
            const done   = p.num < activePhase;
            const active = p.num === activePhase;
            return (
              <div key={p.num} style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                  <div style={{
                    width: 34, height: 34, borderRadius: '50%',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 12, fontWeight: 800,
                    background: done ? '#16A34A' : active ? cfg.color : 'var(--bg-card-alt)',
                    color: done || active ? '#fff' : 'var(--text-4)',
                    border: active ? `3px solid ${cfg.color}40` : '2px solid transparent',
                    transition: 'all var(--dur-fast)',
                  }}>
                    {done ? <CheckCircle size={16} /> : p.num}
                  </div>
                  <span style={{
                    fontSize: 10, fontWeight: active ? 700 : 500,
                    color: active ? cfg.color : done ? '#16A34A' : 'var(--text-4)',
                    whiteSpace: 'nowrap',
                  }}>
                    {p.label}
                  </span>
                </div>
                {idx < PHASES.length - 1 && (
                  <div style={{
                    flex: 1, height: 2, marginBottom: 18, marginInline: 4,
                    background: done ? '#16A34A' : 'var(--border)',
                    transition: 'background var(--dur-fast)',
                  }} />
                )}
              </div>
            );
          })}
        </div>

        {/* Delivery info pill */}
        <div style={{
          background: 'var(--bg-card-alt)', borderRadius: 'var(--r-md)',
          padding: '10px 14px', fontSize: 12.5,
          display: 'flex', flexDirection: 'column', gap: 4,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: 'var(--text-3)' }}>Gate Pass</span>
            <span style={{ fontWeight: 600, color: 'var(--text-h)', fontFamily: '"JetBrains Mono", monospace' }}>
              {delivery.gate_pass_number || '—'}
            </span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: 'var(--text-3)' }}>Location</span>
            <span style={{ fontWeight: 600, color: 'var(--text-h)', maxWidth: '60%', textAlign: 'right', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {[delivery.delivery_city, delivery.delivery_province].filter(Boolean).join(', ') || delivery.location || '—'}
            </span>
          </div>
        </div>

        {/* Phase instructions */}
        <div>
          <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-h)', marginBottom: 4 }}>{cfg.title}</p>
          <p style={{ fontSize: 12, color: 'var(--text-3)' }}>{cfg.subtitle}</p>
        </div>

        {/* Arrival time (phase 2 only) */}
        {activePhase === 2 && (
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-3)', display: 'block', marginBottom: 6 }}>
              Time Arrived
            </label>
            <input
              type="datetime-local"
              className="input-field"
              value={arrivalTime}
              onChange={e => setArrivalTime(e.target.value)}
            />
          </div>
        )}

        {/* Main photo upload */}
        <div>
          <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-3)', display: 'block', marginBottom: 6 }}>
            {activePhase === 1 ? 'Loading Photo' :
             activePhase === 2 ? 'Arrival Area Photo' :
             activePhase === 3 ? 'Delivery / Unloading Photo' :
             'Document Photos'}
          </label>
          <PhotoUploadArea
            multiple={activePhase === 4}
            onChange={handleFileChange}
            previews={previews}
          />
        </div>

        {/* Signature (phase 3 only, optional) */}
        {activePhase === 3 && (
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-3)', display: 'block', marginBottom: 6 }}>
              Customer Signature <span style={{ fontWeight: 400, color: 'var(--text-4)' }}>(optional)</span>
            </label>
            <PhotoUploadArea
              multiple={false}
              onChange={handleSigChange}
              previews={sigPreviews}
            />
          </div>
        )}

        {activePhase === 4 && previews.length > 0 && (
          <p style={{ fontSize: 11, color: 'var(--text-4)', textAlign: 'center' }}>
            {previews.length} photo{previews.length !== 1 ? 's' : ''} selected
          </p>
        )}
      </div>
    </Modal>

    <ConfirmDialog
      open={confirmStatus === 'delayed'}
      onClose={() => setConfirmStatus(null)}
      onConfirm={() => handleStatusChange('delayed')}
      loading={updating}
      title="Mark as Delayed"
      confirmLabel="Mark Delayed"
      message={`Mark "${delivery.outlet}" as delayed? The delivery stays active and can be resumed later.`}
    />
    <ConfirmDialog
      open={confirmStatus === 'cancelled'}
      onClose={() => setConfirmStatus(null)}
      onConfirm={() => handleStatusChange('cancelled')}
      loading={updating}
      title="Cancel Delivery"
      confirmLabel="Cancel Delivery"
      message={`Cancel the delivery for "${delivery.outlet}"? This cannot be easily undone.`}
    />
    </>
  );
}
