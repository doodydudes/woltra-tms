import { useState, useEffect, useRef } from 'react';
import { useSelector } from 'react-redux';
import {
  AlertTriangle, Plus, X, Camera, MapPin,
  Clock, CheckCircle2, Wrench, ChevronDown, Send,
  Image as ImageIcon, CalendarClock, Hammer, CheckCheck,
  Upload, FileImage,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import api from '../../services/api';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import EmptyState from '../../components/common/EmptyState';

const REPORT_TYPES = [
  { value: 'breakdown',    label: 'Breakdown' },
  { value: 'flat_tire',   label: 'Flat Tire' },
  { value: 'accident',    label: 'Accident' },
  { value: 'engine_issue', label: 'Engine Issue' },
  { value: 'other',       label: 'Other' },
];

const STATUS_CONFIG = {
  pending:     { label: 'Pending',      color: '#F59E0B', bg: 'rgba(245,158,11,0.1)', border: 'rgba(245,158,11,0.25)' },
  in_progress: { label: 'In Progress',  color: '#F97316', bg: 'rgba(249,115,22,0.1)', border: 'rgba(249,115,22,0.25)' },
  resolved:    { label: 'Fixed / Done', color: '#10B981', bg: 'rgba(16,185,129,0.1)', border: 'rgba(16,185,129,0.25)' },
  // legacy
  acknowledged: { label: 'In Progress', color: '#F97316', bg: 'rgba(249,115,22,0.1)', border: 'rgba(249,115,22,0.25)' },
  scheduled:    { label: 'In Progress', color: '#F97316', bg: 'rgba(249,115,22,0.1)', border: 'rgba(249,115,22,0.25)' },
};

// ── Phase stepper ──────────────────────────────────────────────────────────────
const PHASES = [
  { key: 'filed',       label: 'Filed' },
  { key: 'in_progress', label: 'In Progress' },
  { key: 'work_done',   label: 'Work Done' },
  { key: 'fixed',       label: 'Fixed' },
];

function getPhaseIndex(report) {
  if (report.status === 'resolved') return 3;
  if (report.status === 'in_progress' || report.status === 'acknowledged' || report.status === 'scheduled') {
    return report.driver_progress_at ? 2 : 1;
  }
  return 0;
}

function PhaseStepper({ report }) {
  const current = getPhaseIndex(report);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 0, marginTop: 14, marginBottom: 6 }}>
      {PHASES.map((phase, i) => {
        const done    = i < current;
        const active  = i === current;
        const future  = i > current;
        const color   = done || active ? (i === 3 ? '#10B981' : done ? '#10B981' : '#F97316') : 'var(--border-strong)';
        return (
          <div key={phase.key} style={{ display: 'flex', alignItems: 'center', flex: i < PHASES.length - 1 ? 1 : 'none' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
              <div style={{
                width: 24, height: 24, borderRadius: '50%',
                background: done ? '#10B981' : active ? (i === 3 ? '#10B981' : '#F97316') : 'var(--bg)',
                border: `2px solid ${future ? 'var(--border)' : color}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'all 0.2s',
              }}>
                {done ? (
                  <CheckCheck size={11} color="#fff" />
                ) : active ? (
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: color }} />
                ) : null}
              </div>
              <span style={{
                fontSize: '9.5px', fontWeight: active ? 700 : 500,
                color: future ? 'var(--text-3)' : color,
                whiteSpace: 'nowrap',
              }}>
                {phase.label}
              </span>
            </div>
            {i < PHASES.length - 1 && (
              <div style={{
                flex: 1, height: 2, marginBottom: 16, marginLeft: 2, marginRight: 2,
                background: done ? '#10B981' : 'var(--border)',
                transition: 'background 0.2s',
              }} />
            )}
          </div>
        );
      })}
    </div>
  );
}

function StatusBadge({ status }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.pending;
  return (
    <span style={{
      fontSize: '11px', fontWeight: 700, padding: '3px 9px', borderRadius: 99,
      color: cfg.color, background: cfg.bg, border: `1px solid ${cfg.border}`,
      whiteSpace: 'nowrap',
    }}>
      {cfg.label}
    </span>
  );
}

// ── Photo thumbnails ───────────────────────────────────────────────────────────
function PhotoGrid({ photos, apiBase }) {
  const [lightbox, setLightbox] = useState(null);
  if (!photos?.length) return null;
  return (
    <>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
        {photos.map((p, i) => (
          <div key={i} onClick={() => setLightbox(p)} style={{
            width: 72, height: 72, borderRadius: 8, overflow: 'hidden',
            border: '1px solid var(--border)', cursor: 'pointer', flexShrink: 0,
          }}>
            <img src={`${apiBase}${p}`} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              onError={e => { e.target.style.display = 'none'; }} />
          </div>
        ))}
      </div>
      {lightbox && (
        <div onClick={() => setLightbox(null)} style={{
          position: 'fixed', inset: 0, zIndex: 100,
          background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '1rem',
        }}>
          <button onClick={() => setLightbox(null)} style={{
            position: 'absolute', top: 16, right: 16,
            background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: '50%',
            width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', color: '#fff',
          }}>
            <X size={18} />
          </button>
          <img src={`${apiBase}${lightbox}`} alt="" style={{ maxWidth: '90vw', maxHeight: '85vh', borderRadius: 10, objectFit: 'contain' }} />
        </div>
      )}
    </>
  );
}

// ── Photo picker (reusable) ────────────────────────────────────────────────────
function PhotoPicker({ photos, previews, onAdd, onRemove, max = 5 }) {
  const fileRef = useRef();
  const handleFiles = e => {
    const files = Array.from(e.target.files).slice(0, max - photos.length);
    onAdd(files);
    e.target.value = '';
  };
  return (
    <div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {previews.map((src, i) => (
          <div key={i} style={{ position: 'relative', width: 80, height: 80, borderRadius: 8, overflow: 'hidden', border: '1px solid var(--border)' }}>
            <img src={src} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            <button type="button" onClick={() => onRemove(i)} style={{
              position: 'absolute', top: 3, right: 3, width: 18, height: 18, borderRadius: '50%',
              background: 'rgba(0,0,0,0.6)', border: 'none', cursor: 'pointer',
              color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <X size={10} />
            </button>
          </div>
        ))}
        {photos.length < max && (
          <button type="button" onClick={() => fileRef.current?.click()} style={{
            width: 80, height: 80, borderRadius: 8,
            border: '1.5px dashed var(--border-strong)',
            background: 'var(--bg)', cursor: 'pointer',
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            gap: 4, color: 'var(--text-3)',
          }}>
            <Camera size={18} />
            <span style={{ fontSize: '10px', fontWeight: 600 }}>Add Photo</span>
          </button>
        )}
      </div>
      <input ref={fileRef} type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={handleFiles} />
    </div>
  );
}

// ── Progress upload form (driver submits work photos) ─────────────────────────
function ProgressUploadForm({ report, onSuccess }) {
  const [photos, setPhotos]   = useState([]);
  const [previews, setPreviews] = useState([]);
  const [notes, setNotes]     = useState('');
  const [submitting, setSubmitting] = useState(false);

  const addPhotos = files => {
    setPhotos(prev => [...prev, ...files].slice(0, 5));
    files.forEach(f => {
      const reader = new FileReader();
      reader.onload = ev => setPreviews(prev => [...prev, ev.target.result].slice(0, 5));
      reader.readAsDataURL(f);
    });
  };
  const removePhoto = i => {
    setPhotos(p => p.filter((_, idx) => idx !== i));
    setPreviews(p => p.filter((_, idx) => idx !== i));
  };

  const handleSubmit = async e => {
    e.preventDefault();
    if (!photos.length && !notes.trim()) {
      toast.error('Add at least one photo or note');
      return;
    }
    setSubmitting(true);
    try {
      const fd = new FormData();
      if (notes.trim()) fd.append('driver_progress_notes', notes.trim());
      photos.forEach(f => fd.append('progress_photos', f));
      await api.put(`/vehicle-reports/${report.id}/progress`, fd);
      toast.success('Work progress submitted — owner notified');
      onSuccess();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to submit progress');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ marginTop: 14, padding: 14, background: 'rgba(249,115,22,0.05)', border: '1px solid rgba(249,115,22,0.2)', borderRadius: 10 }}>
      <p style={{ fontSize: '12px', fontWeight: 700, color: '#F97316', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
        <Upload size={13} /> Submit Work Progress
      </p>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div>
          <label className="label" style={{ fontSize: '11.5px' }}>Work / Repair Photos <span style={{ fontWeight: 400, color: 'var(--text-3)' }}>(up to 5)</span></label>
          <PhotoPicker photos={photos} previews={previews} onAdd={addPhotos} onRemove={removePhoto} max={5} />
        </div>
        <div>
          <label className="label" style={{ fontSize: '11.5px' }}>Notes <span style={{ fontWeight: 400, color: 'var(--text-3)' }}>(optional)</span></label>
          <textarea rows={3} className="input-field resize-none"
            placeholder="Describe what was done — parts replaced, mechanic notes, current state..."
            value={notes}
            onChange={e => setNotes(e.target.value)}
            style={{ fontSize: '12.5px' }}
          />
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button type="submit" className="btn-primary" disabled={submitting} style={{ gap: 7, height: 34, fontSize: '13px' }}>
            {submitting ? <LoadingSpinner size="sm" /> : <Send size={13} />}
            {submitting ? 'Submitting...' : 'Submit Progress'}
          </button>
        </div>
      </form>
    </div>
  );
}

// ── Submit report form (driver) ────────────────────────────────────────────────
function SubmitReportForm({ vehicles, onSuccess, onCancel }) {
  const assignedVehicle = vehicles[0] || null;
  const [form, setForm] = useState({
    type: 'breakdown', title: '', description: '', location: '',
    vehicle_id: assignedVehicle?.id || '',
  });
  const [photos, setPhotos]   = useState([]);
  const [previews, setPreviews] = useState([]);
  const [submitting, setSubmitting] = useState(false);

  const addPhotos = files => {
    setPhotos(prev => [...prev, ...files].slice(0, 5));
    files.forEach(f => {
      const reader = new FileReader();
      reader.onload = ev => setPreviews(prev => [...prev, ev.target.result].slice(0, 5));
      reader.readAsDataURL(f);
    });
  };
  const removePhoto = i => {
    setPhotos(p => p.filter((_, idx) => idx !== i));
    setPreviews(p => p.filter((_, idx) => idx !== i));
  };

  const handleSubmit = async e => {
    e.preventDefault();
    if (!form.title.trim()) { toast.error('Title is required'); return; }
    setSubmitting(true);
    try {
      const fd = new FormData();
      Object.entries(form).forEach(([k, v]) => { if (v) fd.append(k, v); });
      photos.forEach(f => fd.append('photos', f));
      await api.post('/vehicle-reports', fd);
      toast.success('Report submitted — owner has been notified');
      onSuccess();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to submit report');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ maxWidth: 560, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: '1.25rem' }}>
        <button type="button" onClick={onCancel} style={{
          background: 'none', border: 'none', cursor: 'pointer',
          color: 'var(--blue)', fontSize: '13.5px', fontWeight: 600,
          display: 'flex', alignItems: 'center', gap: 4, padding: 0,
        }}>
          ← Back
        </button>
        <span style={{ color: 'var(--border-strong)' }}>·</span>
        <h1 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-h)', margin: 0 }}>Submit Vehicle Report</h1>
      </div>

      <form onSubmit={handleSubmit} className="card" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
          <div>
            <label className="label">Issue Type</label>
            <select className="input-field" value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}>
              {REPORT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Assigned Truck</label>
            {assignedVehicle ? (
              <div className="input-field" style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--bg)', cursor: 'default' }}>
                <Wrench size={13} color="var(--text-3)" />
                <span style={{ fontWeight: 600, color: 'var(--text)' }}>{assignedVehicle.truck_id}</span>
                <span style={{ color: 'var(--text-3)', fontSize: '12px' }}>· {assignedVehicle.plate_number}</span>
              </div>
            ) : (
              <div className="input-field" style={{ color: 'var(--text-3)', fontSize: '13px' }}>No truck assigned</div>
            )}
          </div>
        </div>

        <div>
          <label className="label">Title / Summary <span style={{ color: 'var(--red)' }}>*</span></label>
          <input type="text" className="input-field" placeholder="e.g. Engine overheating on EDSA"
            value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} required />
        </div>

        <div>
          <label className="label">Current Location</label>
          <div style={{ position: 'relative' }}>
            <MapPin size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-3)', pointerEvents: 'none' }} />
            <input type="text" className="input-field" placeholder="e.g. EDSA Northbound near Balintawak"
              style={{ paddingLeft: 30 }}
              value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} />
          </div>
        </div>

        <div>
          <label className="label">Description</label>
          <textarea rows={4} className="input-field resize-none"
            placeholder="Describe what happened — what you heard, saw, or felt. The more detail the better."
            value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
        </div>

        <div>
          <label className="label">Photos <span style={{ color: 'var(--text-3)', fontWeight: 400 }}>(up to 5)</span></label>
          <PhotoPicker photos={photos} previews={previews} onAdd={addPhotos} onRemove={removePhoto} max={5} />
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, paddingTop: 4 }}>
          <button type="button" onClick={onCancel} className="btn-secondary" disabled={submitting}>Cancel</button>
          <button type="submit" className="btn-primary" disabled={submitting} style={{ gap: 7 }}>
            {submitting ? <LoadingSpinner size="sm" /> : <Send size={14} />}
            {submitting ? 'Submitting...' : 'Submit Report'}
          </button>
        </div>
      </form>
    </div>
  );
}

// ── Driver view ────────────────────────────────────────────────────────────────
function DriverView() {
  const [reports, setReports]       = useState([]);
  const [loading, setLoading]       = useState(true);
  const [vehicles, setVehicles]     = useState([]);
  const [vehicleReady, setVehicleReady] = useState(false);
  const [showForm, setShowForm]     = useState(false);
  const [expanded, setExpanded]     = useState(null);
  const apiBase = import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:5000';

  const loadReports = () =>
    api.get('/vehicle-reports/my')
      .then(r => setReports(r.data.data || []))
      .catch(console.error)
      .finally(() => setLoading(false));

  useEffect(() => {
    loadReports();
    api.get('/vehicles?limit=1')
      .then(r => setVehicles(r.data.data || []))
      .catch(console.error)
      .finally(() => setVehicleReady(true));
  }, []);

  const handleSuccess = () => {
    setShowForm(false);
    loadReports();
  };

  const handleProgressSuccess = () => {
    loadReports();
  };

  if (showForm) return <SubmitReportForm vehicles={vehicles} onSuccess={handleSuccess} onCancel={() => setShowForm(false)} />;

  return (
    <div style={{ maxWidth: 640, margin: '0 auto' }} className="space-y-5 fade-in">
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
        <div>
          <h1 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-h)', marginBottom: 2 }}>Truck Reports</h1>
          <p style={{ fontSize: '13px', color: 'var(--text-3)' }}>Report any vehicle issues or breakdowns</p>
        </div>
        <button onClick={() => setShowForm(true)} className="btn-primary" style={{ gap: 7 }}
          disabled={!vehicleReady}>
          <Plus size={15} /> New Report
        </button>
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}><LoadingSpinner size="xl" /></div>
      ) : reports.length === 0 ? (
        <div className="card">
          <EmptyState icon="reports" title="No reports yet" message="If your vehicle has an issue, submit a report so your owner is notified." action={() => setShowForm(true)} actionLabel="New Report" />
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {reports.map(r => {
            const photos = typeof r.photos === 'string' ? JSON.parse(r.photos) : (r.photos || []);
            const progressPhotos = typeof r.progress_photos === 'string' ? JSON.parse(r.progress_photos) : (r.progress_photos || []);
            const isOpen = expanded === r.id;
            const isInProgress = ['in_progress', 'acknowledged', 'scheduled'].includes(r.status);
            const canSubmitProgress = isInProgress && !r.driver_progress_at;

            return (
              <div key={r.id} className="card" style={{ padding: 0, overflow: 'hidden' }}>
                <button type="button" onClick={() => setExpanded(isOpen ? null : r.id)}
                  style={{ width: '100%', padding: '14px 16px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 36, height: 36, borderRadius: 8, background: 'rgba(239,68,68,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <AlertTriangle size={16} color="#EF4444" />
                  </div>
                  <div style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
                    <p style={{ fontSize: '13.5px', fontWeight: 700, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.title}</p>
                    <p style={{ fontSize: '11.5px', color: 'var(--text-3)', marginTop: 2 }}>
                      {REPORT_TYPES.find(t => t.value === r.type)?.label || r.type}
                      {r.truck_id && ` · ${r.truck_id}`}
                      {' · '}{format(new Date(r.created_at), 'dd/MM/yyyy')}
                    </p>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                    <StatusBadge status={r.status} />
                    {canSubmitProgress && (
                      <span style={{ fontSize: '10px', fontWeight: 700, padding: '2px 7px', borderRadius: 99, background: 'rgba(249,115,22,0.12)', color: '#F97316', border: '1px solid rgba(249,115,22,0.3)', whiteSpace: 'nowrap' }}>
                        Action needed
                      </span>
                    )}
                    <ChevronDown size={14} color="var(--text-3)" style={{ transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
                  </div>
                </button>

                {isOpen && (
                  <div style={{ padding: '0 16px 16px', borderTop: '1px solid var(--border)' }}>
                    <PhaseStepper report={r} />

                    {r.location && (
                      <p style={{ fontSize: '12px', color: 'var(--text-3)', marginTop: 10, display: 'flex', alignItems: 'center', gap: 5 }}>
                        <MapPin size={12} /> {r.location}
                      </p>
                    )}
                    {r.description && (
                      <p style={{ fontSize: '13px', color: 'var(--text-2)', marginTop: 10, lineHeight: 1.6 }}>{r.description}</p>
                    )}
                    {photos.length > 0 && (
                      <div style={{ marginTop: 10 }}>
                        <p style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-3)', marginBottom: 4 }}>INCIDENT PHOTOS</p>
                        <PhotoGrid photos={photos} apiBase={apiBase} />
                      </div>
                    )}

                    {/* Owner response */}
                    {r.owner_notes && (
                      <div style={{ marginTop: 12, padding: '10px 12px', background: 'rgba(59,130,246,0.07)', border: '1px solid rgba(59,130,246,0.2)', borderRadius: 8 }}>
                        <p style={{ fontSize: '11px', fontWeight: 700, color: 'var(--blue)', marginBottom: 4 }}>Owner's Response</p>
                        <p style={{ fontSize: '12.5px', color: 'var(--text-2)' }}>{r.owner_notes}</p>
                        {r.scheduled_date && (
                          <p style={{ fontSize: '11.5px', color: 'var(--text-3)', marginTop: 4, display: 'flex', alignItems: 'center', gap: 5 }}>
                            <CalendarClock size={11} /> Repair date: {format(new Date(r.scheduled_date), 'dd/MM/yyyy')}
                          </p>
                        )}
                      </div>
                    )}

                    {/* Driver submits work progress */}
                    {canSubmitProgress && (
                      <ProgressUploadForm report={r} onSuccess={handleProgressSuccess} />
                    )}

                    {/* Submitted progress photos */}
                    {r.driver_progress_at && progressPhotos.length > 0 && (
                      <div style={{ marginTop: 12, padding: '10px 12px', background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: 10 }}>
                        <p style={{ fontSize: '11px', fontWeight: 700, color: '#10B981', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 5 }}>
                          <CheckCheck size={12} /> Work Photos Submitted
                        </p>
                        <PhotoGrid photos={progressPhotos} apiBase={apiBase} />
                        {r.driver_progress_notes && (
                          <p style={{ fontSize: '12.5px', color: 'var(--text-2)', marginTop: 8 }}>{r.driver_progress_notes}</p>
                        )}
                      </div>
                    )}

                    {r.status === 'resolved' && (
                      <div style={{ marginTop: 12, padding: '10px 12px', background: 'rgba(16,185,129,0.07)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
                        <CheckCheck size={14} color="#10B981" />
                        <div>
                          <p style={{ fontSize: '12.5px', fontWeight: 700, color: '#10B981' }}>Marked as Fixed / Done</p>
                          {r.resolved_at && <p style={{ fontSize: '11.5px', color: 'var(--text-3)', marginTop: 1 }}>Resolved on {format(new Date(r.resolved_at), 'dd/MM/yyyy')}</p>}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Owner action panel ─────────────────────────────────────────────────────────
function OwnerActions({ report, noteInputs, setNoteInputs, updatingId, onUpdate }) {
  const [schedDate, setSchedDate] = useState('');
  const isUpdating = updatingId === report.id;
  const isInProgress = ['in_progress', 'acknowledged', 'scheduled'].includes(report.status);

  return (
    <div style={{ marginTop: 14, padding: '14px', background: 'var(--bg)', borderRadius: 10, border: '1px solid var(--border)' }}>
      <p style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 12 }}>
        Update Status
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 14 }}>
        {[
          { status: 'in_progress', label: 'In Progress',   icon: Hammer,     color: '#F97316', bg: 'rgba(249,115,22,0.08)',  border: 'rgba(249,115,22,0.25)',  desc: 'Repair is underway' },
          { status: 'resolved',    label: 'Mark as Fixed', icon: CheckCheck, color: '#10B981', bg: 'rgba(16,185,129,0.08)', border: 'rgba(16,185,129,0.25)', desc: 'Issue fully resolved' },
        ].map(({ status, label, icon: Icon, color, bg, border, desc }) => {
          const isCurrent = status === 'in_progress' ? isInProgress : report.status === status;
          return (
            <button key={status} type="button"
              disabled={isCurrent || isUpdating}
              onClick={() => onUpdate(report.id, status, schedDate ? { scheduled_date: schedDate } : {})}
              style={{
                display: 'flex', alignItems: 'center', gap: 9,
                padding: '10px 12px', borderRadius: 8,
                cursor: isCurrent ? 'default' : 'pointer',
                border: `1px solid ${isCurrent ? border : 'var(--border)'}`,
                background: isCurrent ? bg : 'var(--bg-card)',
                opacity: isUpdating ? 0.6 : 1,
                transition: 'all 0.15s', textAlign: 'left',
              }}
              onMouseEnter={e => { if (!isCurrent) e.currentTarget.style.borderColor = border; }}
              onMouseLeave={e => { if (!isCurrent) e.currentTarget.style.borderColor = 'var(--border)'; }}
            >
              <div style={{ width: 30, height: 30, borderRadius: 7, background: isCurrent ? bg : `${color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Icon size={14} color={color} />
              </div>
              <div style={{ minWidth: 0 }}>
                <p style={{ fontSize: '12.5px', fontWeight: 700, color: isCurrent ? color : 'var(--text)', lineHeight: 1.2 }}>{label}</p>
                <p style={{ fontSize: '10.5px', color: 'var(--text-3)', marginTop: 1 }}>{desc}</p>
              </div>
              {isCurrent && <span style={{ marginLeft: 'auto', fontSize: '10px', fontWeight: 700, color, background: bg, padding: '2px 7px', borderRadius: 99, border: `1px solid ${border}`, flexShrink: 0 }}>Current</span>}
            </button>
          );
        })}
      </div>

      <div style={{ marginBottom: 12 }}>
        <label style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--text-3)', display: 'flex', alignItems: 'center', gap: 5, marginBottom: 6 }}>
          <CalendarClock size={12} /> Repair Date <span style={{ fontWeight: 400 }}>(optional)</span>
        </label>
        <input type="date" className="input-field"
          value={schedDate}
          min={new Date().toISOString().split('T')[0]}
          onChange={e => setSchedDate(e.target.value)}
          style={{ fontSize: '12.5px' }}
        />
      </div>

      <div>
        <label style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--text-3)', display: 'block', marginBottom: 6 }}>
          Note to driver <span style={{ fontWeight: 400 }}>(optional)</span>
        </label>
        <textarea rows={2} className="input-field resize-none"
          placeholder="e.g. Will be fixed at AutoFix Shop on Saturday morning..."
          value={noteInputs[report.id] || ''}
          onChange={e => setNoteInputs(n => ({ ...n, [report.id]: e.target.value }))}
          style={{ fontSize: '12.5px', marginBottom: 8 }}
        />
        {noteInputs[report.id] && (
          <button type="button" onClick={() => onUpdate(report.id, report.status)}
            disabled={isUpdating} className="btn-secondary" style={{ height: 32, fontSize: '12px' }}>
            {isUpdating ? 'Saving...' : 'Send Note'}
          </button>
        )}
      </div>
    </div>
  );
}

// ── Owner view ─────────────────────────────────────────────────────────────────
function OwnerView() {
  const [reports, setReports]   = useState([]);
  const [loading, setLoading]   = useState(true);
  const [filter, setFilter]     = useState('');
  const [expanded, setExpanded] = useState(null);
  const [updatingId, setUpdatingId] = useState(null);
  const [noteInputs, setNoteInputs] = useState({});
  const apiBase = import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:5000';

  const load = async () => {
    setLoading(true);
    try {
      const params = filter ? `?status=${filter}` : '';
      const res = await api.get(`/vehicle-reports${params}`);
      setReports(res.data.data || []);
    } catch { toast.error('Failed to load reports'); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [filter]);

  const handleStatusUpdate = async (id, status, extra = {}) => {
    setUpdatingId(id);
    try {
      const payload = { status, owner_notes: noteInputs[id] || undefined, ...extra };
      const res = await api.put(`/vehicle-reports/${id}/status`, payload);
      setReports(prev => prev.map(r => r.id === id ? res.data.report : r));
      setNoteInputs(n => { const c = { ...n }; delete c[id]; return c; });
      toast.success('Report updated — driver has been notified');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to update');
    } finally { setUpdatingId(null); }
  };

  const pendingCount = reports.filter(r => r.status === 'pending').length;

  return (
    <div className="space-y-5 fade-in">
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
        <div>
          <h1 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-h)', marginBottom: 2 }}>
            Vehicle Incident Reports
            {pendingCount > 0 && (
              <span style={{ marginLeft: 8, fontSize: '11px', fontWeight: 700, padding: '2px 8px', borderRadius: 99, background: 'rgba(245,158,11,0.12)', color: '#F59E0B', border: '1px solid rgba(245,158,11,0.25)' }}>
                {pendingCount} pending
              </span>
            )}
          </h1>
          <p style={{ fontSize: '13px', color: 'var(--text-3)' }}>Breakdown and incident reports from drivers</p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {['', 'pending', 'in_progress', 'resolved'].map(s => (
            <button key={s} onClick={() => setFilter(s)} style={{
              padding: '5px 12px', borderRadius: 7, fontSize: '12px', fontWeight: 600,
              border: '1px solid var(--border)',
              background: filter === s ? 'var(--blue)' : 'var(--bg-card)',
              color: filter === s ? '#fff' : 'var(--text-2)',
              cursor: 'pointer', transition: 'all 0.15s',
            }}>
              {s === '' ? 'All' : STATUS_CONFIG[s]?.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}><LoadingSpinner size="xl" /></div>
      ) : reports.length === 0 ? (
        <div className="card">
          <EmptyState icon="reports" title={filter ? `No ${STATUS_CONFIG[filter]?.label} reports` : 'No reports yet'} message="Reports from drivers will appear here." />
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {reports.map(r => {
            const photos = typeof r.photos === 'string' ? JSON.parse(r.photos) : (r.photos || []);
            const progressPhotos = typeof r.progress_photos === 'string' ? JSON.parse(r.progress_photos) : (r.progress_photos || []);
            const isOpen = expanded === r.id;
            const cfg = STATUS_CONFIG[r.status] || STATUS_CONFIG.pending;
            const workDone = !!r.driver_progress_at;

            return (
              <div key={r.id} className="card" style={{ padding: 0, overflow: 'hidden', borderLeft: `3px solid ${cfg.color}` }}>
                <button type="button" onClick={() => setExpanded(isOpen ? null : r.id)}
                  style={{ width: '100%', padding: '14px 16px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 38, height: 38, borderRadius: 8, background: cfg.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <AlertTriangle size={17} color={cfg.color} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <p style={{ fontSize: '13.5px', fontWeight: 700, color: 'var(--text)' }}>{r.title}</p>
                      <StatusBadge status={r.status} />
                      {workDone && r.status !== 'resolved' && (
                        <span style={{ fontSize: '10px', fontWeight: 700, padding: '2px 7px', borderRadius: 99, background: 'rgba(16,185,129,0.1)', color: '#10B981', border: '1px solid rgba(16,185,129,0.3)', whiteSpace: 'nowrap' }}>
                          Work Done ✓
                        </span>
                      )}
                    </div>
                    <p style={{ fontSize: '11.5px', color: 'var(--text-3)', marginTop: 3 }}>
                      <strong style={{ color: 'var(--text-2)' }}>{r.driver_name}</strong>
                      {r.truck_id && <> · {r.truck_id} ({r.plate_number})</>}
                      {' · '}{REPORT_TYPES.find(t => t.value === r.type)?.label || r.type}
                      {' · '}{format(new Date(r.created_at), 'dd/MM/yyyy HH:mm')}
                    </p>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                    {photos.length > 0 && (
                      <span style={{ fontSize: '11px', color: 'var(--text-3)', display: 'flex', alignItems: 'center', gap: 3 }}>
                        <Camera size={12} />{photos.length}
                      </span>
                    )}
                    <ChevronDown size={14} color="var(--text-3)" style={{ transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
                  </div>
                </button>

                {isOpen && (
                  <div style={{ padding: '0 16px 16px', borderTop: '1px solid var(--border)' }}>
                    <PhaseStepper report={r} />

                    {r.location && (
                      <p style={{ fontSize: '12px', color: 'var(--text-3)', marginTop: 10, display: 'flex', alignItems: 'center', gap: 5 }}>
                        <MapPin size={12} />{r.location}
                      </p>
                    )}
                    {r.description && (
                      <p style={{ fontSize: '13px', color: 'var(--text-2)', marginTop: 10, lineHeight: 1.65 }}>{r.description}</p>
                    )}

                    {photos.length > 0 && (
                      <div style={{ marginTop: 10 }}>
                        <p style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-3)', marginBottom: 4 }}>INCIDENT PHOTOS</p>
                        <PhotoGrid photos={photos} apiBase={apiBase} />
                      </div>
                    )}

                    {/* Driver work photos */}
                    {progressPhotos.length > 0 && (
                      <div style={{ marginTop: 12, padding: '10px 12px', background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: 10 }}>
                        <p style={{ fontSize: '11px', fontWeight: 700, color: '#10B981', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 5 }}>
                          <CheckCheck size={12} /> Driver's Work Photos
                          {r.driver_progress_at && (
                            <span style={{ fontWeight: 400, color: 'var(--text-3)', marginLeft: 4 }}>
                              — {format(new Date(r.driver_progress_at), 'dd/MM/yyyy HH:mm')}
                            </span>
                          )}
                        </p>
                        <PhotoGrid photos={progressPhotos} apiBase={apiBase} />
                        {r.driver_progress_notes && (
                          <p style={{ fontSize: '12.5px', color: 'var(--text-2)', marginTop: 8 }}>{r.driver_progress_notes}</p>
                        )}
                      </div>
                    )}

                    {r.status !== 'resolved' && (
                      <OwnerActions
                        report={r}
                        noteInputs={noteInputs}
                        setNoteInputs={setNoteInputs}
                        updatingId={updatingId}
                        onUpdate={handleStatusUpdate}
                      />
                    )}
                    {r.status === 'resolved' && (
                      <div style={{ marginTop: 14, display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', background: 'rgba(16,185,129,0.07)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: 8 }}>
                        <CheckCheck size={16} color="#10B981" />
                        <div>
                          <p style={{ fontSize: '12.5px', fontWeight: 700, color: '#10B981' }}>Marked as Fixed / Done</p>
                          {r.resolved_at && <p style={{ fontSize: '11px', color: 'var(--text-3)', marginTop: 1 }}>Resolved on {format(new Date(r.resolved_at), 'dd/MM/yyyy HH:mm')}</p>}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Main export ────────────────────────────────────────────────────────────────
export default function VehicleReports() {
  const { user } = useSelector(s => s.auth);
  if (user?.role === 'driver') return <DriverView />;
  return <OwnerView />;
}
