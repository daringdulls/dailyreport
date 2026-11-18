import { useLayoutEffect, useRef, type ReactNode } from 'react';

// Yellow = fill in daily, Grey = auto-calculated (same legend as the Excel sheets).
// Inputs print as plain text via the .print-only span.

export function NumIn({
  value,
  onChange,
  step = 1,
  suffix,
  prefix,
  nullable,
  autoValue,
}: {
  value: number | null;
  onChange: (v: number | null) => void;
  step?: number;
  suffix?: string;
  prefix?: string;
  nullable?: boolean;
  autoValue?: number;
}) {
  const v = value == null ? autoValue : value;
  const shown = v == null ? '' : `${prefix ?? ''}${v}${suffix ?? ''}`;
  return (
    <td className="in num">
      <div
        className="numwrap screen-only"
        onMouseDown={(e) => {
          const input = e.currentTarget.querySelector('input');
          if (input && e.target !== input) {
            e.preventDefault();
            input.focus();
          }
        }}
      >
      {prefix && <span className="unit">{prefix}</span>}
      <input
        type="number"
        inputMode="decimal"
        step={step}
        value={value == null ? '' : value}
        placeholder={nullable ? (autoValue != null ? String(autoValue) : 'auto') : '0'}
        onFocus={(e) => e.target.select()}
        onChange={(e) => {
          const raw = e.target.value;
          if (raw === '') return onChange(nullable ? null : 0);
          const n = Number(raw);
          if (!Number.isNaN(n)) onChange(n);
        }}
      />
      {suffix && <span className="unit">{suffix}</span>}
      </div>
      <span className="print-only">{shown}</span>
    </td>
  );
}

export function TextIn({
  value,
  onChange,
  colSpan,
  multiline,
  className = '',
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  colSpan?: number;
  multiline?: boolean;
  className?: string;
  placeholder?: string;
}) {
  return (
    <td className={`in txt ${className}`} colSpan={colSpan}>
      {multiline ? (
        <AutoTextarea value={value} placeholder={placeholder} onChange={onChange} />
      ) : (
        <input className="screen-only" value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
      )}
      <span className="print-only">{value}</span>
    </td>
  );
}

export function Calc({ children, className = '', colSpan }: { children: ReactNode; className?: string; colSpan?: number }) {
  return (
    <td className={`calc num ${className}`} colSpan={colSpan}>
      {children}
    </td>
  );
}

export function Label({ children, colSpan, className = '' }: { children: ReactNode; colSpan?: number; className?: string }) {
  return (
    <td className={`label ${className}`} colSpan={colSpan}>
      {children}
    </td>
  );
}

export function Section({ title }: { title: string }) {
  return <div className="section">{title}</div>;
}

export function RowTools({ onRemove }: { onRemove: () => void }) {
  return (
    <td className="tools screen-only">
      <button className="icon" title="Remove row" onClick={onRemove}>
        ×
      </button>
    </td>
  );
}

/** Report date cell: a date picker on screen (opens that day's report), plain text when printed. */
export function DateCell({ value, label, onPick }: { value: string; label: string; onPick: (d: string) => void }) {
  return (
    <td className="in center">
      <input
        className="screen-only"
        type="date"
        value={value}
        title="Pick a date to open (or start) that day's report"
        onChange={(e) => e.target.value && onPick(e.target.value)}
      />
      <span className="print-only">{label}</span>
    </td>
  );
}

/** Textarea that grows with its text, so nothing is cut off on narrow (phone) screens. */
function AutoTextarea({
  value,
  placeholder,
  onChange,
}: {
  value: string;
  placeholder?: string;
  onChange: (v: string) => void;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const grow = () => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  };
  useLayoutEffect(grow, [value]);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    let w = el.clientWidth;
    const ro = new ResizeObserver(() => {
      if (el.clientWidth !== w) {
        w = el.clientWidth;
        grow();
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return (
    <textarea
      ref={ref}
      className="screen-only"
      rows={1}
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}
