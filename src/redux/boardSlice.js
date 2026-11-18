import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import { jobsApi } from '@api';

// Board summary (total + one entry per role column) for the current filters.
export const fetchBoard = createAsyncThunk('board/fetchSummary', ({ filters }) => jobsApi.getBoard(filters));

// Per-column cache for the jobs board (mirrors crm.dealsKanbanColumns):
// items, cursor, hasMore, loading — keyed by column (role). `key` is the
// filter signature; changing it clears every column so they refetch page 1.
const boardSlice = createSlice({
  name: 'board',
  initialState: { key: null, summary: { status: 'idle', total: 0, columns: [], error: null }, columns: {} },
  reducers: {
    resetBoard: (_state, { payload: key }) => ({
      key,
      summary: { status: 'idle', total: 0, columns: [], error: null },
      columns: {},
    }),
    columnRequested: (state, { payload: { key, column } }) => {
      if (key !== state.key) return;
      const prev = state.columns[column] || { items: [], cursor: null, hasMore: true, loaded: false };
      state.columns[column] = { ...prev, loading: true };
    },
    columnLoaded: (state, { payload: { key, column, items, nextCursor, hasMore, append } }) => {
      // Ignore responses that arrive after the filters changed.
      if (key !== state.key) return;
      const prev = append ? state.columns[column]?.items || [] : [];
      const seen = new Set(prev.map((j) => j.id));
      state.columns[column] = {
        items: [...prev, ...items.filter((j) => !seen.has(j.id))],
        cursor: nextCursor,
        hasMore: Boolean(nextCursor) && hasMore !== false,
        loading: false,
        loaded: true,
      };
    },
    columnFailed: (state, { payload: { key, column } }) => {
      if (key !== state.key || !state.columns[column]) return;
      Object.assign(state.columns[column], { loading: false, loaded: true, hasMore: false, cursor: null });
    },
  },
  extraReducers: (builder) => {
    const forCurrentKey = (state, action) => action.meta.arg.key === state.key;
    builder
      .addCase(fetchBoard.pending, (state, action) => {
        if (forCurrentKey(state, action)) state.summary = { ...state.summary, status: 'loading', error: null };
      })
      .addCase(fetchBoard.fulfilled, (state, action) => {
        if (forCurrentKey(state, action)) state.summary = { status: 'succeeded', error: null, ...action.payload };
      })
      .addCase(fetchBoard.rejected, (state, action) => {
        if (forCurrentKey(state, action)) state.summary = { ...state.summary, status: 'failed', error: action.error.message };
      });
  },
});

export const { resetBoard, columnRequested, columnLoaded, columnFailed } = boardSlice.actions;
export default boardSlice.reducer;
