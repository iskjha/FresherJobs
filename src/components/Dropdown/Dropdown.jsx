import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown, Search } from 'lucide-react';
import Checkbox from '@components/Checkbox.jsx';

const labelOf = (o) => o.label ?? String(o.value);
const MENU_MIN_WIDTH = 256;

// Fixed-position coordinates for the menu, flipping above the trigger when
// there is not enough room below. Rendered in a portal so scrolling parents
// (e.g. the filter sidebar) never clip it.
function measure(button, align) {
  const r = button?.getBoundingClientRect();
  if (!r) return null;
  const width = Math.max(r.width, MENU_MIN_WIDTH);
  const preferred = align === 'right' ? r.right - width : r.left;
  const left = Math.min(Math.max(8, preferred), window.innerWidth - width - 8);
  const below = window.innerHeight - r.bottom;
  return below < 340 && r.top > below
    ? { left, width, bottom: window.innerHeight - r.top + 6 }
    : { left, width, top: r.bottom + 6 };
}

/**
 * Custom select used everywhere instead of native <select>.
 *  - single:   value is a string, closes on pick
 *  - multiple: value is an array, rows have checkboxes + "Select all"
 *  - searchable adds a filter box; "Select all" then applies to matches only
 *  - variant "field" (label above, bordered trigger) or "row" (label left,
 *    compact value right — used inside the filter sidebar)
 * Keyboard: ↓/↑ move, Enter picks, Esc closes.
 */
export default function Dropdown({
  label,
  options,
  value,
  onChange,
  multiple = false,
  searchable = false,
  allLabel = 'All',
  placeholder = 'Select…',
  searchPlaceholder = 'Search…',
  align = 'left',
  variant = 'field',
  defaultValue,
  ariaLabel,
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(-1);
  const [pos, setPos] = useState(null);
  const rootRef = useRef(null);
  const buttonRef = useRef(null);
  const menuRef = useRef(null);
  const searchRef = useRef(null);
  const listRef = useRef(null);
  const listId = useId();
  // Multi-select value: null = All (every box ticked), [] = None, or a list.
  // Ticking every option emits null so URLs and API filters stay short.
  const allValues = useMemo(() => options.map((o) => o.value), [options]);
  const selected = useMemo(() => {
    if (!multiple) return [value];
    return value ?? allValues;
  }, [multiple, value, allValues]);
  const emitMulti = (next) => onChange(allValues.length > 0 && allValues.every((v) => next.includes(v)) ? null : next);
  const menuAlign = variant === 'row' ? 'right' : align;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? options.filter((o) => labelOf(o).toLowerCase().includes(q)) : options;
  }, [options, query]);

  const close = (refocus) => {
    setOpen(false);
    setQuery('');
    setActive(-1);
    if (refocus) buttonRef.current?.focus();
  };
  const openMenu = () => {
    setPos(measure(buttonRef.current, menuAlign));
    setActive(multiple ? -1 : options.findIndex((o) => o.value === value));
    setOpen(true);
  };

  useEffect(() => {
    if (!open) return undefined;
    const onPointer = (e) => {
      if (!rootRef.current?.contains(e.target) && !menuRef.current?.contains(e.target)) {
        setOpen(false);
        setQuery('');
        setActive(-1);
      }
    };
    const reposition = (e) => {
      if (menuRef.current?.contains(e.target)) return;
      setPos(measure(buttonRef.current, menuAlign));
    };
    document.addEventListener('mousedown', onPointer);
    window.addEventListener('scroll', reposition, true);
    window.addEventListener('resize', reposition);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      window.removeEventListener('scroll', reposition, true);
      window.removeEventListener('resize', reposition);
    };
  }, [open, menuAlign]);

  useEffect(() => {
    if (open) (searchRef.current ?? listRef.current)?.focus();
  }, [open]);

  useEffect(() => {
    if (active >= 0) listRef.current?.querySelector(`[data-index="${active}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  const choose = (opt) => {
    if (multiple) {
      emitMulti(selected.includes(opt.value) ? selected.filter((v) => v !== opt.value) : [...selected, opt.value]);
    } else {
      onChange(opt.value);
      close(true);
    }
  };

  const visible = filtered.map((o) => o.value);
  const allChecked = visible.length > 0 && visible.every((v) => selected.includes(v));
  const someChecked = !allChecked && visible.some((v) => selected.includes(v));
  const toggleAll = () =>
    emitMulti(allChecked ? selected.filter((v) => !visible.includes(v)) : [...new Set([...selected, ...visible])]);

  const onMenuKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && filtered[active]) {
      e.preventDefault();
      choose(filtered[active]);
    } else if (e.key === 'Escape') {
      // Portal events still bubble through React parents (e.g. the sidebar).
      e.preventDefault();
      e.stopPropagation();
      close(true);
    } else if (e.key === 'Tab') {
      close(false);
    }
  };

  const findLabel = (v) => labelOf(options.find((o) => o.value === v) ?? { value: v });
  // All · None · the single name · a count ("Role - 3").
  const allPicked = multiple && (value == null || (allValues.length > 0 && allValues.every((v) => selected.includes(v))));
  const multiSummary = (allText, countText) =>
    allPicked ? allText : selected.length === 0 ? 'None' : selected.length === 1 ? findLabel(selected[0]) : countText;
  const pillSummary = () => {
    const prefix = label ? `${label} - ` : '';
    if (multiple) return `${prefix}${multiSummary('All', selected.length)}`;
    return `${prefix}${options.some((o) => o.value === value) ? findLabel(value) : placeholder}`;
  };
  const summary = variant === 'pill'
    ? pillSummary()
    : multiple
      ? multiSummary(allLabel, variant === 'row' ? `${selected.length} selected` : `${findLabel(selected[0])} +${selected.length - 1}`)
      : options.some((o) => o.value === value)
        ? findLabel(value)
        : placeholder;
  const isActive = multiple ? !allPicked : defaultValue !== undefined && value !== defaultValue;

  const rowClass = (isSel, isActive) =>
    isSel ? (isActive ? 'bg-accent/15 text-slate-900' : 'bg-accent/[0.08] text-slate-900') : isActive ? 'bg-slate-100 text-slate-900' : 'text-slate-600';

  const labelId = `${listId}-label`;
  const triggerProps = {
    ref: buttonRef,
    type: 'button',
    'aria-haspopup': 'listbox',
    'aria-expanded': open,
    'aria-controls': listId,
    'aria-label': ariaLabel,
    'aria-labelledby': label && !ariaLabel ? labelId : undefined,
    onClick: () => (open ? close(false) : openMenu()),
    onKeyDown: (e) => {
      if (!open && ['ArrowDown', 'Enter', ' '].includes(e.key)) {
        e.preventDefault();
        openMenu();
      }
    },
  };
  const countBadge = multiple && !allPicked && selected.length > 0 && (
    <span className="rounded bg-accent px-1.5 text-[11px] font-semibold leading-5 text-white">{selected.length}</span>
  );

  return (
    <div
      ref={rootRef}
      className={
        variant === 'row' ? 'flex items-center justify-between gap-3 border-b border-slate-100 px-3 py-3 last:border-0' : variant === 'pill' ? 'inline-block' : 'relative'
      }
    >
      {variant === 'pill' ? (
        <button
          {...triggerProps}
          aria-label={ariaLabel || summary}
          aria-labelledby={undefined}
          className={`inline-flex h-[34px] max-w-[220px] items-center gap-3 rounded-lg px-4 text-[12px] font-semibold text-[#1e2a4a] transition ${
            open || isActive ? 'bg-[#dde3fb]' : 'bg-[#eef0fb] hover:bg-[#e4e8fb]'
          }`}
        >
          <span className="truncate">{summary}</span>
          <ChevronDown size={15} className={`shrink-0 transition ${open ? 'rotate-180' : ''}`} />
        </button>
      ) : variant === 'row' ? (
        <>
          <span id={labelId} className="text-[13px] text-slate-600">
            {label}
          </span>
          <button
            {...triggerProps}
            className={`flex min-w-0 items-center gap-1.5 text-[13px] font-semibold transition hover:text-accent ${open ? 'text-accent' : 'text-slate-800'}`}
          >
            <span className="max-w-[150px] truncate">{summary}</span>
            {countBadge}
            <ChevronDown size={14} className={`shrink-0 text-slate-400 transition ${open ? 'rotate-180' : ''}`} />
          </button>
        </>
      ) : (
        <>
          {label && (
            <span id={labelId} className="mb-2 block text-sm font-medium text-slate-600">
              {label}
            </span>
          )}
          <button
            {...triggerProps}
            className={`flex w-full items-center justify-between gap-2 rounded-lg border bg-white px-4 py-3 text-left text-[15px] transition ${
              open ? 'border-accent ring-2 ring-accent/15' : 'border-line hover:border-slate-300'
            }`}
          >
            <span className={`truncate ${allPicked ? 'text-slate-500' : 'text-slate-800'}`}>{summary}</span>
            <span className="flex shrink-0 items-center gap-2">
              {countBadge}
              <ChevronDown size={16} className={`text-slate-400 transition ${open ? 'rotate-180' : ''}`} />
            </span>
          </button>
        </>
      )}

      {open &&
        pos &&
        createPortal(
          <div
            ref={menuRef}
            onKeyDown={onMenuKeyDown}
            style={{ position: 'fixed', zIndex: 70, ...pos }}
            className="rounded-xl border border-slate-100 bg-white p-2 shadow-[0_12px_40px_-10px_rgba(0,0,0,0.2)]"
          >
            {searchable && (
              <div className="relative px-1 pb-2 pt-1">
                <Search size={15} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  ref={searchRef}
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setActive(0);
                  }}
                  placeholder={searchPlaceholder}
                  aria-controls={listId}
                  aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
                  className="w-full rounded-lg border border-line bg-white py-2 pl-9 pr-3 text-sm text-slate-800 outline-none placeholder:text-slate-400 focus:border-accent focus:ring-2 focus:ring-accent/15"
                />
              </div>
            )}

            {multiple && filtered.length > 0 && (
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={toggleAll}
                className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold text-slate-800 hover:bg-slate-50"
              >
                <Checkbox checked={allChecked} indeterminate={someChecked} />
                {query ? `Select all matching (${filtered.length})` : 'Select All'}
              </button>
            )}

            <ul
              ref={listRef}
              id={listId}
              role="listbox"
              tabIndex={-1}
              aria-multiselectable={multiple || undefined}
              className="thin-scroll max-h-64 space-y-0.5 overflow-y-auto outline-none"
            >
              {filtered.map((o, i) => {
                const isSel = selected.includes(o.value);
                return (
                  <li
                    key={o.value}
                    id={`${listId}-${i}`}
                    data-index={i}
                    role="option"
                    aria-selected={isSel}
                    onMouseEnter={() => setActive(i)}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => choose(o)}
                    className={`flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors ${rowClass(isSel, active === i)}`}
                  >
                    {multiple && <Checkbox checked={isSel} />}
                    <span className="flex-1 truncate">{labelOf(o)}</span>
                    {o.count != null && <span className="text-xs tabular-nums text-slate-400">{o.count}</span>}
                    {!multiple && isSel && <Check size={16} className="text-accent" />}
                  </li>
                );
              })}
              {!filtered.length && <li className="px-3 py-6 text-center text-sm text-slate-400">No matches</li>}
            </ul>
          </div>,
          document.body
        )}
    </div>
  );
}
