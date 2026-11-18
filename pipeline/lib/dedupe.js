import { normalizeKey } from './text.js';

const COMPANY_SUFFIX = /\b(private|pvt|limited|ltd|inc|llc|technologies|technology|software|group|india|gmbh|corp|corporation)\b/g;

const companyKey = (c) => normalizeKey(c).replace(COMPANY_SUFFIX, '').replace(/\s+/g, ' ').trim();
const titleKey = (t) => normalizeKey(t).replace(/\b(m f d|f m d|m w d)\b/g, '').replace(/\s+/g, ' ').trim();
const locKey = (l) => {
  const first = normalizeKey(String(l || '').split(/[;|]/)[0]);
  return first.replace(/\bbangalore\b/, 'bengaluru').replace(/\bgurgaon\b/, 'gurugram').split(' ')[0] || '';
};
const urlKey = (u) => String(u || '').toLowerCase().replace(/[?#].*$/, '').replace(/\/+$/, '');

function tokens(s) {
  return new Set(titleKey(s).split(' ').filter((w) => w.length > 1));
}

function jaccard(a, b) {
  let inter = 0;
  for (const x of a) if (b.has(x)) inter++;
  return inter / (a.size + b.size - inter || 1);
}

/**
 * Removes duplicates in three passes:
 *  1. identical source id or canonical URL (same post seen twice),
 *  2. same company + normalized title + first city (reposts / multi-req ids),
 *  3. near-identical titles at the same company+city (token Jaccard >= 0.85),
 *     e.g. "Software Engineer Intern - 2026" vs "Software Engineer Intern (2026)".
 * The newest post wins so the link is most likely to still be open.
 */
export function dedupe(posts) {
  const sorted = [...posts].sort((a, b) => String(b.postedAt || '').localeCompare(String(a.postedAt || '')));
  const seenIds = new Set();
  const seenUrls = new Set();
  const seenExact = new Set();
  const byGroup = new Map();
  const kept = [];
  const removed = [];

  for (const p of sorted) {
    const u = urlKey(p.url);
    const exact = `${companyKey(p.company)}|${titleKey(p.title)}|${locKey(p.location)}`;
    const group = `${companyKey(p.company)}|${locKey(p.location)}`;
    const tok = tokens(p.title);

    let dupOf = null;
    if (seenIds.has(p.sourceId) || (u && seenUrls.has(u))) dupOf = 'id/url';
    else if (seenExact.has(exact)) dupOf = 'exact';
    else if ((byGroup.get(group) || []).some((t) => jaccard(t, tok) >= 0.85)) dupOf = 'fuzzy';

    if (dupOf) {
      removed.push({ sourceId: p.sourceId, reason: dupOf });
      // Remember the dropped copy's URL too, so a third copy sharing it is caught.
      seenIds.add(p.sourceId);
      if (u) seenUrls.add(u);
      continue;
    }
    seenIds.add(p.sourceId);
    if (u) seenUrls.add(u);
    seenExact.add(exact);
    if (!byGroup.has(group)) byGroup.set(group, []);
    byGroup.get(group).push(tok);
    kept.push(p);
  }
  return { kept, removed };
}
