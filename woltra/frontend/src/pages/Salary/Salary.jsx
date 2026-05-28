import { useState, useEffect, useCallback } from 'react';
import { useSelector } from 'react-redux';
import { MapPin, ChevronDown, Save, Users, Calendar, TrendingUp, CheckCircle, Clock, Truck } from 'lucide-react';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import api from '../../services/api';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import EmptyState from '../../components/common/EmptyState';
import { PH_LOCATIONS, PH_PROVINCES } from '../../data/philippineLocations';

const fmt = n => Number(n || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const WHEEL_OPTIONS = [
  { value: 0,  label: 'All Types (default)' },
  { value: 4,  label: '4 Wheeler' },
  { value: 6,  label: '6 Wheeler' },
  { value: 8,  label: '8 Wheeler' },
  { value: 10, label: '10 Wheeler' },
  { value: 12, label: '12 Wheeler' },
  { value: 14, label: '14 Wheeler' },
  { value: 16, label: '16 Wheeler' },
];

/* ── Owner: Rate Settings ─────────────────────────────────────── */
function RateSettings() {
  const [wheelCount, setWheelCount] = useState(0);
  const [province, setProvince]     = useState('');
  const [cities, setCities]         = useState([]);
  const [rates, setRates]           = useState({});   // { city: { driver_rate, helper_rate } }
  const [saved, setSaved]           = useState({});
  const [saving, setSaving]         = useState(null);
  const [selected, setSelected]     = useState({});   // { city: bool } — for bulk apply
  const [bulk, setBulk]             = useState({ driver_rate: '', helper_rate: '' });

  const loadRates = useCallback(async (prov, wc) => {
    if (!prov) return;
    try {
      const res = await api.get(`/salary?province=${encodeURIComponent(prov)}&wheel_count=${wc}`);
      const existing = {};
      (res.data.data || []).forEach(r => {
        existing[r.city] = {
          driver_rate: r.driver_rate != null ? String(r.driver_rate) : '',
          helper_rate: r.helper_rate != null ? String(r.helper_rate) : '',
        };
      });
      setSaved(existing);
      const cityList = PH_LOCATIONS[prov] || [];
      setCities(cityList);
      const draft = {};
      cityList.forEach(c => { draft[c] = existing[c] || { driver_rate: '', helper_rate: '' }; });
      setRates(draft);
      setSelected({});
      setBulk({ driver_rate: '', helper_rate: '' });
    } catch { toast.error('Failed to load rates'); }
  }, []);

  useEffect(() => { loadRates(province, wheelCount); }, [province, wheelCount, loadRates]);

  const saveOne = async city => {
    const dr = parseFloat(rates[city]?.driver_rate);
    const hr = parseFloat(rates[city]?.helper_rate) || null;
    if (!dr || dr <= 0) { toast.error('Enter a valid driver rate'); return; }
    setSaving(city);
    try {
      await api.post('/salary', { province, city, wheel_count: wheelCount, driver_rate: dr, helper_rate: hr });
      setSaved(s => ({ ...s, [city]: { driver_rate: String(dr), helper_rate: hr ? String(hr) : '' } }));
      toast.success(`Saved ${city}`);
    } catch { toast.error('Failed to save'); }
    finally { setSaving(null); }
  };

  const applyBulk = () => {
    const dr = bulk.driver_rate;
    const hr = bulk.helper_rate;
    if (!dr || parseFloat(dr) <= 0) { toast.error('Enter a bulk driver rate first'); return; }
    const targets = Object.keys(selected).filter(c => selected[c]);
    if (!targets.length) { toast.error('Select at least one city'); return; }
    setRates(prev => {
      const next = { ...prev };
      targets.forEach(c => { next[c] = { driver_rate: dr, helper_rate: hr }; });
      return next;
    });
    toast(`Rate applied to ${targets.length} cit${targets.length === 1 ? 'y' : 'ies'} — click Save All to confirm`);
  };

  const saveAll = async () => {
    const toSave = cities.filter(c => {
      const dr = rates[c]?.driver_rate;
      return dr && parseFloat(dr) > 0 &&
        (rates[c]?.driver_rate !== saved[c]?.driver_rate || rates[c]?.helper_rate !== saved[c]?.helper_rate);
    });
    if (!toSave.length) { toast('No changes to save'); return; }
    setSaving('__all__');
    try {
      await Promise.all(toSave.map(c =>
        api.post('/salary', {
          province, city: c, wheel_count: wheelCount,
          driver_rate: parseFloat(rates[c]?.driver_rate),
          helper_rate: parseFloat(rates[c]?.helper_rate) || null,
        })
      ));
      const ns = { ...saved };
      toSave.forEach(c => { ns[c] = { driver_rate: rates[c]?.driver_rate, helper_rate: rates[c]?.helper_rate || '' }; });
      setSaved(ns);
      toast.success(`Saved ${toSave.length} rate(s)`);
    } catch { toast.error('Failed to save some rates'); }
    finally { setSaving(null); }
  };

  const allSelected = cities.length > 0 && cities.every(c => selected[c]);
  const dirty = cities.filter(c => {
    const dr = rates[c]?.driver_rate;
    return dr && (rates[c]?.driver_rate !== saved[c]?.driver_rate || rates[c]?.helper_rate !== saved[c]?.helper_rate);
  });

  return (
    <div className="space-y-4">
      {/* Step 1 — Wheel count + Province */}
      <div className="card space-y-3">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 6 }}>
            <Truck size={14} color="var(--blue)" />
            <p style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-h)' }}>Truck Type</p>
          </div>
          <select className="input-field" value={wheelCount} onChange={e => setWheelCount(parseInt(e.target.value))}>
            {WHEEL_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <p style={{ fontSize: '11px', color: 'var(--text-3)', marginTop: 4 }}>
            "All Types" is a fallback used when no specific wheel-count rate is set.
          </p>
        </div>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 6 }}>
            <MapPin size={14} color="var(--blue)" />
            <p style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-h)' }}>Province</p>
          </div>
          <select className="input-field" value={province} onChange={e => setProvince(e.target.value)}>
            <option value="">— Select province —</option>
            {PH_PROVINCES.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
      </div>

      {province && (
        <>
          {/* Bulk apply */}
          <div className="card" style={{ borderLeft: '3px solid var(--blue)' }}>
            <p style={{ fontSize: '12.5px', fontWeight: 700, color: 'var(--text-h)', marginBottom: 8 }}>
              Bulk Apply — set same rate for selected cities
            </p>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
              <div>
                <label className="label">Driver Rate</label>
                <div style={{ position: 'relative' }}>
                  <span style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', fontSize: '12px', color: 'var(--text-3)' }}>₱</span>
                  <input type="number" min="0" step="50" placeholder="0.00" value={bulk.driver_rate}
                    onChange={e => setBulk(b => ({ ...b, driver_rate: e.target.value }))}
                    className="input-field mono" style={{ paddingLeft: 22, width: 120, height: 34 }} />
                </div>
              </div>
              <div>
                <label className="label">Helper Rate</label>
                <div style={{ position: 'relative' }}>
                  <span style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', fontSize: '12px', color: 'var(--text-3)' }}>₱</span>
                  <input type="number" min="0" step="50" placeholder="optional" value={bulk.helper_rate}
                    onChange={e => setBulk(b => ({ ...b, helper_rate: e.target.value }))}
                    className="input-field mono" style={{ paddingLeft: 22, width: 120, height: 34 }} />
                </div>
              </div>
              <button onClick={applyBulk} className="btn-primary" style={{ height: 34, fontSize: '12.5px' }}>
                Apply to Selected
              </button>
            </div>
          </div>

          {/* City list */}
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            {/* Header */}
            <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <input type="checkbox" checked={allSelected}
                  onChange={e => {
                    const v = e.target.checked;
                    const all = {};
                    cities.forEach(c => { all[c] = v; });
                    setSelected(all);
                  }}
                  style={{ width: 15, height: 15, accentColor: 'var(--blue)', cursor: 'pointer' }}
                />
                <p style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-h)' }}>
                  {province} — {WHEEL_OPTIONS.find(o => o.value === wheelCount)?.label}
                </p>
                <p style={{ fontSize: '11.5px', color: 'var(--text-3)' }}>{cities.length} cities</p>
              </div>
              {dirty.length > 0 && (
                <button onClick={saveAll} disabled={saving === '__all__'} className="btn-primary" style={{ fontSize: '12px' }}>
                  {saving === '__all__' ? <LoadingSpinner size="sm" /> : <Save size={12} />}
                  Save All ({dirty.length})
                </button>
              )}
            </div>

            {/* Column labels */}
            <div style={{ display: 'flex', padding: '5px 16px', background: 'var(--bg-card-alt)', borderBottom: '1px solid var(--border)', gap: 6 }}>
              <div style={{ width: 22 }} />
              <div style={{ flex: 1 }} />
              <p style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-3)', width: 110, textAlign: 'center' }}>Driver Rate</p>
              <p style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-3)', width: 110, textAlign: 'center' }}>Helper Rate</p>
              <div style={{ width: 34 }} />
            </div>

            {cities.map(city => {
              const cr = rates[city] || { driver_rate: '', helper_rate: '' };
              const sv = saved[city] || { driver_rate: '', helper_rate: '' };
              const isDirty = cr.driver_rate !== sv.driver_rate || cr.helper_rate !== sv.helper_rate;
              return (
                <div key={city} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 16px', borderBottom: '1px solid var(--border)' }}>
                  <input type="checkbox" checked={!!selected[city]}
                    onChange={e => setSelected(s => ({ ...s, [city]: e.target.checked }))}
                    style={{ width: 15, height: 15, flexShrink: 0, accentColor: 'var(--blue)', cursor: 'pointer' }}
                  />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{city}</p>
                    {sv.driver_rate && !isDirty && (
                      <p style={{ fontSize: '10.5px', color: '#10B981' }}>
                        D: ₱{fmt(sv.driver_rate)}{sv.helper_rate ? ` · H: ₱${fmt(sv.helper_rate)}` : ''}
                      </p>
                    )}
                  </div>
                  <div style={{ position: 'relative' }}>
                    <span style={{ position: 'absolute', left: 7, top: '50%', transform: 'translateY(-50%)', fontSize: '12px', color: 'var(--text-3)' }}>₱</span>
                    <input type="number" min="0" step="50" placeholder="Driver"
                      value={cr.driver_rate}
                      onChange={e => setRates(r => ({ ...r, [city]: { ...r[city], driver_rate: e.target.value } }))}
                      className="input-field mono" style={{ paddingLeft: 20, width: 110, height: 32 }} />
                  </div>
                  <div style={{ position: 'relative' }}>
                    <span style={{ position: 'absolute', left: 7, top: '50%', transform: 'translateY(-50%)', fontSize: '12px', color: 'var(--text-3)' }}>₱</span>
                    <input type="number" min="0" step="50" placeholder="Helper"
                      value={cr.helper_rate}
                      onChange={e => setRates(r => ({ ...r, [city]: { ...r[city], helper_rate: e.target.value } }))}
                      className="input-field mono" style={{ paddingLeft: 20, width: 110, height: 32 }} />
                  </div>
                  <button onClick={() => saveOne(city)} disabled={!cr.driver_rate || saving === city || saving === '__all__'}
                    style={{ width: 32, height: 32, borderRadius: 7, border: 'none', flexShrink: 0,
                      background: isDirty ? 'var(--blue)' : 'var(--bg-card-alt)',
                      color: isDirty ? '#fff' : 'var(--text-3)',
                      cursor: isDirty ? 'pointer' : 'default',
                      display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {saving === city ? <LoadingSpinner size="sm" /> : <Save size={13} />}
                  </button>
                </div>
              );
            })}
          </div>
        </>
      )}

      {!province && (
        <div className="card">
          <EmptyState icon="earnings" title="Select truck type & province" message="Pick a truck type and province above to set rates." />
        </div>
      )}
    </div>
  );
}

/* ── Owner: Pending Approvals ─────────────────────────────────── */
function PendingApprovals() {
  const today      = format(new Date(), 'yyyy-MM-dd');
  const monthStart = format(new Date(new Date().getFullYear(), new Date().getMonth(), 1), 'yyyy-MM-dd');
  const [filters, setFilters] = useState({ date_from: monthStart, date_to: today });
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [approving, setApproving] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams(Object.fromEntries(Object.entries(filters).filter(([, v]) => v)));
      const res = await api.get(`/salary/pending-approvals?${params}`);
      setItems(res.data.data || []);
    } catch { toast.error('Failed to load pending deliveries'); }
    finally { setLoading(false); }
  }, [filters]);

  useEffect(() => { load(); }, []);

  const approve = async id => {
    setApproving(id);
    try {
      await api.post(`/salary/approve/${id}`);
      toast.success('Salary approved');
      setItems(prev => prev.filter(i => i.id !== id));
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to approve');
    } finally { setApproving(null); }
  };

  return (
    <div className="space-y-4">
      <div className="card">
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div>
            <label className="label">From</label>
            <input type="date" className="input-field mono" style={{ width: 148 }}
              value={filters.date_from} onChange={e => setFilters(f => ({ ...f, date_from: e.target.value }))} />
          </div>
          <div>
            <label className="label">To</label>
            <input type="date" className="input-field mono" style={{ width: 148 }}
              value={filters.date_to} onChange={e => setFilters(f => ({ ...f, date_to: e.target.value }))} />
          </div>
          <button onClick={load} disabled={loading} className="btn-primary">
            {loading ? <LoadingSpinner size="sm" /> : <Clock size={15} />}
            Refresh
          </button>
        </div>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 7 }}>
          <Clock size={14} color="var(--text-3)" />
          <p style={{ fontSize: '13.5px', fontWeight: 700, color: 'var(--text-h)' }}>
            Delivered — Awaiting Salary Approval
          </p>
          {items.length > 0 && (
            <span style={{ marginLeft: 'auto', fontSize: '12px', background: '#F59E0B', color: '#fff', borderRadius: 9999, padding: '1px 8px', fontWeight: 700 }}>
              {items.length}
            </span>
          )}
        </div>
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem' }}><LoadingSpinner size="lg" /></div>
        ) : items.length === 0 ? (
          <EmptyState icon="deliveries" title="All caught up" message="No delivered trips are waiting for salary approval." />
        ) : (
          <div>
            {items.map(d => (
              <div key={d.id} style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '12px 16px', borderBottom: '1px solid var(--border)',
              }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-h)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {d.outlet}
                  </p>
                  <p style={{ fontSize: '11.5px', color: 'var(--text-3)' }}>
                    {format(new Date(d.date), 'dd/MM/yyyy')} · {d.driver_name || '—'}
                    {d.helper_name && ` + ${d.helper_name}`}
                  </p>
                  {(d.delivery_city || d.delivery_province) && (
                    <p style={{ fontSize: '11px', color: 'var(--text-3)', marginTop: 1 }}>
                      <MapPin size={10} style={{ display: 'inline', marginRight: 3 }} />
                      {[d.delivery_city, d.delivery_province].filter(Boolean).join(', ')}
                    </p>
                  )}
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <p style={{ fontSize: '13px', fontWeight: 800, color: '#10B981', fontFamily: 'monospace' }}>
                    {d.driver_rate != null ? `₱${fmt(d.driver_rate)}` : <span style={{ color: '#F59E0B', fontSize: '12px' }}>Unrated</span>}
                  </p>
                  {d.helper_rate != null && d.helper_name && (
                    <p style={{ fontSize: '11px', color: 'var(--text-3)' }}>H: ₱{fmt(d.helper_rate)}</p>
                  )}
                  <button
                    onClick={() => approve(d.id)}
                    disabled={approving === d.id}
                    className="btn-primary"
                    style={{ marginTop: 6, fontSize: '11.5px', padding: '4px 10px', display: 'flex', alignItems: 'center', gap: 4 }}
                  >
                    {approving === d.id ? <LoadingSpinner size="sm" /> : <CheckCircle size={12} />}
                    Approve
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Owner: Payroll ───────────────────────────────────────────── */
function Payroll() {
  const today      = format(new Date(), 'yyyy-MM-dd');
  const monthStart = format(new Date(new Date().getFullYear(), new Date().getMonth(), 1), 'yyyy-MM-dd');

  const [filters, setFilters] = useState({ date_from: monthStart, date_to: today });
  const [summary, setSummary] = useState([]);
  const [selected, setSelected] = useState(null);
  const [trips, setTrips] = useState([]);
  const [loading, setLoading] = useState(false);
  const [tripsLoading, setTripsLoading] = useState(false);

  const load = async () => {
    setLoading(true); setSelected(null);
    try {
      const params = new URLSearchParams(Object.fromEntries(Object.entries(filters).filter(([, v]) => v)));
      const res = await api.get(`/salary/payroll?${params}`);
      setSummary(res.data.data || []);
    } catch { toast.error('Failed to load payroll'); }
    finally { setLoading(false); }
  };

  const loadTrips = async driver => {
    setSelected(driver); setTripsLoading(true);
    try {
      const params = new URLSearchParams({ driver_id: driver.driver_id, ...Object.fromEntries(Object.entries(filters).filter(([k, v]) => v && k !== 'driver_id')) });
      const res = await api.get(`/salary/driver-trips?${params}`);
      setTrips(res.data.data || []);
    } catch { toast.error('Failed to load trips'); }
    finally { setTripsLoading(false); }
  };

  useEffect(() => { load(); }, []);
  const totalPayout = summary.reduce((s, d) => s + parseFloat(d.total_earnings || 0), 0);

  return (
    <div className="space-y-4">
      <div className="card">
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div>
            <label className="label">From</label>
            <input type="date" className="input-field mono" style={{ width: 148 }}
              value={filters.date_from} onChange={e => setFilters(f => ({ ...f, date_from: e.target.value }))} />
          </div>
          <div>
            <label className="label">To</label>
            <input type="date" className="input-field mono" style={{ width: 148 }}
              value={filters.date_to} onChange={e => setFilters(f => ({ ...f, date_to: e.target.value }))} />
          </div>
          <button onClick={load} disabled={loading} className="btn-primary">
            {loading ? <LoadingSpinner size="sm" /> : <TrendingUp size={15} />}
            Generate
          </button>
        </div>
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem 0' }}><LoadingSpinner size="lg" /></div>
      ) : (
        <>
          {summary.length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div className="card" style={{ textAlign: 'center' }}>
                <p style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--text-h)', fontFamily: 'monospace' }}>{summary.length}</p>
                <p style={{ fontSize: '11.5px', color: 'var(--text-3)', marginTop: 3 }}>Drivers</p>
              </div>
              <div className="card" style={{ textAlign: 'center' }}>
                <p style={{ fontSize: '1.4rem', fontWeight: 800, color: '#10B981', fontFamily: 'monospace' }}>₱{fmt(totalPayout)}</p>
                <p style={{ fontSize: '11.5px', color: 'var(--text-3)', marginTop: 3 }}>Approved Payout</p>
              </div>
            </div>
          )}

          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 7 }}>
              <Users size={14} color="var(--text-3)" />
              <p style={{ fontSize: '13.5px', fontWeight: 700, color: 'var(--text-h)' }}>Approved Driver Earnings</p>
            </div>
            {summary.length === 0 ? (
              <EmptyState icon="earnings" title="No approved payroll" message="Approve deliveries in the Approve tab first." />
            ) : (
              <div>
                {summary.map(d => (
                  <button key={d.driver_id} onClick={() => loadTrips(d)}
                    style={{
                      width: '100%', display: 'flex', alignItems: 'center', gap: 12,
                      padding: '12px 16px', border: 'none', borderBottom: '1px solid var(--border)',
                      background: selected?.driver_id === d.driver_id ? 'rgba(59,130,246,0.07)' : 'transparent',
                      cursor: 'pointer', textAlign: 'left',
                    }}
                  >
                    <div style={{ width: 36, height: 36, borderRadius: '50%', flexShrink: 0, background: 'rgba(59,130,246,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: 800, color: 'var(--blue)' }}>
                      {d.driver_name?.charAt(0).toUpperCase()}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: '13.5px', fontWeight: 600, color: 'var(--text-h)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.driver_name}</p>
                      <p style={{ fontSize: '11.5px', color: 'var(--text-3)' }}>
                        {d.total_trips} approved trip{d.total_trips !== 1 ? 's' : ''}
                        {d.unrated_trips > 0 && <span style={{ color: '#F59E0B', marginLeft: 6 }}>· {d.unrated_trips} unrated</span>}
                      </p>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <p style={{ fontSize: '14px', fontWeight: 800, color: '#10B981', fontFamily: 'monospace' }}>₱{fmt(d.total_earnings)}</p>
                      <ChevronDown size={13} color="var(--text-3)" style={{ marginLeft: 'auto', transform: selected?.driver_id === d.driver_id ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {selected && (
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)' }}>
                <p style={{ fontSize: '13.5px', fontWeight: 700, color: 'var(--text-h)' }}>{selected.driver_name} — Trip Breakdown</p>
              </div>
              {tripsLoading ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem' }}><LoadingSpinner size="lg" /></div>
              ) : trips.length === 0 ? (
                <EmptyState icon="deliveries" title="No approved trips" message="No approved trips in this period." />
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 480 }}>
                    <thead>
                      <tr>{['Date', 'Outlet', 'Location', 'Driver Rate', 'Helper Rate'].map(h => (
                        <th key={h} className="table-header text-left">{h}</th>
                      ))}</tr>
                    </thead>
                    <tbody>
                      {trips.map(t => (
                        <tr key={t.id}>
                          <td className="table-cell" style={{ fontFamily: 'monospace', fontSize: '12px', whiteSpace: 'nowrap' }}>
                            {format(new Date(t.date), 'dd/MM/yyyy')}
                          </td>
                          <td className="table-cell" style={{ fontWeight: 600, fontSize: '13px' }}>{t.outlet}</td>
                          <td className="table-cell" style={{ fontSize: '12px', color: 'var(--text-3)' }}>
                            {[t.delivery_city, t.delivery_province].filter(Boolean).join(', ') || '—'}
                          </td>
                          <td className="table-cell" style={{ fontFamily: 'monospace', fontWeight: 700, color: '#10B981', whiteSpace: 'nowrap' }}>
                            {t.effective_rate != null ? `₱${fmt(t.effective_rate)}` : <span style={{ color: '#F59E0B', fontSize: '12px' }}>Unrated</span>}
                          </td>
                          <td className="table-cell" style={{ fontFamily: 'monospace', fontSize: '12px', color: 'var(--text-3)' }}>
                            {t.helper_rate != null && t.helper_name ? `₱${fmt(t.helper_rate)}` : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr style={{ background: 'var(--bg-card-alt)' }}>
                        <td colSpan={3} className="table-cell" style={{ fontSize: '12px', fontWeight: 700 }}>Total</td>
                        <td className="table-cell" style={{ fontFamily: 'monospace', fontWeight: 800, color: '#10B981' }}>
                          ₱{fmt(trips.reduce((s, t) => s + parseFloat(t.effective_rate || 0), 0))}
                        </td>
                        <td className="table-cell" />
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

/* ── Driver: My Earnings ─────────────────────────────────────── */
function MyEarnings() {
  const today      = format(new Date(), 'yyyy-MM-dd');
  const monthStart = format(new Date(new Date().getFullYear(), new Date().getMonth(), 1), 'yyyy-MM-dd');

  const [filters, setFilters] = useState({ date_from: monthStart, date_to: today });
  const [approved, setApproved] = useState([]);
  const [pending, setPending] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState('approved');

  const load = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams(Object.fromEntries(Object.entries(filters).filter(([, v]) => v)));
      const res = await api.get(`/salary/my-earnings?${params}`);
      setApproved(res.data.approved || []);
      setPending(res.data.pending || []);
      setTotal(res.data.total || 0);
    } catch { toast.error('Failed to load earnings'); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const TripList = ({ items, emptyMsg }) => items.length === 0 ? (
    <div className="card"><EmptyState icon="earnings" title="No trips" message={emptyMsg} /></div>
  ) : (
    <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
      {items.map((t, i) => (
        <div key={t.id} style={{
          display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px',
          borderBottom: i < items.length - 1 ? '1px solid var(--border)' : 'none',
        }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontSize: '13.5px', fontWeight: 600, color: 'var(--text-h)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {t.outlet}
            </p>
            <p style={{ fontSize: '11.5px', color: 'var(--text-3)' }}>
              {format(new Date(t.date), 'dd/MM/yyyy')}
              {t.delivery_city && ` · ${t.delivery_city}`}
            </p>
            {t.gate_pass_number && (
              <p style={{ fontSize: '11px', color: 'var(--text-3)', fontFamily: 'monospace', marginTop: 2 }}>{t.gate_pass_number}</p>
            )}
          </div>
          <div style={{ textAlign: 'right', flexShrink: 0 }}>
            {t.effective_rate != null ? (
              <>
                <p style={{ fontSize: '15px', fontWeight: 800, color: '#10B981', fontFamily: 'monospace' }}>₱{fmt(t.effective_rate)}</p>
                {t.helper_rate != null && t.helper_name && (
                  <p style={{ fontSize: '10.5px', color: 'var(--text-3)' }}>H: ₱{fmt(t.helper_rate)}</p>
                )}
              </>
            ) : (
              <span style={{ fontSize: '11.5px', color: '#F59E0B', background: 'rgba(245,158,11,0.1)', padding: '2px 8px', borderRadius: 9999, border: '1px solid rgba(245,158,11,0.25)' }}>
                Unrated
              </span>
            )}
          </div>
        </div>
      ))}
    </div>
  );

  return (
    <div className="space-y-4">
      <div style={{
        background: 'linear-gradient(135deg, #F08C2E 0%, #D97C22 100%)',
        borderRadius: 12, padding: '1.25rem', boxShadow: '0 4px 16px rgba(240,140,46,0.3)',
      }}>
        <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.75)', marginBottom: 4 }}>Approved Earnings This Period</p>
        <p style={{ fontSize: '2rem', fontWeight: 900, color: '#fff', fontFamily: 'monospace', lineHeight: 1, marginBottom: 4 }}>
          ₱{fmt(total)}
        </p>
        <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.65)' }}>
          {approved.length} approved · {pending.length} pending review
        </p>
      </div>

      <div className="card">
        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 120 }}>
            <label className="label">From</label>
            <input type="date" className="input-field mono" value={filters.date_from} onChange={e => setFilters(f => ({ ...f, date_from: e.target.value }))} />
          </div>
          <div style={{ flex: 1, minWidth: 120 }}>
            <label className="label">To</label>
            <input type="date" className="input-field mono" value={filters.date_to} onChange={e => setFilters(f => ({ ...f, date_to: e.target.value }))} />
          </div>
          <button onClick={load} disabled={loading} className="btn-primary" style={{ padding: '0 14px', flexShrink: 0 }}>
            {loading ? <LoadingSpinner size="sm" /> : <Calendar size={15} />}
          </button>
        </div>
      </div>

      <div className="tab-strip">
        <button onClick={() => setTab('approved')} className={`tab-item ${tab === 'approved' ? 'tab-item-active' : ''}`}>
          <CheckCircle size={13} /> Approved ({approved.length})
        </button>
        <button onClick={() => setTab('pending')} className={`tab-item ${tab === 'pending' ? 'tab-item-active' : ''}`}>
          <Clock size={13} /> Pending Review ({pending.length})
        </button>
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem 0' }}><LoadingSpinner size="lg" /></div>
      ) : tab === 'approved' ? (
        <TripList items={approved} emptyMsg="No approved earnings yet. Complete deliveries and ask your owner to approve." />
      ) : (
        <TripList items={pending} emptyMsg="No deliveries pending review." />
      )}
    </div>
  );
}

/* ── Main Page ───────────────────────────────────────────────── */
export default function Salary() {
  const { user } = useSelector(s => s.auth);
  const isOwner  = user?.role === 'owner';
  const [tab, setTab] = useState('rates');

  if (!isOwner) return (
    <div className="fade-in">
      <div style={{ marginBottom: '1.25rem' }}>
        <h1 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-h)' }}>My Earnings</h1>
        <p style={{ fontSize: '12px', color: 'var(--text-3)' }}>Track your trip earnings and payment history</p>
      </div>
      <MyEarnings />
    </div>
  );

  return (
    <div className="space-y-5 fade-in">
      <div>
        <h1 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-h)' }}>Salary & Rates</h1>
        <p style={{ fontSize: '12px', color: 'var(--text-3)' }}>Manage trip rates and review driver payroll</p>
      </div>

      <div className="tab-strip">
        {[
          { id: 'rates',   label: 'Rate Settings', icon: MapPin },
          { id: 'approve', label: 'Approve',        icon: CheckCircle },
          { id: 'payroll', label: 'Payroll',         icon: Users },
        ].map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => setTab(id)} className={`tab-item ${tab === id ? 'tab-item-active' : ''}`}>
            <Icon size={14} /> {label}
          </button>
        ))}
      </div>

      {tab === 'rates'   && <RateSettings />}
      {tab === 'approve' && <PendingApprovals />}
      {tab === 'payroll' && <Payroll />}
    </div>
  );
}
