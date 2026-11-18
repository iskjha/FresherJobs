import { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Download, Filter, Loader2 } from 'lucide-react';
import { jobsApi } from '@api';
import { fetchJobsData } from '@redux/jobsSlice';
import { selectFacets, selectFilters, setJobType, toApiFilters } from '@redux/filtersSlice';
import { ErrorState, LoadingState } from '@components/StatusStates.jsx';
import PageHeader, { IconButton } from '@components/PageHeader.jsx';
import RefreshButton from '@components/RefreshButton.jsx';
import { useDocumentTitle } from '@hooks/useDocumentTitle';
import { formatNumber } from '@utils/format';
import { downloadBlob } from '@utils/download';
import SearchBar from '../components/SearchBar.jsx';
import FilterSidebar from '../components/FilterSidebar.jsx';
import JobsToolbar from '../components/JobsToolbar.jsx';
import JobBoard from '../components/JobBoard.jsx';
import { useFilterUrlSync } from '../hooks/useFilterUrlSync.js';
import { listFilterCount } from '../utils/filterJobs.js';

const TABS = [
  { value: 'all', label: 'All Jobs' },
  { value: 'Internship', label: 'Internships' },
  { value: 'Full-time', label: 'Full-time' },
];

export default function JobsPage() {
  useDocumentTitle('Opportunities');
  useFilterUrlSync();
  const dispatch = useDispatch();
  const { status, error, meta } = useSelector((s) => s.jobs);
  const facets = useSelector(selectFacets);
  const filters = useSelector(selectFilters);
  const summary = useSelector((s) => s.board.summary);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [exporting, setExporting] = useState(false);

  // Keep showing current data while a manual refresh is in flight.
  if (!meta && status === 'failed') return <ErrorState message={error} onRetry={() => dispatch(fetchJobsData())} />;
  if (!meta) return <LoadingState />;

  const typeCount = (type) => facets.jobTypes.find((t) => t.value === type)?.count ?? 0;
  const counts = { all: facets.total, Internship: typeCount('Internship'), 'Full-time': typeCount('Full-time') };
  const activeFilterCount =
    listFilterCount(filters.roles) + listFilterCount(filters.cities) + listFilterCount(filters.sources) + (filters.postedWithin !== 'any' ? 1 : 0) + (filters.sort !== 'newest' ? 1 : 0);

  const exportCsv = async () => {
    setExporting(true);
    try {
      downloadBlob(await jobsApi.exportCsv(toApiFilters(filters)), `fresher-jobs-${summary.total}.csv`);
    } catch (err) {
      alert(err.message);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="flex h-[calc(100dvh-3rem)] flex-col">
      {/* Fixed block: title, tabs, toolbar and result count never scroll; only the board does. */}
      <div className="shrink-0">
        <PageHeader
          title="Fresher Jobs"
          actions={
            <>
              <RefreshButton compact />
              <IconButton label="Download results as CSV" onClick={exportCsv} disabled={exporting} compact>
                {exporting ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} strokeWidth={1.8} />}
              </IconButton>
              <SearchBar />
              <button
                type="button"
                onClick={() => setFiltersOpen(true)}
                className="inline-flex h-10 items-center gap-2 rounded-md bg-[#e9eaee] px-4 text-[12px] font-medium text-slate-800 transition hover:bg-[#dfe1e6]"
              >
                <Filter size={16} strokeWidth={1.8} />
                Filter
                {activeFilterCount > 0 && (
                  <span className="rounded-full bg-accent px-1.5 text-[11px] font-semibold leading-5 text-white">{activeFilterCount}</span>
                )}
              </button>
            </>
          }
        />

        <div role="tablist" className="mb-6 flex gap-9 overflow-x-auto pl-1">
          {TABS.map((t) => {
            const on = filters.jobType === t.value;
            return (
              <button
                key={t.value}
                type="button"
                role="tab"
                aria-selected={on}
                onClick={() => dispatch(setJobType(t.value))}
                className={`flex items-center gap-2 whitespace-nowrap border-b-2 pb-2 text-[14px] transition ${
                  on ? 'border-slate-900 font-medium text-slate-900' : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                {t.label}
                <span className="grid h-5 min-w-[20px] place-items-center rounded-full bg-blue-100 px-1.5 text-[11px] font-semibold text-blue-600">
                  {formatNumber(counts[t.value])}
                </span>
              </button>
            );
          })}
        </div>

        <JobsToolbar />

        <div className="pb-5 pt-3">
          <p className="text-sm text-slate-400" aria-live="polite">
            Result: {summary.status === 'succeeded' ? formatNumber(summary.total) : '…'}
          </p>
        </div>
      </div>

      <div className="min-h-0 flex-1">
        <JobBoard />
      </div>

      {filtersOpen && <FilterSidebar onClose={() => setFiltersOpen(false)} />}
    </div>
  );
}
