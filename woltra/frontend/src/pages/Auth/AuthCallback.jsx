import { useEffect, useState } from 'react';
import { useDispatch } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { oauthLogin } from '../../features/auth/authSlice';
import LoadingSpinner from '../../components/common/LoadingSpinner';

export default function AuthCallback() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const [errorMsg, setErrorMsg] = useState(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const provider = params.get('provider') || 'github';
    const oauthError = params.get('error');
    const errorDesc = params.get('error_description');

    if (oauthError || !code) {
      setErrorMsg(errorDesc || oauthError || 'Authorization was cancelled or failed.');
      return;
    }

    dispatch(oauthLogin({ provider, code })).then(action => {
      if (action.meta.requestStatus === 'fulfilled') {
        navigate('/dashboard', { replace: true });
      } else {
        setErrorMsg(action.payload || 'Authentication failed. Please try again.');
      }
    });
  }, []);

  if (errorMsg) {
    return (
      <div style={{
        minHeight: '100vh', background: 'var(--bg)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem',
      }}>
        <div style={{ textAlign: 'center', maxWidth: 360 }}>
          <div style={{
            width: 56, height: 56, borderRadius: '50%',
            background: 'rgba(208,69,69,0.1)', border: '1px solid rgba(208,69,69,0.25)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem',
          }}>
            <span style={{ fontSize: '1.5rem' }}>✕</span>
          </div>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-h)', marginBottom: 8 }}>
            Sign-in failed
          </h2>
          <p style={{ fontSize: '13px', color: 'var(--text-2)', marginBottom: '1.25rem', lineHeight: 1.55 }}>
            {errorMsg}
          </p>
          <button
            onClick={() => navigate('/login')}
            className="btn-primary"
            style={{ minWidth: 140 }}
          >
            Back to Sign In
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      minHeight: '100vh', background: 'var(--bg)',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16,
    }}>
      <LoadingSpinner size="lg" />
      <p style={{ fontSize: '13px', color: 'var(--text-3)' }}>Completing sign-in…</p>
    </div>
  );
}
