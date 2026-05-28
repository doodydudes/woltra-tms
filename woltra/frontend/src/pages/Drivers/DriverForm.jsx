import { useForm } from 'react-hook-form';
import { useState } from 'react';
import { Search, User, Mail, Phone, FileText, CheckCircle2, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../services/api';
import Modal from '../../components/common/Modal';

// ── Edit existing driver ──────────────────────────────────────────────────────
function EditDriverForm({ driver, onClose, onSuccess }) {
  const [submitting, setSubmitting] = useState(false);
  const { register, handleSubmit, formState: { errors } } = useForm({
    defaultValues: {
      name: driver.name || '',
      license_number: driver.license_number || '',
      license_expiry: driver.license_expiry?.slice(0, 10) || '',
      phone: driver.phone || '',
      email: driver.email || '',
      address: driver.address || '',
      hire_date: driver.hire_date?.slice(0, 10) || '',
      status: driver.status || 'active',
      emergency_contact: driver.emergency_contact || '',
      emergency_phone: driver.emergency_phone || '',
      notes: driver.notes || '',
    },
  });

  const onSubmit = async (data) => {
    setSubmitting(true);
    try {
      await api.put(`/drivers/${driver.id}`, data);
      toast.success('Driver updated');
      onSuccess();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to update driver');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal open onClose={onClose} title="Edit Driver" size="lg"
      footer={
        <div className="flex justify-end gap-3">
          <button onClick={onClose} className="btn-secondary" disabled={submitting}>Cancel</button>
          <button form="driver-edit-form" type="submit" className="btn-primary" disabled={submitting}>
            {submitting ? 'Saving...' : 'Update Driver'}
          </button>
        </div>
      }
    >
      <form id="driver-edit-form" onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="label">Full Name <span className="text-red-500">*</span></label>
            <input type="text" className="input-field" {...register('name', { required: 'Required' })} />
            {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name.message}</p>}
          </div>
          <div>
            <label className="label">Phone</label>
            <input type="text" className="input-field" {...register('phone')} />
          </div>
          <div>
            <label className="label">License Number</label>
            <input type="text" className="input-field" {...register('license_number')} />
          </div>
          <div>
            <label className="label">License Expiry</label>
            <input type="date" className="input-field" {...register('license_expiry')} />
          </div>
          <div>
            <label className="label">Hire Date</label>
            <input type="date" className="input-field" {...register('hire_date')} />
          </div>
          <div>
            <label className="label">Status</label>
            <select className="input-field" {...register('status')}>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="on_leave">On Leave</option>
            </select>
          </div>
        </div>
        <div>
          <label className="label">Address</label>
          <textarea rows={2} className="input-field resize-none" {...register('address')} />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="label">Emergency Contact</label>
            <input type="text" className="input-field" {...register('emergency_contact')} />
          </div>
          <div>
            <label className="label">Emergency Phone</label>
            <input type="text" className="input-field" {...register('emergency_phone')} />
          </div>
        </div>
        <div>
          <label className="label">Notes</label>
          <textarea rows={2} className="input-field resize-none" {...register('notes')} />
        </div>
      </form>
    </Modal>
  );
}

// ── Add driver by account code ─────────────────────────────────────────────────
function AddDriverForm({ onClose, onSuccess }) {
  const [code, setCode] = useState('');
  const [looking, setLooking] = useState(false);
  const [preview, setPreview] = useState(null); // { user, driver }
  const [lookupError, setLookupError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const { register, handleSubmit, formState: { errors } } = useForm();

  const handleLookup = async () => {
    if (!code.trim()) return;
    setLooking(true);
    setLookupError('');
    setPreview(null);
    try {
      const res = await api.get(`/drivers/lookup?code=${encodeURIComponent(code.trim().toUpperCase())}`);
      setPreview(res.data);
    } catch (err) {
      setLookupError(err.response?.data?.error || 'Driver not found');
    } finally {
      setLooking(false);
    }
  };

  const onSubmit = async (data) => {
    setSubmitting(true);
    try {
      await api.post('/drivers', { driver_code: code.trim().toUpperCase(), ...data });
      toast.success('Driver added to fleet');
      onSuccess();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to add driver');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal open onClose={onClose} title="Add Driver by Code" size="md"
      footer={
        preview ? (
          <div className="flex justify-end gap-3">
            <button onClick={onClose} className="btn-secondary" disabled={submitting}>Cancel</button>
            <button form="add-driver-form" type="submit" className="btn-primary" disabled={submitting}>
              {submitting ? 'Adding...' : 'Add to Fleet'}
            </button>
          </div>
        ) : (
          <div className="flex justify-end gap-3">
            <button onClick={onClose} className="btn-secondary">Cancel</button>
            <button type="button" onClick={handleLookup} className="btn-primary" disabled={looking || !code.trim()}>
              {looking ? 'Looking up...' : 'Look Up Driver'}
            </button>
          </div>
        )
      }
    >
      <div className="space-y-5">

        {/* Step 1: Code input */}
        <div>
          <label className="label">Driver Account Code</label>
          <p style={{ fontSize: '12px', color: 'var(--text-3)', marginBottom: 8 }}>
            Ask the driver to share their account code from their dashboard or profile.
          </p>
          <div style={{ display: 'flex', gap: 8 }}>
            <div style={{ position: 'relative', flex: 1 }}>
              <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-3)', pointerEvents: 'none' }} />
              <input
                type="text"
                className="input-field"
                placeholder="e.g. A3X9K2M2"
                value={code}
                onChange={e => { setCode(e.target.value.toUpperCase()); setPreview(null); setLookupError(''); }}
                onKeyDown={e => e.key === 'Enter' && handleLookup()}
                style={{ paddingLeft: 32, fontFamily: 'monospace', letterSpacing: '0.1em', textTransform: 'uppercase' }}
                maxLength={12}
              />
            </div>
          </div>

          {lookupError && (
            <div style={{
              marginTop: 10, padding: '9px 12px',
              background: 'rgba(208,69,69,0.08)', border: '1px solid rgba(208,69,69,0.2)',
              borderRadius: 7, display: 'flex', alignItems: 'center', gap: 8,
              fontSize: '12.5px', color: 'var(--red)',
            }}>
              <AlertCircle size={14} />
              {lookupError}
            </div>
          )}
        </div>

        {/* Step 2: Preview + confirm */}
        {preview && (
          <>
            <div style={{
              background: 'rgba(29,158,117,0.06)', border: '1px solid rgba(29,158,117,0.2)',
              borderRadius: 10, padding: '1rem',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: '0.875rem' }}>
                <CheckCircle2 size={18} color="#1D9E75" />
                <p style={{ fontSize: '13px', fontWeight: 700, color: '#1D9E75' }}>Driver account found</p>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {[
                  { icon: User, label: 'Name', value: preview.user.name },
                  { icon: Mail, label: 'Email', value: preview.user.email },
                  { icon: Phone, label: 'Phone', value: preview.user.phone || '—' },
                  { icon: FileText, label: 'License', value: preview.driver?.license_number || '—' },
                ].map(({ icon: Icon, label, value }) => (
                  <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '13px' }}>
                    <Icon size={13} color="var(--text-3)" style={{ flexShrink: 0 }} />
                    <span style={{ color: 'var(--text-3)', minWidth: 52 }}>{label}</span>
                    <span style={{ color: 'var(--text)', fontWeight: 500 }}>{value}</span>
                  </div>
                ))}
              </div>
            </div>

            <form id="add-driver-form" onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="label">Employee ID <span className="text-red-500">*</span></label>
                  <input type="text" className="input-field" placeholder="DRV001"
                    {...register('employee_id', { required: 'Employee ID is required' })} />
                  {errors.employee_id && <p className="text-xs text-red-500 mt-1">{errors.employee_id.message}</p>}
                </div>
                <div>
                  <label className="label">Hire Date</label>
                  <input type="date" className="input-field" {...register('hire_date')} />
                </div>
              </div>
              <div>
                <label className="label">Notes</label>
                <textarea rows={2} className="input-field resize-none" placeholder="Optional notes..." {...register('notes')} />
              </div>
            </form>
          </>
        )}
      </div>
    </Modal>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────
export default function DriverForm({ driver, onClose, onSuccess }) {
  if (driver) return <EditDriverForm driver={driver} onClose={onClose} onSuccess={onSuccess} />;
  return <AddDriverForm onClose={onClose} onSuccess={onSuccess} />;
}
