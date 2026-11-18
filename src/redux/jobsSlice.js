import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import { jobsApi } from '@api';

// Overview data shared by every page: latest pipeline run (meta) and the
// unfiltered facet counts (tabs, filter options, Insights).
export const fetchJobsData = createAsyncThunk('jobs/fetchOverview', async () => {
  const [meta, facets] = await Promise.all([jobsApi.getMeta(), jobsApi.getFacets()]);
  return { meta, facets };
});

export const fetchEvaluation = createAsyncThunk('jobs/fetchEvaluation', () => jobsApi.getEvaluation());

const jobsSlice = createSlice({
  name: 'jobs',
  initialState: {
    meta: null,
    facets: null,
    status: 'idle',
    error: null,
    evaluation: null,
    evaluationStatus: 'idle',
    evaluationError: null,
  },
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchJobsData.pending, (state) => {
        state.status = 'loading';
        state.error = null;
      })
      .addCase(fetchJobsData.fulfilled, (state, { payload }) => {
        state.status = 'succeeded';
        state.meta = payload.meta;
        state.facets = payload.facets;
      })
      .addCase(fetchJobsData.rejected, (state, { error }) => {
        state.status = 'failed';
        state.error = error.message;
      })
      .addCase(fetchEvaluation.pending, (state) => {
        state.evaluationStatus = 'loading';
        state.evaluationError = null;
      })
      .addCase(fetchEvaluation.fulfilled, (state, { payload }) => {
        state.evaluationStatus = 'succeeded';
        state.evaluation = payload;
      })
      .addCase(fetchEvaluation.rejected, (state, { error }) => {
        state.evaluationStatus = 'failed';
        state.evaluationError = error.message;
      });
  },
});

export default jobsSlice.reducer;
