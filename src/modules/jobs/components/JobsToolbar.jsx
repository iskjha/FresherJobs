import { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Check, Link2 } from 'lucide-react';
import { selectFacets, selectFilters, setCities, setPostedWithin, setRoles, setSort } from '@redux/filtersSlice';
import Dropdown from '@components/Dropdown/Dropdown.jsx';
import { POSTED_WITHIN_OPTIONS, SORT_OPTIONS } from '@/config';

const toOptions = (facet) => facet.map(({ value, count }) => ({ value, label: value, count }));

const Divider = () => <span className="mx-1 h-7 w-px bg-slate-200" aria-hidden="true" />;

export default function JobsToolbar() {
  const dispatch = useDispatch();
  const filters = useSelector(selectFilters);
  const facets = useSelector(selectFacets);
  const [copied, setCopied] = useState(false);

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard can be blocked (http/permissions); the URL bar still has the link.
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <Dropdown variant="pill" label="Role" multiple searchable searchPlaceholder="Search roles…" options={toOptions(facets.roles)} value={filters.roles} onChange={(v) => dispatch(setRoles(v))} />
      <Dropdown variant="pill" label="City" multiple searchable searchPlaceholder="Search cities…" options={toOptions(facets.cities)} value={filters.cities} onChange={(v) => dispatch(setCities(v))} />
      <Dropdown variant="pill" label="Posted" options={POSTED_WITHIN_OPTIONS} defaultValue="any" value={filters.postedWithin} onChange={(v) => dispatch(setPostedWithin(v))} />
      <Divider />
      <Dropdown variant="pill" options={SORT_OPTIONS} defaultValue="newest" value={filters.sort} onChange={(v) => dispatch(setSort(v))} ariaLabel="Sort jobs" />
      <Divider />
      <button
        type="button"
        onClick={copyLink}
        title="Copy link to this view"
        aria-label="Copy link to this view"
        className="grid h-[34px] w-9 place-items-center rounded-lg text-slate-600 transition hover:bg-slate-100"
      >
        {copied ? <Check size={20} className="text-emerald-500" /> : <Link2 size={20} />}
      </button>
    </div>
  );
}
