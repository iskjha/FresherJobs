import { Check, Minus } from 'lucide-react';

// Visual-only checkbox; the clickable row owns the interaction and ARIA state.
export default function Checkbox({ checked = false, indeterminate = false }) {
  const on = checked || indeterminate;
  return (
    <span
      aria-hidden="true"
      className={`grid h-[18px] w-[18px] shrink-0 place-items-center rounded-[5px] border transition ${
        on ? 'border-accent bg-accent' : 'border-slate-300 bg-transparent'
      }`}
    >
      {checked ? (
        <Check size={12} strokeWidth={3.5} className="text-white" />
      ) : indeterminate ? (
        <Minus size={12} strokeWidth={3.5} className="text-white" />
      ) : null}
    </span>
  );
}
