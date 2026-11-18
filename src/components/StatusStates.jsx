import { AlertTriangle, Loader2, SearchX } from 'lucide-react';

export function LoadingState({ label = 'Loading jobs…' }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-32 text-slate-500" role="status">
      <Loader2 className="animate-spin text-accent" size={28} />
      <p>{label}</p>
    </div>
  );
}

export function ErrorState({ message, onRetry }) {
  return (
    <div className="mx-auto mt-16 max-w-md rounded-xl border border-accent/30 bg-accent/10 p-6 text-center">
      <AlertTriangle className="mx-auto mb-2 text-accent" />
      <p className="font-medium text-slate-900">Something went wrong</p>
      <p className="mt-1 text-sm text-slate-600">{message}</p>
      {onRetry && (
        <button onClick={onRetry} className="mt-4 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-hover">
          Try again
        </button>
      )}
    </div>
  );
}

export function EmptyState({ title, children }) {
  return (
    <div className="rounded-xl border border-dashed border-line p-12 text-center">
      <SearchX className="mx-auto mb-3 text-slate-500" size={32} />
      <p className="font-semibold text-slate-900">{title}</p>
      {children && <div className="mt-2 text-sm text-slate-500">{children}</div>}
    </div>
  );
}
