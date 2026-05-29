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
    return insforge.auth.signInWithOAuth({
      provider,
      redirectTo: `${window.location.origin}/auth-callback`,
    });
  },

  async getCurrentUser() {
    const result = await insforge.auth.getCurrentUser();
    captureToken(result.data);
    return result;
  },

  async signOut() {
    clearToken();
    localStorage.removeItem('woltra_user');
    return insforge.auth.signOut();
  },
};

export default insforge;
