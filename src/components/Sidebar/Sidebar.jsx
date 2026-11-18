import { NavLink } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { BarChart3, Briefcase, GraduationCap, Target, Workflow } from 'lucide-react';
import ProfileMenu from './ProfileMenu.jsx';
import { ROUTES } from '@/routes/paths.js';

// Icon with its name underneath (CRM rail style). All names fade in while the
// rail is hovered or has keyboard focus; the current page's name is always
// shown. Their space is reserved so icons never shift.
function RailLink({ to, label, ariaLabel, icon: Icon, end, badge }) {
  return (
    <NavLink to={to} end={end} aria-label={ariaLabel || label} className="group flex w-full flex-col items-center gap-1 px-1 outline-none">
      {({ isActive }) => (
        <>
          <span
            className={`relative grid h-10 w-10 place-items-center rounded-xl transition ${
              isActive
                ? 'bg-white text-slate-900 shadow-sm ring-1 ring-line'
                : 'text-slate-400 group-hover:bg-white group-hover:text-slate-800 group-focus-visible:ring-2 group-focus-visible:ring-accent/40'
            }`}
          >
            <Icon size={21} strokeWidth={isActive ? 2 : 1.6} />
            {badge > 0 && (
              <span className="absolute -right-1.5 -top-1.5 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-red-500 px-1 text-[10px] font-semibold text-white ring-2 ring-[#f7f7f9]">
                {badge > 99 ? '99+' : badge}
              </span>
            )}
          </span>
          <span
            className={`min-h-[26px] text-center text-[11px] leading-[13px] transition-opacity duration-150 ${
              isActive
                ? 'font-medium text-slate-900 opacity-100'
                : 'text-slate-500 opacity-0 group-hover/rail:opacity-100 group-focus-within/rail:opacity-100'
            }`}
          >
            {label}
          </span>
        </>
      )}
    </NavLink>
  );
}

// Narrow icon rail with names under the icons.
export default function Sidebar() {
  const meta = useSelector((s) => s.jobs.meta);
  const newToday = meta?.live?.newLast24h ?? 0;

  return (
    <aside className="group/rail fixed inset-y-0 left-0 z-40 flex w-[72px] flex-col items-center border-r border-line bg-[#f7f7f9] py-5 md:w-[92px]">
      <NavLink to={ROUTES.jobs} className="flex flex-col items-center gap-1" aria-label="FresherJobs home">
        <span className="grid h-10 w-10 place-items-center rounded-lg bg-accent text-white shadow-sm">
          <GraduationCap size={22} />
        </span>
        <span className="text-[11px] font-medium text-slate-700">FJobs</span>
      </NavLink>

      <nav className="mt-8 flex w-full flex-1 flex-col items-center gap-3">
        <RailLink to={ROUTES.jobs} label="Jobs" ariaLabel={`Jobs · ${newToday} new in 24h`} icon={Briefcase} badge={newToday} />
        <RailLink to={ROUTES.insights} label="Insights" icon={BarChart3} />
        <RailLink to={ROUTES.accuracy} label="Accuracy & Cost" icon={Target} />
        <RailLink to={ROUTES.howItWorks} label="How it Works" icon={Workflow} />
      </nav>

      <ProfileMenu />
    </aside>
  );
}
