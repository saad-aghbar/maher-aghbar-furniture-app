'use client';

import { Input } from './Input';

export type DateRangeFieldProps = {
  fromLabel: string;
  toLabel: string;
  from: string;
  to: string;
  onFromChange: (value: string) => void;
  onToChange: (value: string) => void;
  error?: string;
};

export function DateRangeField({
  fromLabel,
  toLabel,
  from,
  to,
  onFromChange,
  onToChange,
  error,
}: DateRangeFieldProps) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Input
        type="date"
        label={fromLabel}
        value={from}
        onChange={(e) => onFromChange(e.target.value)}
        error={error}
      />
      <Input
        type="date"
        label={toLabel}
        value={to}
        onChange={(e) => onToChange(e.target.value)}
        error={error}
      />
    </div>
  );
}
