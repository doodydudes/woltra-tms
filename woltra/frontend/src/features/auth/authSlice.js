import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { auth as insforgeAuth, getToken, clearToken } from '../../services/insforge';
import api from '../../services/api';

// ── Sign in with email/password ───────────────────────────────────────────────
export const login = createAsyncThunk('auth/login', async ({ email, password }, { rejectWithValue }) => {
  try {
    const { data, error } = await insforgeAuth.signIn(email, password);
    if (error) {
      if (error.statusCode === 403) return rejectWithValue('Email not verified. Check your inbox for a verification code.');
      return rejectWithValue(error.message || 'Invalid email or password');
    }
    if (!data) return rejectWithValue('Sign in failed');

    const profileRes = await api.get('/auth/profile');
    return profileRes.data.user;
  } catch (err) {
    return rejectWithValue(err.response?.data?.error || err.message || 'Login failed');
  }
});

// ── Start registration (email/password) ───────────────────────────────────────
export const register = createAsyncThunk('auth/register', async ({ email, password, name }, { rejectWithValue }) => {
  try {
    const { data, error } = await insforgeAuth.signUp(email, password, name);
    if (error) return rejectWithValue(error.message || 'Registration failed');
    return { requireEmailVerification: data?.requireEmailVerification ?? true, email };
  } catch (err) {
    return rejectWithValue(err.response?.data?.error || err.message || 'Registration failed');
  }
});

// ── Verify OTP + create app profile ──────────────────────────────────────────
export const verifyAndSetupProfile = createAsyncThunk(
  'auth/verifyAndSetupProfile',
  async ({ email, otp, profileData }, { rejectWithValue }) => {
    try {
      const { data, error } = await insforgeAuth.verifyEmail(email, otp);
      if (error) return rejectWithValue(error.message || 'Invalid verification code');
      if (!getToken()) return rejectWithValue('Verification succeeded but no session was returned');

      const profileRes = await api.post('/auth/setup-profile', profileData);
      return profileRes.data.user;
    } catch (err) {
      return rejectWithValue(err.response?.data?.error || err.message || 'Profile setup failed');
    }
  }
);

// ── OAuth callback — exchange code, fetch or request profile creation ─────────
export const oauthCallback = createAsyncThunk('auth/oauthCallback', async (_, { rejectWithValue }) => {
  try {
    const { data, error } = await insforgeAuth.getCurrentUser();
    if (error || !data?.user) return rejectWithValue('OAuth authentication failed');

    try {
      const profileRes = await api.get('/auth/profile');
      return { user: profileRes.data.user, needsProfile: false };
    } catch (profileErr) {
      if (profileErr.response?.status === 401) {
        return { user: null, needsProfile: true, insforgeUser: data.user };
      }
      throw profileErr;
    }
  } catch (err) {
    return rejectWithValue(err.response?.data?.error || err.message || 'OAuth failed');
  }
});

// ── Setup profile for OAuth users (called from AuthCallback) ──────────────────
export const setupOAuthProfile = createAsyncThunk(
  'auth/setupOAuthProfile',
  async (profileData, { rejectWithValue }) => {
    try {
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
      const { data } = await insforgeAuth.getCurrentUser();
      if (!data?.user || !getToken()) throw new Error('No session');
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
    loading: false,
    error: null,
    initialized: false,
  },
  reducers: {
    logout: (state) => {
      state.user = null;
      state.error = null;
      clearToken();
      localStorage.removeItem('woltra_user');
      insforgeAuth.signOut().catch(() => {});
    },
    clearError: (state) => { state.error = null; },
  },
  extraReducers: (builder) => {
    const pending = (state) => { state.loading = true; state.error = null; };
    const rejected = (state, action) => { state.loading = false; state.error = action.payload; };
    const setUser = (state, action) => {
      state.loading = false;
      state.user = action.payload;
      localStorage.setItem('woltra_user', JSON.stringify(action.payload));
    };

    builder
      .addCase(login.pending, pending)
      .addCase(login.fulfilled, setUser)
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
        if (action.payload.user) {
          state.user = action.payload.user;
          localStorage.setItem('woltra_user', JSON.stringify(action.payload.user));
        }
      })
      .addCase(oauthCallback.rejected, rejected)

      .addCase(setupOAuthProfile.pending, pending)
      .addCase(setupOAuthProfile.fulfilled, setUser)
      .addCase(setupOAuthProfile.rejected, rejected)

      .addCase(loadUser.fulfilled, (state, action) => {
        state.user = action.payload;
        state.initialized = true;
        localStorage.setItem('woltra_user', JSON.stringify(action.payload));
      })
      .addCase(loadUser.rejected, (state) => {
        state.user = null;
        state.initialized = true;
      });
  },
});

export const { logout, clearError } = authSlice.actions;
export default authSlice.reducer;
