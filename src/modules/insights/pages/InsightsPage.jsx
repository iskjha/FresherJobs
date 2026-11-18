import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { CheckCircle2, Copy, Filter, Layers, XCircle } from 'lucide-react';
import { resetFilters, selectFacets, toggleCity, toggleRole } from '@redux/filtersSlice';
import BarList from '@components/BarList.jsx';
import PageHeader from '@components/PageHeader.jsx';
import StatTiles from '@components/StatTiles.jsx';
import RefreshButton from '@components/RefreshButton.jsx';
import { ErrorState, LoadingState } from '@components/StatusStates.jsx';
import { useDocumentTitle } from '@hooks/useDocumentTitle';
import { ROUTES } from '@/routes/paths.js';
import { formatNumber } from '@utils/format';
import { SOURCE_LABELS } from '@/config';

function Funnel({ counts }) {
  const steps = [
    ['Fetched from job boards', counts.fetched],
    ['Located in India', counts.india],
    ['Look entry-level (rules)', counts.candidates],
    ['After de-duplication', counts.tagged],
    ['Confirmed fresher by LLM', counts.published],
  ];
  return (
    <ol className="space-y-4">
      {steps.map(([label, n]) => (
        <li key={label}>
          <div className="flex justify-between text-sm">
            <span className="text-slate-600">{label}</span>
            <span className="font-semibold tabular-nums text-slate-900">{formatNumber(n)}</span>
          </div>
          <div className="mt-2 h-1.5 rounded-full bg-slate-100">
            <div className="h-1.5 rounded-full bg-accent" style={{ width: `${Math.max(1, (n / counts.fetched) * 100)}%` }} />
          </div>
        </li>
      ))}
    </ol>
  );
}

export default function InsightsPage() {
  useDocumentTitle('Insights');
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { status, error, meta } = useSelector((s) => s.jobs);
  const facets = useSelector(selectFacets);

  if (!meta && status === 'failed') return <ErrorState message={error} />;
  if (!meta) return <LoadingState />;

  const drill = (action) => (value) => {
    dispatch(resetFilters());
    dispatch(action(value));
    navigate(ROUTES.jobs);
  };

  const okSources = meta.sources.filter((s) => s.ok);
  return (
    <div className="flex h-[calc(100dvh-3rem)] flex-col">
      {/* Fixed: title + summary tiles. Only the cards below scroll. */}
      <div className="w-full shrink-0 pb-6 lg:w-[80%]">
        <PageHeader title="Insights" subtitle="What today’s fresher market looks like. Click a row to see those jobs." actions={<RefreshButton />} />

        <StatTiles
          items={[
            { icon: Layers, label: 'Fetched today', value: formatNumber(meta.counts.fetched), hint: `${okSources.length} / ${meta.sources.length} boards healthy` },
            { icon: Filter, label: 'Entry-level candidates', value: formatNumber(meta.counts.candidates), hint: 'After India + rules filter' },
            { icon: Copy, label: 'Duplicates removed', value: formatNumber(meta.counts.duplicatesRemoved), hint: 'URL, exact and fuzzy matches' },
            { icon: CheckCircle2, label: 'Published', value: formatNumber(meta.counts.published), hint: `Pipeline ran in ${meta.durationSec}s` },
          ]}
        />
      </div>

      <div className="thin-scroll -mx-2 min-h-0 flex-1 overflow-y-auto px-2 pb-6">
      <div className="grid w-full gap-5 lg:w-[80%] lg:grid-cols-2">
        <section className="card p-5">
          <h2 className="mb-3 flex items-center justify-between text-[15px] font-semibold text-slate-900">
            Roles <span className="text-[11px] font-normal text-slate-400">{facets.roles.length} categories</span>
          </h2>
          <BarList items={facets.roles} total={facets.total} onSelect={drill(toggleRole)} limit={20} />
        </section>
        <section className="card p-5">
          <h2 className="mb-3 flex items-center justify-between text-[15px] font-semibold text-slate-900">
            Top cities <span className="text-[11px] font-normal text-slate-400">Top 20 of {facets.cities.length}</span>
          </h2>
          <BarList items={facets.cities} total={facets.total} onSelect={drill(toggleCity)} limit={20} />
        </section>
        <section className="card p-5">
          <h2 className="text-[15px] font-semibold text-slate-900">Pipeline funnel</h2>
          <p className="mb-5 mt-1 text-sm text-slate-500">Latest daily run</p>
          <Funnel counts={meta.counts} />
        </section>
        <section className="card p-5">
          <h2 className="text-[15px] font-semibold text-slate-900">Source health</h2>
          <p className="mb-4 mt-1 text-sm text-slate-500">A failing board never blocks the run.</p>
          <div className="thin-scroll max-h-80 overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-panel text-left text-[11px] uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="py-2 font-medium">Board</th>
                  <th className="py-2 font-medium">Provider</th>
                  <th className="py-2 text-right font-medium">Posts</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {[...meta.sources]
                  .sort((a, b) => b.fetched - a.fetched)
                  .map((s) => (
                    <tr key={`${s.source}/${s.board}`}>
                      <td className="flex items-center gap-2 py-2 text-slate-700">
                        {s.ok ? <CheckCircle2 size={14} className="text-emerald-600" /> : <XCircle size={14} className="text-accent" />}
                        <span title={s.error}>{s.board}</span>
                      </td>
                      <td className="py-2 text-slate-500">{SOURCE_LABELS[s.source] || s.source}</td>
                      <td className="py-2 text-right tabular-nums text-slate-700">{formatNumber(s.fetched)}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
      </div>
    </div>
  );
}
