import { ROLES, canonicalCity } from './taxonomy.js';
import { hashString } from './text.js';
import { mapPool, sleep } from './http.js';

export const PROMPT_VERSION = 'v2';
const BATCH_SIZE = 15;

const SYSTEM_PROMPT = `You classify Indian job postings for a fresher (0-2 years experience) job board.
For EACH post return an object with:
- "id": the post id (unchanged)
- "role": exactly one of: ${ROLES.map((r) => `"${r}"`).join(', ')}
- "city": the primary Indian city of the job, as a common English city name (e.g. "Bengaluru", "Gurugram", "Mumbai", "Hyderabad", "Pune", "Chennai", "Noida", "New Delhi"). Use "Remote" if the role is remote within India, "Unspecified" if no Indian city is given.
- "other_cities": array of any additional Indian cities (may be empty)
- "job_type": "Internship" or "Full-time"
- "is_fresher": true if a fresh graduate / student / person with <= 2 years experience can apply; false if it needs 3+ years or is a senior/lead/manager role
- "min_experience_years": integer minimum years asked (0 if fresher/intern/not stated)
Rules: base "role" on the actual work, not the department name. Interns are always is_fresher=true.
Role edge cases: tax/audit/credit/payroll work -> "Finance & Accounting"; training, L&D, onboarding of employees -> "HR & Recruiting"; data annotation, search/map rating, content moderation -> "Other"; lab/chemistry/pharma/cosmetics R&D -> "Other"; "Hardware & Electronics" is only for electronics, semiconductors, embedded and electrical work.
Output JSON: {"results":[...]} with one entry per input post.`;

function compactDescription(text = '') {
  const head = text.slice(0, 900);
  const expLines = text
    .split(/\n|(?<=\.)\s/)
    .filter((l) => /year|yrs|experience|graduat|fresher|degree|intern|student|batch/i.test(l))
    .join(' ')
    .slice(0, 500);
  return `${head}${expLines ? `\n[Experience-related lines] ${expLines}` : ''}`;
}

function toLLMPost(post) {
  return {
    id: post.sourceId,
    title: post.title,
    company: post.company,
    location: post.location,
    employment_type: post.employmentType || undefined,
    department: post.department || undefined,
    description: compactDescription(post.description),
  };
}

export function contentHash(post, model) {
  return hashString(JSON.stringify([PROMPT_VERSION, model, toLLMPost(post)]));
}

export function validateTag(raw, post) {
  const role = ROLES.includes(raw?.role) ? raw.role : 'Other';
  let city = canonicalCity(raw?.city);
  let otherCities = Array.isArray(raw?.other_cities) ? raw.other_cities.map(canonicalCity) : [];
  // The source's structured work-mode flag beats the LLM: in v1 eval the model
  // picked the listed city for 3/4 work-from-home posts.
  if (post.remote && city !== 'Remote') {
    otherCities = [city, ...otherCities];
    city = 'Remote';
  }
  otherCities = [...new Set(otherCities)].filter((c) => c !== city && c !== 'Unspecified');
  const jobType = raw?.job_type === 'Internship' || /intern/i.test(post.title) ? 'Internship' : 'Full-time';
  return {
    role,
    city,
    otherCities,
    jobType,
    isFresher: jobType === 'Internship' ? true : Boolean(raw?.is_fresher),
    minExperienceYears: Number.isFinite(Number(raw?.min_experience_years)) ? Number(raw.min_experience_years) : 0,
  };
}

function completeTag(raw) {
  return raw && ROLES.includes(raw.role) &&
    typeof raw.city === 'string' && raw.city.trim().length > 0 &&
    Array.isArray(raw.other_cities) && raw.other_cities.every((c) => typeof c === 'string' && c.trim().length > 0) &&
    ['Internship', 'Full-time'].includes(raw.job_type) &&
    typeof raw.is_fresher === 'boolean' &&
    Number.isInteger(raw.min_experience_years) && raw.min_experience_years >= 0;
}

async function callLLM({ baseUrl, apiKey, model }, posts) {
  const payload = posts.map(toLLMPost);
  const body = {
    model,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: JSON.stringify(payload) },
    ],
    response_format: { type: 'json_object' },
    max_completion_tokens: 4000,
  };
  for (let attempt = 0; attempt < 4; attempt++) {
    const res = await fetch(`${baseUrl.replace(/\/$/, '')}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}`, 'api-key': apiKey },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(120000),
    }).catch((e) => ({ ok: false, status: 0, text: async () => String(e) }));
    if (res.ok) {
      const json = await res.json();
      const content = json.choices?.[0]?.message?.content;
      let parsed;
      try {
        parsed = JSON.parse(content);
      } catch {
        throw new Error('LLM returned invalid JSON; keeping the previous data.');
      }
      if (!Array.isArray(parsed?.results)) throw new Error('LLM response is missing a results array.');
      return { results: parsed.results, usage: json.usage || {} };
    }
    const errText = await res.text();
    if (res.status !== 429 && res.status < 500 && res.status !== 0) throw new Error(`LLM ${res.status}: ${errText.slice(0, 300)}`);
    await sleep(2000 * 2 ** attempt);
  }
  throw new Error('LLM failed after retries');
}

/**
 * Tags posts with role/city/fresher using the LLM. Results are cached per post
 * content hash, so a daily run only pays for new or edited postings.
 */
export async function tagPosts(posts, cache, llmConfig, log = console.log) {
  const usage = { calls: 0, promptTokens: 0, cachedTokens: 0, completionTokens: 0, postsTagged: 0, cacheHits: 0 };
  const todo = [];
  for (const p of posts) {
    const h = contentHash(p, llmConfig.model);
    const hit = cache[p.sourceId];
    if (hit && hit.hash === h && completeTag(hit.raw)) {
      p.tags = { ...validateTag(hit.raw, p), tagger: llmConfig.model };
      usage.cacheHits++;
    } else {
      p._hash = h;
      todo.push(p);
    }
  }
  log(`  tagging: ${usage.cacheHits} cached, ${todo.length} to send to ${llmConfig.model}`);

  const batches = [];
  for (let i = 0; i < todo.length; i += BATCH_SIZE) batches.push(todo.slice(i, i + BATCH_SIZE));

  await mapPool(batches, 4, async (batch, bi) => {
    let { results, usage: u } = await callLLM(llmConfig, batch);
    usage.calls++;
    usage.promptTokens += u.prompt_tokens || 0;
    usage.cachedTokens += u.prompt_tokens_details?.cached_tokens || 0;
    usage.completionTokens += u.completion_tokens || 0;

    const byId = new Map(results.filter(completeTag).map((r) => [r.id, r]));
    const missing = batch.filter((p) => !byId.has(p.sourceId));
    if (missing.length) {
      // The model occasionally drops or renames ids in a batch; retry those alone.
      const retry = await callLLM(llmConfig, missing);
      usage.calls++;
      usage.promptTokens += retry.usage.prompt_tokens || 0;
      usage.cachedTokens += retry.usage.prompt_tokens_details?.cached_tokens || 0;
      usage.completionTokens += retry.usage.completion_tokens || 0;
      for (const r of retry.results.filter(completeTag)) byId.set(r.id, r);
    }
    const unresolved = batch.filter((p) => !byId.has(p.sourceId));
    if (unresolved.length) {
      throw new Error(`LLM omitted or returned invalid tags for ${unresolved.length} posts after retry; keeping the previous data.`);
    }
    for (const p of batch) {
      const raw = byId.get(p.sourceId);
      p.tags = { ...validateTag(raw, p), tagger: llmConfig.model };
      cache[p.sourceId] = { hash: p._hash, raw, taggedAt: new Date().toISOString() };
      usage.postsTagged++;
      delete p._hash;
    }
    log(`  batch ${bi + 1}/${batches.length} done`);
  });
  return usage;
}

export function costUsd(usage, pricing) {
  const uncached = usage.promptTokens - usage.cachedTokens;
  return (
    (uncached * pricing.input + usage.cachedTokens * pricing.cachedInput + usage.completionTokens * pricing.output) /
    1e6
  );
}
