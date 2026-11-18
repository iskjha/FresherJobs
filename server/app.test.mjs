// Integration test against a real MongoDB (a throwaway database that is
// dropped afterwards). Skipped when no server is reachable.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { MongoClient } from 'mongodb';
import { ensureIndexes } from './db.js';
import { createApp } from './app.js';
import { saveJobs } from '../pipeline/lib/store.js';

const baseUri = process.env.TEST_MONGODB_URI || 'mongodb://127.0.0.1:27017';
let client;
let db;
let server;
let api;
let skip = false;

before(async () => {
  client = new MongoClient(baseUri, { serverSelectionTimeoutMS: 2000 });
  try {
    await client.connect();
  } catch {
    skip = 'MongoDB not reachable';
    return;
  }
  db = client.db(`fresher_jobs_test_${randomUUID().replace(/-/g, '')}`);
  await ensureIndexes(db);
  const base = Date.parse('2026-11-01T00:00:00Z');
  // 40 live jobs: 33 Marketing (some sharing a postedAt to exercise the _id
  // tie-break), 7 Sales; plus a closed job and a non-fresher that must be hidden.
  const docs = Array.from({ length: 40 }, (_, i) => ({
    _id: `t:${String(i).padStart(2, '0')}`,
    title: `Job ${i}`,
    company: `Co ${i % 5}`,
    companyKey: `co ${i % 5}`,
    role: i < 33 ? 'Marketing' : 'Sales & Business Development',
    city: i % 2 ? 'Pune' : 'Remote',
    otherCities: [],
    cities: [i % 2 ? 'Pune' : 'Remote'],
    jobType: i % 3 ? 'Internship' : 'Full-time',
    source: 'unstop',
    url: `https://x/${i}`,
    postedAt: new Date(base + Math.floor(i / 2) * 3_600_000),
    searchText: `job ${i} co ${i % 5}`,
    active: true,
    isFresher: true,
  }));
  docs.push({ ...docs[0], _id: 't:closed', active: false }, { ...docs[0], _id: 't:senior', isFresher: false });
  await db.collection('jobs').insertMany(docs);
  await db.collection('runs').insertOne({ generatedAt: new Date(), counts: { published: 40 }, sources: [] });

  server = createApp({ db }).listen(0);
  api = `http://127.0.0.1:${server.address().port}/api`;
});

after(async () => {
  server?.close();
  if (db) await db.dropDatabase();
  await client?.close();
});

const post = async (path, body) => {
  const res = await fetch(api + path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  return { status: res.status, body: await res.json() };
};

test('board summary groups live jobs by role, largest first', async (t) => {
  if (skip) return t.skip(skip);
  const { body } = await post('/jobs/board', { filters: {} });
  assert.equal(body.total, 40);
  assert.deepEqual(
    body.columns.map((c) => [c.role, c.total]),
    [
      ['Marketing', 33],
      ['Sales & Business Development', 7],
    ]
  );
});

for (const sort of ['newest', 'oldest', 'company']) {
  test(`cursor pagination (${sort}) returns every job exactly once, in order`, async (t) => {
    if (skip) return t.skip(skip);
    const seen = [];
    let before;
    let pages = 0;
    do {
      const { status, body } = await post('/jobs/search', { filters: { sort }, role: 'Marketing', pageSize: 15, before });
      assert.equal(status, 200);
      assert.equal(body.meta.totalJobs, 33);
      seen.push(...body.jobs);
      before = body.meta.nextCursor;
      pages++;
    } while (before);
    assert.equal(pages, 3);
    assert.equal(new Set(seen.map((j) => j.id)).size, 33);
    const key = (j) => (sort === 'company' ? `${j.company.toLowerCase()}` : j.postedAt);
    for (let i = 1; i < seen.length; i++) {
      const cmp = key(seen[i - 1]).localeCompare(key(seen[i]));
      assert.ok(sort === 'newest' ? cmp >= 0 : cmp <= 0, `out of order at ${i}`);
    }
  });
}

test('filters and search narrow results; closed/non-fresher jobs never appear', async (t) => {
  if (skip) return t.skip(skip);
  // Every word must appear (substring match): "job 13" → only Job 13.
  const { body } = await post('/jobs/search', { filters: { cities: ['Pune'], jobType: 'Internship', query: 'JOB 13' }, pageSize: 50 });
  assert.deepEqual(
    body.jobs.map((j) => [j.title, j.city, j.jobType]),
    [['Job 13', 'Pune', 'Internship']]
  );
  const all = await post('/jobs/search', { filters: {}, pageSize: 50 });
  assert.ok(!all.body.jobs.some((j) => j.id === 't:closed' || j.id === 't:senior'));
});

test('invalid cursor is a 400, not a 500', async (t) => {
  if (skip) return t.skip(skip);
  const { status } = await post('/jobs/search', { filters: {}, before: 'not-a-cursor' });
  assert.equal(status, 400);
});

test('historical evaluation reports missing current predictions without changing recorded scores', async (t) => {
  if (skip) return t.skip(skip);
  await db.collection('evaluations').insertOne({
    evaluatedAt: new Date(), reportType: 'historical', sampleSize: 50,
    sampleIds: Array.from({ length: 50 }, (_, i) => `t:${String(i).padStart(2, '0')}`),
    accuracy: { role: 96, city: 100 },
  });
  const res = await fetch(api + '/evaluation');
  assert.equal(res.status, 200);
  const result = await res.json();
  assert.deepEqual(result.accuracy, { role: 96, city: 100 });
  assert.equal(result.reportType, 'historical');
  assert.deepEqual(result.coverage, { sampleSize: 50, currentPredictions: 40, missingPredictions: 10, canRescore: false });
  assert.equal(result.sampleIds, undefined);
});
test('saving a run preserves failed boards and clears closedAt on reopened jobs', async (t) => {
  if (skip) return t.skip(skip);
  const jobs = db.collection('store_cases');
  const old = new Date('2026-11-01');
  const now = new Date('2026-11-02');
  await jobs.insertMany([
    { _id: 'vanished', source: 'lever', board: 'ok', active: true, lastSeenAt: old },
    { _id: 'outage', source: 'unstop', board: 'jobs', active: true, lastSeenAt: old },
    { _id: 'unqueried', source: 'lever', board: 'other', active: true, lastSeenAt: old },
    { _id: 'reopened', source: 'lever', board: 'ok', active: false, lastSeenAt: old, closedAt: old },
  ]);
  const posts = [{
    sourceId: 'reopened', source: 'lever', board: 'ok', title: 'Engineer', company: 'Acme',
    tags: { role: 'Software Engineering', city: 'Pune', otherCities: [], isFresher: true, jobType: 'Full-time' },
  }];
  const storeDb = { collection: () => jobs };
  const result = await saveJobs(storeDb, posts, {}, now, [
    { source: 'lever', board: 'ok', ok: true },
    { source: 'unstop', board: 'jobs', ok: false },
  ]);
  assert.equal(result.closed, 1);
  assert.equal((await jobs.findOne({ _id: 'vanished' })).active, false);
  assert.equal((await jobs.findOne({ _id: 'outage' })).active, true);
  assert.equal((await jobs.findOne({ _id: 'unqueried' })).active, true);
  const reopened = await jobs.findOne({ _id: 'reopened' });
  assert.equal(reopened.active, true);
  assert.equal(reopened.closedAt, undefined);
  const withoutSourceHealth = await saveJobs(storeDb, [], {}, new Date('2026-11-03'));
  assert.equal(withoutSourceHealth.closed, 0);
});
