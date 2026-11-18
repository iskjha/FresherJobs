import { CheckCircle2, Code2, Copy, Database, Filter, Globe, Server, Sparkles } from 'lucide-react';
import PageHeader from '@components/PageHeader.jsx';
import { useDocumentTitle } from '@hooks/useDocumentTitle';
import { REPO_URL } from '@/config';

const STAGES = [
  { icon: Globe, name: 'Collect', desc: 'Unstop, Lever, Greenhouse, Ashby and SmartRecruiters public JSON APIs — 52 boards.' },
  { icon: Filter, name: 'Filter', desc: 'India location check, then a rule-based entry-level pre-filter to avoid tagging clearly senior posts.' },
  { icon: Copy, name: 'Dedupe', desc: 'Same URL or id → same company + title + city → fuzzy title match (Jaccard ≥ 0.85).' },
  { icon: Sparkles, name: 'Tag', desc: 'gpt-5.4 in batches of 15, JSON mode, fixed taxonomy. Tag cache lives on each job.' },
  { icon: Database, name: 'Store', desc: 'Upsert into MongoDB (jobs, runs, evaluations). Vanished postings are marked closed.' },
  { icon: Server, name: 'Serve', desc: 'Express API with filters and cursor pagination. node-cron re-runs daily at 06:30 IST.' },
];

const STACK = ['Node 22', 'MongoDB', 'Express 5', 'node-cron', 'gpt-5.4', 'React 18', 'Redux Toolkit', 'Tailwind'];

const ISSUES = [
  {
    broke: 'Only 66 fresher posts out of 2,151 India jobs from 50 company boards',
    fix: 'Company ATS boards mostly hire experienced people. Added Unstop, an India-first internship marketplace. Public API access still requires a separate terms and licensing review.',
  },
  {
    broke: 'LLM put a city on remote jobs (3 of 4 work-from-home posts in the sample)',
    fix: 'Structured source data now beats the model: if the source says WFH, the city becomes Remote. City accuracy went from 94% to 100% on the sample.',
  },
  {
    broke: 'Role confusions: tax → Legal, cosmetics R&D → Hardware, map rating → Data Science',
    fix: 'Explicit edge-case rules in the prompt (v2), with a prompt-version bump that invalidates the cache.',
  },
  {
    broke: 'Dedupe let a third copy through when the second copy was dropped',
    fix: 'Caught by a unit test — dropped posts now also register their URL and id.',
  },
  {
    broke: 'Re-tagging every post daily would cost money for nothing',
    fix: 'The raw LLM answer is cached by a hash of prompt version, model and post content; validation rules re-run for free.',
  },
  {
    broke: 'SmartRecruiters list API has no descriptions; 600+ detail calls are slow',
    fix: 'Details are fetched lazily, only for posts that pass the cheap title filter.',
  },
  {
    broke: 'Static JSON could not page, filter or count at scale',
    fix: 'Moved to MongoDB + Express. Filters are indexed queries; columns page with a keyset cursor (sort values + _id), so nothing is skipped or repeated.',
  },
  {
    broke: 'Moving to the database would have re-tagged ~950 posts',
    fix: 'The existing tag cache was imported first, so the first DB run sent only 32 new posts to the LLM ($0.05).',
  },
  {
    broke: 'A partial source outage could close valid jobs, and incomplete LLM answers could receive fallback tags',
    fix: 'Only successfully collected boards can close vanished jobs. Invalid or missing tags fail after retry, and publication requires at least 200 confirmed fresher posts.',
  },
];

const TERMS = [
  'Uses public ATS job-board APIs and Unstop’s public API. Public access or a robots.txt allowance is not permission to collect or redistribute data.',
  'Verify each provider’s current terms, licensing and rate limits before collection; disable any source without the required permission.',
  'No HTML scraping, login bypass, or collection from LinkedIn, Naukri, Indeed or Internshala.',
  'One run a day with bounded concurrency, retries with backoff and an identifying User-Agent.',
  'Only a short snippet is shown; every card links to the original posting to apply.',
];

function SectionTitle({ children, aside }) {
  return (
    <h2 className="mb-3 flex items-center justify-between text-[15px] font-semibold text-slate-900">
      {children}
      {aside && <span className="text-[11px] font-normal text-slate-400">{aside}</span>}
    </h2>
  );
}

export default function AboutPage() {
  useDocumentTitle('How it works');
  return (
    <div className="flex h-[calc(100dvh-3rem)] flex-col">
      {/* Fixed: title + pipeline. Only the content below scrolls. */}
      <div className="w-full shrink-0 pb-6 lg:w-[80%]">
        <PageHeader
          title="How it works"
          subtitle="A daily pipeline writes every job into MongoDB; an Express API serves filtered, cursor-paginated results to this app."
          actions={
            REPO_URL && (
              <a
                href={REPO_URL}
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-11 items-center gap-2 rounded-md bg-[#e9eaee] px-4 text-[14px] font-medium text-slate-800 transition hover:bg-[#dfe1e6]"
              >
                <Code2 size={17} /> Source
              </a>
            )
          }
        />

        <div className="rounded-2xl bg-[#f8f8fb] p-5">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2 px-1">
            <p className="text-[13px] font-semibold text-slate-800">Pipeline</p>
            <div className="flex flex-wrap gap-1.5">
              {STACK.map((s) => (
                <span key={s} className="rounded-full bg-white px-2.5 py-0.5 text-[11px] text-slate-500 ring-1 ring-slate-100">
                  {s}
                </span>
              ))}
            </div>
          </div>
          <ol className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {STAGES.map(({ icon: Icon, name, desc }, i) => (
              <li key={name} className="min-w-0 rounded-2xl border border-slate-100 bg-white px-4 py-3.5">
                <p className="flex items-center gap-3">
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[#eef0fd] text-[#4f46e5]">
                    <Icon size={16} strokeWidth={1.8} />
                  </span>
                  <span className="text-[13px] font-semibold text-slate-800">{name}</span>
                  <span className="ml-auto text-[11px] font-medium tabular-nums text-slate-300">{String(i + 1).padStart(2, '0')}</span>
                </p>
                <p className="mt-2 text-[12px] leading-relaxed text-slate-500">{desc}</p>
              </li>
            ))}
          </ol>
        </div>
      </div>

      <div className="thin-scroll -mx-2 min-h-0 flex-1 overflow-y-auto px-2 pb-6">
        <div className="grid w-full gap-5 lg:w-[80%] xl:grid-cols-[minmax(0,1fr)_340px]">
          <section className="card p-5">
            <SectionTitle aside={`${ISSUES.length} issues`}>What broke, and how it was fixed</SectionTitle>
            <ol className="divide-y divide-slate-100">
              {ISSUES.map(({ broke, fix }, i) => (
                <li key={broke} className="flex gap-3 py-3 first:pt-1 last:pb-1">
                  <span className="w-5 shrink-0 pt-0.5 text-right text-[11px] tabular-nums text-slate-400">{i + 1}</span>
                  <div className="min-w-0 space-y-1.5">
                    <p className="flex items-start gap-2 text-[13px] font-medium text-slate-800">
                      <span className="mt-px shrink-0 rounded bg-red-50 px-1.5 text-[10px] font-semibold leading-4 text-red-500">Problem</span>
                      {broke}
                    </p>
                    <p className="flex items-start gap-2 text-[12px] leading-relaxed text-slate-500">
                      <span className="mt-px shrink-0 rounded bg-emerald-50 px-1.5 text-[10px] font-semibold leading-4 text-emerald-600">Fix</span>
                      {fix}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          </section>

          <section className="card h-fit p-5">
            <SectionTitle>Respecting each site’s terms</SectionTitle>
            <ul className="space-y-3">
              {TERMS.map((t) => (
                <li key={t} className="flex gap-2.5 text-[12px] leading-relaxed text-slate-600">
                  <CheckCircle2 size={15} className="mt-px shrink-0 text-emerald-500" />
                  {t}
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
}
