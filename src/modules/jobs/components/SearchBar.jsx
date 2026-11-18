import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Search, X } from 'lucide-react';
import { setQuery } from '@redux/filtersSlice';
import { useDebounce } from '@hooks/useDebounce';

export default function SearchBar() {
  const dispatch = useDispatch();
  const query = useSelector((s) => s.filters.query);
  const [text, setText] = useState(query);
  const [prevQuery, setPrevQuery] = useState(query);
  const debounced = useDebounce(text, 200);

  // Sync the input only for external changes (Clear all, chip removal, URL),
  // not for our own debounced dispatch — that would drop keys typed meanwhile.
  if (query !== prevQuery) {
    setPrevQuery(query);
    if (query !== debounced) setText(query);
  }

  useEffect(() => {
    if (debounced !== query) dispatch(setQuery(debounced));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only react to typing
  }, [debounced, dispatch]);

  return (
    <div className="relative w-full sm:w-64">
      <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
      <input
        type="search"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Search Jobs..."
        className="h-10 w-full rounded-md border border-line bg-white pl-10 pr-9 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-accent focus:ring-2 focus:ring-accent/15 [&::-webkit-search-cancel-button]:hidden"
        aria-label="Search jobs"
      />
      {text && (
        <button
          type="button"
          onClick={() => setText('')}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-1 text-slate-400 hover:text-slate-700"
          aria-label="Clear search"
        >
          <X size={15} />
        </button>
      )}
    </div>
  );
}
