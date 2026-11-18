import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Loader2 } from 'lucide-react';
import { jobsApi } from '@api';
import { columnFailed, columnLoaded, columnRequested, fetchBoard, resetBoard } from '@redux/boardSlice';
import { selectFilters, toApiFilters } from '@redux/filtersSlice';
import { EmptyState, ErrorState } from '@components/StatusStates.jsx';
import { COLUMN_PAGE_SIZE } from '@/config';
import JobCard from './JobCard.jsx';

const BAR_COLORS = ['bg-sky-200', 'bg-emerald-100', 'bg-amber-100', 'bg-orange-200', 'bg-indigo-200', 'bg-rose-200', 'bg-teal-200', 'bg-violet-200'];
const LOAD_THRESHOLD_PX = 150;

function SkeletonCard() {
  return (
    <div className="animate-pulse rounded-xl bg-white p-3 ring-1 ring-slate-100">
      <div className="flex gap-2.5">
        <div className="h-8 w-8 rounded-full bg-slate-200" />
        <div className="flex-1 space-y-1.5">
          <div className="h-2 w-1/3 rounded bg-slate-200" />
          <div className="h-2.5 w-3/4 rounded bg-slate-200" />
          <div className="h-2 w-1/2 rounded bg-slate-100" />
        </div>
      </div>
      <div className="mt-4 h-3 w-16 rounded bg-red-50" />
    </div>
  );
}

function ColumnShell({ title, subtitle, barColor, children, bodyRef, onScroll }) {
  return (
    <section className="flex h-full w-[300px] shrink-0 flex-col" aria-label={title}>
      <div className={`h-1 rounded-full ${barColor}`} />
      <header className="px-3 pb-3 pt-4">
        <h2 className="truncate text-[12px] font-semibold text-slate-900">{title}</h2>
        <p className="mt-0.5 text-[11px] text-slate-500">{subtitle}</p>
      </header>
      <div
        ref={bodyRef}
        onScroll={onScroll}
        className="thin-scroll flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto rounded-xl bg-[#f6f6f8] p-3"
      >
        {children}
      </div>
    </section>
  );
}

// One column: fetches its own pages (15 at a time) from POST /api/jobs/search
// with an opaque cursor and asks for the next page within 150px of the bottom.
function JobColumn({ boardKey, apiFilters, column, barColor }) {
  const { role, total, internships } = column;
  const dispatch = useDispatch();
  const col = useSelector((s) => s.board.columns[role]);
  const bodyRef = useRef(null);
  const inFlight = useRef(false);

  const fetchPage = useCallback(
    async (cursor) => {
      if (inFlight.current) return;
      inFlight.current = true;
      dispatch(columnRequested({ key: boardKey, column: role }));
      try {
        const { jobs, meta } = await jobsApi.searchJobs({
          filters: apiFilters,
          role,
          pageSize: COLUMN_PAGE_SIZE,
          before: cursor || undefined,
        });
        dispatch(columnLoaded({ key: boardKey, column: role, items: jobs, nextCursor: meta.nextCursor, hasMore: meta.hasMore, append: Boolean(cursor) }));
      } catch (err) {
        console.error(`Failed to load "${role}" column`, err);
        dispatch(columnFailed({ key: boardKey, column: role }));
      } finally {
        inFlight.current = false;
      }
    },
    [dispatch, boardKey, apiFilters, role]
  );

  // First page on mount (skipped when the column is already cached).
  useEffect(() => {
    if (!col) fetchPage(null);
  }, [col, fetchPage]);

  // If a page doesn't fill the column there is nothing to scroll, so keep
  // loading until it overflows or the column is exhausted.
  useEffect(() => {
    const el = bodyRef.current;
    if (el && col?.loaded && col.hasMore && !col.loading && el.scrollHeight - el.clientHeight < LOAD_THRESHOLD_PX) {
      fetchPage(col.cursor);
    }
  }, [col, fetchPage]);

  const onScroll = (e) => {
    const el = e.currentTarget;
    if (col?.hasMore && !col.loading && el.scrollHeight - el.scrollTop - el.clientHeight < LOAD_THRESHOLD_PX) {
      fetchPage(col.cursor);
    }
  };

  const items = col?.items || [];
  return (
    <ColumnShell
      title={role}
      barColor={barColor}
      bodyRef={bodyRef}
      onScroll={onScroll}
      subtitle={
        <>
          {total} Jobs <span className="mx-1.5 text-slate-300">|</span>
          <span className="font-medium text-slate-700">{internships} Internships</span>
        </>
      }
    >
      {!col?.loaded ? (
        <>
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </>
      ) : (
        items.map((job) => <JobCard key={job.id} job={job} />)
      )}
      {col?.loaded && col.loading && (
        <div className="flex justify-center py-2" role="status" aria-label="Loading more jobs">
          <Loader2 size={16} className="animate-spin text-accent" />
        </div>
      )}
      {col?.loaded && !items.length && <p className="py-10 text-center text-[11px] text-slate-400">No jobs yet</p>}
      {col?.loaded && !col.hasMore && items.length > 0 && <p className="py-1 text-center text-[10px] text-slate-400">End</p>}
    </ColumnShell>
  );
}

// Kanban board: one column per LLM-tagged role, largest first. Columns come
// from POST /api/jobs/board for the current filters.
export default function JobBoard() {
  const dispatch = useDispatch();
  const filters = useSelector(selectFilters);
  const generatedAt = useSelector((s) => s.jobs.meta?.generatedAt);
  const { key: storedKey, summary } = useSelector((s) => s.board);
  const apiFilters = useMemo(() => toApiFilters(filters), [filters]);

  // Any filter/search/data change gives a new key → cached columns are
  // cleared and columns remount to fetch their first page again.
  const boardKey = useMemo(() => JSON.stringify([apiFilters, generatedAt]), [apiFilters, generatedAt]);

  useEffect(() => {
    if (storedKey === boardKey) return;
    dispatch(resetBoard(boardKey));
    dispatch(fetchBoard({ filters: apiFilters, key: boardKey }));
  }, [dispatch, storedKey, boardKey, apiFilters]);

  if (storedKey !== boardKey || summary.status === 'idle' || (summary.status === 'loading' && !summary.columns.length)) {
    return (
      <div className="flex h-full gap-6 overflow-hidden" role="status" aria-label="Loading board">
        {[0, 1, 2, 3].map((i) => (
          <ColumnShell key={i} title="" subtitle="Loading…" barColor={BAR_COLORS[i]}>
            <SkeletonCard />
            <SkeletonCard />
          </ColumnShell>
        ))}
      </div>
    );
  }
  if (summary.status === 'failed') {
    return <ErrorState message={summary.error} onRetry={() => dispatch(fetchBoard({ filters: apiFilters, key: boardKey }))} />;
  }
  if (!summary.columns.length) {
    return <EmptyState title="No jobs match these filters">Try removing a filter or searching a broader term.</EmptyState>;
  }

  return (
    <div className="thin-scroll -mx-1 flex h-full gap-6 overflow-x-auto px-1 pb-2">
      {summary.columns.map((column, i) => (
        <JobColumn key={column.role} boardKey={boardKey} apiFilters={apiFilters} column={column} barColor={BAR_COLORS[i % BAR_COLORS.length]} />
      ))}
    </div>
  );
}
