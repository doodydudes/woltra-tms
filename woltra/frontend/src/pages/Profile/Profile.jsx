import { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import {
  User, Lock, Shield, Camera,
  Eye, EyeOff, Mail, Phone, Bell,
  Monitor, Laptop, Smartphone, CheckCircle2,
  ChevronRight, ArrowLeft, Sun, Moon, Building2, LogOut, Copy, Check,
  FileText, Calendar, MapPin, PhoneCall,
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../services/api';
import { useTheme } from '../../contexts/ThemeContext';
import { loadUser, logout } from '../../features/auth/authSlice';

function getPasswordStrength(pwd) {
  if (!pwd) return { score: 0, label: '', color: '' };
  let score = 0;
  if (pwd.length >= 8)           score++;
  if (pwd.length >= 12)          score++;
  if (/[A-Z]/.test(pwd))         score++;
  if (/[0-9]/.test(pwd))         score++;
  if (/[^A-Za-z0-9]/.test(pwd))  score++;
  if (score <= 1) return { score: 1, label: 'Weak',   color: 'var(--red)'    };
  if (score <= 3) return { score: 2, label: 'Fair',   color: 'var(--yellow)' };
  return                { score: 3, label: 'Strong', color: 'var(--green)'  };
}

const DUTY_OPTIONS = {
  on_duty:   { label: 'On Duty',   color: '#1D9E75',     bg: 'rgba(29,158,117,0.13)',  border: 'rgba(29,158,117,0.3)'  },
  off_duty:  { label: 'Off Duty',  color: 'var(--igray)', bg: 'rgba(136,135,128,0.1)', border: 'rgba(136,135,128,0.2)' },
  available: { label: 'Available', color: 'var(--blue)',  bg: 'rgba(31,90,168,0.12)',  border: 'rgba(31,90,168,0.28)'  },
};

const NOTIF_ROWS = [
  { key: 'load_assignments', label: 'Load assignments' },
  { key: 'route_changes',    label: 'Route changes'    },
  { key: 'payments',         label: 'Payment notifications' },
  { key: 'system',           label: 'System alerts'   },
  { key: 'marketing',        label: 'Marketing'       },
];

const MOCK_SESSIONS = [
  { id: 1, device: 'Chrome on Windows', icon: 'desktop',  location: 'Manila, PH',    active: 'Now (current)' },
  { id: 2, device: 'Safari on iPhone',  icon: 'mobile',   location: 'Batangas, PH',  active: '2 hours ago'   },
];

/* ── Reusable row ── */
function SettingsRow({ icon: Icon, iconColor = 'var(--blue)', label, sublabel, onClick, right, last }) {
  const [hover, setHover] = useState(false);
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: 12,
        width: '100%', padding: '12px 0',
        background: hover && onClick ? 'var(--bg-card-alt)' : 'transparent',
        border: 'none', borderBottom: last ? 'none' : '1px solid var(--border)',
        cursor: onClick ? 'pointer' : 'default',
        textAlign: 'left', borderRadius: last ? '0 0 4px 4px' : 0,
        marginLeft: -4, paddingLeft: 4, marginRight: -4, paddingRight: 4,
        transition: 'background 0.15s ease',
      }}
    >
      <div style={{
        width: 32, height: 32, borderRadius: 8, flexShrink: 0,
        background: iconColor + '1a',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <Icon size={16} color={iconColor} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: '13.5px', fontWeight: 500, color: 'var(--text)', lineHeight: 1.3 }}>{label}</p>
        {sublabel && <p style={{ fontSize: '11.5px', color: 'var(--text-3)', marginTop: 2 }}>{sublabel}</p>}
      </div>
      {right || (onClick && <ChevronRight size={15} color="var(--text-3)" />)}
    </button>
  );
}

/* ── Section group wrapper ── */
function SettingsGroup({ title, children }) {
  return (
    <div>
      {title && (
        <p style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6, paddingLeft: 2 }}>
          {title}
        </p>
      )}
      <div className="card" style={{ padding: '0 1rem' }}>
        {children}
      </div>
    </div>
  );
}

/* ── Sub-view header ── */
function SubHeader({ title, onBack }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: '1.25rem' }}>
      <button
        type="button"
        onClick={onBack}
        style={{
          display: 'flex', alignItems: 'center', gap: 4,
          background: 'none', border: 'none', cursor: 'pointer',
          color: 'var(--blue)', fontSize: '13.5px', fontWeight: 600,
          padding: '4px 0', fontFamily: 'inherit',
        }}
      >
        <ArrowLeft size={16} />
        Settings
      </button>
      <span style={{ color: 'var(--border-strong)' }}>·</span>
      <h1 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-h)', margin: 0 }}>{title}</h1>
    </div>
  );
}

export default function Profile() {
  const { user } = useSelector(s => s.auth);
  const dispatch  = useDispatch();
  const navigate  = useNavigate();
  const { darkMode, toggleDarkMode } = useTheme();

  const [section, setSection] = useState(null);
  const [codeCopied, setCodeCopied] = useState(false);

  const handleLogout = () => { dispatch(logout()); navigate('/login'); };

  const copyDriverCode = () => {
    navigator.clipboard.writeText(user?.driver_code || '');
    setCodeCopied(true);
    setTimeout(() => setCodeCopied(false), 2000);
  };

  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [showCurrentPwd, setShowCurrentPwd] = useState(false);
  const [showNewPwd, setShowNewPwd]         = useState(false);
  const [showConfirmPwd, setShowConfirmPwd] = useState(false);
  const [dutyStatus, setDutyStatus]         = useState('available');
  const [emailTooltip, setEmailTooltip]     = useState(false);
  const [notifPrefs, setNotifPrefs] = useState({
    load_assignments: { email: true,  push: true,  sms: false },
    route_changes:    { email: true,  push: true,  sms: false },
    payments:         { email: true,  push: false, sms: false },
    system:           { email: true,  push: false, sms: false },
    marketing:        { email: false, push: false, sms: false },
  });

  const {
    register: regProfile, handleSubmit: handleProfile,
    formState: { errors: errProfile, isDirty: profileDirty },
    reset: resetProfile,
  } = useForm({ defaultValues: {
    name: user?.name || '',
    phone: user?.phone || '',
    company_name: user?.company_name || '',
    license_number: user?.license_number || '',
    license_expiry: user?.license_expiry?.slice(0, 10) || '',
    address: user?.address || '',
    emergency_contact: user?.emergency_contact || '',
    emergency_phone: user?.emergency_phone || '',
  } });

  const {
    register: regPwd, handleSubmit: handlePwd,
    formState: { errors: errPwd }, reset: resetPwd, watch,
  } = useForm();

  const newPwd     = watch('newPassword', '');
  const confirmPwd = watch('confirmPassword', '');
  const strength   = getPasswordStrength(newPwd);
  const pwdMatch   = confirmPwd && confirmPwd === newPwd;


  const onSaveProfile = async data => {
    setSavingProfile(true);
    try {
      await api.put('/auth/profile', data);
      await dispatch(loadUser());
      resetProfile({
        name: data.name,
        phone: data.phone,
        company_name: data.company_name || '',
        license_number: data.license_number || '',
        license_expiry: data.license_expiry || '',
        address: data.address || '',
        emergency_contact: data.emergency_contact || '',
        emergency_phone: data.emergency_phone || '',
      });
      toast.success('Profile updated');
    } catch {
      toast.error('Failed to update profile');
    } finally {
      setSavingProfile(false);
    }
  };

  const onChangePassword = async data => {
    setSavingPassword(true);
    try {
      await api.put('/auth/change-password', { currentPassword: data.currentPassword, newPassword: data.newPassword });
      toast.success('Password changed successfully');
      resetPwd();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to change password');
    } finally {
      setSavingPassword(false);
    }
  };

  const roleConfig = {
    owner:  { color: 'rgba(139,92,246,0.14)', text: '#9b72f5', border: 'rgba(139,92,246,0.28)', label: 'Fleet Owner' },
    driver: { color: 'rgba(16,185,129,0.14)', text: '#10B981', border: 'rgba(16,185,129,0.28)', label: 'Driver'      },
  };
  const role = roleConfig[user?.role] || roleConfig.driver;

  const kpis = user?.role === 'driver'
    ? [
        { label: 'Deliveries', value: '24',    sub: 'this month' },
        { label: 'On-time',    value: '91%',   sub: 'rate'       },
        { label: 'Miles',      value: '1,240', sub: 'this week'  },
        { label: 'Rating',     value: '★ 4.8', sub: 'score'      },
      ]
    : [
        { label: 'Total Loads', value: '148', sub: 'this month' },
        { label: 'Active',      value: '8',   sub: 'en route'   },
        { label: 'Fleet',       value: '12',  sub: 'trucks'     },
        { label: 'On-time',     value: '94%', sub: 'rate'       },
      ];

  const toggleNotif = (row, col) =>
    setNotifPrefs(p => ({ ...p, [row]: { ...p[row], [col]: !p[row][col] } }));

  const duty = DUTY_OPTIONS[dutyStatus];

  /* ─── Sub-view: Personal Information ─── */
  if (section === 'personal') return (
    <div style={{ maxWidth: 640, margin: '0 auto', paddingBottom: profileDirty ? 72 : 0 }}>
      <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        <SubHeader title="Personal Information" onBack={() => setSection(null)} />
        <div className="card">
          <form id="profile-form" onSubmit={handleProfile(onSaveProfile)} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div>
              <label className="label">Full Name</label>
              <div style={{ position: 'relative' }}>
                <User size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-3)', pointerEvents: 'none' }} />
                <input type="text" className="input-field" style={{ paddingLeft: 30 }}
                  {...regProfile('name', { required: 'Name is required' })} />
              </div>
              {errProfile.name && <p style={{ fontSize: '11.5px', color: 'var(--red)', marginTop: 4 }}>{errProfile.name.message}</p>}
            </div>
            <div>
              <label className="label">Email Address</label>
              <div style={{ position: 'relative' }}>
                <Mail size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-3)', pointerEvents: 'none' }} />
                <input type="email" className="input-field" value={user?.email || ''} disabled
                  style={{ paddingLeft: 30, paddingRight: 36, opacity: 0.62, cursor: 'not-allowed' }} />
                <button type="button"
                  onMouseEnter={() => setEmailTooltip(true)}
                  onMouseLeave={() => setEmailTooltip(false)}
                  style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'help', color: 'var(--text-3)', padding: 0 }}>
                  <Lock size={13} />
                </button>
                {emailTooltip && (
                  <div style={{
                    position: 'absolute', bottom: 'calc(100% + 6px)', right: 0, zIndex: 20,
                    background: 'var(--bg-card)', border: '1px solid var(--border)',
                    boxShadow: 'var(--shadow-modal)', borderRadius: 8, padding: '8px 12px',
                    fontSize: '12px', color: 'var(--text-2)', width: 230, lineHeight: 1.5,
                  }}>
                    Email address cannot be changed. Contact your administrator to update it.
                  </div>
                )}
              </div>
            </div>
            <div>
              <label className="label">Phone Number</label>
              <div style={{ position: 'relative' }}>
                <Phone size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-3)', pointerEvents: 'none' }} />
                <input type="text" className="input-field" placeholder="+63 9xx xxx xxxx"
                  style={{ paddingLeft: 30 }}
                  {...regProfile('phone')} />
              </div>
            </div>
            {user?.role === 'driver' && (
              <>
                <div style={{ height: 1, background: 'var(--border)', margin: '2px 0' }} />
                <p style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                  Driver License
                </p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div>
                    <label className="label">License Number</label>
                    <div style={{ position: 'relative' }}>
                      <FileText size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-3)', pointerEvents: 'none' }} />
                      <input type="text" className="input-field" placeholder="N01-23-456789"
                        style={{ paddingLeft: 30 }}
                        {...regProfile('license_number')} />
                    </div>
                  </div>
                  <div>
                    <label className="label">License Expiry</label>
                    <div style={{ position: 'relative' }}>
                      <Calendar size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-3)', pointerEvents: 'none' }} />
                      <input type="date" className="input-field"
                        style={{ paddingLeft: 30 }}
                        {...regProfile('license_expiry')} />
                    </div>
                  </div>
                </div>

                <div style={{ height: 1, background: 'var(--border)', margin: '2px 0' }} />
                <p style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                  Address
                </p>
                <div>
                  <div style={{ position: 'relative' }}>
                    <MapPin size={13} style={{ position: 'absolute', left: 10, top: 14, color: 'var(--text-3)', pointerEvents: 'none' }} />
                    <textarea rows={2} className="input-field resize-none"
                      placeholder="Street, City, Province"
                      style={{ paddingLeft: 30 }}
                      {...regProfile('address')} />
                  </div>
                </div>

                <div style={{ height: 1, background: 'var(--border)', margin: '2px 0' }} />
                <p style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                  Emergency Contact
                </p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div>
                    <label className="label">Contact Name</label>
                    <div style={{ position: 'relative' }}>
                      <User size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-3)', pointerEvents: 'none' }} />
                      <input type="text" className="input-field" placeholder="Full name"
                        style={{ paddingLeft: 30 }}
                        {...regProfile('emergency_contact')} />
                    </div>
                  </div>
                  <div>
                    <label className="label">Contact Phone</label>
                    <div style={{ position: 'relative' }}>
                      <PhoneCall size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-3)', pointerEvents: 'none' }} />
                      <input type="text" className="input-field" placeholder="+63 9xx xxx xxxx"
                        style={{ paddingLeft: 30 }}
                        {...regProfile('emergency_phone')} />
                    </div>
                  </div>
                </div>

                <div style={{ height: 1, background: 'var(--border)', margin: '2px 0' }} />
              </>
            )}

            {user?.role === 'driver' && (
              <div>
                <label className="label">Driver Account Code</label>
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.22)',
                  borderRadius: 8, padding: '10px 14px',
                }}>
                  <span style={{
                    fontFamily: '"JetBrains Mono", monospace', fontSize: '1.2rem', fontWeight: 800,
                    color: user?.driver_code ? '#10B981' : 'var(--text-3)',
                    letterSpacing: '0.15em', flex: 1,
                  }}>
                    {user?.driver_code || 'Loading...'}
                  </span>
                  <button type="button" onClick={copyDriverCode} style={{
                    display: 'inline-flex', alignItems: 'center', gap: 5,
                    background: codeCopied ? 'rgba(16,185,129,0.12)' : 'var(--bg-card)',
                    border: '1px solid var(--border)', borderRadius: 6,
                    padding: '5px 10px', fontSize: '12px', fontWeight: 600,
                    color: codeCopied ? '#10B981' : 'var(--text-2)',
                    cursor: 'pointer', flexShrink: 0, transition: 'all 0.15s',
                  }}>
                    {codeCopied ? <><Check size={12} />Copied</> : <><Copy size={12} />Copy</>}
                  </button>
                </div>
                <p style={{ fontSize: '11.5px', color: 'var(--text-3)', marginTop: 4 }}>
                  Share this code with your fleet owner so they can add you to the fleet.
                </p>
              </div>
            )}

            {user?.role === 'owner' && (
              <div>
                <label className="label">Company / Fleet Name</label>
                <div style={{ position: 'relative' }}>
                  <Building2 size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-3)', pointerEvents: 'none' }} />
                  <input type="text" className="input-field" placeholder="e.g. Dwagon Logistics"
                    style={{ paddingLeft: 30 }}
                    {...regProfile('company_name')} />
                </div>
                <p style={{ fontSize: '11.5px', color: 'var(--text-3)', marginTop: 4 }}>
                  Used as the prefix on vehicle claim codes (e.g. DWAGON1XXXX).
                </p>
              </div>
            )}
          </form>
        </div>
      </div>
      {profileDirty && (
        <div style={{
          position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 40,
          background: 'var(--bg-card)', borderTop: '1px solid var(--border)',
          boxShadow: '0 -4px 20px rgba(0,0,0,0.12)', padding: '10px 16px',
          display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <p style={{ fontSize: '13px', color: 'var(--text-3)', flex: 1 }}>Unsaved changes</p>
          <button type="button" onClick={() => resetProfile({
            name: user?.name || '', phone: user?.phone || '', company_name: user?.company_name || '',
            license_number: user?.license_number || '', license_expiry: user?.license_expiry?.slice(0,10) || '',
            address: user?.address || '', emergency_contact: user?.emergency_contact || '', emergency_phone: user?.emergency_phone || '',
          })} className="btn-tertiary" style={{ height: 34 }}>Discard</button>
          <button type="submit" form="profile-form" className="btn-primary" disabled={savingProfile} style={{ height: 34 }}>
            {savingProfile ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      )}
    </div>
  );

  /* ─── Sub-view: Change Password ─── */
  if (section === 'password') return (
    <div style={{ maxWidth: 640, margin: '0 auto' }} className="fade-in">
      <SubHeader title="Change Password" onBack={() => setSection(null)} />
      <div className="card">
        <form onSubmit={handlePwd(onChangePassword)} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div>
            <label className="label">Current Password</label>
            <div style={{ position: 'relative' }}>
              <input type={showCurrentPwd ? 'text' : 'password'} className="input-field" style={{ paddingRight: 36 }}
                {...regPwd('currentPassword', { required: 'Required' })} />
              <button type="button" onClick={() => setShowCurrentPwd(v => !v)} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)', padding: 0 }}>
                {showCurrentPwd ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
            {errPwd.currentPassword && <p style={{ fontSize: '11.5px', color: 'var(--red)', marginTop: 4 }}>{errPwd.currentPassword.message}</p>}
            <button type="button" style={{ background: 'none', border: 'none', padding: 0, marginTop: 5, fontSize: '12px', color: 'var(--blue)', cursor: 'pointer', fontFamily: 'inherit' }}>
              Forgot current password?
            </button>
          </div>
          <div>
            <label className="label">New Password</label>
            <div style={{ position: 'relative' }}>
              <input type={showNewPwd ? 'text' : 'password'} className="input-field" style={{ paddingRight: 36 }}
                {...regPwd('newPassword', { required: 'Required', minLength: { value: 8, message: 'Minimum 8 characters' } })} />
              <button type="button" onClick={() => setShowNewPwd(v => !v)} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)', padding: 0 }}>
                {showNewPwd ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
            {newPwd && (
              <div style={{ marginTop: 8 }}>
                <div style={{ display: 'flex', gap: 4, marginBottom: 5 }}>
                  {[1, 2, 3].map(i => (
                    <div key={i} style={{ flex: 1, height: 3, borderRadius: 99, background: i <= strength.score ? strength.color : 'var(--border)', transition: 'background 0.25s ease' }} />
                  ))}
                </div>
                <p style={{ fontSize: '11.5px', color: strength.color, fontWeight: 600 }}>{strength.label}</p>
              </div>
            )}
            {errPwd.newPassword && <p style={{ fontSize: '11.5px', color: 'var(--red)', marginTop: 4 }}>{errPwd.newPassword.message}</p>}
          </div>
          <div>
            <label className="label">Confirm New Password</label>
            <div style={{ position: 'relative' }}>
              <input type={showConfirmPwd ? 'text' : 'password'} className="input-field" style={{ paddingRight: 60 }}
                {...regPwd('confirmPassword', { required: 'Required', validate: v => v === newPwd || 'Passwords do not match' })} />
              {confirmPwd && (
                <div style={{ position: 'absolute', right: 34, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
                  <CheckCircle2 size={14} color={pwdMatch ? 'var(--green)' : 'var(--red)'} />
                </div>
              )}
              <button type="button" onClick={() => setShowConfirmPwd(v => !v)} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)', padding: 0 }}>
                {showConfirmPwd ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
            {errPwd.confirmPassword && <p style={{ fontSize: '11.5px', color: 'var(--red)', marginTop: 4 }}>{errPwd.confirmPassword.message}</p>}
          </div>
          <button type="submit" className="btn-primary" disabled={savingPassword} style={{ alignSelf: 'flex-start' }}>
            <Lock size={14} />
            {savingPassword ? 'Saving...' : 'Change Password'}
          </button>
        </form>
      </div>
    </div>
  );

  /* ─── Sub-view: Notification Preferences ─── */
  if (section === 'notifications') return (
    <div style={{ maxWidth: 640, margin: '0 auto' }} className="fade-in">
      <SubHeader title="Notification Preferences" onBack={() => setSection(null)} />
      <div className="card">
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 320 }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left', paddingBottom: 8, paddingRight: 16, fontSize: '11px', fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.07em' }} />
                {['Email', 'Push', 'SMS'].map(c => (
                  <th key={c} style={{ textAlign: 'center', paddingBottom: 8, paddingLeft: 8, paddingRight: 8, fontSize: '11px', fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.07em', whiteSpace: 'nowrap' }}>{c}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {NOTIF_ROWS.map(row => (
                <tr key={row.key} style={{ borderTop: '1px solid var(--border)' }}>
                  <td style={{ padding: '11px 16px 11px 0', fontSize: '13px', color: 'var(--text)', fontWeight: 500, whiteSpace: 'nowrap' }}>{row.label}</td>
                  {(['email', 'push', 'sms']).map(col => (
                    <td key={col} style={{ textAlign: 'center', padding: '11px 8px' }}>
                      <button type="button" onClick={() => toggleNotif(row.key, col)} style={{
                        width: 34, height: 18, borderRadius: 99,
                        background: notifPrefs[row.key][col] ? 'var(--blue)' : 'var(--border-strong)',
                        border: 'none', cursor: 'pointer', padding: 2,
                        transition: 'background 0.2s ease',
                        display: 'inline-flex', alignItems: 'center',
                      }}>
                        <div style={{
                          width: 14, height: 14, borderRadius: '50%', background: '#fff',
                          transform: notifPrefs[row.key][col] ? 'translateX(16px)' : 'translateX(0)',
                          transition: 'transform 0.2s ease',
                          boxShadow: '0 1px 3px rgba(0,0,0,0.18)',
                        }} />
                      </button>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  /* ─── Sub-view: Sessions & Devices ─── */
  if (section === 'sessions') return (
    <div style={{ maxWidth: 640, margin: '0 auto' }} className="fade-in">
      <SubHeader title="Sessions & Devices" onBack={() => setSection(null)} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <div className="card" style={{ padding: 0 }}>
          {MOCK_SESSIONS.map((s, i) => (
            <div key={s.id} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '14px 1rem',
              borderBottom: i < MOCK_SESSIONS.length - 1 ? '1px solid var(--border)' : 'none',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 36, height: 36, borderRadius: 8, background: 'var(--bg)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  {s.icon === 'desktop' ? <Laptop size={16} color="var(--text-3)" /> : <Smartphone size={16} color="var(--text-3)" />}
                </div>
                <div>
                  <p style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text)' }}>{s.device}</p>
                  <p style={{ fontSize: '11.5px', color: 'var(--text-3)', marginTop: 2 }}>{s.location} · {s.active}</p>
                </div>
              </div>
              {s.id === 1
                ? <span style={{ fontSize: '11px', color: 'var(--green)', fontWeight: 700, background: 'rgba(29,158,117,0.1)', padding: '3px 10px', borderRadius: 99, border: '1px solid rgba(29,158,117,0.2)', flexShrink: 0 }}>Current</span>
                : <button type="button" style={{
                    background: 'none', border: '1px solid var(--border)', cursor: 'pointer',
                    fontSize: '12px', fontWeight: 600, color: 'var(--red)', fontFamily: 'inherit',
                    padding: '4px 10px', borderRadius: 6, flexShrink: 0,
                    transition: 'background 0.15s ease',
                  }}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(208,69,69,0.08)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'none'}
                  >
                    Log out
                  </button>
              }
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  /* ─── Main settings list ─── */
  return (
    <div style={{ maxWidth: 640, margin: '0 auto' }}>
      <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

        {/* Hero strip */}
        <div className="card" style={{ padding: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
            <div style={{ position: 'relative', flexShrink: 0 }}>
              <div style={{
                width: 68, height: 68, borderRadius: '50%',
                background: 'var(--blue)', border: '3px solid var(--border)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '1.5rem', fontWeight: 800, color: '#fff',
                fontFamily: '"Cabinet Grotesk", sans-serif',
              }}>
                {user?.name?.charAt(0).toUpperCase()}
              </div>
              <button title="Change photo" style={{
                position: 'absolute', bottom: 1, right: 1,
                width: 22, height: 22, borderRadius: '50%',
                background: 'var(--orange)', color: '#fff',
                border: '2px solid var(--bg-card)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', padding: 0,
              }}>
                <Camera size={10} />
              </button>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <h2 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-h)', marginBottom: 6, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {user?.name}
              </h2>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
                <span style={{
                  display: 'inline-flex', alignItems: 'center', gap: 4,
                  padding: '3px 10px', borderRadius: 9999,
                  fontSize: '11.5px', fontWeight: 700,
                  background: role.color, color: role.text, border: `1px solid ${role.border}`,
                }}>
                  <Shield size={10} />{role.label}
                </span>
                {user?.role === 'driver' && (
                  <select value={dutyStatus} onChange={e => setDutyStatus(e.target.value)} style={{
                    padding: '3px 10px', borderRadius: 9999,
                    fontSize: '11.5px', fontWeight: 700,
                    background: duty.bg, color: duty.color, border: `1px solid ${duty.border}`,
                    cursor: 'pointer', appearance: 'none', WebkitAppearance: 'none', outline: 'none',
                  }}>
                    <option value="on_duty">● On Duty</option>
                    <option value="off_duty">○ Off Duty</option>
                    <option value="available">◎ Available</option>
                  </select>
                )}
              </div>
              {user?.role === 'driver' && (
                <p style={{ fontSize: '12px', color: 'var(--text-3)', marginTop: 6 }}>
                  Assigned: Truck #4271 — Freightliner Cascadia · 2022
                </p>
              )}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 2 }}>
            {kpis.map((tile, i) => (
              <div key={i} style={{
                flex: '0 0 auto', minWidth: 88,
                background: 'var(--bg)', border: '1px solid var(--border)',
                borderRadius: 8, padding: '10px 14px', textAlign: 'center',
              }}>
                <p style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-h)', lineHeight: 1, marginBottom: 3, fontFamily: '"JetBrains Mono", monospace' }}>{tile.value}</p>
                <p style={{ fontSize: '10.5px', fontWeight: 600, color: 'var(--text-2)', marginBottom: 1 }}>{tile.label}</p>
                <p style={{ fontSize: '10px', color: 'var(--text-3)' }}>{tile.sub}</p>
              </div>
            ))}
          </div>

          {user?.role === 'driver' && user?.driver_code && (
            <div style={{
              marginTop: '0.875rem', padding: '10px 12px',
              background: 'rgba(16,185,129,0.07)', border: '1px solid rgba(16,185,129,0.2)',
              borderRadius: 8, display: 'flex', alignItems: 'center', gap: 10,
            }}>
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: '10.5px', fontWeight: 700, color: '#10B981', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 2 }}>
                  Your Driver Code
                </p>
                <p style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: '1.25rem', fontWeight: 800, color: '#10B981', letterSpacing: '0.15em' }}>
                  {user.driver_code}
                </p>
              </div>
              <button onClick={copyDriverCode} style={{
                display: 'inline-flex', alignItems: 'center', gap: 5,
                background: codeCopied ? 'rgba(16,185,129,0.12)' : 'var(--bg-card)',
                border: '1px solid var(--border)', borderRadius: 6,
                padding: '6px 10px', fontSize: '12px', fontWeight: 600,
                color: codeCopied ? '#10B981' : 'var(--text-2)',
                cursor: 'pointer', flexShrink: 0, transition: 'all 0.15s',
              }}>
                {codeCopied ? <><Check size={12} />Copied</> : <><Copy size={12} />Copy</>}
              </button>
            </div>
          )}
        </div>

        {/* Account section */}
        <SettingsGroup title="Account">
          <SettingsRow icon={User} iconColor="var(--blue)" label="Personal Information" sublabel={user?.email} onClick={() => setSection('personal')} />
          <SettingsRow icon={Lock} iconColor="var(--igray)" label="Change Password" sublabel="Update your login password" onClick={() => setSection('password')} last />
        </SettingsGroup>

        {/* Appearance section */}
        <SettingsGroup title="Appearance">
          <SettingsRow
            icon={darkMode ? Moon : Sun}
            iconColor={darkMode ? '#9b72f5' : 'var(--yellow)'}
            label="Dark Mode"
            sublabel={darkMode ? 'Currently dark' : 'Currently light'}
            right={
              <button onClick={toggleDarkMode} style={{
                width: 44, height: 24, borderRadius: 99,
                background: darkMode ? 'var(--blue)' : 'var(--border-strong)',
                border: 'none', cursor: 'pointer', padding: 3,
                transition: 'background 0.2s ease',
                display: 'flex', alignItems: 'center', flexShrink: 0,
              }}>
                <div style={{
                  width: 18, height: 18, borderRadius: '50%', background: '#fff',
                  transform: darkMode ? 'translateX(20px)' : 'translateX(0)',
                  transition: 'transform 0.2s ease',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                }} />
              </button>
            }
            last
          />
        </SettingsGroup>

        {/* Notifications section */}
        <SettingsGroup title="Notifications">
          <SettingsRow icon={Bell} iconColor="var(--orange)" label="Notification Preferences" sublabel="Email, push & SMS alerts" onClick={() => setSection('notifications')} last />
        </SettingsGroup>

        {/* Privacy section */}
        <SettingsGroup title="Privacy">
          <SettingsRow icon={Monitor} iconColor="var(--green)" label="Sessions & Devices" sublabel={`${MOCK_SESSIONS.length} active session${MOCK_SESSIONS.length !== 1 ? 's' : ''}`} onClick={() => setSection('sessions')} last />
        </SettingsGroup>

        {/* Sign out */}
        <div className="card" style={{ padding: '0 1rem' }}>
          <SettingsRow icon={LogOut} iconColor="var(--red)" label="Sign Out" sublabel="Log out of your account" onClick={handleLogout} last />
        </div>

      </div>
    </div>
  );
}
