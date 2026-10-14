import { Check, ChevronDown, Languages } from 'lucide-react';
import { useApp } from '../lib/store';
import { CURRENCIES, currencyInfo } from '../lib/currencies';
import { cx } from '../lib/format';
import { Dropdown, MenuItem } from './ui';

/**
 * Base (reporting) currency picker. Every screen converts multi-currency
 * records into this currency for totals, and new documents default to it.
 */
export function CurrencyPicker({ className }) {
  const { settings, updateSettings, toast } = useApp();
  const current = settings?.locale?.baseCurrency || 'EUR';
  const info = currencyInfo(current);

  return (
    <Dropdown
      className={className}
      trigger={
        <button
          type="button"
          className="btn btn-ghost btn-sm gap-1.5"
          aria-label={`Base currency: ${current}. Change currency`}
          title="Base currency used for reports"
        >
          <Languages className="h-4 w-4" aria-hidden />
          <span className="hidden font-bold sm:inline">{current}</span>
          <ChevronDown className="h-3 w-3 opacity-60" aria-hidden />
        </button>
      }
    >
      <p className="px-2.5 pb-1 pt-1.5 text-[0.65rem] font-bold uppercase tracking-wider text-[var(--text-muted)]">
        Base currency
      </p>
      <div className="max-h-72 overflow-y-auto">
        {CURRENCIES.map((c) => (
          <MenuItem
            key={c.code}
            onClick={() => {
              updateSettings({ locale: { baseCurrency: c.code } });
              toast(`Base currency set to ${c.code} (${c.name})`);
            }}
          >
            <span className="flex w-full items-center gap-2">
              <span className={cx('tnum w-11 shrink-0 font-mono text-xs', c.code === current ? 'font-bold text-[var(--color-flag-700)]' : 'text-[var(--text-muted)]')}>
                {c.code}
              </span>
              <span className="min-w-0 flex-1 truncate">{c.name}</span>
              {c.code === current && <Check className="h-4 w-4 shrink-0 text-[var(--color-mint-500)]" aria-hidden />}
            </span>
          </MenuItem>
        ))}
      </div>
      <div className="mt-1 border-t border-[var(--line)] px-2.5 py-2 text-[0.68rem] leading-snug text-[var(--text-muted)]">
        Reporting currency: {info.symbol} · documents keep their own currency and totals are converted at the reference rate (editable in Settings → Currencies).
      </div>
    </Dropdown>
  );
}
