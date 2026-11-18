import { useEffect, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useSearchParams } from 'react-router-dom';
import { hydrateFilters, selectFilters } from '@redux/filtersSlice';
import { DEFAULT_FILTERS, filtersToParams, paramsToFilters } from '../utils/filterJobs.js';

/**
 * Two-way sync between Redux filters and the URL so filtered views are
 * shareable (e.g. /#/?roles=Marketing&cities=Pune) and back/forward works.
 *  - URL changed by someone else (load, back button, pasted link) -> hydrate store
 *  - store changed by the user -> replace URL
 *  - landing with an empty URL keeps existing store state (Insights drill-down)
 */
export function useFilterUrlSync() {
  const dispatch = useDispatch();
  const filters = useSelector(selectFilters);
  const [params, setParams] = useSearchParams();
  const lastSynced = useRef(null);
  const prevFilters = useRef(filters);

  useEffect(() => {
    const current = params.toString();
    if (current === lastSynced.current) return;
    if (lastSynced.current === null && current === '') {
      const next = filtersToParams(filters).toString();
      lastSynced.current = next;
      if (next) setParams(next, { replace: true });
      return;
    }
    lastSynced.current = current;
    dispatch(hydrateFilters({ ...DEFAULT_FILTERS, ...paramsToFilters(params) }));
  }, [params, filters, dispatch, setParams]);

  useEffect(() => {
    if (prevFilters.current === filters) return;
    prevFilters.current = filters;
    const next = filtersToParams(filters).toString();
    if (next !== lastSynced.current) {
      lastSynced.current = next;
      setParams(next, { replace: true });
    }
  }, [filters, setParams]);
}
