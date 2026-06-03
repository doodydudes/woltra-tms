import { createClient } from '@insforge/sdk';

const insforge = createClient({
  baseUrl: import.meta.env.VITE_INSFORGE_URL,
  anonKey: import.meta.env.VITE_INSFORGE_ANON_KEY,
});

// ── Token management ─────────────────────────────────────────────────────────
const TOKEN_KEY = 'woltra_token';

export function setToken(token) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

function captureToken(data) {
  if (data?.accessToken) setToken(data.accessToken);
}

// After OAuth, accessToken isn't in getCurrentUser() response —
// it lives in the SDK's internal tokenManager after the code exchange.
function captureFromSdk() {
  const token = insforge.tokenManager?.getAccessToken();
  if (token) setToken(token);
}

// ── Auth helpers ─────────────────────────────────────────────────────────────
export const auth = {
  async signIn(email, password) {
    const result = await insforge.auth.signInWithPassword({ email, password });
    captureToken(result.data);
    return result;
  },

  async signUp(email, password, name) {
    return insforge.auth.signUp({
      email,
      password,
      name,
      redirectTo: `${window.location.origin}/auth-callback`,
    });
  },

  async verifyEmail(email, otp) {
    const result = await insforge.auth.verifyEmail({ email, otp });
    captureToken(result.data);
    return result;
  },

  async resendVerification(email) {
    return insforge.auth.resendVerificationEmail({
      email,
      redirectTo: `${window.location.origin}/auth-callback`,
    });
  },

  async signInWithOAuth(provider) {
    // Redirect to Google OAuth, which redirects back to /auth-callback
    const redirectUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
      `client_id=${import.meta.env.VITE_GOOGLE_CLIENT_ID}&` +
      `redirect_uri=${window.location.origin}/auth-callback&` +
      `response_type=code&` +
      `scope=openid%20email%20profile`;
    window.location.href = redirectUrl;
  },

  async exchangeOAuthCodeWithBackend(code) {
    // Exchange Google code with backend for JWT token
    const apiUrl = import.meta.env.VITE_API_URL || 'https://woltra-api-0043bca8-5e26-4f7e-9f3a-c48e4e872065.fly.dev/api';
    const response = await fetch(`${apiUrl}/auth/google/callback`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code }),
    });
    if (!response.ok) {
      throw new Error('OAuth exchange failed');
    }
    const { token, user_id } = await response.json();
    setToken(token);
    return { token, user_id };
  },

  async getCurrentUser() {
    const result = await insforge.auth.getCurrentUser();
    captureToken(result.data);
    captureFromSdk(); // picks up token stored by OAuth code-exchange
    return result;
  },

  async signOut() {
    clearToken();
    localStorage.removeItem('woltra_user');
    return insforge.auth.signOut();
  },
};

export default insforge;
