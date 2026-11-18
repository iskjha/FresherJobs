import { useEffect, useRef, useState } from 'react';
import { useSelector } from 'react-redux';
import { Clock, Code2, RefreshCw } from 'lucide-react';
import avatarUrl from '@assets/avatar.jpg';
import { formatDateTime, timeAgo } from '@utils/format';
import { REPO_URL } from '@/config';

// Avatar at the bottom of the rail; click opens a small card to its right
// with the data-refresh status (what the old green dot showed on hover).
export default function ProfileMenu() {
  const meta = useSelector((s) => s.jobs.meta);
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const buttonRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onPointer = (e) => {
      if (!rootRef.current?.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => {
      if (e.key === 'Escape') {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label="Profile and data status"
        className={`relative block h-11 w-11 overflow-hidden rounded-full ring-2 transition ${
          open ? 'ring-accent' : 'ring-white hover:ring-slate-200'
        } shadow-sm`}
      >
        <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
      </button>
      {meta && (
        <span
          className="pointer-events-none absolute bottom-0 right-0 h-3 w-3 rounded-full bg-emerald-500 ring-2 ring-[#f7f7f9]"
          aria-hidden="true"
        />
      )}

      {open && (
        <div
          role="dialog"
          aria-label="Profile and data status"
          className="absolute bottom-0 left-full z-50 ml-4 w-64 overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-[0_12px_40px_-10px_rgba(0,0,0,0.2)]"
        >
          <div className="flex items-center gap-3 bg-[#f8f8fb] p-4">
            <img src={avatarUrl} alt="" className="h-12 w-12 rounded-full object-cover ring-2 ring-white" />
            <div className="min-w-0">
              <p className="truncate text-[13px] font-semibold text-slate-900">FresherJobs India</p>
              <p className="truncate text-[11px] text-slate-500">Workspace owner</p>
            </div>
          </div>
          <dl className="space-y-2.5 p-4 text-[12px]">
            <div className="flex items-start gap-2.5">
              <RefreshCw size={14} className="mt-0.5 shrink-0 text-[#4f46e5]" />
              <div>
                <dt className="text-slate-500">Data refreshed</dt>
                <dd className="font-medium text-slate-800">
                  {meta ? `${timeAgo(meta.generatedAt)} · ${formatDateTime(meta.generatedAt)}` : 'Loading…'}
                </dd>
              </div>
            </div>
            <div className="flex items-start gap-2.5">
              <Clock size={14} className="mt-0.5 shrink-0 text-[#4f46e5]" />
              <div>
                <dt className="text-slate-500">Auto-refresh</dt>
                <dd className="font-medium text-slate-800">Daily at 06:30 IST</dd>
              </div>
            </div>
          </dl>
          {REPO_URL && (
            <a
              href={REPO_URL}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-2 border-t border-slate-100 px-4 py-3 text-[12px] font-medium text-slate-700 hover:bg-slate-50 hover:text-accent"
            >
              <Code2 size={14} /> Source code
            </a>
          )}
        </div>
      )}
    </div>
  );
}
