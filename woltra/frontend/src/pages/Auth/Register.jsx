import { useState, useEffect, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { Truck, Eye, EyeOff, Sun, Moon, UserPlus, Mail, Lock, User, Phone, Copy, Check, FileText, Calendar, Building2 } from 'lucide-react';
import { register, oauthLogin, clearError } from '../../features/auth/authSlice';
import { useTheme } from '../../contexts/ThemeContext';

export default function Register() {
  const [searchParams] = useSearchParams();
  const [role, setRole] = useState(searchParams.get('role') === 'owner' ? 'owner' : 'driver');

  const resetForm = () => ({ name: '', email: '', password: '', confirmPassword: '', phone: '', license_number: '', license_expiry: '', company_name: '' });
  const [form, setForm] = useState(resetForm);
  const [showPassword, setShowPwd] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [copied, setCopied] = useState(false);
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const roleRef = useRef(role);
  const [pendingCompanyName, setPendingCompanyName] = useState('');
  const companyNameRef = useRef('');
  useEffect(() => { roleRef.current = role; }, [role]);
  useEffect(() => { companyNameRef.current = pendingCompanyName; }, [pendingCompanyName]);

  const switchRole = r => { setRole(r); setForm(resetForm()); setPendingCompanyName(''); dispatch(clearError()); };
  const { loading, error, token, user } = useSelector(s => s.auth);
  const { darkMode, toggleDarkMode } = useTheme();

  const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
  const githubClientId = import.meta.env.VITE_GITHUB_CLIENT_ID;

  // Show driver code screen after successful registration
  const [registered, setRegistered] = useState(false);
  const [driverCode, setDriverCode] = useState('');

  useEffect(() => {
    return () => dispatch(clearError());
  }, [dispatch]);

  useEffect(() => {
    if (!googleClientId) return;
    const init = () => {
      if (!window.google) return;
      window.google.accounts.id.initialize({
        client_id: googleClientId,
        callback: (response) => {
          const currentRole = roleRef.current;
          const currentCompanyName = companyNameRef.current;
          dispatch(oauthLogin({
            provider: 'google',
            credential: response.credential,
            role: currentRole,
            ...(currentRole === 'owner' && currentCompanyName && { company_name: currentCompanyName }),
          })).then(r => {
            if (r.meta.requestStatus === 'fulfilled') {
              setDriverCode(r.payload.user?.driver_code || '');
              setRegistered(true);
            }
          });
        },
      });
      const btn = document.getElementById('google-register-btn');
      if (btn) {
        window.google.accounts.id.renderButton(btn, { type: 'standard', theme: 'outline', size: 'large', width: btn.offsetWidth || 340, text: 'signup_with' });
      }
    };
    if (window.google?.accounts?.id) init();
    else window.onGoogleLibraryLoad = init;
    return () => { if (window.onGoogleLibraryLoad === init) window.onGoogleLibraryLoad = null; };
  }, [googleClientId]);

  const handleGithubRegister = () => {
    if (!githubClientId) return;
    const redirectUri = `${window.location.origin}/auth-callback`;
    window.location.href = `https://github.com/login/oauth/authorize?client_id=${githubClientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=user:email`;
  };

  const handleSubmit = async e => {
    e.preventDefault();
    if (form.password !== form.confirmPassword) return;
    if (role === 'owner' && form.company_name.length < 2) return;
    const payload = {
      name: form.name,
      email: form.email,
      password: form.password,
      phone: form.phone,
      role,
    };
    if (role === 'owner') {
      payload.company_name = form.company_name;
    } else {
      payload.license_number = form.license_number;
      payload.license_expiry = form.license_expiry;
    }
    const r = await dispatch(register(payload));
    if (r.meta.requestStatus === 'fulfilled') {
      setDriverCode(r.payload.user?.driver_code || '');
      setRegistered(true);
    }
  };

  const copyCode = () => {
    navigator.clipboard.writeText(driverCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const pwdMatch = form.confirmPassword && form.confirmPassword === form.password;

  // ── Success screen: owner goes straight to dashboard ──
  if (registered && role === 'owner') {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem' }}>
        <div style={{ width: '100%', maxWidth: 420, textAlign: 'center' }}>
          <div style={{
            background: 'var(--bg-card)', border: '1px solid var(--border)',
            borderRadius: 12, padding: '2rem', boxShadow: 'var(--shadow-modal)',
          }}>
            <div style={{
              width: 56, height: 56, borderRadius: '50%',
              background: 'rgba(59,130,246,0.12)', border: '2px solid rgba(59,130,246,0.3)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 1.25rem',
            }}>
              <Check size={26} color="var(--blue)" strokeWidth={2.5} />
            </div>
            <h2 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-h)', marginBottom: 6 }}>
              Owner Account Created!
            </h2>
            <p style={{ fontSize: '13px', color: 'var(--text-2)', marginBottom: '1.25rem', lineHeight: 1.55 }}>
              Your fleet owner account is ready. Head to the dashboard to start managing your fleet.
            </p>
            <div style={{
              background: 'var(--bg)', border: '1px solid var(--border)',
              borderRadius: 8, padding: '10px 14px', marginBottom: '1.5rem',
              textAlign: 'left',
            }}>
              <p style={{ fontSize: '11px', color: 'var(--text-3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 4 }}>Fleet Code Prefix</p>
              <p style={{ fontFamily: 'monospace', fontSize: '1.4rem', fontWeight: 800, color: 'var(--blue)', letterSpacing: '0.1em' }}>
                {form.company_name}
              </p>
              <p style={{ fontSize: '11.5px', color: 'var(--text-3)', marginTop: 4 }}>
                This will be used as a prefix in your fleet's codes and identifiers.
              </p>
            </div>
            <button onClick={() => navigate('/dashboard')} className="btn-primary" style={{ width: '100%', height: 42, fontSize: '14px', borderRadius: 8 }}>
              Go to Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Success screen: show driver code ──
  if (registered && driverCode) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem' }}>
        <div style={{ width: '100%', maxWidth: 420, textAlign: 'center' }}>
          <div style={{
            background: 'var(--bg-card)', border: '1px solid var(--border)',
            borderRadius: 12, padding: '2rem', boxShadow: 'var(--shadow-modal)',
          }}>
            <div style={{
              width: 56, height: 56, borderRadius: '50%',
              background: 'rgba(16,185,129,0.12)', border: '2px solid rgba(16,185,129,0.3)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 1.25rem',
            }}>
              <Check size={26} color="#10B981" strokeWidth={2.5} />
            </div>

            <h2 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-h)', marginBottom: 6 }}>
              Account Created!
            </h2>
            <p style={{ fontSize: '13px', color: 'var(--text-2)', marginBottom: '1.75rem', lineHeight: 1.55 }}>
              Your driver account is ready. Share the code below with your fleet owner so they can add you.
            </p>

            <div style={{
              background: 'var(--bg)', border: '2px dashed rgba(16,185,129,0.4)',
              borderRadius: 10, padding: '1.25rem', marginBottom: '1.25rem',
            }}>
              <p style={{ fontSize: '11px', color: 'var(--text-3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>
                Your Driver Code
              </p>
              <p style={{
                fontFamily: 'monospace', fontSize: '2rem', fontWeight: 800,
                color: '#10B981', letterSpacing: '0.18em', marginBottom: 12,
              }}>
                {driverCode}
              </p>
              <button onClick={copyCode} style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                background: copied ? 'rgba(16,185,129,0.12)' : 'var(--bg-card)',
                border: '1px solid var(--border)',
                borderRadius: 7, padding: '6px 14px',
                fontSize: '12.5px', fontWeight: 600,
                color: copied ? '#10B981' : 'var(--text-2)',
                cursor: 'pointer', transition: 'all 0.15s ease',
              }}>
                {copied ? <><Check size={13} /> Copied!</> : <><Copy size={13} /> Copy Code</>}
              </button>
            </div>

            <div style={{
              background: 'rgba(245,158,11,0.07)', border: '1px solid rgba(245,158,11,0.25)',
              borderRadius: 8, padding: '10px 14px', marginBottom: '1.5rem',
              fontSize: '12px', color: 'var(--text-2)', lineHeight: 1.55, textAlign: 'left',
            }}>
              <strong style={{ color: 'var(--text)' }}>What's next:</strong> Give this code to your fleet owner. They'll enter it in the Drivers page to add you to the fleet.
            </div>

            <button onClick={() => navigate('/dashboard')} className="btn-primary" style={{ width: '100%', height: 42, fontSize: '14px', borderRadius: 8 }}>
              Go to Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem' }}>

      <button onClick={toggleDarkMode} style={{
        position: 'fixed', top: 16, right: 16,
        background: 'var(--bg-card)', border: '1px solid var(--border)',
        borderRadius: '50%', width: 34, height: 34,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        cursor: 'pointer', color: 'var(--text-2)',
      }}>
        {darkMode ? <Sun size={15} /> : <Moon size={15} />}
      </button>

      <div style={{ width: '100%', maxWidth: 420 }}>

        <div style={{ textAlign: 'center', marginBottom: '1.75rem' }}>
          <img src="/logo-badge.svg" alt="WOLTRA" style={{ width: 44, height: 44, display: 'inline-block', borderRadius: 10, marginBottom: '0.75rem' }} />
          <h1 style={{ fontFamily: '"Cabinet Grotesk", sans-serif', fontWeight: 800, fontSize: '1.5rem', color: 'var(--text-h)', letterSpacing: '-0.03em', marginBottom: 4 }}>
            Create an Account
          </h1>
          <p style={{ fontSize: '13px', color: 'var(--text-2)' }}>
            Choose your account type below.
          </p>
        </div>

        <div style={{
          background: 'var(--bg-card)', border: '1px solid var(--border)',
          borderRadius: 12, padding: '1.75rem', boxShadow: 'var(--shadow-modal)',
        }}>

          {/* Role selector */}
          <div style={{ display: 'flex', gap: 6, background: 'var(--bg)', borderRadius: 10, padding: 4, marginBottom: '1.25rem', border: '1px solid var(--border)' }}>
            {(['owner', 'driver']).map(r => (
              <button key={r} type="button" onClick={() => switchRole(r)} style={{
                flex: 1, padding: '11px 8px', borderRadius: 7, border: 'none',
                fontFamily: 'Satoshi, Inter, sans-serif', cursor: 'pointer',
                transition: 'all 0.2s ease',
                background: role === r ? (r === 'owner' ? '#0F2C4A' : 'var(--blue)') : 'transparent',
                color: role === r ? '#fff' : 'var(--text-3)',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5,
                boxShadow: role === r ? '0 2px 8px rgba(0,0,0,0.22)' : 'none',
              }}>
                {r === 'owner' ? <Building2 size={17} /> : <Truck size={17} />}
                <span style={{ fontSize: '12px', fontWeight: 700, lineHeight: 1 }}>
                  {r === 'owner' ? 'Owner' : 'Driver'}
                </span>
              </button>
            ))}
          </div>

          {(googleClientId || githubClientId) && (
            <>
              {role === 'owner' && googleClientId && (
                <div style={{ marginBottom: 10 }}>
                  <p style={{ fontSize: '12px', color: 'var(--text-2)', marginBottom: 6, lineHeight: 1.5 }}>
                    Enter your fleet short name first — it becomes your code prefix.
                  </p>
                  <div style={{ position: 'relative' }}>
                    <span style={{
                      position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)',
                      fontSize: '11px', fontWeight: 700, color: 'var(--text-3)', pointerEvents: 'none',
                      fontFamily: 'monospace', letterSpacing: '0.05em',
                    }}>#</span>
                    <input
                      type="text"
                      className="input-field"
                      placeholder="MYFLEET"
                      style={{ paddingLeft: 26, textTransform: 'uppercase', fontFamily: 'monospace', fontWeight: 700, letterSpacing: '0.08em' }}
                      value={pendingCompanyName}
                      onChange={e => setPendingCompanyName(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10))}
                      maxLength={10}
                    />
                  </div>
                </div>
              )}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: '1.25rem' }}>
                {googleClientId && <div id="google-register-btn" style={{ width: '100%', minHeight: 40 }} />}
                {githubClientId && (
                  <button type="button" onClick={handleGithubRegister} style={{
                    width: '100%', height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                    background: darkMode ? '#24292f' : '#f6f8fa',
                    border: `1px solid ${darkMode ? '#30363d' : '#d0d7de'}`,
                    borderRadius: 6, cursor: 'pointer', fontSize: '14px', fontWeight: 600,
                    color: darkMode ? '#c9d1d9' : '#24292f', fontFamily: 'inherit',
                    transition: 'background 0.15s ease',
                  }}
                    onMouseEnter={e => e.currentTarget.style.background = darkMode ? '#30363d' : '#eaeef2'}
                    onMouseLeave={e => e.currentTarget.style.background = darkMode ? '#24292f' : '#f6f8fa'}
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z" />
                    </svg>
                    Sign up with GitHub
                  </button>
                )}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: '1.25rem' }}>
                <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
                <span style={{ fontSize: '12px', color: 'var(--text-3)' }}>or create with email</span>
                <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
              </div>
            </>
          )}

          {error && (
            <div style={{
              marginBottom: '1rem', padding: '9px 12px',
              background: 'rgba(208,69,69,0.08)', border: '1px solid rgba(208,69,69,0.25)',
              borderRadius: 7, fontSize: '12.5px', color: 'var(--red)',
            }}>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>

            {/* Owner: company fields at top */}
            {role === 'owner' ? (
              <>
                <div>
                  <label className="label">Company Name</label>
                  <div style={{ position: 'relative' }}>
                    <Building2 size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-3)', pointerEvents: 'none' }} />
                    <input type="text" className="input-field" placeholder="Trucking Services"
                      style={{ paddingLeft: 32 }}
                      value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
                      required autoComplete="organization" />
                  </div>
                </div>

                <div>
                  <label className="label">
                    Short Name{' '}
                    <span style={{ color: 'var(--text-3)', fontWeight: 400 }}>— used in codes</span>
                  </label>
                  <div style={{ position: 'relative' }}>
                    <span style={{
                      position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)',
                      fontSize: '11px', fontWeight: 700, color: 'var(--text-3)', pointerEvents: 'none',
                      fontFamily: 'monospace', letterSpacing: '0.05em',
                    }}>#</span>
                    <input type="text" className="input-field" placeholder="FLEET CODE NAME"
                      style={{ paddingLeft: 26, textTransform: 'uppercase', fontFamily: 'monospace', letterSpacing: '0.08em', fontWeight: 700 }}
                      value={form.company_name}
                      onChange={e => setForm({ ...form, company_name: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10) })}
                      required
                      maxLength={10} />
                  </div>
                  <p style={{ fontSize: '11px', color: 'var(--text-3)', marginTop: 4 }}>
                    2–10 characters, letters and numbers only. This will prefix all codes in your fleet.
                  </p>
                </div>
              </>
            ) : (
              /* Driver: personal name */
              <div>
                <label className="label">Full Name</label>
                <div style={{ position: 'relative' }}>
                  <User size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-3)', pointerEvents: 'none' }} />
                  <input type="text" className="input-field" placeholder="Derwil Gonzales"
                    style={{ paddingLeft: 32 }}
                    value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
                    required autoComplete="name" />
                </div>
              </div>
            )}

            <div>
              <label className="label">Email address</label>
              <div style={{ position: 'relative' }}>
                <Mail size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-3)', pointerEvents: 'none' }} />
                <input type="email" className="input-field" placeholder="you@email.com"
                  style={{ paddingLeft: 32 }}
                  value={form.email} onChange={e => setForm({ ...form, email: e.target.value })}
                  required autoComplete="email" />
              </div>
            </div>

            <div>
              <label className="label">Phone <span style={{ color: 'var(--text-3)', fontWeight: 400 }}>(optional)</span></label>
              <div style={{ position: 'relative' }}>
                <Phone size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-3)', pointerEvents: 'none' }} />
                <input type="text" className="input-field" placeholder="+63 9xx xxx xxxx"
                  style={{ paddingLeft: 32 }}
                  value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })}
                  autoComplete="tel" />
              </div>
            </div>

            {/* Driver: license info */}
            {role === 'driver' && (
              <>
                <div style={{ height: 1, background: 'var(--border)', margin: '2px 0' }} />
                <p style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                  Driver License
                </p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <div>
                    <label className="label">License Number</label>
                    <div style={{ position: 'relative' }}>
                      <FileText size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-3)', pointerEvents: 'none' }} />
                      <input type="text" className="input-field" placeholder="N01-23-456789"
                        style={{ paddingLeft: 32 }}
                        value={form.license_number} onChange={e => setForm({ ...form, license_number: e.target.value })} />
                    </div>
                  </div>
                  <div>
                    <label className="label">Expiry Date</label>
                    <div style={{ position: 'relative' }}>
                      <Calendar size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-3)', pointerEvents: 'none' }} />
                      <input type="date" className="input-field"
                        style={{ paddingLeft: 32 }}
                        value={form.license_expiry} onChange={e => setForm({ ...form, license_expiry: e.target.value })} />
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* Password */}
            <div style={{ height: 1, background: 'var(--border)', margin: '2px 0' }} />

            <div>
              <label className="label">Password</label>
              <div style={{ position: 'relative' }}>
                <Lock size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-3)', pointerEvents: 'none' }} />
                <input type={showPassword ? 'text' : 'password'} className="input-field"
                  placeholder="Min. 8 characters" style={{ paddingLeft: 32, paddingRight: 36 }}
                  value={form.password} onChange={e => setForm({ ...form, password: e.target.value })}
                  required minLength={8} autoComplete="new-password" />
                <button type="button" onClick={() => setShowPwd(v => !v)} style={{
                  position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
                  background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)', display: 'flex', padding: 0,
                }}>
                  {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>

            <div>
              <label className="label">Confirm Password</label>
              <div style={{ position: 'relative' }}>
                <Lock size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-3)', pointerEvents: 'none' }} />
                <input type={showConfirm ? 'text' : 'password'} className="input-field"
                  placeholder="Repeat your password" style={{ paddingLeft: 32, paddingRight: 36 }}
                  value={form.confirmPassword} onChange={e => setForm({ ...form, confirmPassword: e.target.value })}
                  required autoComplete="new-password" />
                <button type="button" onClick={() => setShowConfirm(v => !v)} style={{
                  position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
                  background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)', display: 'flex', padding: 0,
                }}>
                  {showConfirm ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
              {form.confirmPassword && !pwdMatch && (
                <p style={{ fontSize: '11.5px', color: 'var(--red)', marginTop: 4 }}>Passwords do not match</p>
              )}
            </div>

            <button type="submit" className="btn-primary" disabled={loading || (form.confirmPassword && !pwdMatch)}
              style={{ width: '100%', marginTop: 4, height: 42, fontSize: '14px', borderRadius: 8, gap: 7 }}>
              {loading
                ? <div style={{ width: 16, height: 16, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.65s linear infinite' }} />
                : <><UserPlus size={15} />Create Account</>}
            </button>
          </form>
        </div>

        <p style={{ textAlign: 'center', marginTop: '1.25rem', fontSize: '13px', color: 'var(--text-3)' }}>
          Already have an account?{' '}
          <Link to="/login" style={{ color: 'var(--blue)', fontWeight: 600, textDecoration: 'none' }}>
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
