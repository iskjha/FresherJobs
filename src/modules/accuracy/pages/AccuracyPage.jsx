import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { AlertTriangle, CircleDollarSign, Cpu, MapPin, Tag, UserCheck } from 'lucide-react';
import { fetchEvaluation, fetchJobsData } from '@redux/jobsSlice';
import PageHeader from '@components/PageHeader.jsx';
import StatTiles from '@components/StatTiles.jsx';
import RefreshButton from '@components/RefreshButton.jsx';
import { ErrorState, LoadingState } from '@components/StatusStates.jsx';
import { useDocumentTitle } from '@hooks/useDocumentTitle';
import { formatDateTime, formatNumber, formatUsd } from '@utils/format';

const pct = (n) => (Number.isFinite(n) ? `${n}%` : '—');

function Delta({ now, before }) {
  if (!Number.isFinite(before)) return 'Hand-checked sample';
  const d = Math.round((now - before) * 10) / 10;
  const cls = d > 0 ? 'text-emerald-600' : d < 0 ? 'text-accent' : 'text-slate-500';
  return (
    <span>
      <span className={`font-medium ${cls}`}>{d > 0 ? `+${d}` : d} pts</span> vs {pct(before)} before tuning
    </span>
  );
}

export default function AccuracyPage() {
  useDocumentTitle('Accuracy & cost');
  const dispatch = useDispatch();
  const { evaluation, evaluationStatus, evaluationError, meta, status, error } = useSelector((s) => s.jobs);

  useEffect(() => {
    if (evaluationStatus === 'idle') dispatch(fetchEvaluation());
  }, [dispatch, evaluationStatus]);

  if (evaluationStatus === 'failed') return <ErrorState message={evaluationError} onRetry={() => dispatch(fetchEvaluation())} />;
  if (status === 'failed') return <ErrorState message={error} onRetry={() => dispatch(fetchJobsData())} />;
  if (evaluationStatus !== 'succeeded' || !meta) return <LoadingState label="Loading evaluation…" />;

  const { accuracy, baseline, coverage } = evaluation;
  const u = meta.llmUsage;
  const rows = [
    ['Posts sent to LLM', formatNumber(u.postsTagged)],
    ['Served from cache', formatNumber(u.cacheHits)],
    ['API calls (15 posts/call)', formatNumber(u.calls)],
    ['Input tokens', formatNumber(u.promptTokens)],
    ['Output tokens', formatNumber(u.completionTokens)],
    ['Run cost', formatUsd(u.costUsd, 4)],
  ];

  return (
    <div className="flex h-[calc(100dvh-3rem)] flex-col">
      {/* Fixed: title + summary tiles. Only the content below scrolls. */}
      <div className="w-full shrink-0 pb-6 lg:w-[80%]">
        <PageHeader
          title="Accuracy & cost"
          subtitle={`Historical result · ${evaluation.sampleSize} reviewed-label posts · ${evaluation.model} · prompt ${evaluation.promptVersion}`}
          actions={<RefreshButton onRefresh={() => dispatch(fetchEvaluation())} />}
        />
        <StatTiles
          items={[
            { icon: Tag, label: 'Role accuracy', value: pct(accuracy.role), hint: <Delta now={accuracy.role} before={baseline?.accuracy.role} /> },
            { icon: MapPin, label: 'City accuracy', value: pct(accuracy.city), hint: <Delta now={accuracy.city} before={baseline?.accuracy.city} /> },
            { icon: UserCheck, label: 'Fresher flag', value: pct(accuracy.fresherFlag), hint: <Delta now={accuracy.fresherFlag} before={baseline?.accuracy.fresherFlag} /> },
            { icon: CircleDollarSign, label: 'Cost / 1,000 posts', value: formatUsd(meta.costPer1000PostsUsd), hint: 'LLM tagging at list price' },
          ]}
        />
      </div>

      <div className="thin-scroll -mx-2 min-h-0 flex-1 overflow-y-auto px-2 pb-6">
        <div className="w-full space-y-5 lg:w-[80%]">
          {coverage && !coverage.canRescore && (
            <div role="status" className="flex gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] text-amber-900">
              <AlertTriangle size={16} className="mt-0.5 shrink-0" />
              <p className="leading-relaxed">
                <span className="font-semibold">Historical scores, not a fresh re-score. </span>
                Only {coverage.currentPredictions}/{coverage.sampleSize} sampled posts have predictions in the current database.
                A current re-score is blocked: {coverage.missingPredictions} missing or invalid prediction(s).
                Saved sample predictions are not substituted.
              </p>
            </div>
          )}
          {baseline && (
            <div className="flex gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] text-amber-900">
              <AlertTriangle size={16} className="mt-0.5 shrink-0 text-amber-600" />
              <p className="leading-relaxed">
                <span className="font-semibold">Read this honestly: </span>
                prompt {baseline.promptVersion} scored role {pct(baseline.accuracy.role)}, city {pct(baseline.accuracy.city)}, fresher{' '}
                {pct(baseline.accuracy.fresherFlag)} on this sample <em>before</em> tuning. The {evaluation.promptVersion}{' '}
                fixes were designed after looking at these errors, so the recorded scores are in-sample and likely optimistic.
                A new, independently reviewed sample is needed to measure generalization.
              </p>
            </div>
          )}

          <div className="grid gap-5 lg:grid-cols-2">
            <section className="card p-5">
              <h2 className="mb-3 flex items-center gap-2 text-[15px] font-semibold text-slate-900">
                <Cpu size={17} strokeWidth={1.8} className="text-accent" /> Latest run usage
              </h2>
              <dl className="divide-y divide-line text-[13px]">
                {rows.map(([k, v]) => (
                  <div key={k} className="flex justify-between px-1 py-2.5">
                    <dt className="text-slate-500">{k}</dt>
                    <dd className="font-semibold tabular-nums text-slate-900">{v}</dd>
                  </div>
                ))}
              </dl>
              <p className="mt-3 text-[11px] leading-relaxed text-slate-400">
                Estimated LLM-only cost; hosting and database costs are excluded.
                Pricing per 1M tokens: ${u.pricingPerMillion.input} input · ${u.pricingPerMillion.cachedInput} cached · ${u.pricingPerMillion.output} output.
                Daily runs only pay for new or edited posts, because tags are cached by content hash.
              </p>
            </section>

            <section className="card p-5">
              <h2 className="mb-3 flex items-center justify-between text-[15px] font-semibold text-slate-900">
                Recorded errors
                <span className="rounded-full bg-blue-100 px-2 text-[11px] font-semibold leading-5 text-blue-600">{evaluation.errors.length}</span>
              </h2>
              <ul className="space-y-2.5">
                {evaluation.errors.map((e) => (
                  <li key={e.url} className="rounded-lg border border-slate-100 bg-[#f8f8fb] p-3">
                    <a href={e.url} target="_blank" rel="noreferrer" className="text-[13px] font-medium text-slate-900 hover:text-accent">
                      {e.title}
                    </a>
                    <span className="text-[12px] text-slate-400"> · {e.company}</span>
                    <div className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[11px]">
                      <span className="rounded bg-red-50 px-1.5 font-medium text-red-500">LLM</span>
                      <span className="text-slate-600">
                        {e.llm.role} · {e.llm.city} · fresher={String(e.llm.isFresher)}
                      </span>
                      <span className="rounded bg-emerald-50 px-1.5 font-medium text-emerald-600">Truth</span>
                      <span className="text-slate-600">
                        {e.truth.role} · {e.truth.city} · fresher={String(e.truth.isFresher)}
                      </span>
                    </div>
                    {e.notes && <p className="mt-2 text-[11px] text-slate-400">{e.notes}</p>}
                  </li>
                ))}
              </ul>
            </section>
          </div>
          <p className="text-[11px] text-slate-400">
            Role and city both correct: {pct(accuracy.roleAndCity)}. Evaluated {formatDateTime(evaluation.evaluatedAt)}.
          </p>
        </div>
      </div>
    </div>
  );
}
