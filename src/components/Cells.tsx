import type { ReactNode } from 'react';

// Yellow = fill in daily, Grey = auto-calculated (same legend as the Excel sheets).
// Inputs print as plain text via the .print-only span.

export function NumIn({
  value,
  onChange,
  step = 1,
  suffix,
  prefix,
  nullable,
}: {
  value: number | null;
  onChange: (v: number | null) => void;
  step?: number;
  suffix?: string;
  prefix?: string;
  nullable?: boolean;
}) {
  const shown = value == null ? '' : `${prefix ?? ''}${value}${suffix ?? ''}`;
  return (
    <td className="in num">
      <input
        className="screen-only"
        type="number"
        inputMode="decimal"
        step={step}
        value={value == null ? '' : value}
        placeholder={nullable ? 'auto' : '0'}
        onFocus={(e) => e.target.select()}
        onChange={(e) => {
          const raw = e.target.value;
          if (raw === '') return onChange(nullable ? null : 0);
          const n = Number(raw);
          if (!Number.isNaN(n)) onChange(n);
        }}
      />
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
        <textarea
          className="screen-only"
          rows={Math.max(1, Math.ceil(value.length / 40))}
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
        />
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
