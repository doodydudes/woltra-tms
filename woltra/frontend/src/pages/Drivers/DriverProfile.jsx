import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Phone, Mail, MapPin, Calendar, Truck } from 'lucide-react';
import { format } from 'date-fns';
import api from '../../services/api';
import StatusPill from '../../components/common/StatusPill';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';

const BAR_COLORS = {
  Total: '#3B82F6', Delivered: '#10B981', Delayed: '#F59E0B', Returned: '#EF4444',
};

export default function DriverProfile({ driverId: propId, compact = false }) {
  const params   = useParams();
  const id       = propId ?? params.id;
  const navigate = useNavigate();
  const [data, setData]     = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get(`/drivers/${id}`)
      .then(r => setData(r.data))
      .catch(() => { if (!compact) navigate('/drivers'); })
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 240 }}>
      <LoadingSpinner size="lg" />
    </div>
  );
  if (!data) return null;

  const { driver, deliveries, stats } = data;

  const chartData = [
    { name: 'Total',     value: stats?.total     || 0, fill: '#3B82F6' },
    { name: 'Delivered', value: stats?.delivered || 0, fill: '#10B981' },
    { name: 'Delayed',   value: stats?.delayed   || 0, fill: '#F59E0B' },
    { name: 'Returned',  value: stats?.returned  || 0, fill: '#EF4444' },
  ];

  const kpis = [
    { label: 'Total',     value: stats?.total     || 0, color: '#3B82F6' },
    { label: 'Delivered', value: stats?.delivered || 0, color: '#10B981' },
    { label: 'Delayed',   value: stats?.delayed   || 0, color: '#F59E0B' },
    { label: 'Returned',  value: stats?.returned  || 0, color: '#EF4444' },
  ];

  const infoItems = [
    { icon: Phone,    value: driver.phone          || '—' },
    { icon: Mail,     value: driver.email          || '—' },
    { icon: MapPin,   value: driver.address        || '—' },
    { icon: Calendar, value: driver.hire_date ? `Hired ${format(new Date(driver.hire_date), 'dd/MM/yyyy')}` : '—' },
    { icon: Truck,    value: driver.license_number ? `License: ${driver.license_number}` : '—' },
  ];

  return (
    <div className="fade-in" style={compact ? { display: 'flex', flexDirection: 'column', gap: 14 } : { maxWidth: 860, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        {!compact && (
          <button
            onClick={() => navigate('/drivers')}
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, width: 36, height: 36, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--text-2)', transition: 'all 0.15s' }}
          >
            <ArrowLeft size={16} />
          </button>
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <h1 style={{ fontSize: compact ? '15px' : '1.15rem', fontWeight: 800, color: 'var(--text-h)' }}>{driver.name}</h1>
          <p style={{ fontSize: '11px', color: 'var(--text-3)', fontFamily: '"JetBrains Mono", monospace', marginTop: 1 }}>{driver.employee_id}</p>
        </div>
        <StatusPill status={driver.status} />
      </div>

      {/* Driver info card */}
      <div className="card" style={{ padding: '16px', borderLeft: '3px solid var(--blue)' }}>
        {/* Avatar + name */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, paddingBottom: 14, borderBottom: '1px solid var(--border)', marginBottom: 14 }}>
          <div style={{
            width: 52, height: 52, borderRadius: '50%',
            background: 'rgba(59,130,246,0.12)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '1.3rem', fontWeight: 800, color: 'var(--blue)', flexShrink: 0,
          }}>
            {driver.name?.charAt(0).toUpperCase()}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-h)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{driver.name}</p>
            <p style={{ fontSize: '11px', color: 'var(--text-3)', fontFamily: '"JetBrains Mono", monospace', marginTop: 2 }}>{driver.employee_id}</p>
          </div>
        </div>
        {/* Info items */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {infoItems.map(({ icon: Icon, value }, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Icon size={13} color="var(--text-3)" style={{ flexShrink: 0 }} />
              <span style={{ fontSize: '12.5px', color: 'var(--text-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* KPI row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
        {kpis.map(({ label, value, color }) => (
          <div key={label} style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderTop: `3px solid ${color}`, borderRadius: 8, padding: '10px 12px', textAlign: 'center' }}>
            <p style={{ fontSize: '1.3rem', fontWeight: 800, color, fontFamily: '"JetBrains Mono", monospace', lineHeight: 1, marginBottom: 4 }}>{value}</p>
            <p style={{ fontSize: '9.5px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-3)' }}>{label}</p>
          </div>
        ))}
      </div>

      {/* Performance chart */}
      <div className="card">
        <p style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-3)', marginBottom: 12 }}>
          Performance Overview
        </p>
        <ResponsiveContainer width="100%" height={140}>
          <BarChart data={chartData} barCategoryGap="30%" barGap={2}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
            <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'var(--text-3)' }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 11, fill: 'var(--text-3)', fontFamily: '"JetBrains Mono", monospace' }} axisLine={false} tickLine={false} allowDecimals={false} width={22} />
            <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-card)', boxShadow: 'var(--shadow-modal)', fontSize: 12 }} />
            <Bar dataKey="value" radius={[4, 4, 0, 0]} maxBarSize={36}>
              {chartData.map((entry, i) => (
                <rect key={i} fill={entry.fill} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Recent deliveries */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)' }}>
          <p style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-3)' }}>
            Recent Deliveries
          </p>
        </div>
        {deliveries?.length ? (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 420 }}>
              <thead>
                <tr style={{ background: 'var(--bg-card-alt)' }}>
                  {['Date', 'Gate Pass', 'Outlet', 'Boxes', 'Status'].map(h => (
                    <th key={h} className="table-header" style={{ textAlign: 'left' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {deliveries.map(d => (
                  <tr key={d.id} style={{ borderBottom: '1px solid var(--border)', transition: 'background 0.1s' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-card-alt)'}
                    onMouseLeave={e => e.currentTarget.style.background = ''}
                  >
                    <td className="table-cell" style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: '11.5px', whiteSpace: 'nowrap' }}>
                      {format(new Date(d.date), 'dd/MM/yyyy')}
                    </td>
                    <td className="table-cell" style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: '11.5px' }}>
                      {d.gate_pass_number || `#${d.id}`}
                    </td>
                    <td className="table-cell" style={{ fontWeight: 600, fontSize: '13px' }}>{d.outlet}</td>
                    <td className="table-cell" style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: '13px' }}>{d.number_of_boxes}</td>
                    <td className="table-cell"><StatusPill status={d.status} size="sm" /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div style={{ padding: '1.5rem', textAlign: 'center' }}>
            <p style={{ fontSize: '13px', color: 'var(--text-3)' }}>No deliveries yet</p>
          </div>
        )}
      </div>
    </div>
  );
}
