const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });

export function timeAgo(iso, now = Date.now()) {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return 'date unknown';
  const sec = Math.round((t - now) / 1000);
  const units = [
    ['year', 31536000],
    ['month', 2592000],
    ['week', 604800],
    ['day', 86400],
    ['hour', 3600],
    ['minute', 60],
  ];
  for (const [unit, s] of units) {
    if (Math.abs(sec) >= s) return rtf.format(Math.round(sec / s), unit);
  }
  return 'just now';
}

export function formatDateTime(iso) {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return '—';
  return new Date(t).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Kolkata' }) + ' IST';
}

export const formatNumber = (n) => (Number.isFinite(n) ? n.toLocaleString('en-IN') : '—');

export const formatUsd = (n, digits = 2) => (Number.isFinite(n) ? `$${n.toFixed(digits)}` : '—');

// "16 Nov, 26" — compact date used on cards (fixed month names; en-GB ICU
// renders September as "Sept").
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export function formatChipDate(iso) {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return '—';
  // Shift to IST so the calendar day matches what Indian users expect.
  const d = new Date(t + 5.5 * 3_600_000);
  return `${String(d.getUTCDate()).padStart(2, '0')} ${MONTHS[d.getUTCMonth()]}, ${String(d.getUTCFullYear()).slice(2)}`;
}

export function initials(name = '') {
  const words = name.replace(/[^\p{L}\p{N} ]/gu, ' ').split(/\s+/).filter(Boolean);
  return ((words[0]?.[0] || '') + (words.length > 1 ? words[1][0] : '')).toUpperCase() || '?';
}
