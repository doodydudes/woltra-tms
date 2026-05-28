/* Badge — inline status label using design-system CSS tokens */
const STATUS_MAP = {
  /* Delivery */
  delivered:         { color: 'var(--s-delivered)', bg: 'var(--s-delivered-bg)', border: 'var(--s-delivered-border)', label: 'Delivered'    },
  in_transit:        { color: 'var(--s-transit)',   bg: 'var(--s-transit-bg)',   border: 'var(--s-transit-border)',   label: 'In Transit'   },
  pending:           { color: 'var(--s-pending)',   bg: 'var(--s-pending-bg)',   border: 'var(--s-pending-border)',   label: 'Pending'      },
  delayed:           { color: 'var(--s-delayed)',   bg: 'var(--s-delayed-bg)',   border: 'var(--s-delayed-border)',   label: 'Delayed'      },
  returned:          { color: 'var(--s-returned)',  bg: 'var(--s-returned-bg)',  border: 'var(--s-returned-border)',  label: 'Returned'     },
  cancelled:         { color: 'var(--s-cancelled)', bg: 'var(--s-cancelled-bg)', border: 'var(--s-cancelled-border)', label: 'Cancelled'   },
  arrived_unloading: { color: 'var(--s-unloading)', bg: 'var(--s-unloading-bg)', border: 'var(--s-unloading-border)', label: 'Unloading'  },
  /* Vehicle */
  available:         { color: 'var(--s-delivered)', bg: 'var(--s-delivered-bg)', border: 'var(--s-delivered-border)', label: 'Available'   },
  in_use:            { color: 'var(--s-transit)',   bg: 'var(--s-transit-bg)',   border: 'var(--s-transit-border)',   label: 'In Use'      },
  maintenance:       { color: 'var(--s-pending)',   bg: 'var(--s-pending-bg)',   border: 'var(--s-pending-border)',   label: 'Maintenance' },
  retired:           { color: 'var(--s-cancelled)', bg: 'var(--s-cancelled-bg)', border: 'var(--s-cancelled-border)', label: 'Retired'    },
  /* Driver */
  active:            { color: 'var(--s-delivered)', bg: 'var(--s-delivered-bg)', border: 'var(--s-delivered-border)', label: 'Active'     },
  inactive:          { color: 'var(--s-cancelled)', bg: 'var(--s-cancelled-bg)', border: 'var(--s-cancelled-border)', label: 'Inactive'   },
  on_leave:          { color: 'var(--s-pending)',   bg: 'var(--s-pending-bg)',   border: 'var(--s-pending-border)',   label: 'On Leave'    },
  /* Reports */
  pending_review:    { color: 'var(--s-pending)',   bg: 'var(--s-pending-bg)',   border: 'var(--s-pending-border)',   label: 'Pending'     },
  in_progress:       { color: 'var(--s-transit)',   bg: 'var(--s-transit-bg)',   border: 'var(--s-transit-border)',   label: 'In Progress' },
  work_done:         { color: 'var(--s-unloading)', bg: 'var(--s-unloading-bg)', border: 'var(--s-unloading-border)', label: 'Work Done'  },
  resolved:          { color: 'var(--s-delivered)', bg: 'var(--s-delivered-bg)', border: 'var(--s-delivered-border)', label: 'Resolved'   },
  /* Notification severity */
  info:              { color: 'var(--s-transit)',   bg: 'var(--s-transit-bg)',   border: 'var(--s-transit-border)',   label: 'Info'        },
  warning:           { color: 'var(--s-pending)',   bg: 'var(--s-pending-bg)',   border: 'var(--s-pending-border)',   label: 'Warning'     },
  error:             { color: 'var(--s-delayed)',   bg: 'var(--s-delayed-bg)',   border: 'var(--s-delayed-border)',   label: 'Error'       },
  success:           { color: 'var(--s-delivered)', bg: 'var(--s-delivered-bg)', border: 'var(--s-delivered-border)', label: 'Success'    },
  delivery:          { color: 'var(--s-transit)',   bg: 'var(--s-transit-bg)',   border: 'var(--s-transit-border)',   label: 'Delivery'    },
};

const FALLBACK = {
  color: 'var(--s-cancelled)',
  bg: 'var(--s-cancelled-bg)',
  border: 'var(--s-cancelled-border)',
};

export default function Badge({ status, label, dot = false, className = '' }) {
  const s = STATUS_MAP[status] || {
    ...FALLBACK,
    label: label || (status ? status.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) : '—'),
  };
  const text = label || s.label;

  if (dot) {
    return (
      <span style={{
        display: 'inline-flex', alignItems: 'center', gap: 6,
        fontSize: 12.5, color: 'var(--text-2)', fontWeight: 500,
      }}>
        <span style={{ width: 7, height: 7, borderRadius: '50%', background: s.color, flexShrink: 0 }} />
        {text}
      </span>
    );
  }

  return (
    <span
      className={className}
      style={{
        display: 'inline-flex', alignItems: 'center',
        padding: '3px 10px', borderRadius: 'var(--r-pill)',
        fontSize: 11, fontWeight: 700, letterSpacing: '0.04em',
        whiteSpace: 'nowrap', textTransform: 'uppercase',
        color: s.color, background: s.bg, border: `1px solid ${s.border}`,
      }}
    >
      {text}
    </span>
  );
}
