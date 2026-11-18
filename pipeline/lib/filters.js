const INDIA_RE =
  /\bindia\b|bengaluru|bangalore|mumbai|navi mumbai|new delhi|\bdelhi\b|gurgaon|gurugram|noida|hyderabad|\bpune\b|chennai|kolkata|ahmedabad|jaipur|kochi|cochin|coimbatore|chandigarh|indore|trivandrum|thiruvananthapuram|mysore|mysuru|vadodara|nagpur|bhubaneswar|lucknow|surat|vizag|visakhapatnam|mangalore|goa\b/i;

export function isIndiaPost(post) {
  if (['IN', 'IND', 'INDIA'].includes(String(post.countryHint || '').toUpperCase())) return true;
  return INDIA_RE.test(post.location || '');
}

const TITLE_POSITIVE =
  /\bintern(ship)?s?\b|\btrainee\b|\bapprentice(ship)?\b|\bgraduate\b|\bgrad\b|\bfresher|\bcampus\b|entry[- ]level|early[- ]career|\buniversity\b|\bjunior\b|\bjr\.?\s|\bassociate\b|\b(engineer|developer|analyst|sde|swe)[- ]?(i|1)\b|\bsde[- ]?(i|1)\b|\bnew grad|\bplacement\b|\bstudent\b|\bco-?op\b/i;

const TITLE_NEGATIVE =
  /\bsenior\b|\bsr\.?\b|\blead\b|\bprincipal\b|\bstaff\b|\bmanager\b|\bdirector\b|\bhead\b|\bvp\b|\bvice president\b|\barchitect\b|\bchief\b|\b(ii|iii|iv|2|3)\b|\bexpert\b|\bspecialist ii\b/i;

const SR_ENTRY_LEVELS = new Set(['entry_level', 'internship', 'student']);

// Minimum years of experience mentioned in the description, or null.
export function minYearsRequired(text = '') {
  const re = /(\d{1,2})\s*(?:\+|\s*(?:-|–|to)\s*(\d{1,2}))?\s*\+?\s*(?:years?|yrs?)/gi;
  let min = null;
  for (const m of text.matchAll(re)) {
    const n = Number(m[1]);
    if (n > 20) continue;
    const ctx = text.slice(Math.max(0, m.index - 80), m.index + 80).toLowerCase();
    if (!/experience|exp\b|work/.test(ctx)) continue;
    min = min === null ? n : Math.min(min, n);
  }
  return min;
}

const DESC_FRESHER =
  /\bfreshers?\b|recent(ly)? graduat|new grad|no (prior )?experience|0\s*(-|–|to)\s*[12]\s*(years?|yrs?)|final[- ]year|pursuing (a |an )?(bachelor|master|b\.?tech|degree)|graduating in 20\d\d|batch of 20\d\d|20\d\d (graduates|batch|pass[- ]?outs?)/i;

/**
 * Cheap rule-based gate before the LLM: keeps posts that look entry-level so
 * we don't pay to tag thousands of senior roles. The LLM makes the final call.
 */
export function isFresherCandidate(post) {
  const title = post.title || '';
  if (TITLE_NEGATIVE.test(title) && !/\bintern/i.test(title)) return false;
  if (SR_ENTRY_LEVELS.has(post.experienceHint)) return true;
  if (/intern/i.test(post.employmentType || '')) return true;
  if (TITLE_POSITIVE.test(title)) {
    const yrs = minYearsRequired(post.description);
    return yrs === null || yrs <= 2;
  }
  const desc = post.description || '';
  if (DESC_FRESHER.test(desc)) return true;
  const yrs = minYearsRequired(desc);
  return yrs !== null && yrs <= 1;
}
