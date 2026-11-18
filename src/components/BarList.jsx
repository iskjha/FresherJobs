// Ranked list: name + count on one line, a thin share bar underneath.
// Bars are scaled to the largest item so small values stay visible.
export default function BarList({ items, total, onSelect, limit = 12 }) {
  const max = Math.max(1, ...items.map((i) => i.count));
  return (
    <ol className="space-y-1">
      {items.slice(0, limit).map(({ value, count }, i) => {
        const pct = total ? Math.round((count / total) * 100) : null;
        return (
          <li key={value}>
            <button
              type="button"
              onClick={onSelect ? () => onSelect(value) : undefined}
              disabled={!onSelect}
              title={onSelect ? `See ${value} jobs` : undefined}
              className="group flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left transition enabled:hover:bg-slate-50"
            >
              <span className="w-5 shrink-0 text-right text-[11px] tabular-nums text-slate-400">{i + 1}</span>
              <span className="min-w-0 flex-1">
                <span className="flex items-baseline justify-between gap-3">
                  <span className="truncate text-[13px] text-slate-700 group-enabled:group-hover:text-accent">{value}</span>
                  <span className="shrink-0 text-[12px] tabular-nums">
                    <span className="font-semibold text-slate-900">{count}</span>
                    {pct != null && <span className="ml-1.5 inline-block w-8 text-right text-slate-400">{pct}%</span>}
                  </span>
                </span>
                <span className="mt-1.5 block h-1.5 overflow-hidden rounded-full bg-slate-100">
                  <span
                    className={`block h-full rounded-full ${i === 0 ? 'bg-accent' : 'bg-accent/50'} transition-all group-enabled:group-hover:bg-accent`}
                    style={{ width: `${Math.max(2, (count / max) * 100)}%` }}
                  />
                </span>
              </span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}
