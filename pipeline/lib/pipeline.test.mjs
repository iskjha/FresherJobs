import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dedupe } from './dedupe.js';
import { isFresherCandidate, isIndiaPost, minYearsRequired } from './filters.js';
import { contentHash, costUsd, tagPosts, validateTag } from './tagger.js';
import { publishMinimum } from '../run.js';
import { getEnabledSources } from '../sources.config.js';
import { fetchAshby } from '../sources/ashby.js';
import { fetchGreenhouse } from '../sources/greenhouse.js';
import { fetchUnstop } from '../sources/unstop.js';
import { fetchSmartRecruiters, hydrateSmartRecruiters } from '../sources/smartrecruiters.js';

const post = (over) => ({ sourceId: Math.random().toString(36), company: 'Acme', title: 'SDE Intern', location: 'Bengaluru', url: '', postedAt: '2026-11-01', ...over });

test('dedupe drops same URL, exact reposts and near-identical titles, keeping the newest', () => {
  const posts = [
    post({ sourceId: '1', url: 'https://x/1', postedAt: '2026-11-01' }),
    post({ sourceId: '2', url: 'https://x/1?utm=a', title: 'Other', postedAt: '2026-10-01' }),
    post({ sourceId: '3', company: 'Acme Pvt Ltd', location: 'Bangalore, India', postedAt: '2026-11-05' }),
    post({ sourceId: '4', title: 'SDE Intern (2026)', company: 'Acme', postedAt: '2026-09-01' }),
    post({ sourceId: '5', title: 'SDE Intern', location: 'Pune' }),
    post({ sourceId: '6', title: 'Backend SDE Intern Payments', company: 'Acme' }),
  ];
  const { kept, removed } = dedupe(posts);
  assert.deepEqual(kept.map((p) => p.sourceId).sort(), ['3', '5', '6']);
  assert.equal(removed.length, 3);
});

test('fresher prefilter: intern titles pass, senior titles and 3+ years fail', () => {
  assert.equal(isFresherCandidate(post({ title: 'Senior Intern Program Manager' })), true);
  assert.equal(isFresherCandidate(post({ title: 'Senior Software Engineer' })), false);
  assert.equal(isFresherCandidate(post({ title: 'Associate Engineer', description: 'Requires 4-6 years of experience' })), false);
  assert.equal(isFresherCandidate(post({ title: 'Sales Executive', description: 'Freshers are welcome' })), true);
  assert.equal(minYearsRequired('We need 2+ years of work experience and 5 years of age'), 2);
});

test('India detection uses country codes and Indian city names', () => {
  assert.equal(isIndiaPost({ location: 'Gurugram, Haryana' }), true);
  assert.equal(isIndiaPost({ location: 'London', countryHint: 'IN' }), true);
  assert.equal(isIndiaPost({ location: 'Indianapolis, US' }), false);
});

test('work-from-home posts are tagged Remote even if the LLM picks the listed city', () => {
  const tag = validateTag({ role: 'Marketing', city: 'Gurgaon', other_cities: [], is_fresher: true }, { title: 'Sales Intern', remote: true });
  assert.equal(tag.city, 'Remote');
  assert.deepEqual(tag.otherCities, ['Gurugram']);
  assert.equal(tag.jobType, 'Internship');
});

test('unknown roles from the LLM fall back to Other', () => {
  assert.equal(validateTag({ role: 'Astronaut', city: 'Pune' }, { title: 'X' }).role, 'Other');
});

test('publication minimum cannot silently fall below the required 200 posts', () => {
  assert.equal(publishMinimum(200), 200);
  assert.equal(publishMinimum('250'), 250);
  for (const value of [100, 0, '', 'not-a-number', 200.5]) {
    assert.throws(() => publishMinimum(value), /at least 200/);
  }
});

test('collection requires an explicit allowlist of configured source boards', () => {
  assert.throws(() => getEnabledSources(''), /must list reviewed/);
  assert.deepEqual(getEnabledSources('unstop/internships, lever/cred'), [
    { source: 'unstop', board: 'internships' },
    { source: 'lever', board: 'cred' },
  ]);
  assert.throws(() => getEnabledSources('unstop/unknown'), /Unknown source\/board/);
  assert.throws(() => getEnabledSources('unstop/jobs,unstop/jobs'), /duplicate/);
});

const llm = { model: 'test-model', baseUrl: 'https://llm.invalid', apiKey: 'test-only' };
const rawTag = (id) => ({
  id, role: 'Software Engineering', city: 'Pune', other_cities: [],
  job_type: 'Internship', is_fresher: true, min_experience_years: 0,
});
const llmResponse = (results, cachedTokens = 0) => new Response(JSON.stringify({
  choices: [{ message: { content: JSON.stringify({ results }) } }],
  usage: { prompt_tokens: 100, completion_tokens: 20, prompt_tokens_details: { cached_tokens: cachedTokens } },
}), { status: 200 });

test('missing LLM posts are retried and cached tokens from the retry count toward cost', async (t) => {
  let calls = 0;
  t.mock.method(globalThis, 'fetch', async () => ++calls === 1
    ? llmResponse([rawTag('a')], 10)
    : llmResponse([rawTag('b')], 30));
  const posts = [post({ sourceId: 'a' }), post({ sourceId: 'b' })];
  const cache = {};
  const usage = await tagPosts(posts, cache, llm, () => {});
  assert.equal(calls, 2);
  assert.equal(usage.cachedTokens, 40);
  assert.equal(usage.postsTagged, 2);
  assert.equal(costUsd(usage, { input: 2, cachedInput: 0.5, output: 10 }), 0.00074);
  assert.ok(posts.every((p) => p.tags.tagger === llm.model));
  assert.deepEqual(Object.keys(cache).sort(), ['a', 'b']);
});

test('incomplete LLM results fail rather than publishing fallback tags', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => llmResponse([{ ...rawTag('a'), is_fresher: 'false' }]));
  const posts = [post({ sourceId: 'a' })];
  const cache = { a: { hash: contentHash(posts[0], llm.model), raw: { id: 'a' } } };
  await assert.rejects(tagPosts(posts, cache, llm, () => {}), /invalid tags.*after retry/);
  assert.equal(posts[0].tags, undefined);
  assert.deepEqual(cache.a.raw, { id: 'a' });
});

test('malformed LLM JSON is an explicit pipeline error', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => new Response(JSON.stringify({
    choices: [{ message: { content: '{broken' } }],
  })));
  await assert.rejects(tagPosts([post({ sourceId: 'a' })], {}, llm, () => {}), /invalid JSON/);
});

test('changes to any LLM post input invalidate the cached prediction', async (t) => {
  const original = post({
    sourceId: 'cache-input', title: 'Graduate Engineer', location: 'Pune',
    company: 'Acme', employmentType: 'Full-time', department: 'Engineering',
    description: `Overview.\n${'x'.repeat(2200)}\nRequires 1 year of experience.`,
  });
  const variants = {
    company: { company: 'Another company' },
    employment: { employmentType: 'Internship' },
    department: { department: 'Data Science' },
    experience: { description: original.description.replace('1 year', '3 years') },
  };
  for (const [name, changes] of Object.entries(variants)) {
    await t.test(name, async (t) => {
      let calls = 0;
      t.mock.method(globalThis, 'fetch', async (_url, options) => {
        calls++;
        const [input] = JSON.parse(JSON.parse(options.body).messages[1].content);
        assert.equal(input.company, changes.company || original.company);
        assert.equal(input.employment_type, changes.employmentType || original.employmentType);
        assert.equal(input.department, changes.department || original.department);
        if (name === 'experience') assert.match(input.description, /3 years of experience/);
        return llmResponse([rawTag(original.sourceId)]);
      });
      const stale = { ...rawTag(original.sourceId), job_type: 'Full-time', is_fresher: false };
      const cache = { [original.sourceId]: { hash: contentHash(original, llm.model), raw: stale } };
      const changed = { ...original, ...changes };
      const usage = await tagPosts([changed], cache, llm, () => {});
      assert.equal(calls, 1);
      assert.equal(usage.cacheHits, 0);
      assert.equal(usage.postsTagged, 1);
      assert.equal(changed.tags.jobType, 'Internship');
      assert.notEqual(cache[original.sourceId].hash, contentHash(original, llm.model));
    });
  }
});

test('unchanged LLM input reuses its cache while structured remote rules reapply', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => { throw new Error('Unchanged input must not call the LLM'); });
  const original = post({ sourceId: 'same-input', title: 'Engineer', description: 'Overview.' });
  const cache = { [original.sourceId]: { hash: contentHash(original, llm.model), raw: rawTag(original.sourceId) } };
  const updated = { ...original, remote: true };
  const usage = await tagPosts([updated], cache, llm, () => {});
  assert.equal(usage.cacheHits, 1);
  assert.equal(usage.calls, 0);
  assert.equal(updated.tags.city, 'Remote');
});

test('Unstop requires location evidence for India, including remote posts', async (t) => {
  const data = [
    { id: 1, jobDetail: { locations: ['Pune'] } },
    { id: 2, jobDetail: { locations: ['London'] } },
    { id: 3, jobDetail: { locations: ['London'], type: 'wfh' } },
    { id: 4, jobDetail: { locations: [], type: 'wfh' } },
    { id: 5, jobDetail: { locations: ['Bengaluru'], type: 'wfh' } },
    { id: 6, jobDetail: { locations: ['India'], type: 'wfh' } },
  ].map((p) => ({ title: 'Engineering Internship', ...p }));
  t.mock.method(globalThis, 'fetch', async () => new Response(JSON.stringify({ data: { last_page: 1, data } })));
  const posts = await fetchUnstop('internships');
  assert.deepEqual(posts.filter(isIndiaPost).map((p) => p.sourceId), ['unstop:1', 'unstop:5', 'unstop:6']);
  assert.equal(posts[3].location, 'Remote');
  assert.equal(posts[4].remote, true);
});

const smartPage = (offset, length = 100) => Array.from({ length }, (_, i) => ({
  id: offset + i, name: 'Engineer', location: { city: 'Pune', country: 'in' },
}));

test('SmartRecruiters collects a complete feed at the 2,000-post limit', async (t) => {
  let calls = 0;
  t.mock.method(globalThis, 'fetch', async (url) => {
    calls++;
    const offset = Number(new URL(url).searchParams.get('offset'));
    return new Response(JSON.stringify({ totalFound: 2000, content: smartPage(offset) }));
  });
  const posts = await fetchSmartRecruiters('test');
  assert.equal(posts.length, 2000);
  assert.equal(new Set(posts.map((p) => p.sourceId)).size, 2000);
  assert.equal(calls, 20);
});

test('SmartRecruiters accepts a short final page when all reported posts were collected', async (t) => {
  t.mock.method(globalThis, 'fetch', async (url) => {
    const offset = Number(new URL(url).searchParams.get('offset'));
    return new Response(JSON.stringify({ totalFound: 101, content: smartPage(offset, offset === 0 ? 100 : 1) }));
  });
  const posts = await fetchSmartRecruiters('test');
  assert.equal(posts.length, 101);
  assert.equal(posts.at(-1).sourceId, 'smartrecruiters:test:100');
});

test('SmartRecruiters rejects a feed above its cap instead of reporting partial success', async (t) => {
  let calls = 0;
  t.mock.method(globalThis, 'fetch', async () => {
    calls++;
    return new Response(JSON.stringify({ totalFound: 2100, content: smartPage(0) }));
  });
  await assert.rejects(fetchSmartRecruiters('test'), /exceeds.*2000/);
  assert.equal(calls, 1);
});

test('SmartRecruiters rejects missing totals and short pages that would skip postings', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => new Response(JSON.stringify({ content: [] })));
  await assert.rejects(fetchSmartRecruiters('test'), /totalFound/);
  t.mock.method(globalThis, 'fetch', async () => new Response(JSON.stringify({ totalFound: 2, content: smartPage(0, 1) })));
  await assert.rejects(fetchSmartRecruiters('test'), /incomplete/);
});

test('Unstop rejects a feed above its page cap before collecting a partial snapshot', async (t) => {
  let calls = 0;
  t.mock.method(globalThis, 'fetch', async () => {
    calls++;
    return calls === 1
      ? new Response(JSON.stringify({ data: { last_page: 41, data: [] } }))
      : new Response('Unexpected extra request', { status: 404 });
  });
  await assert.rejects(fetchUnstop('internships'), /exceeds.*40/);
  assert.equal(calls, 1);
});

test('Unstop rejects missing pagination and empty intermediate pages', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => new Response(JSON.stringify({ data: { data: [] } })));
  await assert.rejects(fetchUnstop('jobs'), /last_page/);
  t.mock.method(globalThis, 'fetch', async () => new Response(JSON.stringify({ data: { last_page: 2, data: [] } })));
  await assert.rejects(fetchUnstop('jobs'), /incomplete/);
});

test('malformed source responses cannot masquerade as successfully collected empty boards', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => new Response('{}', { status: 200 }));
  for (const fetcher of [fetchAshby, fetchGreenhouse, fetchSmartRecruiters, fetchUnstop]) {
    await assert.rejects(fetcher('test'), /missing .* array/);
  }
});

test('missing SmartRecruiters details fail explicitly instead of tagging title-only data', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => new Response('Not found', { status: 404 }));
  await assert.rejects(hydrateSmartRecruiters([
    post({ sourceId: 'details-test', description: '', _detailUrl: 'https://source.invalid/detail' }),
  ]), /details failed for details-test/);
});
