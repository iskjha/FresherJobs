import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildJobFilter, decodeCursor, encodeCursor, keysetFilter, normalizeFilters } from './query.js';

test('normalizeFilters drops unknown values and non-string list items', () => {
  const f = normalizeFilters({ roles: ['Marketing', 5, { $ne: 1 }], jobType: 'Boss', postedWithin: 999, sort: '__proto__', query: 42 });
  assert.deepEqual(f, { query: '', roles: ['Marketing'], cities: null, sources: null, jobType: 'all', postedWithin: 'any', sort: 'newest' });
});

test('absent list filter means All; an empty list means None (matches nothing)', () => {
  assert.equal(buildJobFilter(normalizeFilters({})).role, undefined);
  assert.deepEqual(buildJobFilter(normalizeFilters({ roles: [] })).role, { $in: [] });
});

test('buildJobFilter maps filters to an indexed query; search tokens are regex-escaped', () => {
  const now = new Date('2026-11-16T00:00:00Z');
  const q = buildJobFilter(normalizeFilters({ roles: ['Marketing'], cities: ['Pune'], jobType: 'Internship', postedWithin: '7', query: 'c++ Pune' }), {
    role: 'Marketing',
    now,
  });
  assert.equal(q.active, true);
  assert.equal(q.isFresher, true);
  assert.deepEqual(q.role, { $in: ['Marketing'] });
  assert.deepEqual(q.cities, { $in: ['Pune'] });
  assert.equal(q.jobType, 'Internship');
  assert.deepEqual(q.postedAt, { $gte: new Date('2026-11-09T00:00:00Z') });
  assert.deepEqual(q.$and, [{ role: 'Marketing' }, { searchText: { $regex: 'c\\+\\+' } }, { searchText: { $regex: 'pune' } }]);
});

test('cursor round-trips dates and is rejected for a different sort or garbage', () => {
  const doc = { postedAt: new Date('2026-11-01T10:00:00Z'), _id: 'unstop:1', companyKey: 'acme' };
  const cursor = encodeCursor(doc, 'newest');
  assert.deepEqual(decodeCursor(cursor, 'newest'), [doc.postedAt, 'unstop:1']);
  assert.throws(() => decodeCursor(cursor, 'company'), { status: 400 });
  assert.throws(() => decodeCursor('%%%', 'newest'), { status: 400 });
});

test('keysetFilter selects rows strictly after the cursor for mixed sort directions', () => {
  const d = new Date('2026-11-01T00:00:00Z');
  assert.deepEqual(keysetFilter('company', ['acme', d, 'x']), {
    $or: [{ companyKey: { $gt: 'acme' } }, { companyKey: 'acme', postedAt: { $lt: d } }, { companyKey: 'acme', postedAt: d, _id: { $lt: 'x' } }],
  });
});
