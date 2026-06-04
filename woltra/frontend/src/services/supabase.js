import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
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

// ── Auth helpers ─────────────────────────────────────────────────────────────
export const auth = {
  // Returns { user, session } or throws
  async signIn(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    if (data.session?.access_token) setToken(data.session.access_token);
    return data;
  },

  // Returns { user, session, needsConfirmation }
  async signUp(email, password, name) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { name },
        emailRedirectTo: `${window.location.origin}/auth-callback`,
      },
    });
    if (error) throw error;
    if (data.session?.access_token) setToken(data.session.access_token);
    // No session = email confirmation required before first sign-in
    return { ...data, needsConfirmation: !data.session };
  },

  async resendVerification(email) {
    const { error } = await supabase.auth.resend({ type: 'signup', email });
    if (error) throw error;
  },

  // Verify a 6-digit email signup code (when Supabase email template uses {{ .Token }})
  async verifyEmailOtp(email, token) {
    const { data, error } = await supabase.auth.verifyOtp({ email, token, type: 'signup' });
    if (error) throw error;
    if (data.session?.access_token) setToken(data.session.access_token);
    return data;
  },

  async signInWithGoogle() {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth-callback`,
        queryParams: { access_type: 'offline', prompt: 'consent' },
      },
    });
    if (error) throw error;
  },

  async signInWithGitHub() {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'github',
      options: { redirectTo: `${window.location.origin}/auth-callback` },
    });
    if (error) throw error;
  },

  // Ensures the current session token is stored; returns the user or null
  async getCurrentUser() {
    const { data: sessionData } = await supabase.auth.getSession();
    const session = sessionData?.session;
    if (session?.access_token) setToken(session.access_token);
    return session?.user ?? null;
  },

  async resetPassword(email) {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth-callback`,
    });
    if (error) throw error;
  },

  async signOut() {
    clearToken();
    localStorage.removeItem('woltra_user');
    await supabase.auth.signOut();
  },
};
