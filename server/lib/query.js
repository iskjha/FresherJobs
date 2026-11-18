// Pure helpers that turn UI filters into MongoDB queries and implement
// cursor (keyset) pagination. No DB access here, so they are unit-tested.

const DAY_MS = 86_400_000;
const JOB_TYPES = ['all', 'Internship', 'Full-time'];
const POSTED_WITHIN = ['any', '1', '3', '7', '30'];

// Every sort ends with _id so the order (and therefore the cursor) is total.
export const SORTS = {
  newest: [
    ['postedAt', -1],
    ['_id', -1],
  ],
  oldest: [
    ['postedAt', 1],
    ['_id', 1],
  ],
  company: [
    ['companyKey', 1],
    ['postedAt', -1],
    ['_id', -1],
  ],
};

export class BadRequestError extends Error {
  status = 400;
}

const strList = (v, max = 50) =>
  Array.isArray(v) ? [...new Set(v.filter((x) => typeof x === 'string' && x.length <= 120))].slice(0, max) : [];
// List filters: null/absent = no filter (All); [] = nothing selected (None).
const listFilter = (v, max) => (v == null ? null : strList(v, max));

export function normalizeFilters(raw = {}) {
  const f = raw && typeof raw === 'object' ? raw : {};
  return {
    query: typeof f.query === 'string' ? f.query.slice(0, 200) : '',
    roles: listFilter(f.roles),
    cities: listFilter(f.cities, 200),
    sources: listFilter(f.sources),
    jobType: JOB_TYPES.includes(f.jobType) ? f.jobType : 'all',
    postedWithin: POSTED_WITHIN.includes(String(f.postedWithin)) ? String(f.postedWithin) : 'any',
    sort: Object.hasOwn(SORTS, f.sort) ? f.sort : 'newest',
  };
}

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export function buildJobFilter(filters, { role, now = new Date() } = {}) {
  const query = { active: true, isFresher: true };
  const and = [];
  // `$in: []` matches nothing, so an empty selection returns no jobs.
  if (filters.roles) query.role = { $in: filters.roles };
  if (role !== undefined) and.push({ role });
  if (filters.cities) query.cities = { $in: filters.cities };
  if (filters.sources) query.source = { $in: filters.sources };
  if (filters.jobType !== 'all') query.jobType = filters.jobType;
  if (filters.postedWithin !== 'any') {
    query.postedAt = { $gte: new Date(now.getTime() - Number(filters.postedWithin) * DAY_MS) };
  }
  // Every word must appear somewhere (title, company, role, city, snippet…).
  for (const token of filters.query.toLowerCase().split(/\s+/).filter(Boolean)) {
    and.push({ searchText: { $regex: escapeRegex(token) } });
  }
  if (and.length) query.$and = and;
  return query;
}

export const sortSpec = (sort) => Object.fromEntries(SORTS[sort]);

// Opaque cursor = base64url(JSON of the last document's sort-key values).
export function encodeCursor(doc, sort) {
  const values = SORTS[sort].map(([field]) => {
    const v = doc[field];
    return v instanceof Date ? { $date: v.toISOString() } : v;
  });
  return Buffer.from(JSON.stringify([sort, values])).toString('base64url');
}

export function decodeCursor(cursor, sort) {
  let parsed;
  try {
    parsed = JSON.parse(Buffer.from(String(cursor), 'base64url').toString('utf8'));
  } catch {
    throw new BadRequestError('Invalid cursor');
  }
  const [cursorSort, values] = Array.isArray(parsed) ? parsed : [];
  if (cursorSort !== sort || !Array.isArray(values) || values.length !== SORTS[sort].length) {
    throw new BadRequestError('Cursor does not match the requested sort');
  }
  return values.map((v) => (v && typeof v === 'object' && typeof v.$date === 'string' ? new Date(v.$date) : v));
}

// Documents strictly after `values` in the given sort order:
// (a > x) OR (a = x AND b > y) OR (a = x AND b = y AND c > z) …
export function keysetFilter(sort, values) {
  const spec = SORTS[sort];
  return {
    $or: spec.map(([field, dir], i) => {
      const cond = {};
      for (let k = 0; k < i; k++) cond[spec[k][0]] = values[k];
      cond[field] = { [dir === -1 ? '$lt' : '$gt']: values[i] };
      return cond;
    }),
  };
}

export const clampInt = (v, min, max, fallback) => {
  const n = Number.parseInt(v, 10);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
};
