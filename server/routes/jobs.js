import { Router } from 'express';
import { PUBLIC_PROJECTION, toPublicJob } from '../lib/jobShape.js';
import { buildJobFilter, clampInt, decodeCursor, encodeCursor, keysetFilter, normalizeFilters, sortSpec } from '../lib/query.js';

const SOURCE_LABELS = { unstop: 'Unstop', lever: 'Lever', greenhouse: 'Greenhouse', ashby: 'Ashby', smartrecruiters: 'SmartRecruiters' };

const DEFAULT_PAGE_SIZE = 15;
const MAX_PAGE_SIZE = 50;
const EXPORT_LIMIT = 5000;

export function jobsRouter(db) {
  const jobs = db.collection('jobs');
  const router = Router();

  // One page of one board column (or of the whole result when `role` is
  // omitted). Cursor-based: send back meta.nextCursor as `before`.
  router.post('/search', async (req, res) => {
    const filters = normalizeFilters(req.body?.filters);
    const pageSize = clampInt(req.body?.pageSize, 1, MAX_PAGE_SIZE, DEFAULT_PAGE_SIZE);
    const role = typeof req.body?.role === 'string' ? req.body.role : undefined;
    const base = buildJobFilter(filters, { role });
    const query = req.body?.before ? { $and: [base, keysetFilter(filters.sort, decodeCursor(req.body.before, filters.sort))] } : base;

    const [docs, totalJobs, totalInternships] = await Promise.all([
      jobs.find(query, { projection: PUBLIC_PROJECTION }).sort(sortSpec(filters.sort)).limit(pageSize + 1).toArray(),
      jobs.countDocuments(base),
      jobs.countDocuments({ $and: [base, { jobType: 'Internship' }] }),
    ]);
    const hasMore = docs.length > pageSize;
    const page = docs.slice(0, pageSize);
    res.json({
      jobs: page.map(toPublicJob),
      meta: {
        nextCursor: hasMore ? encodeCursor(page[page.length - 1], filters.sort) : null,
        hasMore,
        totalJobs,
        totalInternships,
      },
    });
  });

  // Board summary for the current filters: overall total + one entry per
  // role column with its job and internship counts (largest first).
  router.post('/board', async (req, res) => {
    const base = buildJobFilter(normalizeFilters(req.body?.filters));
    const columns = await jobs
      .aggregate([
        { $match: base },
        {
          $group: {
            _id: '$role',
            total: { $sum: 1 },
            internships: { $sum: { $cond: [{ $eq: ['$jobType', 'Internship'] }, 1, 0] } },
          },
        },
        { $sort: { total: -1, _id: 1 } },
      ])
      .toArray();
    res.json({
      total: columns.reduce((n, c) => n + c.total, 0),
      columns: columns.map((c) => ({ role: c._id, total: c.total, internships: c.internships })),
    });
  });

  router.post('/export', async (req, res) => {
    const filters = normalizeFilters(req.body?.filters);
    const docs = await jobs
      .find(buildJobFilter(filters), { projection: PUBLIC_PROJECTION })
      .sort(sortSpec(filters.sort))
      .limit(EXPORT_LIMIT)
      .toArray();
    const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const header = ['Title', 'Company', 'Role', 'City', 'Type', 'Salary', 'Posted', 'Source', 'Apply URL'];
    const rows = docs.map((d) =>
      [
        d.title,
        d.company,
        d.role,
        [d.city, ...(d.otherCities || [])].join(' / '),
        d.jobType,
        d.salary,
        d.postedAt?.toISOString?.() ?? '',
        SOURCE_LABELS[d.source] || d.source,
        d.url,
      ]
        .map(esc)
        .join(',')
    );
    res
      .type('text/csv; charset=utf-8')
      .attachment(`fresher-jobs-${docs.length}.csv`)
      .send(`\ufeff${[header.map(esc).join(','), ...rows].join('\r\n')}`);
  });

  return router;
}
