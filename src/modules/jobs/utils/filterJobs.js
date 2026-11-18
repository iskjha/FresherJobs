// Filter defaults and URL <-> filters helpers (filtering itself happens in the
// API). No React/Redux/alias imports so they can be tested with `node --test`.
//
// List filters (roles, cities, sources) have three states:
//   null      → All (no filter; omitted from the URL)
//   []        → None (nothing selected; API returns no jobs; `roles=` in URL)
//   ['a', …]  → only those values

export const DEFAULT_FILTERS = Object.freeze({
  query: '',
  roles: null,
  cities: null,
  sources: null,
  jobType: 'all',
  postedWithin: 'any',
  sort: 'newest',
});

const LIST_KEYS = ['roles', 'cities', 'sources'];
const SCALAR_KEYS = { q: 'query', type: 'jobType', posted: 'postedWithin', sort: 'sort' };

export function filtersToParams(filters) {
  const params = new URLSearchParams();
  for (const [param, key] of Object.entries(SCALAR_KEYS)) {
    if (filters[key] && filters[key] !== DEFAULT_FILTERS[key]) params.set(param, filters[key]);
  }
  for (const key of LIST_KEYS) {
    if (Array.isArray(filters[key])) params.set(key, filters[key].join('|'));
  }
  return params;
}

export function paramsToFilters(params) {
  const out = {};
  for (const [param, key] of Object.entries(SCALAR_KEYS)) {
    if (params.has(param)) out[key] = params.get(param);
  }
  for (const key of LIST_KEYS) {
    if (params.has(key)) out[key] = params.get(key).split('|').filter(Boolean);
  }
  return out;
}

// Number of active list selections (None counts as one active filter).
export const listFilterCount = (list) => (list == null ? 0 : Math.max(list.length, 1));
