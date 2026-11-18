import { getJson } from '../lib/http.js';
import { stripHtml } from '../lib/text.js';
import { COMPANY_NAMES } from '../sources.config.js';

export async function fetchGreenhouse(board) {
  const data = await getJson(`https://boards-api.greenhouse.io/v1/boards/${board}/jobs?content=true`, {
    timeoutMs: 60000,
  });
  if (!Array.isArray(data?.jobs)) throw new Error(`Greenhouse/${board}: missing jobs array.`);
  return data.jobs.map((p) => ({
    source: 'greenhouse',
    board,
    sourceId: `greenhouse:${board}:${p.id}`,
    company: p.company_name || COMPANY_NAMES[board] || board,
    title: p.title,
    location: [p.location?.name, ...(p.offices || []).map((o) => o.location || o.name)]
      .filter(Boolean)
      .join('; '),
    countryHint: '',
    url: p.absolute_url,
    postedAt: p.first_published || p.updated_at || null,
    employmentType: '',
    department: (p.departments || []).map((d) => d.name).join(', '),
    description: stripHtml(p.content),
  }));
}
