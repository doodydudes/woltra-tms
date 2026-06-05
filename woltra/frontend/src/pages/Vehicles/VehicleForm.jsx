import { useForm } from 'react-hook-form';
import { useState } from 'react';
import { Copy, Check, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../services/api';
import { copyToClipboard } from '../../utils/clipboard';
import Modal from '../../components/common/Modal';

export default function VehicleForm({ vehicle, onClose, onSuccess }) {
  const [submitting, setSubmitting] = useState(false);
  const [claimCode, setClaimCode] = useState(null);
  const [copied, setCopied] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const isEdit = !!vehicle;

  const { register, handleSubmit, formState: { errors } } = useForm({
    defaultValues: {
      truck_id:      vehicle?.truck_id || '',
      plate_number:  vehicle?.plate_number || '',
      make:          vehicle?.make || '',
      model:         vehicle?.model || '',
      year:          vehicle?.year || '',
      capacity:      vehicle?.capacity || '',
      capacity_unit: vehicle?.capacity_unit || 'boxes',
      status:        vehicle?.status || 'available',
      fuel_type:     vehicle?.fuel_type || 'diesel',
      wheel_count:   vehicle?.wheel_count || '',
      notes:         vehicle?.notes || '',
    }
  });

  const copyCode = async (code) => {
    const ok = await copyToClipboard(code);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } else {
      toast.error('Could not copy automatically');
    }
  };

  const handleDelete = async () => {
    if (!confirmDelete) { setConfirmDelete(true); return; }
    setDeleting(true);
    try {
      await api.delete(`/vehicles/${vehicle.id}`);
      toast.success('Vehicle deleted');
      onSuccess();
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to delete vehicle');
      setDeleting(false);
      setConfirmDelete(false);
    }
  };

  const onSubmit = async (data) => {
    setSubmitting(true);
    try {
      if (isEdit) {
        await api.put(`/vehicles/${vehicle.id}`, data);
        toast.success('Vehicle updated');
        onSuccess();
      } else {
        const res = await api.post('/vehicles', data);
        if (res.data.claim_code) {
          setClaimCode(res.data.claim_code);
        } else {
          toast.success('Vehicle created');
          onSuccess();
        }
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to save vehicle');
    } finally {
      setSubmitting(false);
    }
  };

  if (claimCode) {
    return (
      <Modal open onClose={() => { onSuccess(); onClose(); }} title="Vehicle Created" size="sm"
        footer={
          <div className="flex justify-end">
            <button onClick={() => { onSuccess(); onClose(); }} className="btn-primary">Done</button>
          </div>
        }
      >
        <div className="text-center space-y-4 py-2">
          <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto">
            <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <div>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
              Vehicle created! Share this code with your driver so they can join the fleet:
            </p>
            <div className="bg-gray-50 dark:bg-gray-800 border-2 border-dashed border-primary-300 dark:border-primary-700 rounded-xl p-4">
              <p className="text-xl font-bold tracking-[0.15em] text-primary-600 dark:text-primary-400 font-mono break-all">
                {claimCode}
              </p>
            </div>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">
              The driver creates an account (or signs in with Google/GitHub), then enters this code on their dashboard.
            </p>
          </div>
        </div>
      </Modal>
    );
  }

  return (
    <Modal open onClose={onClose} title={isEdit ? 'Edit Vehicle' : 'Add New Vehicle'} size="lg"
      footer={
        <div className="flex items-center justify-between gap-3">
          {isEdit ? (
            <button
              type="button"
              onClick={handleDelete}
              disabled={deleting}
              className={confirmDelete ? 'btn-danger' : 'btn-secondary'}
              style={{ display: 'flex', alignItems: 'center', gap: 6, color: confirmDelete ? undefined : '#EF4444', borderColor: '#EF4444' }}
            >
              <Trash2 size={14} />
              {deleting ? 'Deleting...' : confirmDelete ? 'Confirm Delete' : 'Delete'}
            </button>
          ) : <div />}
          <div className="flex gap-3">
            <button onClick={onClose} className="btn-secondary" disabled={submitting || deleting}>Cancel</button>
            <button form="vehicle-form" type="submit" className="btn-primary" disabled={submitting || deleting}>
              {submitting ? 'Saving...' : isEdit ? 'Update Vehicle' : 'Add Vehicle'}
            </button>
          </div>
        </div>
      }
    >
      <form id="vehicle-form" onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="label">Truck ID <span className="text-red-500">*</span></label>
            <input type="text" className="input-field" placeholder="TRK001"
              {...register('truck_id', { required: 'Required' })} disabled={isEdit} />
            {errors.truck_id && <p className="text-xs text-red-500 mt-1">{errors.truck_id.message}</p>}
          </div>
          <div>
            <label className="label">Plate Number <span className="text-red-500">*</span></label>
            <input type="text" className="input-field" placeholder="ABC-1234"
              {...register('plate_number', { required: 'Required' })} />
            {errors.plate_number && <p className="text-xs text-red-500 mt-1">{errors.plate_number.message}</p>}
          </div>
          <div>
            <label className="label">Make</label>
            <input type="text" className="input-field" placeholder="Isuzu" {...register('make')} />
          </div>
          <div>
            <label className="label">Model</label>
            <input type="text" className="input-field" placeholder="ELF" {...register('model')} />
          </div>
          <div>
            <label className="label">Year</label>
            <input type="number" className="input-field" placeholder="2022" {...register('year')} />
          </div>
          <div>
            <label className="label">Fuel Type</label>
            <select className="input-field" {...register('fuel_type')}>
              <option value="diesel">Diesel</option>
              <option value="gasoline">Gasoline</option>
              <option value="electric">Electric</option>
              <option value="hybrid">Hybrid</option>
            </select>
          </div>
          <div>
            <label className="label">Capacity</label>
            <div className="flex gap-2">
              <input type="number" className="input-field" placeholder="1000" {...register('capacity')} />
              <select className="input-field w-28" {...register('capacity_unit')}>
                <option value="boxes">Boxes</option>
                <option value="kg">KG</option>
                <option value="tons">Tons</option>
              </select>
            </div>
          </div>
          <div>
            <label className="label">Status</label>
            <select className="input-field" {...register('status')}>
              <option value="available">Available</option>
              <option value="in_use">In Use</option>
              <option value="maintenance">Maintenance</option>
              <option value="retired">Retired</option>
            </select>
          </div>
          <div>
            <label className="label">Wheel Count</label>
            <select className="input-field" {...register('wheel_count')}>
              <option value="">— Select —</option>
              <option value="4">4 Wheeler</option>
              <option value="6">6 Wheeler</option>
              <option value="8">8 Wheeler</option>
              <option value="10">10 Wheeler</option>
              <option value="12">12 Wheeler</option>
              <option value="14">14 Wheeler</option>
              <option value="16">16 Wheeler</option>
            </select>
          </div>
        </div>

        <div>
          <label className="label">Notes</label>
          <textarea rows={2} className="input-field resize-none" {...register('notes')} />
        </div>

        {isEdit && (
          <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg space-y-2">
            <p className="text-xs font-semibold text-blue-700 dark:text-blue-300 uppercase tracking-wide">Vehicle Code</p>
            {vehicle?.claim_code ? (
              <>
                <div className="flex items-center gap-2">
                  <div className="flex-1 bg-white dark:bg-gray-800 border border-blue-200 dark:border-blue-700 rounded-lg px-4 py-2.5">
                    <p className="font-mono font-bold text-lg tracking-[0.15em] text-blue-600 dark:text-blue-400">
                      {vehicle.claim_code}
                    </p>
                  </div>
                  <button type="button" onClick={() => copyCode(vehicle.claim_code)}
                    className="flex items-center gap-1.5 px-3 py-2.5 rounded-lg bg-blue-100 dark:bg-blue-800 text-blue-700 dark:text-blue-300 text-xs font-semibold transition-all">
                    {copied ? <Check size={13} /> : <Copy size={13} />}
                    {copied ? 'Copied' : 'Copy'}
                  </button>
                </div>
                <p className="text-xs text-blue-500 dark:text-blue-400">
                  Share with the driver — they enter this code on their dashboard to link to this vehicle.
                </p>
              </>
            ) : (
              <div className="flex items-center gap-2 bg-white dark:bg-gray-800 border border-blue-200 dark:border-blue-700 rounded-lg px-4 py-2.5">
                <Check size={14} className="text-green-500 flex-shrink-0" />
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Driver already linked to this vehicle
                </p>
              </div>
            )}
          </div>
        )}
      </form>
    </Modal>
  );
}
