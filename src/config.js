// All data comes from the Express + MongoDB API. In dev, Vite proxies /api to
// the API server (vite.config.js); in production Express serves both. Set
// VITE_API_BASE_URL when the frontend is hosted separately.
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

// Optional link to the source repository, shown in the sidebar.
export const REPO_URL = import.meta.env.VITE_REPO_URL || '';

// Board columns load this many jobs per request (cursor-based infinite scroll).
export const COLUMN_PAGE_SIZE = 15;

export const POSTED_WITHIN_OPTIONS = [
  { value: 'any', label: 'Any time' },
  { value: '1', label: 'Last 24 hours' },
  { value: '3', label: 'Last 3 days' },
  { value: '7', label: 'Last 7 days' },
  { value: '30', label: 'Last 30 days' },
];

export const SORT_OPTIONS = [
  { value: 'newest', label: 'Newest first' },
  { value: 'oldest', label: 'Oldest first' },
  { value: 'company', label: 'Company A–Z' },
];

export const SOURCE_LABELS = {
  unstop: 'Unstop',
  lever: 'Lever',
  greenhouse: 'Greenhouse',
  ashby: 'Ashby',
  smartrecruiters: 'SmartRecruiters',
};
