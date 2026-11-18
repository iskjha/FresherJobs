import { getJson } from '../lib/http.js';
import { stripHtml } from '../lib/text.js';
import { COMPANY_NAMES } from '../sources.config.js';

export async function fetchLever(board) {
  const data = await getJson(`https://api.lever.co/v0/postings/${board}?mode=json`);
  return data.map((p) => {
    const c = p.categories || {};
    return {
      source: 'lever',
      board,
      sourceId: `lever:${board}:${p.id}`,
      company: COMPANY_NAMES[board] || board,
      title: p.text,
      location: [c.location, ...(c.allLocations || [])].filter(Boolean).join('; '),
      countryHint: p.country || '',
      url: p.hostedUrl,
      postedAt: p.createdAt ? new Date(p.createdAt).toISOString() : null,
      employmentType: c.commitment || '',
      department: c.team || c.department || '',
      description: [p.descriptionPlain, ...(p.lists || []).map((l) => `${l.text}\n${stripHtml(l.content)}`), p.additionalPlain]
        .filter(Boolean)
        .join('\n'),
    };
  });
}
