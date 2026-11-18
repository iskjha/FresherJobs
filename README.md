# FresherJobs India

A live, searchable board of **fresher jobs and internships in India**. A daily pipeline collects ~10,000 posts from public job-board APIs, keeps the India entry-level ones, removes duplicates, tags each post with an LLM (role, city, fresher-eligible) and stores everything in **MongoDB**. An **Express API** serves filtered, cursor-paginated results to a React kanban board.

- **Stack:** Node 22 · MongoDB · Express 5 · node-cron · OpenAI-compatible LLM (gpt-5.4 via Azure OpenAI) · React 18 + Vite 5 + Redux Toolkit + Tailwind

## Recorded results (2026-11-16)

These are a recorded run snapshot, not hardcoded acceptance checks. The live `/api/meta` endpoint reports the current count, run timestamp and usage.

| Metric | Value |
| --- | --- |
| Postings fetched | 9,900 from 52 boards |
| In India | 3,424 |
| Entry-level candidates (rules) | 1,049 |
| After de-duplication | 997 (52 duplicates removed) |
| **Live in MongoDB (LLM-confirmed fresher)** | **956** |
| **Cost per 1,000 posts** | **$1.50** (gpt-5.4 list price, $2.50 in / $15 out per 1M tokens) |

### Recorded accuracy (50 posts with reviewed labels)

| | Prompt v1 (pre-tuning baseline) | Prompt v2 (in-sample) |
| --- | --- | --- |
| Role | **92%** | 96% |
| City | **94%** | 100% |
| Role **and** city | **86%** | 96% |
| Fresher flag | **96%** | 98% |

The v2 fixes were designed after looking at these same 50 errors, so v2 is optimistic, not a held-out test. The v1 column is the recorded pre-tuning baseline, not proof of unbiased population accuracy. v2 also introduced 2 new role mistakes (SAP consultant → Finance, fraud ops → Other) while fixing 4 others. Labels and notes: [`pipeline/eval/labels.json`](pipeline/eval/labels.json). Results are stored in the `evaluations` collection and shown on the **Accuracy & cost** page. Label completeness does not itself prove a human reviewed the original postings; the submitter must verify and attest to that review.

**Re-score audit (2026-11-17):** only **49/50** sample IDs remain in MongoDB. `unstop:1808717` (Finance & Tax Internship) is missing. The original 50-post scores are retained as **historical results**, not a new verification of current predictions. A full current re-score now fails explicitly instead of substituting that post's saved prediction. `/api/evaluation` reports current sample coverage and the Accuracy page shows the gap. A replacement post requires a real human review and a new evaluation; no labels or predictions have been invented.

### Cost math

A full run with an empty cache tagged 965 posts in 65 calls (15 posts per call): 297,893 input + 47,023 output tokens = **$1.45**, or **$1.50 per 1,000 posts**. Daily runs are far cheaper because the raw LLM answer is cached on each job document, keyed by a hash of the prompt version, model and exact post payload sent to the LLM (ID, title, company, location, employment type, department and compacted description). The first MongoDB run reused 965 cached tags and sent 32 new posts in 3 calls, costing **$0.05**. The rule-based pre-filter also keeps ~2,400 senior India posts away from the LLM.

The corrected cache key invalidates the legacy keys once: the next pipeline run will re-tag existing candidates and can incur a full uncached run's LLM cost. Later identical inputs reuse the cache. Structured remote overrides are still re-applied without another LLM call.

This is estimated **LLM-only** spend at the configured token prices, not an invoice or total operating cost. Hosting and MongoDB are excluded. Formula: `((inputTokens - cachedTokens) * inputPrice + cachedTokens * cachedPrice + outputTokens * outputPrice) / 1e6 / newlyTaggedPosts * 1000`. Usage includes successful retry responses; the configured prices must match the selected model. A cache-only run retains the last measured per-1,000 rate.

## Architecture

```
  Public job-board APIs                     MongoDB  (fresher_jobs)
  Unstop · Lever · Greenhouse ─┐            ┌─────────────────────────────┐
  Ashby · SmartRecruiters      │            │ jobs        (+ LLM tag cache)│
                               ▼            │ runs        (one per run)   │
  pipeline/run.js  ── collect → India → rules → dedupe → LLM tag ──upsert──▶│ evaluations (accuracy)      │
       ▲                                    └──────────────┬──────────────┘
       │ node-cron 06:30 IST (server/scheduler.js)         │ indexed queries,
       │ or `npm run pipeline` / POST /api/admin/refresh   │ keyset cursors
                                                           ▼
                                            Express API  (server/)
                                                           │  /api/*
                                                           ▼
                                   React + Redux board (src/)  — Vite proxy in dev,
                                   served by the same Express process in production
```

### Data model (`jobs` collection)

One document per posting, `_id` = `"<source>:<board>:<postingId>"` (stable across runs).

| Field | Notes |
| --- | --- |
| `title, company, location, url, source, salary, snippet, description` | from the source API (description trimmed, never sent to the browser) |
| `role, city, otherCities, cities, jobType, isFresher, minExperienceYears` | LLM tags after validation (`cities` = city + otherCities, for filtering) |
| `postedAt, firstSeenAt, lastSeenAt` | `postedAt` falls back to first-seen when the source has no date |
| `active` | `false` once a posting disappears from a successfully collected board (`closedAt` set); failed/unqueried boards retain their previous jobs, and reopened jobs clear `closedAt` |
| `tag: { hash, raw, taggedAt }` | LLM cache — a run only calls the LLM when the content hash changes |
| `searchText, companyKey` | lowercase helpers for search and A–Z sort |

Indexes cover `{active, isFresher, role, postedAt, _id}` (board columns), the global sorts, and `cities`.

### API

| Endpoint | Purpose |
| --- | --- |
| `GET /api/meta` | latest run (counts, LLM usage, cost, source health) + live totals |
| `GET /api/facets` | unfiltered counts by role, city, source, job type (tabs, dropdowns, Insights) |
| `POST /api/jobs/board` `{filters}` | `{ total, columns: [{ role, total, internships }] }` for the current filters |
| `POST /api/jobs/search` `{filters, role?, pageSize, before?}` | one page: `{ jobs, meta: { nextCursor, hasMore, totalJobs, totalInternships } }` |
| `POST /api/jobs/export` `{filters}` | CSV of the filtered results |
| `GET /api/evaluation` | latest hand-checked accuracy result |
| `POST /api/admin/refresh`, `GET /api/admin/status` | run the pipeline now (header `x-admin-token`; disabled unless `ADMIN_TOKEN` is set) |

`filters` = `{ query, roles[], cities[], sources[], jobType, postedWithin, sort }`. Every search word must appear (substring, case-insensitive).

**Pagination** follows the CRM Deals Kanban pattern: each board column requests 15 jobs, stores `meta.nextCursor`, and sends it back as `before` when the user scrolls within 150 px of the bottom. The cursor is opaque (base64 of the last row's sort values + `_id`), so keyset pagination never skips or repeats rows even when many jobs share a timestamp. Column state is cached in Redux (`board.columns`) and reset whenever filters change.

### Repository layout

```
server/                      Express API + MongoDB
  index.js                   boot: connect, start cron, listen (serves dist/ in production)
  app.js                     createApp({ db }) — routes, error handler (used by tests)
  db.js                      connection + indexes
  scheduler.js               node-cron daily run, single-flight guard
  routes/jobs.js|meta.js|admin.js
  lib/query.js               filters → Mongo query, sorts, cursor encode/decode, keyset filter
pipeline/
  run.js                     runPipeline({ db }) — also the `npm run pipeline` CLI
  sources/*.js               one adapter per provider → common post shape
  lib/filters.js|dedupe.js|tagger.js|taxonomy.js
  lib/store.js               MongoDB tag cache + upserts + closing vanished jobs
  eval/sample.js|score.js    50-post accuracy evaluation (reads/writes MongoDB)
src/                         React app (mkc_vms_web structure)
  api/                       axiosClient.js (single instance) + jobsApi.js
  redux/                     jobsSlice (meta, facets), filtersSlice, boardSlice (columns + cursors)
  modules/jobs/              board, cards, toolbar, filter sidebar, URL sync
  modules/insights|accuracy|about
```

## Running locally

Requires Node 22+ and MongoDB (local `mongod` or Atlas).

```bash
npm install
cp .env.example .env        # set OPENAI_API_KEY / OPENAI_BASE_URL; MONGODB_URI defaults to local
npm run pipeline            # fill MongoDB (first run tags everything, ~$1.50)
npm run dev:all             # API on :4000 + Vite on :3007 (proxies /api) → http://localhost:3007/jobs
```

Pages: `/jobs` (filters live in the query string, e.g. `/jobs?cities=Pune&type=Internship`), `/insights`, `/accuracy`, `/how-it-works`.

`dev:all` (`scripts/dev.mjs`) reloads the API only when a server file's content actually changes (on Windows, plain `node --watch` also restarts when files are merely read), restarts it automatically if it crashes, and does nothing if the servers are already running. The frontend retries API calls for a few seconds during a restart, so refreshing mid-restart doesn't show an error.

Other scripts: `npm run pipeline:dry` (fetch/filter/dedupe only, no LLM or DB writes), `npm test` (unit + MongoDB integration tests in a throwaway database), `npm run lint`, `npm run build`, `npm start` (production: API + built frontend on one port).

### Re-running the accuracy check

```bash
npm run eval:sample -- 50 42 pipeline/eval/labels.next.json
# Review all 50 original postings and fill in truth in the new file.
# Preserve the old labels and baseline before intentionally replacing labels.json.
npm run eval:score          # scores against current tags → `evaluations` collection
```

Sampling refuses to overwrite an existing file or return fewer posts than requested. Scoring requires at least 50 unique, fully labeled posts with current MongoDB predictions; missing jobs cannot silently reuse old predictions saved in the sample. The sample IDs and truth labels are fingerprinted, and the archived baseline is shown only when that fingerprint matches. Keep the existing sample unchanged for a like-for-like v1/v2 comparison. A new sample requires its own baseline.

## Deploying

The app is one Node process (API + static frontend + daily cron), so any Node host works (Render, Railway, Fly.io, a VM):

1. Create a MongoDB database (e.g. Atlas free tier) and set `MONGODB_URI`.
2. Set `OPENAI_API_KEY`, `OPENAI_BASE_URL`, `OPENAI_PROFILE_MODEL`, and optionally `ADMIN_TOKEN`.
3. Build with `npm ci && npm run build`, start with `npm start`.
4. Run `npm run pipeline` once (or `POST /api/admin/refresh`) to fill the database; after that the built-in cron refreshes it daily at 06:30 IST.

If the host sleeps idle processes, trigger `POST /api/admin/refresh` from an external scheduler (e.g. a GitHub Actions cron with `curl`) instead of relying on the in-process cron.

CI (`.github/workflows/ci.yml`) runs lint, the test suite against a MongoDB service container, and the production build.

## What broke and how it was fixed

1. **Not enough fresher posts.** 50 company ATS boards gave 2,151 India jobs but only 66 entry-level ones. *Fix:* added Unstop, an India-first internship and fresher marketplace. Public API access or `robots.txt` rules alone do not establish permission; see the terms caveat below.
2. **LLM chose a city for remote jobs** (3 of 4 WFH posts in the sample). *Fix:* the source's structured WFH flag overrides the model, so the city becomes `Remote`.
3. **Role confusions** (tax → Legal, cosmetics R&D → Hardware). *Fix:* edge-case rules in the prompt (v2) and a `PROMPT_VERSION` bump to invalidate the cache.
4. **Dedupe let a third copy through.** Caught by a unit test; dropped posts now register their URL and id.
5. **Re-tagging daily wastes money.** *Fix:* cache the raw LLM answer by content hash; validation rules are re-applied for free.
6. **Static JSON couldn't page, filter or count at scale.** *Fix:* MongoDB + Express with indexed filters and keyset cursors. Many Unstop posts share the same timestamp, so the cursor includes `_id` as a tie-breaker. The integration test walks a column in all three sort orders and checks that no job is skipped or repeated.
7. **Migrating would have re-tagged everything.** *Fix:* the old tag cache was imported into MongoDB first, so the first DB run cost $0.05 instead of ~$1.50.
8. **A source outage could close valid jobs.** *Fix:* only successfully collected boards can close missing jobs. Malformed source payloads are errors, not empty feeds. The pipeline also refuses to write below `MIN_PUBLISH_JOBS` (default 200, cannot be lower).
9. **Incomplete LLM answers could silently become fallback tags.** *Fix:* require complete, correctly typed results, retry missing/invalid entries once, then fail without publishing if any remain. Cached input tokens from retries are included in cost.
10. **Evaluation could look better by ignoring missing labels or reusing stale predictions.** *Fix:* reject incomplete/duplicate samples and missing current predictions. Sampling no longer overwrites reviewed labels.
11. **Edited postings could reuse stale tags.** *Fix:* cache hashing and LLM requests now share the same post-payload builder, including employment type, department, company and experience lines drawn from beyond the first 2,000 characters.
12. **Unstop posts were assumed to be in India, even when located abroad.** *Fix:* remove the forced country and invented "Remote (India)" label. The normal India filter now requires location evidence; generic remote posts with no India evidence are excluded, while remote posts listing an Indian city or India remain eligible.
13. **Pagination caps could silently produce partial feeds and close still-open jobs.** *Fix:* keep the existing request bounds (2,000 SmartRecruiters posts per board, 40 Unstop pages per category), but fail the board explicitly when its reported size exceeds the cap or pagination is invalid/incomplete. Failed boards are recorded with `ok: false` in run source health and their previous jobs are not closed. A board above its cap will retain its previous data until it can be collected completely; partial results are not published as successful.

## Video walkthrough checklist

Record a walkthrough of the deployed app: search and filter real posts, open an original listing, then show `/api/meta` and explain the daily schedule. Trace collection, India/fresher filtering, deduplication, LLM tagging/cache, MongoDB and the Express/React UI using the architecture above. Explain the failures and fixes above, show the 50 reviewed labels and scoring command, and state both the pre-tuning and in-sample accuracy plus the LLM-only cost formula. Do not expose `.env`, API keys or database credentials. This checklist is not a recorded video.

## Respecting each site's terms

- The collector uses unauthenticated ATS job-board APIs (Lever, Greenhouse, Ashby, SmartRecruiters) and Unstop's public API. **Public accessibility and a robots.txt allowance are not permission or a license to collect, store, or redistribute posts.** This repository does not establish that each provider has authorized this use.
- Before enabling collection, verify and record each provider's current API terms, content license, robots rules, attribution requirements and rate limits, or obtain written permission. Remove sources from `pipeline/sources.config.js` if those requirements cannot be met. This audit has not certified provider permission.
- No HTML scraping, login bypass, or collection from LinkedIn, Naukri, Indeed or Internshala.
- One run per day, bounded concurrency, retries with backoff and an identifying User-Agent.
- Only a short snippet is shown; every card links to the original posting.
