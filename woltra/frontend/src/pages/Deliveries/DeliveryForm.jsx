import { useState, useEffect, useRef, useMemo } from 'react';
import { useSelector } from 'react-redux';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import { Truck, X, AlertCircle, Plus, Minus } from 'lucide-react';
import api from '../../services/api';
import { PH_LOCATIONS, PH_PROVINCES } from '../../data/philippineLocations';

/* ── Sheet / modal shell ────────────────────────── */
function FormShell({ isMobile, onClose, title, subtitle, children, footer }) {
  const header = (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
      <h2 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-h)', margin: 0 }}>{title}</h2>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
        {subtitle && (
          <span style={{ fontSize: 12, color: 'var(--text-3)', fontWeight: 600, padding: '3px 8px', background: 'var(--bg-card-alt)', borderRadius: 'var(--r-pill)' }}>
            {subtitle}
          </span>
        )}
        <button onClick={onClose} style={{ display: 'flex', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)', padding: 5, borderRadius: 'var(--r-sm)' }}>
          <X size={18} />
        </button>
      </div>
    </div>
  );

  if (isMobile) {
    return (
      <>
        <div className="sheet-overlay" onClick={onClose} />
        <div className="sheet">
          <div className="sheet-handle" />
          <div className="sheet-header">{header}</div>
          <div className="sheet-body">{children}</div>
          <div className="sheet-footer">{footer}</div>
        </div>
      </>
    );
  }

  return (
    <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal">
        <div className="modal-header">{header}</div>
        <div className="modal-body">{children}</div>
        <div className="modal-footer">{footer}</div>
      </div>
    </div>
  );
}

/* ── Section heading ── */
function SectionLabel({ children }) {
  return (
    <p style={{
      fontSize: 11, fontWeight: 700, color: 'var(--text-3)',
      textTransform: 'uppercase', letterSpacing: '0.07em',
      margin: '0 0 2px', paddingTop: 4,
    }}>
      {children}
    </p>
  );
}

/* ── Main component ─────────────────────────────── */
export default function DeliveryForm({ delivery, onClose, onSuccess }) {
  const isEdit = !!delivery;
  const { user } = useSelector(s => s.auth);
  const isDriver = user?.role === 'driver';

  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [drivers, setDrivers]   = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [driverAbsent, setDriverAbsent] = useState(false);
  const [province, setProvince] = useState(delivery?.delivery_province || '');
  const [city, setCity]         = useState(delivery?.delivery_city || '');
  const [tripRate, setTripRate] = useState(null);
  const [helperRate, setHelperRate] = useState(null);
  const [myVehicle, setMyVehicle] = useState(undefined);
  const mountedRef = useRef(false);

  /* helpers: parse stored "Name1 ; Name2" or start blank */
  const [helpers, setHelpers] = useState(() => {
    const stored = delivery?.helper_name;
    if (!stored) return [''];
    const parts = stored.split(';').map(s => s.trim()).filter(Boolean);
    return parts.length ? parts : [''];
  });

  /* 10 or 12 wheelers get up to 4 helpers; edit mode always gets 4 */
  const isLargeVehicle = (myVehicle?.wheel_count ?? 0) >= 10;
  const maxHelpers = (isEdit || isLargeVehicle) ? 4 : 1;

  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);

  useEffect(() => {
    if (!isDriver || isEdit) { setMyVehicle(null); return; }
    api.get('/vehicles?limit=1')
      .then(r => setMyVehicle(r.data.data?.[0] || null))
      .catch(() => setMyVehicle(null));
  }, [isDriver, isEdit]);

  const dateValue = delivery?.date
    ? (delivery.date.includes('T') ? delivery.date.split('T')[0] : delivery.date)
    : new Date().toISOString().split('T')[0];

  const { register, handleSubmit, setValue, formState: { errors } } = useForm({
    defaultValues: {
      date: dateValue,
      gate_pass_number: delivery?.gate_pass_number || '',
      outlet: delivery?.outlet || '',
      driver_id: delivery?.driver_id || '',
      replacement_driver_name: delivery?.replacement_driver_name || '',
    },
  });

  const cityOptions = province ? (PH_LOCATIONS[province] || []) : [];
  const myDriver = useMemo(() => drivers.find(d => d.user_id === user?.id), [drivers, user?.id]);

  useEffect(() => {
    api.get('/drivers?limit=100&status=active').then(r => {
      const list = r.data.data || [];
      setDrivers(list);
      if (!isEdit) {
        const me = list.find(d => d.user_id === user?.id);
        if (me) setValue('driver_id', me.id);
      }
    }).catch(() => {});
  }, [user?.id]);

  useEffect(() => {
    if (!mountedRef.current) { mountedRef.current = true; return; }
    setCity('');
    setTripRate(null);
    setHelperRate(null);
  }, [province]);

  useEffect(() => {
    if (!province || !city) { setTripRate(null); setHelperRate(null); return; }
    const wc = myVehicle?.wheel_count || 0;
    api.get(`/salary?province=${encodeURIComponent(province)}&wheel_count=${wc}`)
      .then(r => {
        const exact = (r.data.data || []).find(x => x.city === city);
        if (exact) {
          setTripRate(parseFloat(exact.driver_rate ?? exact.rate));
          setHelperRate(exact.helper_rate != null ? parseFloat(exact.helper_rate) : null);
          return;
        }
        if (wc !== 0) {
          api.get(`/salary?province=${encodeURIComponent(province)}&wheel_count=0`).then(r2 => {
            const fallback = (r2.data.data || []).find(x => x.city === city);
            setTripRate(fallback ? parseFloat(fallback.driver_rate ?? fallback.rate) : null);
            setHelperRate(fallback?.helper_rate != null ? parseFloat(fallback.helper_rate) : null);
          }).catch(() => { setTripRate(null); setHelperRate(null); });
        } else {
          setTripRate(null); setHelperRate(null);
        }
      })
      .catch(() => { setTripRate(null); setHelperRate(null); });
  }, [province, city]);

  const onSubmit = async (data) => {
    if (isDriver) {
      if (!province) { toast.error('Province is required'); return; }
      if (!city)     { toast.error('City / Municipality is required'); return; }
    }
    setSubmitting(true);
    try {
      const payload = {
        ...data,
        driver_id: data.driver_id || null,
        replacement_driver_name: data.replacement_driver_name || null,
        helper_name: helpers.map(h => h.trim()).filter(Boolean).join(' ; ') || null,
        delivery_province: province || null,
        delivery_city: city || null,
        vehicle_id: isDriver && myVehicle ? myVehicle.id : (data.vehicle_id || null),
      };
      if (isEdit) {
        await api.put(`/deliveries/${delivery.id}`, payload);
        toast.success('Delivery updated');
      } else {
        await api.post('/deliveries', { ...payload, status: 'pending' });
        toast.success('Delivery created — proceed to Phase 1 loading');
        window.dispatchEvent(new CustomEvent('woltra:delivery-created'));
      }
      onSuccess();
    } catch (err) {
      toast.error(err.response?.data?.error || `Failed to ${isEdit ? 'update' : 'create'} delivery`);
    } finally {
      setSubmitting(false);
    }
  };

  /* ── Blocked: no vehicle ── */
  if (isDriver && !isEdit && myVehicle === null) {
    return (
      <FormShell isMobile={isMobile} onClose={onClose} title="New Delivery"
        footer={
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button className="btn-secondary" onClick={onClose}>Close</button>
          </div>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', padding: '2rem 1rem', gap: 16 }}>
          <div className="empty-icon">
            <Truck size={24} color="var(--primary)" />
          </div>
          <div>
            <p style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-h)', marginBottom: 8 }}>No Vehicle Assigned</p>
            <p style={{ fontSize: 13, color: 'var(--text-3)', lineHeight: 1.6, maxWidth: 300 }}>
              You need an assigned vehicle before you can log a delivery. Go to the Home screen and claim your vehicle using the code from your fleet owner.
            </p>
          </div>
        </div>
      </FormShell>
    );
  }

  /* ── Blocked: loading ── */
  if (isDriver && !isEdit && myVehicle === undefined) {
    return (
      <FormShell isMobile={isMobile} onClose={onClose} title="New Delivery" footer={null}>
        <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}>
          <div style={{ width: 24, height: 24, borderRadius: '50%', border: '3px solid var(--border)', borderTopColor: 'var(--primary)', animation: 'spin 0.7s linear infinite' }} />
        </div>
      </FormShell>
    );
  }

  /* ── Footer ── */
  const footer = (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', gap: 8 }}>
      <button className="btn-ghost" onClick={onClose}>Cancel</button>
      <button form="delivery-form" type="submit" className="btn-primary" disabled={submitting}>
        {submitting
          ? (isEdit ? 'Saving…' : 'Creating…')
          : (isEdit ? 'Save Changes' : 'Create Delivery')}
      </button>
    </div>
  );

  /* ── Single-page form ── */
  const formBody = (
    <form id="delivery-form" onSubmit={handleSubmit(onSubmit)} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>

      {/* Vehicle chip — driver only, new delivery */}
      {isDriver && myVehicle && !isEdit && (
        <div className="vehicle-chip">
          <div className="vehicle-chip-icon"><Truck size={15} /></div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            <span style={{ fontSize: 11, color: 'var(--text-3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Vehicle</span>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
              <span style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text-h)' }}>
                {[myVehicle.make, myVehicle.model].filter(Boolean).join(' ') || myVehicle.truck_id}
              </span>
              <span style={{ fontSize: 12, fontFamily: '"JetBrains Mono", monospace', color: 'var(--text-3)' }}>
                {myVehicle.truck_id} · {myVehicle.plate_number}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* ── Trip Info ── */}
      <SectionLabel>Trip Information</SectionLabel>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div>
          <label className="label">Date <span style={{ color: 'var(--red)' }}>*</span></label>
          <input type="date" className={`input-field${errors.date ? ' input-error' : ''}`}
            {...register('date', { required: 'Required' })} />
          {errors.date && <p className="error-text">{errors.date.message}</p>}
        </div>
        <div>
          <label className="label">
            Gate Pass No. {isDriver && <span style={{ color: 'var(--red)' }}>*</span>}
          </label>
          <input type="text" className={`input-field${errors.gate_pass_number ? ' input-error' : ''}`}
            placeholder="GP-2026-001"
            {...register('gate_pass_number', { required: isDriver ? 'Required' : false })} />
          {errors.gate_pass_number
            ? <p className="error-text">{errors.gate_pass_number.message}</p>
            : <p className="helper-text">e.g. GP-2026-001</p>}
        </div>
      </div>

      <div>
        <label className="label">Store / Outlet Name <span style={{ color: 'var(--red)' }}>*</span></label>
        <input type="text" className={`input-field${errors.outlet ? ' input-error' : ''}`}
          placeholder="e.g. Supermart North Branch"
          {...register('outlet', { required: 'Store name is required' })} />
        {errors.outlet && <p className="error-text">{errors.outlet.message}</p>}
      </div>

      {/* ── Destination ── */}
      <SectionLabel>Destination</SectionLabel>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div>
          <label className="label">
            Province {isDriver && <span style={{ color: 'var(--red)' }}>*</span>}
          </label>
          <select className="input-field" value={province} onChange={e => setProvince(e.target.value)}>
            <option value="">Select province</option>
            {PH_PROVINCES.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
        <div>
          <label className="label">
            City / Municipality {isDriver && <span style={{ color: 'var(--red)' }}>*</span>}
          </label>
          <select className="input-field" value={city}
            onChange={e => setCity(e.target.value)} disabled={!province}>
            <option value="">Select city</option>
            {cityOptions.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          {!province && <p className="helper-text">Select a province first</p>}
        </div>
      </div>

      {/* Rate preview */}
      {city && (
        <div style={{
          padding: '10px 14px', borderRadius: 'var(--r-sm)',
          background: tripRate !== null ? 'var(--s-delivered-bg)' : 'var(--s-pending-bg)',
          border: `1px solid ${tripRate !== null ? 'var(--s-delivered-border)' : 'var(--s-pending-border)'}`,
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          {tripRate !== null ? (
            <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', fontSize: 13 }}>
              <span>
                <span style={{ color: 'var(--text-3)' }}>Driver rate: </span>
                <span style={{ fontWeight: 700, color: 'var(--s-delivered)' }}>
                  ₱{tripRate.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                </span>
              </span>
              {helperRate != null && (
                <span>
                  <span style={{ color: 'var(--text-3)' }}>Helper: </span>
                  <span style={{ fontWeight: 700, color: 'var(--s-delivered)' }}>
                    ₱{helperRate.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                  </span>
                </span>
              )}
            </div>
          ) : (
            <span style={{ fontSize: 13, color: 'var(--s-pending)', display: 'flex', alignItems: 'center', gap: 6 }}>
              <AlertCircle size={14} />
              No rate set for {city} — owner can add in Salary settings
            </span>
          )}
        </div>
      )}

      {/* ── Crew ── */}
      <SectionLabel>Crew</SectionLabel>

      {/* Driver section */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <label className="label" style={{ marginBottom: 0 }}>Driver</label>
          {!isEdit && (
            <label style={{
              display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer',
              fontSize: 12.5, fontWeight: driverAbsent ? 600 : 500,
              color: driverAbsent ? 'var(--amber-600)' : 'var(--text-3)',
            }}>
              <input
                type="checkbox"
                style={{ accentColor: 'var(--primary)', width: 14, height: 14, cursor: 'pointer' }}
                checked={driverAbsent}
                onChange={e => {
                  setDriverAbsent(e.target.checked);
                  if (!e.target.checked && myDriver) setValue('driver_id', myDriver.id);
                  else if (e.target.checked) setValue('driver_id', '');
                }}
              />
              Main driver absent
            </label>
          )}
        </div>

        {isEdit ? (
          <select className="input-field" {...register('driver_id')}>
            <option value="">— Unassigned —</option>
            {drivers.map(d => (
              <option key={d.id} value={d.id}>{d.name} ({d.employee_id})</option>
            ))}
          </select>
        ) : driverAbsent ? (
          <>
            <input type="text" className="input-field" placeholder="Replacement driver's full name"
              {...register('replacement_driver_name')} />
            <p className="helper-text">Name of driver covering this trip</p>
          </>
        ) : (
          <div className="input-field" style={{
            background: 'var(--bg-card-alt)', color: 'var(--text-3)',
            cursor: 'not-allowed', display: 'flex', alignItems: 'center',
          }}>
            {myDriver?.name || user?.name}
            <input type="hidden" {...register('driver_id')} />
          </div>
        )}
      </div>

      {/* Helpers */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <label className="label" style={{ marginBottom: 0 }}>
            Helper Names
            {isDriver && helpers.length === 1 && !helpers[0] && (
              <span style={{ color: 'var(--red)', marginLeft: 2 }}>*</span>
            )}
          </label>
          {maxHelpers > 1 && (
            <span style={{ fontSize: 11.5, color: 'var(--text-3)', fontWeight: 500 }}>
              {helpers.filter(h => h.trim()).length} / {maxHelpers}
            </span>
          )}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {helpers.map((name, idx) => (
            <div key={idx} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <div style={{ position: 'relative', flex: 1 }}>
                <span style={{
                  position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)',
                  fontSize: 11, fontWeight: 700,
                  background: 'var(--primary)', color: 'var(--primary-text)',
                  width: 16, height: 16, borderRadius: '50%',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0,
                }}>
                  {idx + 1}
                </span>
                <input
                  type="text"
                  className="input-field"
                  style={{ paddingLeft: 34 }}
                  placeholder={idx === 0 ? 'Full name of helper' : `Helper ${idx + 1} name (optional)`}
                  value={name}
                  onChange={e => {
                    const next = [...helpers];
                    next[idx] = e.target.value;
                    setHelpers(next);
                  }}
                />
              </div>
              {helpers.length > 1 && (
                <button
                  type="button"
                  onClick={() => setHelpers(h => h.filter((_, i) => i !== idx))}
                  style={{
                    width: 34, height: 34, borderRadius: 'var(--r-sm)', flexShrink: 0,
                    background: 'var(--s-delayed-bg)', border: '1px solid var(--s-delayed-border)',
                    color: 'var(--s-delayed)', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}
                >
                  <Minus size={14} strokeWidth={2.5} />
                </button>
              )}
            </div>
          ))}
        </div>

        {helpers.length < maxHelpers && (
          <button
            type="button"
            onClick={() => setHelpers(h => [...h, ''])}
            style={{
              marginTop: 8,
              display: 'flex', alignItems: 'center', gap: 6,
              background: 'none', border: '1.5px dashed var(--border-strong)',
              borderRadius: 'var(--r-sm)', padding: '7px 12px',
              fontSize: 13, color: 'var(--text-3)', cursor: 'pointer',
              width: '100%', justifyContent: 'center',
              transition: 'border-color var(--dur-fast), color var(--dur-fast)',
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--primary)'; e.currentTarget.style.color = 'var(--primary)'; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-strong)'; e.currentTarget.style.color = 'var(--text-3)'; }}
          >
            <Plus size={14} strokeWidth={2.5} /> Add helper
          </button>
        )}

        {maxHelpers === 1
          ? <p className="helper-text">Person assisting with loading and unloading</p>
          : <p className="helper-text">
              Up to {maxHelpers} helpers for this {myVehicle?.wheel_count}-wheeler — all optional
            </p>
        }
      </div>
    </form>
  );

  return (
    <FormShell
      isMobile={isMobile}
      onClose={onClose}
      title={isEdit ? 'Edit Delivery' : 'New Delivery'}
      footer={footer}
    >
      {formBody}
    </FormShell>
  );
}
