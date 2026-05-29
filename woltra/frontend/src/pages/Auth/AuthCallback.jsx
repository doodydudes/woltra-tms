import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { Building2, Truck } from 'lucide-react';
import { oauthCallback, setupOAuthProfile } from '../../features/auth/authSlice';
import LoadingSpinner from '../../components/common/LoadingSpinner';

export default function AuthCallback() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { loading, error } = useSelector(s => s.auth);

  const [step, setStep] = useState('loading'); // loading | setup | error
  const [insforgeUser, setInsforgeUser] = useState(null);
  const [profileForm, setProfileForm] = useState({ role: 'driver', name: '', company_name: '', phone: '' });

  useEffect(() => {
    // InsForge SDK auto-exchanges insforge_code in the URL when initialized.
    // Small delay ensures the SDK has processed it before we call getCurrentUser.
    const timer = setTimeout(async () => {
      const action = await dispatch(oauthCallback());
      if (action.meta.requestStatus === 'fulfilled') {
        const { user, needsProfile, insforgeUser: ifUser } = action.payload;
        if (user) {
          navigate('/dashboard', { replace: true });
        } else if (needsProfile && ifUser) {
          setInsforgeUser(ifUser);
          setProfileForm(f => ({
            ...f,
            name: ifUser.user_metadata?.name || ifUser.email?.split('@')[0] || '',
          }));
          setStep('setup');
        }
      } else {
        setStep('error');
      }
    }, 500);
    return () => clearTimeout(timer);
  }, []);

  const handleSetupProfile = async e => {
    e.preventDefault();
    const profileData = {
      role: profileForm.role,
      name: profileForm.name,
      phone: profileForm.phone || undefined,
      ...(profileForm.role === 'owner' ? { company_name: profileForm.company_name } : {}),
    };
    const action = await dispatch(setupOAuthProfile(profileData));
    if (action.meta.requestStatus === 'fulfilled') {
      navigate('/dashboard', { replace: true });
    }
  };

  // ── Profile setup for new OAuth users ──────────────────────────────────────
  if (step === 'setup') {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem' }}>
        <div style={{ width: '100%', maxWidth: 420 }}>
          <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
            <h2 style={{ fontSize: '1.3rem', fontWeight: 800, color: 'var(--text-h)', marginBottom: 6 }}>Complete Your Profile</h2>
            <p style={{ fontSize: '13px', color: 'var(--text-2)' }}>Choose how you'll use Woltra TMS.</p>
          </div>
          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, padding: '1.75rem', boxShadow: 'var(--shadow-modal)' }}>

            {error && (
              <div style={{ marginBottom: '1rem', padding: '9px 12px', background: 'rgba(208,69,69,0.08)', border: '1px solid rgba(208,69,69,0.25)', borderRadius: 7, fontSize: '12.5px', color: 'var(--red)' }}>{error}</div>
            )}

            <form onSubmit={handleSetupProfile} style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
              {/* Role */}
              <div style={{ display: 'flex', gap: 6, background: 'var(--bg)', borderRadius: 10, padding: 4, border: '1px solid var(--border)', marginBottom: 4 }}>
                {(['owner', 'driver']).map(r => (
                  <button key={r} type="button" onClick={() => setProfileForm(f => ({ ...f, role: r }))} style={{ flex: 1, padding: '11px 8px', borderRadius: 7, border: 'none', cursor: 'pointer', transition: 'all 0.2s ease', background: profileForm.role === r ? (r === 'owner' ? '#FACC15' : 'var(--blue)') : 'transparent', color: profileForm.role === r ? (r === 'owner' ? '#16181D' : '#fff') : 'var(--text-3)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, boxShadow: profileForm.role === r ? '0 2px 8px rgba(0,0,0,0.22)' : 'none' }}>
                    {r === 'owner' ? <Building2 size={17} /> : <Truck size={17} />}
                    <span style={{ fontSize: '12px', fontWeight: 700 }}>{r === 'owner' ? 'Owner' : 'Driver'}</span>
                  </button>
                ))}
              </div>

              <div>
                <label className="label">Full Name</label>
                <input type="text" className="input-field" placeholder="Your name" value={profileForm.name}
                  onChange={e => setProfileForm(f => ({ ...f, name: e.target.value }))} required />
              </div>

              {profileForm.role === 'owner' && (
                <div>
                  <label className="label">Fleet Short Code <span style={{ color: 'var(--text-3)', fontWeight: 400 }}>2–10 chars</span></label>
                  <input type="text" className="input-field" placeholder="MYFLEET" style={{ textTransform: 'uppercase', fontFamily: 'monospace', fontWeight: 700, letterSpacing: '0.08em' }}
                    value={profileForm.company_name}
                    onChange={e => setProfileForm(f => ({ ...f, company_name: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10) }))}
                    required maxLength={10} />
                </div>
              )}

              <div>
                <label className="label">Phone <span style={{ color: 'var(--text-3)', fontWeight: 400 }}>(optional)</span></label>
                <input type="text" className="input-field" placeholder="+63 9xx xxx xxxx" value={profileForm.phone}
                  onChange={e => setProfileForm(f => ({ ...f, phone: e.target.value }))} />
              </div>

              <button type="submit" className="btn-primary" disabled={loading} style={{ width: '100%', height: 42, fontSize: '14px', borderRadius: 8, gap: 7, marginTop: 4 }}>
                {loading
                  ? <div style={{ width: 16, height: 16, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.65s linear infinite' }} />
                  : 'Create Profile'}
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  // ── Error state ─────────────────────────────────────────────────────────────
  if (step === 'error' || error) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem' }}>
        <div style={{ textAlign: 'center', maxWidth: 360 }}>
          <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'rgba(208,69,69,0.1)', border: '1px solid rgba(208,69,69,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem' }}>
            <span style={{ fontSize: '1.5rem' }}>✕</span>
          </div>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-h)', marginBottom: 8 }}>Sign-in failed</h2>
          <p style={{ fontSize: '13px', color: 'var(--text-2)', marginBottom: '1.25rem', lineHeight: 1.55 }}>{error || 'Authentication failed. Please try again.'}</p>
          <button onClick={() => navigate('/login')} className="btn-primary" style={{ minWidth: 140 }}>Back to Sign In</button>
        </div>
      </div>
    );
  }

  // ── Loading state ────────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
      <LoadingSpinner size="lg" />
      <p style={{ fontSize: '13px', color: 'var(--text-3)' }}>Completing sign-in…</p>
    </div>
  );
}
