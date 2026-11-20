import { pathToFileURL } from 'node:url';
import { getEnabledSources } from './sources.config.js';
import { fetchLever } from './sources/lever.js';
import { fetchGreenhouse } from './sources/greenhouse.js';
import { fetchAshby } from './sources/ashby.js';
import { fetchSmartRecruiters, hydrateSmartRecruiters } from './sources/smartrecruiters.js';
import { fetchUnstop } from './sources/unstop.js';
import { mapPool } from './lib/http.js';
import { isIndiaPost, isFresherCandidate } from './lib/filters.js';
import { dedupe } from './lib/dedupe.js';
import { tagPosts, costUsd, PROMPT_VERSION } from './lib/tagger.js';
import { loadTagCache, saveJobs, saveRun } from './lib/store.js';

const FETCHERS = {
  lever: fetchLever,
  greenhouse: fetchGreenhouse,
  ashby: fetchAshby,
  smartrecruiters: fetchSmartRecruiters,
  unstop: fetchUnstop,
};

const PRICING = {
  input: Number(process.env.LLM_PRICE_INPUT_PER_M ?? 2.5),
  cachedInput: Number(process.env.LLM_PRICE_CACHED_INPUT_PER_M ?? 0.25),
  output: Number(process.env.LLM_PRICE_OUTPUT_PER_M ?? 15),
};

export function publishMinimum(value = process.env.MIN_PUBLISH_JOBS ?? 200) {
  const minimum = Number(value);
  if (!Number.isInteger(minimum) || minimum < 200) {
    throw new Error('MIN_PUBLISH_JOBS must be an integer of at least 200.');
  }
  return minimum;
}

async function collect(log, jobs) {
  const sourceStats = [];
  const results = await mapPool(jobs, 6, async ({ source, board }) => {
    try {
      const posts = await FETCHERS[source](board);
      sourceStats.push({ source, board, fetched: posts.length, ok: true });
      return posts;
    } catch (err) {
      // One broken board must never fail the whole daily run.
      sourceStats.push({ source, board, fetched: 0, ok: false, error: String(err.message || err) });
      log(`  ! ${source}/${board}: ${err.message}`);
      return [];
    }
  });
  return { posts: results.flat(), sourceStats };
}

/**
 * Collect → India filter → fresher pre-filter → dedupe → LLM tag (cached in
 * MongoDB) → upsert jobs → record the run. Returns the run document.
 */
export async function runPipeline({ db, log = console.log, dryRun = false }) {
  const started = new Date();
  const minJobs = publishMinimum();
  const enabledSources = getEnabledSources();
  const llm = {
    apiKey: process.env.OPENAI_API_KEY,
    baseUrl: process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1',
    model: process.env.OPENAI_PROFILE_MODEL || process.env.OPENAI_MODEL || 'gpt-4o-mini',
  };
  if (!llm.apiKey && !dryRun) throw new Error('OPENAI_API_KEY is not set (see .env.example).');

  log(`1) Collecting from ${enabledSources.length} allowlisted source board(s)...`);
  const { posts: all, sourceStats } = await collect(log, enabledSources);
  log(`   ${all.length} postings fetched from ${sourceStats.filter((s) => s.ok).length} boards`);

  const india = all.filter(isIndiaPost);
  log(`2) India filter: ${india.length}`);

  // SmartRecruiters needs a detail call per post for the description; only do
  // it for posts whose title/level could be entry-level.
  await hydrateSmartRecruiters(india.filter((p) => p.source === 'smartrecruiters' && isFresherCandidate(p)));

  const candidates = india.filter(isFresherCandidate);
  log(`3) Fresher pre-filter (rules): ${candidates.length}`);

  const { kept, removed } = dedupe(candidates);
  log(`4) Dedupe: kept ${kept.length}, removed ${removed.length}`);
  if (dryRun) {
    const bySource = kept.reduce((a, p) => ({ ...a, [`${p.source}/${p.board}`]: (a[`${p.source}/${p.board}`] || 0) + 1 }), {});
    log(bySource);
    return null;
  }

  log('5) LLM tagging (cache in MongoDB)...');
  const cache = await loadTagCache(db);
  const usage = await tagPosts(kept, cache, llm, log);
  const runCost = costUsd(usage, PRICING);

  const fresherCount = kept.filter((p) => p.tags?.isFresher).length;
  log(`6) LLM confirmed fresher-eligible: ${fresherCount}`);

  // Guard against a source/LLM outage silently emptying the live site:
  // nothing is written, so yesterday's jobs stay active.
  if (fresherCount < minJobs) {
    throw new Error(`Only ${fresherCount} fresher jobs (< MIN_PUBLISH_JOBS=${minJobs}); keeping the previous data.`);
  }

  log('7) Saving to MongoDB...');
  const writes = await saveJobs(db, kept, cache, started, sourceStats);
  log(`   upserted ${writes.inserted} new, updated ${writes.updated}, closed ${writes.closed} no-longer-listed`);

  const prevRun = await db.collection('runs').findOne({}, { sort: { generatedAt: -1 } });
  const run = {
    generatedAt: new Date(),
    startedAt: started,
    durationSec: Math.round((Date.now() - started.getTime()) / 1000),
    model: llm.model,
    promptVersion: PROMPT_VERSION,
    counts: {
      fetched: all.length,
      india: india.length,
      candidates: candidates.length,
      duplicatesRemoved: removed.length,
      tagged: kept.length,
      published: fresherCount,
    },
    db: writes,
    duplicateReasons: removed.reduce((acc, r) => ({ ...acc, [r.reason]: (acc[r.reason] || 0) + 1 }), {}),
    llmUsage: { ...usage, costUsd: Number(runCost.toFixed(4)), pricingPerMillion: PRICING },
    // A cache-only day tags nothing; keep the last measured rate.
    costPer1000PostsUsd:
      usage.postsTagged > 0 ? Number(((runCost / usage.postsTagged) * 1000).toFixed(4)) : prevRun?.costPer1000PostsUsd ?? null,
    sources: sourceStats.sort((a, b) => a.source.localeCompare(b.source) || a.board.localeCompare(b.board)),
  };
  await saveRun(db, run);

  log(`Done: ${fresherCount} live jobs. LLM: ${usage.calls} calls, ${usage.promptTokens} in / ${usage.completionTokens} out tokens, $${runCost.toFixed(4)}`);
  return run;
}

// CLI: `npm run pipeline` (or `npm run pipeline:dry`).
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { connectDb } = await import('../server/db.js');
  const dryRun = process.argv.includes('--dry-run');
  const { client, db } = dryRun ? { client: null, db: null } : await connectDb();
  try {
    await runPipeline({ db, dryRun });
  } catch (err) {
    console.error(err);
    process.exitCode = 1;
  } finally {
    await client?.close();
  }
}
