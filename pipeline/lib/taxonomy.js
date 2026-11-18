export const ROLES = [
  'Software Engineering',
  'Data Science & Analytics',
  'AI / Machine Learning',
  'DevOps & Cloud',
  'QA & Testing',
  'Cybersecurity',
  'Product Management',
  'Design (UI/UX)',
  'Hardware & Electronics',
  'Mechanical & Manufacturing',
  'Sales & Business Development',
  'Marketing',
  'Customer Support & Success',
  'Operations & Supply Chain',
  'Finance & Accounting',
  'HR & Recruiting',
  'Consulting & Strategy',
  'Legal & Compliance',
  'Content & Communications',
  'Other',
];

export const CITY_ALIASES = {
  bangalore: 'Bengaluru',
  bengaluru: 'Bengaluru',
  gurgaon: 'Gurugram',
  gurugram: 'Gurugram',
  delhi: 'New Delhi',
  'new delhi': 'New Delhi',
  'delhi ncr': 'New Delhi',
  ncr: 'New Delhi',
  bombay: 'Mumbai',
  mumbai: 'Mumbai',
  'navi mumbai': 'Mumbai',
  madras: 'Chennai',
  calcutta: 'Kolkata',
  cochin: 'Kochi',
  trivandrum: 'Thiruvananthapuram',
  mysore: 'Mysuru',
  vizag: 'Visakhapatnam',
  remote: 'Remote',
  'remote india': 'Remote',
  'remote (india)': 'Remote',
};

export function canonicalCity(city) {
  if (!city) return 'Unspecified';
  const raw = String(city).trim();
  const key = raw.toLowerCase().replace(/,?\s*india$/, '').trim();
  if (CITY_ALIASES[key]) return CITY_ALIASES[key];
  if (/remote|work from home|wfh/.test(key)) return 'Remote';
  return key.replace(/\b\w/g, (c) => c.toUpperCase()) || 'Unspecified';
}
