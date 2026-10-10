import React from 'react';

interface CurrencyInputProps {
  value: string | number;
  onChange: (rawNumericString: string) => void;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  className?: string;
  inputClassName?: string;
  autoFocus?: boolean;
}

/**
 * Accounting-style IDR Currency Input
 * Displays "Rp" prefix on the left and formats numbers with dot thousand separators (e.g. Rp 100.000) as the user types.
 * Calls onChange with the clean numeric string (e.g. "100000").
 */
export const CurrencyInput: React.FC<CurrencyInputProps> = ({
  value,
  onChange,
  placeholder = '0',
  required = false,
  disabled = false,
  className = '',
  inputClassName = '',
  autoFocus = false,
}) => {
  const digitsOnly = String(value ?? '').replace(/[^0-9]/g, '');
  const numericVal = digitsOnly ? parseInt(digitsOnly, 10) : 0;
  const formattedDisplay =
    digitsOnly === ''
      ? ''
      : Number.isNaN(numericVal)
      ? ''
      : new Intl.NumberFormat('id-ID').format(numericVal);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/[^0-9]/g, '');
    if (!raw) {
      onChange('');
      return;
    }
    const clean = String(parseInt(raw, 10));
    onChange(clean === 'NaN' ? '' : clean);
  };

  return (
    <div className={`relative flex items-center ${className}`}>
      <span className="absolute left-3 text-xs font-bold font-mono-tabular text-slate-500 dark:text-slate-400 pointer-events-none select-none">
        Rp.
      </span>
      <input
        type="text"
        inputMode="numeric"
        required={required}
        disabled={disabled}
        autoFocus={autoFocus}
        value={formattedDisplay}
        onChange={handleInputChange}
        placeholder={placeholder}
        className={`w-full pl-10 pr-3 py-2.5 text-sm font-mono-tabular font-semibold border border-slate-300 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-emerald-600 dark:focus:border-emerald-500 transition-colors ${inputClassName}`}
      />
    </div>
  );
};
