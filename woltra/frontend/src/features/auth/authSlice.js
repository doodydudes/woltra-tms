import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { auth as supabaseAuth, getToken, clearToken } from '../../services/supabase';
import api from '../../services/api';

// ── Sign in with email/password ───────────────────────────────────────────────
// expectedRole = the tab the user is signing in from ('owner' | 'driver').
// If the account's real role doesn't match, reject and sign out so they are
// never actually logged in under the wrong portal.
export const login = createAsyncThunk('auth/login', async ({ email, password, expectedRole }, { rejectWithValue }) => {
  try {
    await supabaseAuth.signIn(email, password);

    try {
      const profileRes = await api.get('/auth/profile');
      const user = profileRes.data.user;

      if (expectedRole && user.role && user.role !== expectedRole) {
        await supabaseAuth.signOut().catch(() => {});
        return rejectWithValue(
          user.role === 'owner'
            ? 'This account is registered as an Owner. Please use the Owner tab.'
            : 'This account is registered as a Driver. Please use the Driver tab.'
        );
      }

      return user;
    } catch (profileErr) {
      // A rejected role check above surfaces here only if it threw; re-throw others
      if (profileErr.response?.status === 401) {
        return { needsProfile: true };
      }
      throw profileErr;
    }
  } catch (err) {
    if (err.message?.toLowerCase().includes('email not confirmed')) {
      return rejectWithValue('Email not verified. Check your inbox for the confirmation link.');
    }
    return rejectWithValue(err.response?.data?.error || err.message || 'Invalid email or password');
  }
});

// ── Start registration (email/password) ───────────────────────────────────────
export const register = createAsyncThunk('auth/register', async ({ email, password, name }, { rejectWithValue }) => {
  try {
    const data = await supabaseAuth.signUp(email, password, name);
    // Always skip OTP — profile setup happens immediately after signup
    return { requireEmailVerification: false, email };
  } catch (err) {
    return rejectWithValue(err.response?.data?.error || err.message || 'Registration failed');
  }
});

// ── Create app profile (after signup or OAuth) ────────────────────────────────
export const verifyAndSetupProfile = createAsyncThunk(
  'auth/verifyAndSetupProfile',
  async ({ profileData }, { rejectWithValue }) => {
    try {
      if (!getToken()) return rejectWithValue('Please confirm your email, then sign in to finish setup.');
      const profileRes = await api.post('/auth/setup-profile', profileData);
      return profileRes.data.user;
    } catch (err) {
      return rejectWithValue(err.response?.data?.error || err.message || 'Profile setup failed');
    }
  }
);

// ── OAuth callback — check if profile exists or needs setup ─────────────────────
export const oauthCallback = createAsyncThunk('auth/oauthCallback', async (_, { rejectWithValue }) => {
  try {
    // Ensure the Supabase session token is stored before calling our API
    await supabaseAuth.getCurrentUser();
    if (!getToken()) return rejectWithValue('OAuth authentication failed');

    // Check if user has a profile in our app
    const profileRes = await api.get('/auth/profile');
    const user = profileRes.data.user;

    // Enforce that the account's role matches the tab the user signed in from
    const expectedRole = localStorage.getItem('woltra_oauth_role');
    if (expectedRole && user.role && user.role !== expectedRole) {
      await supabaseAuth.signOut().catch(() => {});
      localStorage.removeItem('woltra_oauth_role');
      return rejectWithValue(
        user.role === 'owner'
          ? 'This account is registered as an Owner. Please use the Owner tab.'
          : 'This account is registered as a Driver. Please use the Driver tab.'
      );
    }

    return { user, needsProfile: false };
  } catch (profileErr) {
    if (profileErr.response?.status === 401) {
      // OAuth succeeded, but user needs to create their app profile
      return { user: null, needsProfile: true };
    }
    return rejectWithValue(profileErr.response?.data?.error || profileErr.message || 'Profile fetch failed');
  }
});

// ── Setup profile for OAuth users (called from AuthCallback) ──────────────────
export const setupOAuthProfile = createAsyncThunk(
  'auth/setupOAuthProfile',
  async (profileData, { rejectWithValue }) => {
    try {
      // Ensure the Supabase session token is persisted before the API call,
      // otherwise the request has no auth header → "Access token required".
      if (!getToken()) await supabaseAuth.getCurrentUser();
      if (!getToken()) return rejectWithValue('Session expired — please sign in again.');
      const profileRes = await api.post('/auth/setup-profile', profileData);
      return profileRes.data.user;
    } catch (err) {
      return rejectWithValue(err.response?.data?.error || err.message || 'Profile setup failed');
    }
  }
);

// ── Rehydrate session on cold load ────────────────────────────────────────────
export const loadUser = createAsyncThunk('auth/loadUser', async (_, { rejectWithValue }) => {
  try {
    if (!getToken()) {
      const user = await supabaseAuth.getCurrentUser();
      if (!user || !getToken()) throw new Error('No session');
    }
    const profileRes = await api.get('/auth/profile');
    return profileRes.data.user;
  } catch {
    clearToken();
    return rejectWithValue('Session expired');
  }
});

// ── Slice ─────────────────────────────────────────────────────────────────────
const savedUser = (() => {
  try { return JSON.parse(localStorage.getItem('woltra_user')); } catch { return null; }
})();

const authSlice = createSlice({
  name: 'auth',
  initialState: {
    user: savedUser,
    token: getToken(),
    loading: false,
    error: null,
    initialized: false,
    needsProfile: false,
  },
  reducers: {
    logout: (state) => {
      state.user = null;
      state.token = null;
      state.error = null;
      state.needsProfile = false;
      clearToken();
      localStorage.removeItem('woltra_user');
      supabaseAuth.signOut().catch(() => {});
    },
    clearError: (state) => { state.error = null; },
    clearNeedsProfile: (state) => { state.needsProfile = false; },
  },
  extraReducers: (builder) => {
    const pending = (state) => { state.loading = true; state.error = null; };
    const rejected = (state, action) => { state.loading = false; state.error = action.payload; };
    const setUser = (state, action) => {
      state.loading = false;
      state.initialized = true;
      state.user = action.payload;
      state.token = getToken();
      localStorage.setItem('woltra_user', JSON.stringify(action.payload));
    };

    builder
      .addCase(login.pending, pending)
      .addCase(login.fulfilled, (state, action) => {
        state.loading = false;
        state.initialized = true;
        state.token = getToken();
        if (action.payload?.needsProfile) {
          state.needsProfile = true;
          return;
        }
        state.user = action.payload;
        localStorage.setItem('woltra_user', JSON.stringify(action.payload));
      })
      .addCase(login.rejected, rejected)

      .addCase(register.pending, pending)
      .addCase(register.fulfilled, (state) => { state.loading = false; })
      .addCase(register.rejected, rejected)

      .addCase(verifyAndSetupProfile.pending, pending)
      .addCase(verifyAndSetupProfile.fulfilled, setUser)
      .addCase(verifyAndSetupProfile.rejected, rejected)

      .addCase(oauthCallback.pending, pending)
      .addCase(oauthCallback.fulfilled, (state, action) => {
        state.loading = false;
        state.initialized = true;
        state.token = getToken();
        if (action.payload.user) {
          state.user = action.payload.user;
          localStorage.setItem('woltra_user', JSON.stringify(action.payload.user));
        }
        if (action.payload.needsProfile) {
          state.needsProfile = true;
        }
      })
      .addCase(oauthCallback.rejected, (state, action) => {
        state.loading = false;
        state.initialized = true;
        state.error = action.payload;
      })

      .addCase(setupOAuthProfile.pending, pending)
      .addCase(setupOAuthProfile.fulfilled, (state, action) => {
        state.loading = false;
        state.initialized = true;
        state.token = getToken();
        state.user = action.payload;
        localStorage.setItem('woltra_user', JSON.stringify(action.payload));
      })
      .addCase(setupOAuthProfile.rejected, (state, action) => {
        state.loading = false;
        state.initialized = true;
        state.error = action.payload;
      })

      .addCase(loadUser.fulfilled, (state, action) => {
        state.user = action.payload;
        state.token = getToken();
        state.initialized = true;
        localStorage.setItem('woltra_user', JSON.stringify(action.payload));
      })
      .addCase(loadUser.rejected, (state) => {
        state.user = null;
        state.token = null;
        state.initialized = true;
      });
  },
});

export const { logout, clearError, clearNeedsProfile } = authSlice.actions;
export default authSlice.reducer;
