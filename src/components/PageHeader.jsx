// CRM-style page title row: title left, actions right.
export default function PageHeader({ title, subtitle, actions }) {
  return (
    <header className="mb-6 flex flex-wrap items-center justify-between gap-4">
      <div className="min-w-0">
        <h1 className="text-[22px] font-medium text-slate-800">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-3 sm:gap-5">{actions}</div>}
    </header>
  );
}

// Gray square icon button used in page headers.
export function IconButton({ label, onClick, children, disabled, compact = false }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
      className={`grid place-items-center rounded-md bg-[#e9eaee] text-slate-800 transition hover:bg-[#dfe1e6] disabled:opacity-60 ${
        compact ? 'h-10 w-12' : 'h-11 w-14'
      }`}
    >
      {children}
    </button>
  );
}
