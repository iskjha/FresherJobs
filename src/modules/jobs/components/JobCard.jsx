import { memo } from 'react';
import { ArrowUpRight, Calendar, IndianRupee, MapPin } from 'lucide-react';
import { formatChipDate, initials, timeAgo } from '@utils/format';
import { SOURCE_LABELS } from '@/config';

const AVATAR_COLORS = ['bg-emerald-300', 'bg-yellow-400', 'bg-rose-400', 'bg-sky-400', 'bg-violet-400', 'bg-orange-400', 'bg-teal-400', 'bg-pink-400'];

function colorFor(text) {
  let h = 0;
  for (const ch of text) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

// CRM-style deal card adapted for a job posting (11px primary / 10px meta).
// Rendered as a link-role div (not <a href>) so Chrome doesn't show the job
// URL in its bottom-left status bubble on hover; click / Enter / middle-click
// still open the original posting in a new tab.
function JobCard({ job }) {
  const cities = [job.city, ...(job.otherCities || [])];
  const isIntern = job.jobType === 'Internship';
  const open = () => window.open(job.url, '_blank', 'noopener,noreferrer');
  return (
    <div
      role="link"
      tabIndex={0}
      onClick={open}
      onMouseDown={(e) => e.button === 1 && e.preventDefault()}
      onMouseUp={(e) => e.button === 1 && open()}
      onKeyDown={(e) => {
        if (e.key === 'Enter') open();
      }}
      aria-label={`${job.title} at ${job.company}, ${cities.join(', ')}`}
      className="group block shrink-0 cursor-pointer rounded-xl bg-white p-3 shadow-[0_1px_3px_rgba(16,24,40,0.06)] outline-none ring-1 ring-slate-100 transition hover:shadow-md hover:ring-accent/30 focus-visible:ring-2 focus-visible:ring-accent"
    >
      <div className="flex items-start gap-2.5">
        <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-full text-[10px] font-semibold text-white ${colorFor(job.company)}`}>
          {initials(job.company)}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[10px] text-slate-400">
            {SOURCE_LABELS[job.source] || job.source}
            <span className="ml-1.5">{timeAgo(job.postedAt).replace(/ ago$/, '')}</span>
          </p>
          <h3 className="mt-0.5 line-clamp-2 text-[11px] font-medium leading-snug text-slate-900 group-hover:text-accent">{job.title}</h3>
          <p className="mt-0.5 truncate text-[11px] text-[#1a73e8]">{job.company}</p>
        </div>
        <span
          className={`shrink-0 rounded px-1.5 py-px text-[10px] font-semibold ${isIntern ? 'bg-emerald-50 text-emerald-500' : 'bg-blue-50 text-blue-500'}`}
        >
          {isIntern ? 'Intern' : 'FT'}
        </span>
      </div>

      <div className="mt-3 flex items-end justify-between gap-2">
        <span className="inline-flex shrink-0 items-center gap-1 rounded bg-red-50 px-1.5 py-0.5 text-[10px] text-red-500">
          <Calendar size={10} />
          {formatChipDate(job.postedAt)}
        </span>
        <div className="min-w-0 space-y-0.5 text-right text-[10px] text-slate-600">
          <p className="flex items-center justify-end gap-1 truncate">
            <MapPin size={10} className="shrink-0 text-slate-400" />
            <span className="truncate">
              {cities[0]}
              {cities.length > 1 && ` +${cities.length - 1}`}
            </span>
          </p>
          {job.salary ? (
            <p className="flex items-center justify-end gap-0.5 truncate">
              <IndianRupee size={10} className="shrink-0 text-slate-400" />
              <span className="truncate">{job.salary.replace(/^₹/, '')}</span>
            </p>
          ) : (
            <p className="flex items-center justify-end gap-0.5 font-medium text-accent">
              Apply <ArrowUpRight size={11} />
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

export default memo(JobCard);
