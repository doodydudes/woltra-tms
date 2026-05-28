const STATUS_MAP = {
  /* Delivery */
  delivered:         { label: 'Delivered',   cls: 'pill-delivered' },
  in_transit:        { label: 'In Transit',  cls: 'pill-transit'   },
  pending:           { label: 'Pending',     cls: 'pill-pending'   },
  delayed:           { label: 'Delayed',     cls: 'pill-delayed'   },
  returned:          { label: 'Returned',    cls: 'pill-returned'  },
  cancelled:         { label: 'Cancelled',   cls: 'pill-cancelled' },
  arrived_unloading: { label: 'Unloading',   cls: 'pill-unloading' },
  /* Vehicle */
  available:         { label: 'Available',   cls: 'pill-delivered' },
  in_use:            { label: 'In Use',      cls: 'pill-transit'   },
  maintenance:       { label: 'Maintenance', cls: 'pill-pending'   },
  retired:           { label: 'Retired',     cls: 'pill-cancelled' },
  /* Driver */
  active:            { label: 'Active',      cls: 'pill-delivered' },
  inactive:          { label: 'Inactive',    cls: 'pill-cancelled' },
  on_leave:          { label: 'On Leave',    cls: 'pill-pending'   },
  /* Reports */
  pending_review:    { label: 'Pending',     cls: 'pill-pending'   },
  in_progress:       { label: 'In Progress', cls: 'pill-transit'   },
  work_done:         { label: 'Work Done',   cls: 'pill-unloading' },
  resolved:          { label: 'Resolved',    cls: 'pill-delivered' },
};

export default function StatusPill({ status }) {
  const s = STATUS_MAP[status] || {
    label: status ? status.replace(/_/g, ' ') : '—',
    cls: 'pill-cancelled',
  };

  /* CSS .status-pill::before already renders the dot — no manual span needed */
  return <span className={`status-pill ${s.cls}`}>{s.label}</span>;
}
