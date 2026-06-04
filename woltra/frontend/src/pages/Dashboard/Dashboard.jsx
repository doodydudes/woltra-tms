import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import {
  Package, Truck, Users, Clock, CheckCircle,
  Key, ArrowRight, TrendingUp, TrendingDown,
  ChevronRight, BarChart2, MapPin,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import api from '../../services/api';
import StatusPill from '../../components/common/StatusPill';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import DeliveryWorkflow from '../Deliveries/DeliveryWorkflow';

/* ── Chart bar colors (must be hex for SVG fill) ── */
const BARS = [
  { key: 'Delivered',  color: '#16A34A' },
  { key: 'In Transit', color: '#2563EB' },
  { key: 'Queued',     color: '#F5B800' },
  { key: 'Delayed',    color: '#DC2626' },
];

const STATUS_ACCENT = {
  delivered:         'var(--s-delivered)',
  in_transit:        'var(--s-transit)',
  pending:           'var(--s-pending)',
  delayed:           'var(--s-delayed)',
  returned:          'var(--s-returned)',
  cancelled:         'var(--s-cancelled)',
  arrived_unloading: 'var(--s-unloading)',
};

const STATUS_ACCENT_HEX = {
  delivered:         '#16A34A',
  in_transit:        '#2563EB',
  pending:           '#F5B800',
  delayed:           '#DC2626',
  returned:          '#7C3AED',
  cancelled:         '#6B7280',
  arrived_unloading: '#0891B2',
};

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

/* ── Section header ── */
function Sec({ children, action, onAction }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', marginBottom: 10, gap: 8 }}>
      <span style={{
        fontSize: 10.5, fontWeight: 700, letterSpacing: '0.10em',
        textTransform: 'uppercase', color: 'var(--text-3)', whiteSpace: 'nowrap',
      }}>
        {children}
      </span>
      <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
      {action && (
        <button
          onClick={onAction}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            fontSize: 11.5, fontWeight: 600, color: 'var(--text-3)',
            display: 'flex', alignItems: 'center', gap: 3,
            fontFamily: 'inherit', padding: 0,
            whiteSpace: 'nowrap',
          }}
          onMouseEnter={e => e.currentTarget.style.color = 'var(--primary)'}
          onMouseLeave={e => e.currentTarget.style.color = 'var(--text-3)'}
        >
          {action} <ArrowRight size={11} />
        </button>
      )}
    </div>
  );
}

/* ── KPI tile ── */
function KPICard({ label, value, icon: Icon, color, sub, trend, loading }) {
  return (
    <div style={{
      background: 'var(--bg-card)',
      border: '1px solid var(--border-card)',
      borderTop: `3px solid ${color}`,
      borderRadius: 'var(--r-lg)',
      padding: '14px 16px',
      boxShadow: 'var(--shadow-card)',
      display: 'flex', flexDirection: 'column', gap: 8,
    }}>
      <div style={{
        width: 34, height: 34, borderRadius: 'var(--r-sm)',
        background: `${color}18`,
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        alignSelf: 'flex-start',
      }}>
        <Icon size={15} color={color} strokeWidth={2.2} />
      </div>

      {loading
        ? <div className="skeleton" style={{ height: 36, width: 56, borderRadius: 6 }} />
        : <span style={{
            fontSize: '1.875rem', fontWeight: 800, color: 'var(--text-h)', lineHeight: 1,
            fontFamily: '"Cabinet Grotesk", Satoshi, sans-serif',
            letterSpacing: '-0.03em', fontVariantNumeric: 'tabular-nums',
          }}>
            {value ?? '—'}
          </span>
      }

      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <span style={{
          fontSize: 10.5, fontWeight: 700, letterSpacing: '0.08em',
          textTransform: 'uppercase', color: 'var(--text-3)',
        }}>
          {label}
        </span>
        {trend !== undefined && !loading && (
          <span style={{
            display: 'flex', alignItems: 'center', gap: 2,
            fontSize: 11, fontWeight: 700,
            color: trend >= 0 ? '#16A34A' : '#DC2626',
          }}>
            {trend >= 0 ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
            {Math.abs(trend)}%
          </span>
        )}
        {sub && !loading && (
          <span style={{ fontSize: 11, color: 'var(--text-4)' }}>{sub}</span>
        )}
      </div>
    </div>
  );
}

/* ── Chart tooltip ── */
function ChartTip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: 'var(--bg-card)', border: '1px solid var(--border)',
      borderRadius: 'var(--r-md)', padding: '10px 14px',
      boxShadow: 'var(--shadow-modal)', fontSize: 12.5, minWidth: 130,
    }}>
      <p style={{
        fontWeight: 700, color: 'var(--text-h)', marginBottom: 8,
        fontFamily: '"JetBrains Mono", monospace', fontSize: 11,
      }}>{label}</p>
      {payload.map(p => (
        <div key={p.name} style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          gap: 12, marginBottom: 3,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 8, height: 8, borderRadius: 2, background: p.fill, flexShrink: 0 }} />
            <span style={{ color: 'var(--text-2)', fontSize: 12 }}>{p.name}</span>
          </div>
          <span style={{ fontWeight: 700, color: 'var(--text-h)', fontVariantNumeric: 'tabular-nums' }}>
            {p.value}
          </span>
        </div>
      ))}
    </div>
  );
}


/* ══ Main dashboard ══════════════════════════════ */
export default function Dashboard() {
  const { user } = useSelector(s => s.auth);
  const navigate  = useNavigate();
  const isDriver  = user?.role === 'driver';
  const isOwner   = user?.role === 'owner';

  const [stats,           setStats]          = useState(null);
  const [loading,         setLoading]        = useState(true);
  const [myVehicle,       setMyVehicle]      = useState(undefined);
  const [claimInput,      setClaimInput]     = useState('');
  const [claiming,        setClaiming]       = useState(false);
  const [isMobile,        setIsMobile]       = useState(window.innerWidth < 768);
  const [workflowDelivery, setWorkflowDelivery] = useState(null);

  const ACTIVE_PHASES = ['pending', 'in_transit', 'arrived_unloading'];

  useEffect(() => {
    const fn = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', fn);
    return () => window.removeEventListener('resize', fn);
  }, []);

  useEffect(() => {
    const loadStats = () => {
      api.get('/dashboard/stats')
        .then(r => setStats(r.data))
        .catch(console.error)
        .finally(() => setLoading(false));
    };
    loadStats();
    window.addEventListener('woltra:delivery-updated', loadStats);
    return () => window.removeEventListener('woltra:delivery-updated', loadStats);
  }, []);

  useEffect(() => {
    if (!isDriver) { setMyVehicle(null); return; }
    api.get('/vehicles?limit=1')
      .then(r => setMyVehicle(r.data.data?.[0] || null))
      .catch(() => setMyVehicle(null));
  }, [isDriver]);

  const handleClaim = useCallback(async () => {
    if (!claimInput.trim()) return;
    setClaiming(true);
    try {
      const res = await api.post('/vehicles/claim', { code: claimInput.trim() });
      toast.success(res.data.message || 'Vehicle claimed!');
      setMyVehicle(res.data.vehicle);
      setClaimInput('');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Invalid code');
    } finally { setClaiming(false); }
  }, [claimInput]);

  const weeklyData = stats?.weeklyData?.map(d => ({
    day:          format(new Date(d.delivery_date), 'EEE'),
    Delivered:    parseInt(d.delivered)  || 0,
    'In Transit': parseInt(d.in_transit) || 0,
    Queued:       parseInt(d.pending)    || 0,
    Delayed:      parseInt(d.delayed)    || 0,
  })) || [];

  const ds        = stats?.deliveryStats || {};
  const firstName = user?.name?.split(' ')[0] || 'there';

  const ownerKPIs = [
    { label: 'Total Trips',    value: ds.total,                             icon: Package,     color: '#F5B800' },
    { label: 'In Transit',     value: ds.in_transit,                        icon: Truck,       color: '#2563EB', sub: `${ds.delayed || 0} delayed` },
    { label: 'Delivered',      value: ds.delivered,                         icon: CheckCircle, color: '#16A34A' },
    { label: 'Active Drivers', value: stats?.driverStats?.active_drivers,   icon: Users,       color: '#7C3AED' },
  ];

  const driverKPIs = [
    { label: 'Total Trips', value: ds.total,       icon: Package,     color: '#F5B800' },
    { label: 'Delivered',   value: ds.delivered,   icon: CheckCircle, color: '#16A34A' },
    { label: 'In Transit',  value: ds.in_transit,  icon: Truck,       color: '#2563EB' },
    { label: 'Queued',      value: ds.pending,     icon: Clock,       color: '#D97706' },
  ];

  const kpis = isOwner ? ownerKPIs : driverKPIs;

  return (
    <div className="fade-up" style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>

      {/* ══ Greeting card ══ */}
      <div style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border-card)',
        borderRadius: 'var(--r-xl)',
        padding: isMobile ? '18px 20px' : '20px 28px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16,
        boxShadow: 'var(--shadow-card)',
        overflow: 'hidden', position: 'relative',
      }}>
        {/* Decorative amber glow */}
        <div style={{
          position: 'absolute', right: -60, top: -60,
          width: 200, height: 200, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(245,184,0,0.10) 0%, transparent 65%)',
          pointerEvents: 'none',
        }} />

        <div style={{ position: 'relative', zIndex: 1 }}>
          <p style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 4, fontWeight: 500 }}>
            {greeting()},
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <h1 style={{
              fontSize: isMobile ? '1.4rem' : '1.6rem', fontWeight: 800,
              letterSpacing: '-0.02em',
              fontFamily: '"Cabinet Grotesk", Satoshi, sans-serif',
              color: 'var(--text-h)', margin: 0,
            }}>
              {firstName}
            </h1>
            <span style={{
              fontSize: 10, fontWeight: 700, letterSpacing: '0.10em', textTransform: 'uppercase',
              background: 'rgba(245,184,0,0.12)', border: '1px solid rgba(245,184,0,0.28)',
              color: 'var(--primary)', borderRadius: 'var(--r-pill)', padding: '3px 9px',
            }}>
              {isOwner ? 'Fleet Owner' : 'Driver'}
            </span>
          </div>
          <p style={{
            fontSize: 11.5, color: 'var(--text-4)', marginTop: 5,
            fontFamily: '"JetBrains Mono", monospace', letterSpacing: '0.02em',
          }}>
            {format(new Date(), 'dd/MM/yyyy · EEEE')}
          </p>
        </div>

        {/* Owner desktop quick-stats */}
        {isOwner && !isMobile && (
          <div style={{ display: 'flex', gap: 32, flexShrink: 0, position: 'relative', zIndex: 1 }}>
            {[
              { v: stats?.vehicleStats?.total_vehicles ?? '—', l: 'Vehicles' },
              { v: stats?.driverStats?.active_drivers  ?? '—', l: 'Drivers'  },
              { v: ds.total ?? '—',                            l: 'Trips'    },
            ].map(({ v, l }) => (
              <div key={l} style={{ textAlign: 'right' }}>
                <p style={{
                  fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-h)',
                  lineHeight: 1, fontVariantNumeric: 'tabular-nums',
                  fontFamily: '"Cabinet Grotesk", Satoshi, sans-serif', letterSpacing: '-0.03em',
                }}>
                  {loading
                    ? <span className="skeleton" style={{ display: 'inline-block', width: 32, height: 28, borderRadius: 4 }} />
                    : v}
                </p>
                <p style={{
                  fontSize: 10.5, fontWeight: 700, letterSpacing: '0.10em',
                  textTransform: 'uppercase', color: 'var(--text-3)', marginTop: 4,
                }}>{l}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ══ Driver vehicle section ══ */}
      {isDriver && myVehicle === undefined && (
        <div className="card" style={{ display: 'flex', justifyContent: 'center', padding: '1.5rem' }}>
          <LoadingSpinner />
        </div>
      )}

      {isDriver && myVehicle === null && (
        <div style={{
          background: 'var(--bg-card)', border: '1px solid var(--border-card)',
          borderRadius: 'var(--r-lg)', padding: '16px 18px', boxShadow: 'var(--shadow-card)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
            <div style={{
              width: 38, height: 38, borderRadius: 'var(--r-sm)', flexShrink: 0,
              background: 'rgba(245,184,0,0.12)', border: '1px solid rgba(245,184,0,0.22)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Key size={18} color="var(--primary)" strokeWidth={2} />
            </div>
            <div>
              <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-h)', margin: 0 }}>Claim Your Vehicle</p>
              <p style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2 }}>
                Enter the code your fleet owner gave you
              </p>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              type="text" className="input-field"
              style={{
                flex: 1, textAlign: 'center', textTransform: 'uppercase',
                letterSpacing: '0.14em', fontFamily: '"JetBrains Mono", monospace',
                fontWeight: 700, fontSize: 15,
              }}
              placeholder="FLEET-CODE" maxLength={14}
              value={claimInput}
              onChange={e => setClaimInput(e.target.value.toUpperCase())}
              onKeyDown={e => e.key === 'Enter' && handleClaim()}
            />
            <button
              onClick={handleClaim} disabled={claiming || !claimInput.trim()}
              className="btn-primary" style={{ flexShrink: 0, paddingInline: 22 }}
            >
              {claiming
                ? <div style={{ width: 14, height: 14, border: '2px solid rgba(0,0,0,0.3)', borderTopColor: '#000', borderRadius: '50%', animation: 'spin 0.65s linear infinite' }} />
                : 'Claim'}
            </button>
          </div>
        </div>
      )}

      {isDriver && myVehicle && (
        <div className="vehicle-chip">
          <div className="vehicle-chip-icon">
            <Truck size={18} strokeWidth={2} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{
              fontSize: 10.5, fontWeight: 700, letterSpacing: '0.10em',
              textTransform: 'uppercase', color: 'var(--text-3)', marginBottom: 3,
            }}>
              Assigned Vehicle
            </p>
            <p style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-h)', margin: 0 }}>
              {[myVehicle.make, myVehicle.model].filter(Boolean).join(' ') || myVehicle.truck_id}
            </p>
            <p style={{
              fontSize: 11.5, color: 'var(--text-3)', marginTop: 2,
              fontFamily: '"JetBrains Mono", monospace', letterSpacing: '0.06em',
            }}>
              {myVehicle.truck_id} · {myVehicle.plate_number}
            </p>
          </div>
          <StatusPill status={myVehicle.status} />
        </div>
      )}

      {/* ══ KPI grid ══ */}
      <div>
        <Sec>Overview</Sec>
        <div style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr 1fr' : `repeat(${kpis.length}, 1fr)`,
          gap: isMobile ? 10 : 12,
        }}>
          {kpis.map(k => <KPICard key={k.label} {...k} loading={loading} />)}
        </div>
      </div>

      {/* ══ Fleet status mobile (owner) ══ */}
      {isOwner && isMobile && (
        <div>
          <Sec action="Fleet" onAction={() => navigate('/vehicles')}>Fleet Status</Sec>
          <div style={{
            display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8,
          }}>
            {[
              { label: 'Available',   value: stats?.vehicleStats?.available_vehicles,  color: '#16A34A' },
              { label: 'In Use',      value: stats?.vehicleStats?.in_use_vehicles,      color: '#2563EB' },
              { label: 'Maintenance', value: stats?.vehicleStats?.maintenance_vehicles, color: '#D97706' },
            ].map(({ label, value, color }) => (
              <div key={label} style={{
                background: 'var(--bg-card)', border: '1px solid var(--border-card)',
                borderRadius: 'var(--r-md)', padding: '12px 12px 10px',
                boxShadow: 'var(--shadow-card)',
                borderTop: `3px solid ${color}`,
              }}>
                <p style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-3)', marginBottom: 6 }}>
                  {label}
                </p>
                <p style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-h)', lineHeight: 1, fontVariantNumeric: 'tabular-nums', fontFamily: '"Cabinet Grotesk", Satoshi, sans-serif' }}>
                  {loading ? '—' : (value || 0)}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ══ Chart + fleet (side-by-side on owner desktop) ══ */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: isOwner && !isMobile ? '1fr 260px' : '1fr',
        gap: 16, alignItems: 'start',
      }}>

        {/* Weekly deliveries chart */}
        <div>
          <Sec>Weekly Deliveries</Sec>
          <div style={{
            background: 'var(--bg-card)', border: '1px solid var(--border-card)',
            borderRadius: 'var(--r-lg)', padding: '16px 12px 10px',
            boxShadow: 'var(--shadow-card)',
          }}>
            {loading ? (
              <div style={{ height: 180, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <LoadingSpinner size="lg" />
              </div>
            ) : weeklyData.length === 0 ? (
              <div style={{ height: 140, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                <BarChart2 size={28} color="var(--text-4)" strokeWidth={1.5} />
                <p style={{ fontSize: 12.5, color: 'var(--text-3)' }}>No data this week</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={isMobile ? 150 : 200}>
                <BarChart data={weeklyData} barCategoryGap="38%" barGap={2}>
                  <CartesianGrid strokeDasharray="2 4" stroke="var(--border)" vertical={false} />
                  <XAxis
                    dataKey="day"
                    tick={{ fontSize: 11, fill: 'var(--text-3)', fontFamily: 'monospace' }}
                    axisLine={false} tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: 'var(--text-3)', fontFamily: 'monospace' }}
                    axisLine={false} tickLine={false} allowDecimals={false} width={20}
                  />
                  <Tooltip content={<ChartTip />} cursor={{ fill: 'rgba(245,184,0,0.05)' }} />
                  {BARS.map(({ key, color }, i) => (
                    <Bar
                      key={key} dataKey={key} stackId="a" fill={color}
                      radius={i === BARS.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]}
                      maxBarSize={32}
                    />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            )}
            {/* Legend */}
            <div style={{
              display: 'flex', gap: 12, justifyContent: 'center',
              paddingTop: 10, flexWrap: 'wrap',
            }}>
              {BARS.map(({ key, color }) => (
                <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <span style={{ width: 8, height: 8, borderRadius: 2, background: color, flexShrink: 0 }} />
                  <span style={{ fontSize: 11, color: 'var(--text-3)' }}>{key}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Fleet status — owner desktop only */}
        {isOwner && !isMobile && (
          <div>
            <Sec action="Fleet" onAction={() => navigate('/vehicles')}>Fleet Status</Sec>
            <div style={{
              background: 'var(--bg-card)', border: '1px solid var(--border-card)',
              borderRadius: 'var(--r-lg)', padding: '16px 18px',
              boxShadow: 'var(--shadow-card)',
              display: 'flex', flexDirection: 'column', gap: 18,
            }}>
              {loading ? (
                <div style={{ height: 120, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <LoadingSpinner />
                </div>
              ) : (
                [
                  { label: 'Available',   value: stats?.vehicleStats?.available_vehicles,  color: '#16A34A' },
                  { label: 'In Use',      value: stats?.vehicleStats?.in_use_vehicles,      color: '#2563EB' },
                  { label: 'Maintenance', value: stats?.vehicleStats?.maintenance_vehicles, color: '#D97706' },
                ].map(({ label, value, color }) => {
                  const total = stats?.vehicleStats?.total_vehicles || 1;
                  const pct   = Math.round(((value || 0) / total) * 100);
                  return (
                    <div key={label}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 7 }}>
                        <span style={{ fontSize: 12.5, color: 'var(--text-2)', fontWeight: 500 }}>{label}</span>
                        <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-h)', fontVariantNumeric: 'tabular-nums' }}>
                          {value || 0}
                        </span>
                      </div>
                      <div style={{ background: 'var(--bg-card-alt)', borderRadius: 'var(--r-pill)', height: 5, overflow: 'hidden' }}>
                        <div style={{
                          width: `${pct}%`, background: color, height: '100%',
                          borderRadius: 'var(--r-pill)',
                          transition: 'width 0.6s var(--ease-out)',
                          minWidth: pct > 0 ? 6 : 0,
                        }} />
                      </div>
                    </div>
                  );
                })
              )}
              <div style={{
                paddingTop: 14, borderTop: '1px solid var(--border)',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              }}>
                <span style={{
                  fontSize: 10.5, fontWeight: 700, letterSpacing: '0.10em',
                  textTransform: 'uppercase', color: 'var(--text-3)',
                }}>
                  Total Fleet
                </span>
                <span style={{
                  fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-h)', lineHeight: 1,
                  fontVariantNumeric: 'tabular-nums',
                  fontFamily: '"Cabinet Grotesk", Satoshi, sans-serif', letterSpacing: '-0.03em',
                }}>
                  {loading ? '—' : (stats?.vehicleStats?.total_vehicles || 0)}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ══ Recent Activity ══ */}
      <div>
        <Sec>Recent Activity</Sec>
        <div style={{
          background: 'var(--bg-card)', border: '1px solid var(--border-card)',
          borderRadius: 'var(--r-lg)', overflow: 'hidden',
          boxShadow: 'var(--shadow-card)',
        }}>
          {loading ? (
            <div style={{ padding: '2.5rem', display: 'flex', justifyContent: 'center' }}>
              <LoadingSpinner size="lg" />
            </div>
          ) : stats?.recentActivity?.length ? (
            stats.recentActivity.slice(0, isMobile ? 5 : 8).map((item, i, arr) => (
              <div
                key={item.id}
                onClick={async () => {
                  if (isDriver && ACTIVE_PHASES.includes(item.status)) {
                    try {
                      const res = await api.get(`/deliveries/${item.id}`);
                      setWorkflowDelivery(res.data.delivery);
                    } catch { navigate(`/deliveries/${item.id}`); }
                  } else {
                    navigate(`/deliveries/${item.id}`);
                  }
                }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '11px 16px',
                  borderBottom: i < arr.length - 1 ? '1px solid var(--border)' : 'none',
                  cursor: 'pointer', transition: 'background var(--dur-fast)',
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(245,184,0,0.03)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                {/* Status dot */}
                <div style={{
                  width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
                  background: STATUS_ACCENT_HEX[item.status] || '#6B7280',
                }} />

                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{
                    fontSize: 13.5, fontWeight: 600, color: 'var(--text-h)',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', margin: 0,
                  }}>
                    {item.outlet}
                  </p>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 2, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 11.5, color: 'var(--text-3)' }}>
                      {item.driver_name || 'Unassigned'}
                    </span>
                    {item.gate_pass_number && (
                      <span className="code-chip" style={{ fontSize: 10, padding: '1px 5px' }}>
                        {item.gate_pass_number}
                      </span>
                    )}
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                  <StatusPill status={item.status} />
                  <ChevronRight size={13} color="var(--text-4)" />
                </div>
              </div>
            ))
          ) : (
            <div className="empty-state">
              <div className="empty-icon">
                <Package size={24} color="var(--primary)" />
              </div>
              <p style={{ fontWeight: 700, color: 'var(--text-h)', fontSize: 15 }}>No recent activity</p>
              <p style={{ fontSize: 13, color: 'var(--text-3)' }}>
                Deliveries will appear here once created.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* ══ Top Drivers — owner only ══ */}
      {isOwner && (
        <div>
          <Sec action="All Drivers" onAction={() => navigate('/drivers')}>Top Drivers</Sec>
          <div style={{
            background: 'var(--bg-card)', border: '1px solid var(--border-card)',
            borderRadius: 'var(--r-lg)', overflow: 'hidden',
            boxShadow: 'var(--shadow-card)',
          }}>
            {loading ? (
              <div style={{ padding: '2rem', display: 'flex', justifyContent: 'center' }}>
                <LoadingSpinner />
              </div>
            ) : stats?.topDrivers?.length ? (
              stats.topDrivers.map((driver, idx, arr) => (
                <div
                  key={driver.id}
                  onClick={() => navigate(`/drivers/${driver.id}`)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: '11px 16px',
                    borderBottom: idx < arr.length - 1 ? '1px solid var(--border)' : 'none',
                    cursor: 'pointer', transition: 'background var(--dur-fast)',
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(245,184,0,0.03)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <div style={{
                    width: 22, height: 22, borderRadius: 'var(--r-xs)', flexShrink: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 11, fontWeight: 800, fontVariantNumeric: 'tabular-nums',
                    background: idx === 0 ? 'rgba(245,184,0,0.15)' : 'var(--bg-card-alt)',
                    color: idx === 0 ? 'var(--primary)' : 'var(--text-3)',
                    border: `1px solid ${idx === 0 ? 'rgba(245,184,0,0.3)' : 'var(--border)'}`,
                  }}>
                    {idx + 1}
                  </div>

                  <div style={{
                    width: 32, height: 32, borderRadius: 'var(--r-pill)', flexShrink: 0,
                    background: `hsl(${(driver.name?.charCodeAt(0) || 65) * 7 % 360}, 55%, 50%)`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 12, fontWeight: 700, color: '#fff',
                  }}>
                    {(driver.name || 'D').charAt(0).toUpperCase()}
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{
                      fontSize: 13.5, fontWeight: 600, color: 'var(--text-h)', margin: 0,
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {driver.name}
                    </p>
                    <p style={{
                      fontSize: 10.5, color: 'var(--text-4)',
                      fontFamily: '"JetBrains Mono", monospace', marginTop: 2, letterSpacing: '0.04em',
                    }}>
                      {driver.employee_id}
                    </p>
                  </div>

                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <p style={{
                      fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-h)', margin: 0,
                      fontVariantNumeric: 'tabular-nums', lineHeight: 1,
                      fontFamily: '"Cabinet Grotesk", Satoshi, sans-serif',
                    }}>
                      {driver.total_deliveries}
                    </p>
                    <p style={{ fontSize: 11, color: '#16A34A', marginTop: 2, fontWeight: 600 }}>
                      {driver.completed} done
                    </p>
                  </div>
                </div>
              ))
            ) : (
              <div className="empty-state">
                <div className="empty-icon"><Users size={24} color="var(--primary)" /></div>
                <p style={{ fontWeight: 700, color: 'var(--text-h)', fontSize: 15 }}>No driver data yet</p>
                <p style={{ fontSize: 13, color: 'var(--text-3)' }}>
                  Stats appear after deliveries are completed.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {workflowDelivery && (
        <DeliveryWorkflow
          delivery={workflowDelivery}
          onClose={() => setWorkflowDelivery(null)}
          onSuccess={() => {
            setWorkflowDelivery(null);
            api.get('/dashboard/stats').then(r => setStats(r.data)).catch(() => {});
          }}
        />
      )}

    </div>
  );
}
