import { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate, Link } from 'react-router-dom';
import { Truck, Eye, EyeOff, Sun, Moon, LogIn, Building2, Mail, Lock, PackageCheck, Users, BarChart3 } from 'lucide-react';
import { login, clearError, clearNeedsProfile } from '../../features/auth/authSlice';
import { auth as supabaseAuth } from '../../services/supabase';
import { useTheme } from '../../contexts/ThemeContext';

const HINTS = {
  owner:  'Full fleet oversight & management',
  driver: 'View loads, log hours, get paid',
};

const FEATURES = [
  { icon: PackageCheck, label: 'Track Deliveries', desc: 'Monitor every load from dispatch to drop-off in real time.' },
  { icon: Users,        label: 'Manage Your Team', desc: 'Add drivers, assign vehicles, and keep everyone in sync.' },
  { icon: BarChart3,    label: 'Simple Reports',   desc: 'Earnings, trips, and performance — at a glance.' },
];

export default function Login() {
  const [mode, setMode]             = useState('owner');
  const [form, setForm]             = useState({ email: '', password: '' });
  const [showPassword, setShowPwd]  = useState(false);
  const [roleError, setRoleError]   = useState(null);
  const [errorKey, setErrorKey]     = useState(0);
  const [showForgot, setShowForgot] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotSent, setForgotSent]   = useState(false);
  const [forgotLoading, setForgotLoading] = useState(false);
  const dispatch   = useDispatch();
  const navigate   = useNavigate();
  const { loading, error, user, needsProfile } = useSelector(s => s.auth);
  const { darkMode, toggleDarkMode } = useTheme();

  useEffect(() => {
    if (user) navigate('/dashboard');
  }, [user, navigate]);

  useEffect(() => {
    if (needsProfile) {
      dispatch(clearNeedsProfile());
      navigate('/auth-callback');
    }
  }, [needsProfile, navigate, dispatch]);

  useEffect(() => {
    return () => dispatch(clearError());
  }, [dispatch]);

  const switchMode = m => { setMode(m); setForm({ email: '', password: '' }); dispatch(clearError()); setRoleError(null); };

  const handleSubmit = async e => {
    e.preventDefault();
    setRoleError(null);
    // expectedRole = active tab; thunk rejects (and signs out) on role mismatch
    const r = await dispatch(login({ email: form.email, password: form.password, expectedRole: mode }));
    if (r.meta.requestStatus === 'fulfilled' && r.payload?.role) {
      navigate('/dashboard');
    }
    setErrorKey(k => k + 1);
  };

  const handleForgotPassword = async (e) => {
    e.preventDefault();
    if (!forgotEmail) return;
    setForgotLoading(true);
    try {
      await supabaseAuth.resetPassword(forgotEmail);
      setForgotSent(true);
    } catch (err) {
      alert(err.message || 'Failed to send reset email');
    } finally {
      setForgotLoading(false);
    }
  };

  const handleOAuth = async (provider) => {
    localStorage.setItem('woltra_oauth_role', mode);
    try {
      if (provider === 'google') {
        await supabaseAuth.signInWithGoogle();
      } else if (provider === 'github') {
        await supabaseAuth.signInWithGitHub();
      }
    } catch (err) {
      console.error('OAuth error:', err);
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', alignItems: 'stretch' }}>

      {/* ── Left brand panel (desktop only) ── */}
      <div className="brand-panel" style={{
        display: 'none', width: 400, flexShrink: 0,
        background: '#16181D', padding: '2.5rem 2.25rem',
        flexDirection: 'column', justifyContent: 'space-between',
        borderRight: '1px solid rgba(255,255,255,0.06)',
        position: 'relative', overflow: 'hidden',
      }}>
        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', background: 'radial-gradient(ellipse 80% 60% at 10% 90%, rgba(250,204,21,0.05) 0%, transparent 70%)' }} />
        <div style={{ position: 'relative' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: '2.75rem' }}>
            <img src="/logo-badge.svg" alt="WOLTRA" style={{ width: 36, height: 36, borderRadius: 9, flexShrink: 0 }} />
            <span style={{ fontFamily: '"Cabinet Grotesk", sans-serif', fontWeight: 800, fontSize: '1.15rem', color: '#fff', letterSpacing: '-0.02em' }}>WOLTRA</span>
          </div>
          <div style={{ width: 32, height: 3, background: '#FACC15', borderRadius: 2, marginBottom: '1.25rem' }} />
          <h2 style={{ fontFamily: '"Cabinet Grotesk", sans-serif', fontWeight: 700, fontSize: '1.65rem', color: '#fff', lineHeight: 1.25, marginBottom: '0.75rem' }}>
            Manage your fleet,<br />the easy way.
          </h2>
          <p style={{ fontSize: '13.5px', color: 'rgba(255,255,255,0.4)', lineHeight: 1.7, marginBottom: '2.25rem' }}>
            A simple trucking management system built for small fleets and growing businesses.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.125rem' }}>
            {FEATURES.map(({ icon: Icon, label, desc }) => (
              <div key={label} style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
                <div style={{ width: 34, height: 34, borderRadius: 8, flexShrink: 0, background: 'rgba(250,204,21,0.12)', border: '1px solid rgba(250,204,21,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Icon size={15} color="#FACC15" />
                </div>
                <div>
                  <p style={{ fontSize: '13px', fontWeight: 700, color: '#fff', marginBottom: 2 }}>{label}</p>
                  <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.35)', lineHeight: 1.55 }}>{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
        <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.18)', position: 'relative', letterSpacing: '0.06em' }}>WOLTRA TMS · v1.0</p>
      </div>

      {/* ── Right form area ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '1.5rem 1.5rem 2rem', position: 'relative', overflowY: 'auto' }}>
        <button onClick={toggleDarkMode} style={{ position: 'absolute', top: 16, right: 16, background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '50%', width: 34, height: 34, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--text-2)' }}>
          {darkMode ? <Sun size={15} /> : <Moon size={15} />}
        </button>

        <div style={{ width: '100%', maxWidth: 400 }}>
          <div className="mobile-logo-block" style={{ textAlign: 'center', marginBottom: '1.75rem' }}>
            <img src="/logo-badge.svg" alt="WOLTRA" style={{ width: 48, height: 48, display: 'inline-block', borderRadius: 12, marginBottom: '0.75rem' }} />
            <h1 style={{ fontFamily: '"Cabinet Grotesk", sans-serif', fontWeight: 800, fontSize: '1.5rem', color: 'var(--text-h)', letterSpacing: '-0.03em', marginBottom: 3 }}>WOLTRA</h1>
            <p style={{ fontSize: '12.5px', color: 'var(--text-2)' }}>{mode === 'owner' ? 'Owner Portal' : 'Driver Portal'}</p>
          </div>
          <div className="desktop-heading-block" style={{ display: 'none', marginBottom: '1.75rem' }}>
            <h1 style={{ fontFamily: '"Cabinet Grotesk", sans-serif', fontWeight: 800, fontSize: '1.6rem', color: 'var(--text-h)', letterSpacing: '-0.03em', marginBottom: 4 }}>
              {mode === 'owner' ? 'Owner Sign In' : 'Driver Sign In'}
            </h1>
            <p style={{ fontSize: '13px', color: 'var(--text-2)' }}>{mode === 'owner' ? 'Manage your fleet and drivers.' : 'View your loads and earnings.'}</p>
          </div>

          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, padding: '1.75rem', boxShadow: 'var(--shadow-modal)' }}>
            {/* Role toggle */}
            <div style={{ display: 'flex', gap: 6, background: 'var(--bg)', borderRadius: 10, padding: 4, marginBottom: '0.75rem', border: '1px solid var(--border)' }}>
              {(['owner', 'driver']).map(m => (
                <button key={m} type="button" onClick={() => switchMode(m)} style={{
                  flex: 1, padding: '11px 8px', borderRadius: 7, border: 'none',
                  fontFamily: 'Satoshi, Inter, sans-serif', cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  background: mode === m ? (m === 'owner' ? '#FACC15' : 'var(--blue)') : 'transparent',
                  color: mode === m ? (m === 'owner' ? '#16181D' : '#fff') : 'var(--text-3)',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5,
                  boxShadow: mode === m ? '0 2px 8px rgba(0,0,0,0.22)' : 'none',
                }}>
                  {m === 'owner' ? <Building2 size={17} /> : <Truck size={17} />}
                  <span style={{ fontSize: '12px', fontWeight: 700, lineHeight: 1 }}>{m === 'owner' ? 'Owner' : 'Driver'}</span>
                </button>
              ))}
            </div>
            <p style={{ fontSize: '12px', color: 'var(--text-3)', marginBottom: '1.25rem', minHeight: 16 }}>{HINTS[mode]}</p>

            {(roleError || error) && (
              <div key={errorKey} style={{ marginBottom: '1rem', padding: '9px 12px', background: 'rgba(208,69,69,0.08)', border: '1px solid rgba(208,69,69,0.25)', borderRadius: 7, fontSize: '12.5px', color: 'var(--red)', animation: 'shake 0.4s ease' }}>
                {roleError || error}
              </div>
            )}

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
              <div>
                <label className="label">Email address</label>
                <div style={{ position: 'relative' }}>
                  <Mail size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-3)', pointerEvents: 'none' }} />
                  <input type="email" className="input-field" placeholder="you@company.com" style={{ paddingLeft: 32 }}
                    value={form.email} onChange={e => setForm({ ...form, email: e.target.value })}
                    required autoComplete="email" />
                </div>
              </div>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <label className="label" style={{ margin: 0 }}>Password</label>
                  <button type="button" onClick={() => { setShowForgot(true); setForgotEmail(form.email); setForgotSent(false); }}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '11.5px', color: 'var(--blue)', fontFamily: 'inherit', fontWeight: 600, padding: 0 }}>
                    Forgot password?
                  </button>
                </div>
                <div style={{ position: 'relative' }}>
                  <Lock size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-3)', pointerEvents: 'none' }} />
                  <input type={showPassword ? 'text' : 'password'} className="input-field" placeholder="••••••••"
                    style={{ paddingLeft: 32, paddingRight: 36 }}
                    value={form.password} onChange={e => setForm({ ...form, password: e.target.value })}
                    required autoComplete="current-password" />
                  <button type="button" onClick={() => setShowPwd(v => !v)} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)', display: 'flex', padding: 0 }}>
                    {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              </div>

              <button type="submit" className="btn-primary" disabled={loading} style={{ width: '100%', marginTop: 4, height: 42, fontSize: '14px', borderRadius: 8, gap: 7 }}>
                {loading
                  ? <div style={{ width: 16, height: 16, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.65s linear infinite' }} />
                  : <><LogIn size={15} />Sign in</>}
              </button>

              {/* OAuth */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, marginTop: '0.875rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%' }}>
                  <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
                  <span style={{ fontSize: '11.5px', color: 'var(--text-3)' }}>or</span>
                  <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  {/* Google */}
                  <button type="button" title="Sign in with Google" onClick={() => handleOAuth('google')} style={{ width: 40, height: 40, borderRadius: '50%', border: '1px solid var(--border)', background: 'var(--bg-card)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background 0.15s ease' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--bg)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'var(--bg-card)'}>
                    <svg width="18" height="18" viewBox="0 0 18 18">
                      <path fill="#4285F4" d="M16.51 8H8.98v3h4.3c-.18 1-.74 1.48-1.6 2.04v2.01h2.6a7.8 7.8 0 0 0 2.38-5.88c0-.57-.05-.66-.15-1.18z"/>
                      <path fill="#34A853" d="M8.98 17c2.16 0 3.97-.72 5.3-1.94l-2.6-2a4.8 4.8 0 0 1-7.18-2.54H1.83v2.07A8 8 0 0 0 8.98 17z"/>
                      <path fill="#FBBC05" d="M4.5 10.52a4.8 4.8 0 0 1 0-3.04V5.41H1.83a8 8 0 0 0 0 7.18l2.67-2.07z"/>
                      <path fill="#EA4335" d="M8.98 4.18c1.17 0 2.23.4 3.06 1.2l2.3-2.3A8 8 0 0 0 1.83 5.4L4.5 7.49a4.77 4.77 0 0 1 4.48-3.3z"/>
                    </svg>
                  </button>
                  {/* GitHub */}
                  <button type="button" title="Sign in with GitHub" onClick={() => handleOAuth('github')} style={{ width: 40, height: 40, borderRadius: '50%', border: '1px solid var(--border)', background: 'var(--bg-card)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-2)', transition: 'background 0.15s ease' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--bg)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'var(--bg-card)'}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z"/>
                    </svg>
                  </button>
                </div>
              </div>
            </form>
          </div>

          <div style={{ textAlign: 'center', marginTop: '1.25rem', display: 'flex', flexDirection: 'column', gap: 6 }}>
            <p style={{ fontSize: '12px', color: 'var(--text-3)' }}>
              {mode === 'owner' ? 'New owner?' : 'New driver?'}{' '}
              <Link to={`/register?role=${mode}`} style={{ color: 'var(--blue)', fontWeight: 600, textDecoration: 'none', fontSize: '12px' }}>Create an account</Link>
            </p>
          </div>
        </div>
      </div>

      <style>{`
        @media (min-width: 1024px) {
          .brand-panel           { display: flex !important; }
          .mobile-logo-block     { display: none !important; }
          .desktop-heading-block { display: block !important; }
        }
      `}</style>

      {/* ── Forgot Password Modal ── */}
      {showForgot && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem' }}>
          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 14, padding: '1.75rem', width: '100%', maxWidth: 380, boxShadow: 'var(--shadow-modal)' }}>
            {forgotSent ? (
              <>
                <div style={{ textAlign: 'center', marginBottom: '1.25rem' }}>
                  <div style={{ width: 52, height: 52, borderRadius: '50%', background: 'rgba(22,163,74,0.12)', border: '1px solid rgba(22,163,74,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem' }}>
                    <Mail size={22} color="#16A34A" />
                  </div>
                  <h3 style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--text-h)', marginBottom: 6 }}>Check your email</h3>
                  <p style={{ fontSize: '13px', color: 'var(--text-2)', lineHeight: 1.6 }}>
                    We sent a password reset link to <strong>{forgotEmail}</strong>. Check your inbox and follow the link.
                  </p>
                </div>
                <button onClick={() => setShowForgot(false)} className="btn-primary" style={{ width: '100%', height: 42, fontSize: '14px', borderRadius: 8 }}>
                  Back to Sign In
                </button>
              </>
            ) : (
              <>
                <h3 style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--text-h)', marginBottom: 6 }}>Reset Password</h3>
                <p style={{ fontSize: '13px', color: 'var(--text-2)', marginBottom: '1.25rem', lineHeight: 1.55 }}>
                  Enter your email and we'll send you a reset link.
                </p>
                <form onSubmit={handleForgotPassword} style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
                  <div style={{ position: 'relative' }}>
                    <Mail size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-3)', pointerEvents: 'none' }} />
                    <input type="email" className="input-field" placeholder="you@company.com" style={{ paddingLeft: 32 }}
                      value={forgotEmail} onChange={e => setForgotEmail(e.target.value)} required autoFocus />
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button type="button" onClick={() => setShowForgot(false)} className="btn-secondary" style={{ flex: 1, height: 42, fontSize: '13px', borderRadius: 8 }}>
                      Cancel
                    </button>
                    <button type="submit" className="btn-primary" disabled={forgotLoading} style={{ flex: 1, height: 42, fontSize: '13px', borderRadius: 8 }}>
                      {forgotLoading ? 'Sending…' : 'Send Link'}
                    </button>
                  </div>
                </form>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
