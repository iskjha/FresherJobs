// Draws a reproducible random sample of tagged jobs from MongoDB for
// hand-checking. Output: pipeline/eval/labels.json — fill in `truth` for each
// item, then run `npm run eval:score`.
import { writeFile } from 'node:fs/promises';
import { connectDb } from '../../server/db.js';

const N = Number(process.argv[2] || 50);
const SEED = Number(process.argv[3] || 42);
const output = process.argv[4] || 'pipeline/eval/labels.json';
if (!Number.isInteger(N) || N < 50 || !Number.isInteger(SEED)) {
  throw new Error('Usage: eval:sample -- [count >= 50] [integer seed] [new output path]');
}

function mulberry32(a) {
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const { client, db } = await connectDb();
try {
  // All live tagged candidates, including ones the LLM rejected as non-fresher.
  const posts = await db
    .collection('jobs')
    .find({ active: true, tag: { $exists: true } }, { projection: { searchText: 0, tag: 0 } })
    .sort({ _id: 1 })
    .toArray();
  if (posts.length < N) throw new Error(`Only ${posts.length} tagged jobs available; cannot sample ${N} unique posts.`);
  const rand = mulberry32(SEED);
  for (let i = posts.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [posts[i], posts[j]] = [posts[j], posts[i]];
  }
  const sample = posts.slice(0, N).map((p) => ({
    id: p._id,
    title: p.title,
    company: p.company,
    location: p.location,
    url: p.url,
    excerpt: (p.description || '').slice(0, 600),
    llm: { role: p.role, city: p.city, isFresher: p.isFresher, jobType: p.jobType },
    truth: { role: null, city: null, isFresher: null },
    notes: '',
  }));
  await writeFile(output, JSON.stringify(sample, null, 2), { flag: 'wx' }).catch((err) => {
    if (err.code === 'EEXIST') throw new Error(`${output} already exists. Choose a new output path to preserve reviewed labels.`);
    throw err;
  });
  console.log(`Wrote ${sample.length} posts to ${output} (seed ${SEED}).`);
} finally {
  await client.close();
}
