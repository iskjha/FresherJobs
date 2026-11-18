import { createSlice } from '@reduxjs/toolkit';
import { DEFAULT_FILTERS } from '@modules/jobs/utils/filterJobs.js';

const toggle = (list, value) => {
  const cur = list ?? []; // from All, toggling picks just that value (Insights drill-down)
  return cur.includes(value) ? cur.filter((v) => v !== value) : [...cur, value];
};

const filtersSlice = createSlice({
  name: 'filters',
  initialState: { ...DEFAULT_FILTERS, visibleCount: 0 },
  reducers: {
    setQuery: (s, a) => ({ ...s, query: a.payload, visibleCount: 0 }),
    toggleRole: (s, a) => ({ ...s, roles: toggle(s.roles, a.payload), visibleCount: 0 }),
    toggleCity: (s, a) => ({ ...s, cities: toggle(s.cities, a.payload), visibleCount: 0 }),
    toggleSource: (s, a) => ({ ...s, sources: toggle(s.sources, a.payload), visibleCount: 0 }),
    setRoles: (s, a) => ({ ...s, roles: a.payload, visibleCount: 0 }),
    setCities: (s, a) => ({ ...s, cities: a.payload, visibleCount: 0 }),
    setSources: (s, a) => ({ ...s, sources: a.payload, visibleCount: 0 }),
    setJobType: (s, a) => ({ ...s, jobType: a.payload, visibleCount: 0 }),
    setPostedWithin: (s, a) => ({ ...s, postedWithin: a.payload, visibleCount: 0 }),
    setSort: (s, a) => ({ ...s, sort: a.payload, visibleCount: 0 }),
    showMore: (s, a) => ({ ...s, visibleCount: s.visibleCount + a.payload }),
    hydrateFilters: (s, a) => ({ ...s, ...a.payload, visibleCount: 0 }),
    resetFilters: () => ({ ...DEFAULT_FILTERS, visibleCount: 0 }),
  },
});

export const {
  setQuery,
  toggleRole,
  toggleCity,
  toggleSource,
  setRoles,
  setCities,
  setSources,
  setJobType,
  setPostedWithin,
  setSort,
  showMore,
  hydrateFilters,
  resetFilters,
} = filtersSlice.actions;

export const selectFilters = (state) => state.filters;

const EMPTY_FACETS = Object.freeze({ roles: [], cities: [], sources: [], jobTypes: [], companies: 0, total: 0 });
// Unfiltered option counts, loaded from GET /api/facets.
export const selectFacets = (state) => state.jobs.facets || EMPTY_FACETS;

// Filters as sent to the API (UI-only fields removed).
export const toApiFilters = ({ query, roles, cities, sources, jobType, postedWithin, sort }) => ({
  query,
  roles,
  cities,
  sources,
  jobType,
  postedWithin,
  sort,
});

export default filtersSlice.reducer;
