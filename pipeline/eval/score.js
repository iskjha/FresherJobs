// Scores the hand-checked labels in pipeline/eval/labels.json against the
// CURRENT tags in MongoDB and stores the result in the `evaluations`
// collection (served by GET /api/evaluation → Accuracy page).
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { connectDb } from '../../server/db.js';
import { ROLES } from '../lib/taxonomy.js';

export function scoreLabels(items, docs) {
  if (!Array.isArray(items) || items.length < 50) throw new Error('Evaluation requires at least 50 fully reviewed posts.');
  if (new Set(items.map((x) => x.id)).size !== items.length) throw new Error('Evaluation contains duplicate post IDs.');
  const latest = new Map(docs.map((d) => [d._id, d]));
  const labeled = items.map((x) => {
    if (typeof x.id !== 'string' || !x.id.trim() ||
      !ROLES.includes(x.truth?.role) || typeof x.truth?.city !== 'string' || !x.truth.city.trim() ||
      typeof x.truth?.isFresher !== 'boolean') {
      throw new Error(`Missing or invalid hand labels for ${x.id || 'an unidentified post'}. Review every sampled post first.`);
    }
    const d = latest.get(x.id);
    if (!d || !ROLES.includes(d.role) || typeof d.city !== 'string' || !d.city.trim() || typeof d.isFresher !== 'boolean') {
      throw new Error(`Missing or invalid current prediction for ${x.id}; refusing to reuse saved sample predictions.`);
    }
    return { ...x, llm: { role: d.role, city: d.city, isFresher: d.isFresher, jobType: d.jobType } };
  });
  const pct = (n) => Number(((n / labeled.length) * 100).toFixed(1));
  const ok = (pred) => labeled.filter(pred).length;
  return {
    sampleSize: labeled.length,
    sampleIds: labeled.map((x) => x.id),
    sampleHash: createHash('sha256')
      .update(JSON.stringify(labeled.map((x) => [x.id, x.truth.role, x.truth.city, x.truth.isFresher])
        .sort((a, b) => a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0)))
      .digest('hex'),
    accuracy: {
      role: pct(ok((x) => x.llm.role === x.truth.role)),
      city: pct(ok((x) => x.llm.city === x.truth.city)),
      roleAndCity: pct(ok((x) => x.llm.role === x.truth.role && x.llm.city === x.truth.city)),
      fresherFlag: pct(ok((x) => x.llm.isFresher === x.truth.isFresher)),
    },
    errors: labeled
      .filter((x) => x.llm.role !== x.truth.role || x.llm.city !== x.truth.city || x.llm.isFresher !== x.truth.isFresher)
      .map(({ title, company, location, url, llm, truth, notes }) => ({ title, company, location, url, llm, truth, notes })),
  };
}

async function main() {
  const items = JSON.parse(await readFile('pipeline/eval/labels.json', 'utf8'));
  const baseline = await readFile('pipeline/eval/eval.v1.json', 'utf8')
    .then((t) => JSON.parse(t.replace(/^\uFEFF/, '')))
    .catch((err) => {
      if (err.code === 'ENOENT') return null;
      throw err;
    });
  const { client, db } = await connectDb();
  try {
    const docs = await db
      .collection('jobs')
      .find({ _id: { $in: items.map((x) => x.id) } }, { projection: { role: 1, city: 1, isFresher: 1, jobType: 1 } })
      .toArray();
    const scored = scoreLabels(items, docs);
    const run = await db.collection('runs').findOne({}, { sort: { generatedAt: -1 } });
    if (!run) throw new Error('No pipeline run found; cannot identify the evaluated model or prompt.');

    const result = {
      evaluatedAt: new Date(),
      reportType: 'historical',
      ...scored,
      model: run.model,
      promptVersion: run.promptVersion,
      baseline:
        baseline && baseline.sampleHash === scored.sampleHash && (baseline.promptVersion || 'v1') !== run.promptVersion
          ? { promptVersion: baseline.promptVersion || 'v1', accuracy: baseline.accuracy, errorCount: baseline.errors.length }
          : null,
      costPer1000PostsUsd: run.costPer1000PostsUsd ?? null,
    };
    await db.collection('evaluations').insertOne(result);
    console.log(result.accuracy, `errors: ${result.errors.length}`);
  } finally {
    await client.close();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
