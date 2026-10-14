import { useMemo } from 'react';
import { useApp } from './store';
import { fmtCompact, fmtMoney, round2 } from './format';
import { convert, localeFor } from './currencies';

/** Currency-aware formatting helpers bound to the current workspace. */
export function useMoney() {
  const { locale, baseCurrency, rates } = useApp();
  return useMemo(() => {
    const loc = (currency) => (currency && currency !== baseCurrency ? localeFor(currency, locale) : locale);
    const m = (amount, currency) => fmtMoney(amount, currency || baseCurrency, loc(currency));
    const base = (amount, currency) => round2(convert(amount, currency || baseCurrency, baseCurrency, rates));
    const mb = (amount, currency) => fmtMoney(base(amount, currency), baseCurrency, locale);
    const compact = (amount, currency) => fmtCompact(amount, currency || baseCurrency, locale);
    return { m, mb, base, compact, locale, baseCurrency, rates };
  }, [locale, baseCurrency, rates]);
}
