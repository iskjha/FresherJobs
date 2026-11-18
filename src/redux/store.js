import { configureStore } from '@reduxjs/toolkit';
import jobsReducer from './jobsSlice';
import filtersReducer from './filtersSlice';
import boardReducer from './boardSlice';

export const store = configureStore({
  reducer: {
    jobs: jobsReducer,
    filters: filtersReducer,
    board: boardReducer,
  },
  // ~1k job objects are kept in state; skip the dev-only deep checks.
  middleware: (getDefault) => getDefault({ serializableCheck: false, immutableCheck: false }),
});
