import { Package, Truck, Users, FileText, DollarSign, Bell, Wrench, AlertTriangle, BarChart3 } from 'lucide-react';

const ICON_MAP = {
  deliveries:    Package,
  trucks:        Truck,
  drivers:       Users,
  vehicles:      Truck,
  reports:       AlertTriangle,
  earnings:      DollarSign,
  salary:        BarChart3,
  notifications: Bell,
  alert:         AlertTriangle,
  default:       FileText,
};

export default function EmptyState({ icon = 'default', title, message, action, actionLabel, onAction }) {
  const Icon = ICON_MAP[icon] || ICON_MAP.default;
  const handler = onAction || action;
  return (
    <div className="empty-state">
      <div className="empty-icon">
        <Icon size={22} color="var(--primary)" strokeWidth={1.8} />
      </div>
      <div>
        <p style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-h)', marginBottom: 4 }}>
          {title}
        </p>
        {message && (
          <p style={{ fontSize: '12.5px', color: 'var(--text-3)', maxWidth: 280, margin: '0 auto', lineHeight: 1.55 }}>
            {message}
          </p>
        )}
      </div>
      {handler && actionLabel && (
        <button onClick={handler} className="btn-primary" style={{ marginTop: 4, height: 34 }}>
          {actionLabel}
        </button>
      )}
    </div>
  );
}
