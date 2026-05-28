import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '../../services/api';

export const fetchNotifications = createAsyncThunk('notifications/fetch', async () => {
  const response = await api.get('/notifications?limit=5');
  return response.data;
});

export const markAllRead = createAsyncThunk('notifications/markAllRead', async () => {
  await api.put('/notifications/mark-all-read');
});

const notificationSlice = createSlice({
  name: 'notifications',
  initialState: {
    items: [],
    unread_count: 0,
    loading: false
  },
  reducers: {
    decrementUnread: (state) => {
      if (state.unread_count > 0) state.unread_count--;
    }
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchNotifications.pending, (state) => { state.loading = true; })
      .addCase(fetchNotifications.fulfilled, (state, action) => {
        state.loading = false;
        state.items = action.payload.data;
        state.unread_count = action.payload.unread_count;
      })
      .addCase(fetchNotifications.rejected, (state) => { state.loading = false; })
      .addCase(markAllRead.fulfilled, (state) => { state.unread_count = 0; });
  }
});

export const { decrementUnread } = notificationSlice.actions;
export default notificationSlice.reducer;
