import { getJson, mapPool } from '../lib/http.js';
import { stripHtml } from '../lib/text.js';

const API = 'https://api.smartrecruiters.com/v1/companies';
const PAGE_SIZE = 100;
const MAX_POSTS = 2000;

// The SmartRecruiters list endpoint has no descriptions, so we list India
// postings first and fetch details lazily (only for fresher candidates).
export async function fetchSmartRecruiters(board) {
  const out = [];
  for (let offset = 0; offset < MAX_POSTS; offset += PAGE_SIZE) {
    const page = await getJson(`${API}/${board}/postings?country=in&limit=${PAGE_SIZE}&offset=${offset}`);
    if (!Array.isArray(page?.content)) throw new Error(`SmartRecruiters/${board}: missing content array.`);
    if (!Number.isSafeInteger(page.totalFound) || page.totalFound < 0) throw new Error(`SmartRecruiters/${board}: invalid totalFound.`);
    if (page.totalFound > MAX_POSTS) throw new Error(`SmartRecruiters/${board}: feed exceeds the ${MAX_POSTS}-post limit; collection is incomplete.`);
    const received = offset + page.content.length;
    if (received < page.totalFound && page.content.length < PAGE_SIZE) {
      throw new Error(`SmartRecruiters/${board}: short intermediate page; collection is incomplete.`);
    }
    for (const p of page.content) {
      const loc = p.location || {};
      out.push({
        source: 'smartrecruiters',
        board,
        sourceId: `smartrecruiters:${board}:${p.id}`,
        company: p.company?.name || board,
        title: p.name,
        location: [loc.city, loc.region, loc.remote ? 'Remote' : '', 'India'].filter(Boolean).join(', '),
        countryHint: (loc.country || '').toUpperCase(),
        url: `https://jobs.smartrecruiters.com/${board}/${p.id}`,
        postedAt: p.releasedDate || null,
        employmentType: p.typeOfEmployment?.label || '',
        experienceHint: p.experienceLevel?.id || '',
        department: p.function?.label || p.department?.label || '',
        description: '',
        _detailUrl: `${API}/${board}/postings/${p.id}`,
      });
    }
    if (received >= page.totalFound) return out;
  }
  throw new Error(`SmartRecruiters/${board}: collection is incomplete at the ${MAX_POSTS}-post limit.`);
}

export async function hydrateSmartRecruiters(posts) {
  const pending = posts.filter((p) => p._detailUrl && !p.description);
  await mapPool(pending, 4, async (p) => {
    try {
      const d = await getJson(p._detailUrl);
      const sections = d.jobAd?.sections || {};
      p.description = ['jobDescription', 'qualifications', 'additionalInformation']
        .map((k) => stripHtml(sections[k]?.text || ''))
        .filter(Boolean)
        .join('\n');
      if (d.postingUrl) p.url = d.postingUrl;
    } catch (err) {
      throw new Error(`SmartRecruiters details failed for ${p.sourceId}: ${err.message}`, { cause: err });
    }
  });
  for (const p of posts) delete p._detailUrl;
}
