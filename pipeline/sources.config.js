// Public job-board APIs that companies publish for embedding their careers
// pages. Public/read-only access alone does not grant redistribution rights;
// verify each provider's current terms before enabling collection.
export const SOURCES = {
  // India-focused internship/fresher marketplace; terms review is still required.
  unstop: ['internships', 'jobs'],
  lever: [
    'cred', 'meesho', 'zeta', 'fampay', 'nium', 'hevodata', 'pocketfm',
    'outreach', 'mindtickle', 'paytm',
  ],
  greenhouse: [
    'hackerrank', 'groww', 'druva', 'rubrik', 'razorpaysoftwareprivatelimited',
    'coinbase', 'twilio', 'airbnb', 'stripe', 'databricks', 'gitlab',
    'cloudflare', 'elastic', 'okta', 'zscaler', 'mongodb', 'inmobi', 'turing',
    'toast', 'samsara', 'datadog', 'sumologic', 'newrelic', 'mixpanel',
  ],
  ashby: ['sarvam', 'atlan', 'spotdraft', 'composio', 'openai', 'notion'],
  smartrecruiters: [
    'BoschGroup', 'Swiggy', 'ServiceNow', 'Freshworks', 'Experian', 'SGS',
    'AveryDennison', 'Continental', 'Ubisoft2', 'WesternDigital',
  ],
};

export function getEnabledSources(value = process.env.PIPELINE_SOURCE_ALLOWLIST) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error('PIPELINE_SOURCE_ALLOWLIST must list reviewed source/board pairs before collection is enabled.');
  }

  const configured = new Set(
    Object.entries(SOURCES).flatMap(([source, boards]) => boards.map((board) => `${source}/${board}`))
  );
  const entries = value.split(',').map((entry) => entry.trim());
  if (entries.some((entry) => !entry)) {
    throw new Error('PIPELINE_SOURCE_ALLOWLIST contains an empty entry.');
  }
  if (new Set(entries).size !== entries.length) {
    throw new Error('PIPELINE_SOURCE_ALLOWLIST contains duplicate entries.');
  }

  return entries.map((entry) => {
    if (!configured.has(entry)) {
      throw new Error(`Unknown source/board in PIPELINE_SOURCE_ALLOWLIST: ${entry}`);
    }
    const [source, board] = entry.split('/');
    return { source, board };
  });
}

// Display names for board slugs whose API does not return a company name.
export const COMPANY_NAMES = {
  cred: 'CRED', meesho: 'Meesho', zeta: 'Zeta', fampay: 'FamPay', nium: 'Nium',
  hevodata: 'Hevo Data', pocketfm: 'Pocket FM', outreach: 'Outreach',
  mindtickle: 'Mindtickle', paytm: 'Paytm', hackerrank: 'HackerRank',
  groww: 'Groww', druva: 'Druva', rubrik: 'Rubrik',
  razorpaysoftwareprivatelimited: 'Razorpay', coinbase: 'Coinbase',
  twilio: 'Twilio', airbnb: 'Airbnb', stripe: 'Stripe', databricks: 'Databricks',
  gitlab: 'GitLab', cloudflare: 'Cloudflare', elastic: 'Elastic', okta: 'Okta',
  zscaler: 'Zscaler', mongodb: 'MongoDB', inmobi: 'InMobi', turing: 'Turing',
  toast: 'Toast', samsara: 'Samsara', datadog: 'Datadog', sumologic: 'Sumo Logic',
  newrelic: 'New Relic', mixpanel: 'Mixpanel', sarvam: 'Sarvam AI',
  atlan: 'Atlan', spotdraft: 'SpotDraft', composio: 'Composio', openai: 'OpenAI',
  notion: 'Notion',
};
