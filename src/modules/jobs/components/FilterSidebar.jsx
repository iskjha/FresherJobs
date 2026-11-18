import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useDispatch, useSelector } from 'react-redux';
import { ArrowRight, ChevronDown, SlidersHorizontal } from 'lucide-react';
import { jobsApi } from '@api';
import { hydrateFilters, selectFacets, selectFilters, toApiFilters } from '@redux/filtersSlice';
import Dropdown from '@components/Dropdown/Dropdown.jsx';
import { useDebounce } from '@hooks/useDebounce';
import { POSTED_WITHIN_OPTIONS, SORT_OPTIONS, SOURCE_LABELS } from '@/config';
import { DEFAULT_FILTERS } from '../utils/filterJobs.js';

// Fields edited in the sidebar; search query stays on the page.
const DRAFT_KEYS = ['jobType', 'roles', 'cities', 'postedWithin', 'sources', 'sort'];
const pickDraft = (f) => Object.fromEntries(DRAFT_KEYS.map((k) => [k, f[k]]));
const toOptions = (facet, labelFor = (v) => v) => facet.map(({ value, count }) => ({ value, label: labelFor(value), count }));

const JOB_TYPE_OPTIONS = [
  { value: 'all', label: 'All types' },
  { value: 'Internship', label: 'Internship' },
  { value: 'Full-time', label: 'Full-time' },
];

function Section({ title, initiallyOpen = true, children }) {
  const [open, setOpen] = useState(initiallyOpen);
  return (
    <section className="mb-4">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="mb-2 flex w-full items-center justify-between gap-2 px-1 text-left text-[11px] font-medium uppercase tracking-wide text-slate-400"
      >
        {title}
        <ChevronDown size={14} className={`transition ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && <div className="flex flex-col rounded-lg border border-slate-100 bg-white">{children}</div>}
    </section>
  );
}

/**
 * Right-hand filter drawer. Edits a draft copy of the filters; nothing
 * changes on the page until "Show results" (Clear all applies immediately).
 */
export default function FilterSidebar({ onClose }) {
  const dispatch = useDispatch();
  const filters = useSelector(selectFilters);
  const facets = useSelector(selectFacets);
  const [draft, setDraft] = useState(() => pickDraft(filters));
  const [resultCount, setResultCount] = useState(null);
  const panelRef = useRef(null);

  const update = (key) => (value) => setDraft((d) => ({ ...d, [key]: value }));

  // Live "Show N results" count from the API, debounced while editing.
  const draftQuery = useDebounce(JSON.stringify(toApiFilters({ ...filters, ...draft })), 250);
  useEffect(() => {
    const controller = new AbortController();
    jobsApi
      .getBoard(JSON.parse(draftQuery), { signal: controller.signal })
      .then((board) => setResultCount(board.total))
      .catch(() => {
        if (!controller.signal.aborted) setResultCount(null);
      });
    return () => controller.abort();
  }, [draftQuery]);

  useEffect(() => {
    panelRef.current?.focus();
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  const apply = () => {
    dispatch(hydrateFilters(draft));
    onClose();
  };
  const clearAll = () => {
    const cleared = pickDraft(DEFAULT_FILTERS);
    setDraft(cleared);
    dispatch(hydrateFilters(cleared));
  };

  return createPortal(
    <>
      <div className="fixed inset-0 z-40 bg-slate-900/20" onClick={onClose} aria-hidden="true" />
      <aside
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label="Job filters"
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            e.stopPropagation();
            onClose();
          }
        }}
        className="fixed bottom-0 right-0 top-0 z-50 flex animate-[slideIn_.2s_ease-out] flex-col bg-white text-slate-700 shadow-[-2px_0_10px_rgba(0,0,0,0.06)] outline-none"
        style={{ width: 'min(342px, 85vw)' }}
      >
        <button
          type="button"
          title="Close"
          aria-label="Close filters"
          onClick={onClose}
          className="absolute -left-[17px] top-[22px] z-[60] inline-flex h-7 w-[34px] items-center justify-center rounded-lg border border-slate-100 bg-white text-accent shadow-[0_2px_8px_rgba(0,0,0,0.12)] transition-colors hover:bg-blue-50"
        >
          <ArrowRight size={16} strokeWidth={2.5} />
        </button>

        <header className="flex shrink-0 items-center gap-2.5 border-b border-slate-100 px-5 py-[18px]">
          <SlidersHorizontal size={18} className="shrink-0 text-accent" />
          <div className="min-w-0 flex-1">
            <h3 className="text-sm font-bold leading-snug text-slate-800">Job Filters</h3>
            <p className="mt-0.5 text-[11px] font-medium text-slate-500">Refine your results</p>
          </div>
        </header>

        <div className="thin-scroll min-h-0 flex-1 overflow-y-auto bg-[#fefefe] px-3 py-4 pb-12">
          <Section title="Core Filters">
            <Dropdown variant="row" label="Job type" options={JOB_TYPE_OPTIONS} value={draft.jobType} onChange={update('jobType')} />
            <Dropdown
              variant="row"
              label="Role"
              multiple
              searchable
              allLabel="All"
              searchPlaceholder="Search roles…"
              options={toOptions(facets.roles)}
              value={draft.roles}
              onChange={update('roles')}
            />
            <Dropdown
              variant="row"
              label="City"
              multiple
              searchable
              allLabel="All"
              searchPlaceholder="Search cities…"
              options={toOptions(facets.cities)}
              value={draft.cities}
              onChange={update('cities')}
            />
          </Section>
          <Section title="Additional Info">
            <Dropdown variant="row" label="Posted" options={POSTED_WITHIN_OPTIONS} value={draft.postedWithin} onChange={update('postedWithin')} />
            <Dropdown
              variant="row"
              label="Source"
              multiple
              allLabel="All"
              options={toOptions(facets.sources, (v) => SOURCE_LABELS[v] || v)}
              value={draft.sources}
              onChange={update('sources')}
            />
            <Dropdown variant="row" label="Sort by" options={SORT_OPTIONS} value={draft.sort} onChange={update('sort')} />
          </Section>
          <p className="px-1 text-[11px] leading-relaxed text-slate-400">
            Role and city are tagged by an LLM from each posting’s full text. Work-from-home roles are grouped under “Remote”.
          </p>
        </div>

        <footer className="flex shrink-0 items-center justify-center gap-4 border-t border-slate-100 bg-white py-3">
          <button type="button" onClick={clearAll} className="text-xs font-medium text-slate-900 hover:text-accent">
            Clear all
          </button>
          <button
            type="button"
            onClick={apply}
            className="rounded-full bg-accent px-6 py-2.5 text-xs font-medium text-white transition-colors hover:bg-accent-hover"
          >
            {resultCount == null ? 'Show results' : `Show ${resultCount.toLocaleString('en-IN')} results`}
          </button>
        </footer>
      </aside>
    </>,
    document.body
  );
}
