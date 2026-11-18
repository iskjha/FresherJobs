import { getJson } from '../lib/http.js';
import { COMPANY_NAMES } from '../sources.config.js';

export async function fetchAshby(board) {
  const data = await getJson(`https://api.ashbyhq.com/posting-api/job-board/${board}`);
  if (!Array.isArray(data?.jobs)) throw new Error(`Ashby/${board}: missing jobs array.`);
  return data.jobs.map((p) => ({
    source: 'ashby',
    board,
    sourceId: `ashby:${board}:${p.id}`,
    company: COMPANY_NAMES[board] || board,
    title: p.title,
    location: [p.location, ...(p.secondaryLocations || []).map((s) => s.location)]
      .filter(Boolean)
      .join('; '),
    countryHint: p.address?.postalAddress?.addressCountry || '',
    url: p.jobUrl,
    postedAt: p.publishedAt || null,
    employmentType: p.employmentType || '',
    department: p.department || p.team || '',
    description: p.descriptionPlain || '',
  }));
}
