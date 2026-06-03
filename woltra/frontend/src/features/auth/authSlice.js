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

    try {
      const profileRes = await api.get('/auth/profile');
      return profileRes.data.user;
    } catch (profileErr) {
      // InsForge auth succeeded but no app profile yet — route to profile setup
      if (profileErr.response?.status === 401) {
        return { needsProfile: true };
      }
      throw profileErr;
    }
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

// ── OAuth callback — check if profile exists or needs setup ─────────────────────
export const oauthCallback = createAsyncThunk('auth/oauthCallback', async (_, { rejectWithValue }) => {
  try {
    // Check if user has a profile in our app (JWT must be in localStorage at this point)
    const profileRes = await api.get('/auth/profile');
    return { user: profileRes.data.user, needsProfile: false };
  } catch (profileErr) {
    if (profileErr.response?.status === 401) {
      // OAuth succeeded, but user needs to create their app profile
      return { user: null, needsProfile: true, insforgeUser: null };
    }
    return rejectWithValue(profileErr.response?.data?.error || 'Profile fetch failed');
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
    needsProfile: false,
  },
  reducers: {
    logout: (state) => {
      state.user = null;
      state.error = null;
      state.needsProfile = false;
      clearToken();
      localStorage.removeItem('woltra_user');
      insforgeAuth.signOut().catch(() => {});
    },
    clearError: (state) => { state.error = null; },
    clearNeedsProfile: (state) => { state.needsProfile = false; },
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
      .addCase(login.fulfilled, (state, action) => {
        state.loading = false;
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
        state.initialized = true;
        localStorage.setItem('woltra_user', JSON.stringify(action.payload));
      })
      .addCase(loadUser.rejected, (state) => {
        state.user = null;
        state.initialized = true;
      });
  },
});

export const { logout, clearError, clearNeedsProfile } = authSlice.actions;
export default authSlice.reducer;
