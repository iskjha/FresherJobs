import axiosClient from './axiosClient';

const data = (r) => r.data;

export const jobsApi = {
  getMeta: () => axiosClient.get('meta').then(data),
  getFacets: () => axiosClient.get('facets').then(data),
  getEvaluation: () => axiosClient.get('evaluation').then(data),

  // { total, columns: [{ role, total, internships }] } for the current filters.
  getBoard: (filters, config) => axiosClient.post('jobs/board', { filters }, config).then(data),

  // One page of one column → { jobs, meta: { nextCursor, hasMore, totalJobs, totalInternships } }.
  // Pass meta.nextCursor back as `before` for the next page.
  searchJobs: ({ filters, role, pageSize, before }) =>
    axiosClient.post('jobs/search', { filters, role, pageSize, before }).then(data),

  exportCsv: (filters) => axiosClient.post('jobs/export', { filters }, { responseType: 'blob' }).then(data),
};
