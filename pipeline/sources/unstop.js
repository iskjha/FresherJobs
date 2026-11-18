import { getJson, sleep } from '../lib/http.js';
import { stripHtml } from '../lib/text.js';

// Public API access and robots.txt do not replace a terms/licensing review.
// Page slowly and link back to the original listing.
const API = 'https://unstop.com/api/public/opportunity/search-result';
const PER_PAGE = 50;
const MAX_PAGES = 40;

function formatPay(d) {
  if (!d || !d.show_salary || d.not_disclosed || (!d.min_salary && !d.max_salary)) return '';
  const fmt = (n) => `₹${Number(n).toLocaleString('en-IN')}`;
  const range = d.min_salary && d.max_salary && d.min_salary !== d.max_salary
    ? `${fmt(d.min_salary)}–${fmt(d.max_salary)}`
    : fmt(d.max_salary || d.min_salary);
  const per = { monthly: '/month', annually: '/year', weekly: '/week' }[d.pay_in] || '';
  return `${range}${per}`;
}

export async function fetchUnstop(kind) {
  const out = [];
  for (let page = 1; page <= MAX_PAGES; page++) {
    const res = await getJson(`${API}?opportunity=${kind}&page=${page}&per_page=${PER_PAGE}&oppstatus=open`);
    const data = res?.data;
    if (!Array.isArray(data?.data)) throw new Error(`Unstop/${kind}: missing postings array.`);
    const lastPage = data.last_page;
    if (!Number.isSafeInteger(lastPage) || lastPage < 1) throw new Error(`Unstop/${kind}: invalid last_page.`);
    if (lastPage > MAX_PAGES) throw new Error(`Unstop/${kind}: feed exceeds the ${MAX_PAGES}-page limit; collection is incomplete.`);
    if (!data.data.length && page < lastPage) throw new Error(`Unstop/${kind}: empty intermediate page; collection is incomplete.`);
    for (const p of data.data) {
      const jd = p.jobDetail || {};
      const cities = [
        ...(jd.locations || []),
        ...(p.locations || []).map((l) => l.city),
      ].filter(Boolean);
      const remote = jd.type === 'wfh';
      const filters = (p.filters || []).map((f) => f.name);
      const fresherEligible = filters.includes('Fresher') || filters.some((f) => /student|undergraduate|postgraduate/i.test(f));
      out.push({
        source: 'unstop',
        board: kind,
        sourceId: `unstop:${p.id}`,
        remote,
        company: p.organisation?.name || 'Unknown',
        title: p.title,
        location: [...new Set(cities)].join('; ') + (remote ? `${cities.length ? '; ' : ''}Remote` : ''),
        countryHint: '',
        url: p.seo_url || `https://unstop.com/${p.public_url}`,
        postedAt: p.approved_date || p.updated_at || null,
        employmentType: kind === 'internships' ? 'Internship' : (jd.timing || '').replace('_', '-'),
        experienceHint: kind === 'internships' ? 'internship' : fresherEligible ? 'entry_level' : '',
        department: (p.workfunction || []).map((w) => w.name).join(', '),
        salary: formatPay(jd),
        description: [
          stripHtml(p.details),
          jd.min_experience != null ? `Experience: ${jd.min_experience}-${jd.max_experience ?? ''} years` : '',
          filters.length ? `Eligible: ${filters.join(', ')}` : '',
        ]
          .filter(Boolean)
          .join('\n'),
      });
    }
    if (page >= lastPage) return out;
    await sleep(400);
  }
  throw new Error(`Unstop/${kind}: collection is incomplete at the ${MAX_PAGES}-page limit.`);
}
