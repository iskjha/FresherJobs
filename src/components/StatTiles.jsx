// Summary tiles: white cards with a lavender icon chip inside a light gray tray.
export default function StatTiles({ items }) {
  return (
    <div className="w-full rounded-2xl bg-[#f8f8fb] p-5">
      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
        {items.map(({ icon: Icon, label, value, hint }) => (
          <div key={label} className="min-w-0 rounded-2xl border border-slate-100 bg-white px-5 py-4">
            <p className="flex items-center gap-3 text-[13px] text-slate-700">
              {Icon && (
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[#eef0fd] text-[#4f46e5]">
                  <Icon size={16} strokeWidth={1.8} />
                </span>
              )}
              <span className="truncate">{label}</span>
            </p>
            <p className="mt-3 text-[26px] font-medium leading-none text-slate-900">{value}</p>
            {hint && <p className="mt-2 truncate text-[11px] text-slate-400">{hint}</p>}
          </div>
        ))}
      </div>
    </div>
  );
}
