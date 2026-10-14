// Multi-currency support. Reference rates are EUR-based and indicative —
// they can be overridden per workspace in Settings → Preferences.
export const CURRENCIES = [
  { code: 'EUR', symbol: '€', name: 'Euro', locale: 'nl-NL', rate: 1 },
  { code: 'USD', symbol: '$', name: 'US dollar', locale: 'en-US', rate: 1.09 },
  { code: 'GBP', symbol: '£', name: 'Pound sterling', locale: 'en-GB', rate: 0.86 },
  { code: 'CHF', symbol: 'CHF', name: 'Swiss franc', locale: 'de-CH', rate: 0.95 },
  { code: 'SEK', symbol: 'kr', name: 'Swedish krona', locale: 'sv-SE', rate: 11.4 },
  { code: 'NOK', symbol: 'kr', name: 'Norwegian krone', locale: 'nb-NO', rate: 11.6 },
  { code: 'DKK', symbol: 'kr', name: 'Danish krone', locale: 'da-DK', rate: 7.46 },
  { code: 'PLN', symbol: 'zł', name: 'Polish złoty', locale: 'pl-PL', rate: 4.3 },
  { code: 'CZK', symbol: 'Kč', name: 'Czech koruna', locale: 'cs-CZ', rate: 25.2 },
  { code: 'HUF', symbol: 'Ft', name: 'Hungarian forint', locale: 'hu-HU', rate: 395 },
  { code: 'RON', symbol: 'lei', name: 'Romanian leu', locale: 'ro-RO', rate: 4.97 },
  { code: 'BGN', symbol: 'лв', name: 'Bulgarian lev', locale: 'bg-BG', rate: 1.95583 },
  { code: 'TRY', symbol: '₺', name: 'Turkish lira', locale: 'tr-TR', rate: 38.5 },
  { code: 'UAH', symbol: '₴', name: 'Ukrainian hryvnia', locale: 'uk-UA', rate: 45 },
  { code: 'CAD', symbol: '$', name: 'Canadian dollar', locale: 'en-CA', rate: 1.48 },
  { code: 'AUD', symbol: '$', name: 'Australian dollar', locale: 'en-AU', rate: 1.65 },
  { code: 'NZD', symbol: '$', name: 'New Zealand dollar', locale: 'en-NZ', rate: 1.78 },
  { code: 'JPY', symbol: '¥', name: 'Japanese yen', locale: 'ja-JP', rate: 168, digits: 0 },
  { code: 'CNY', symbol: '¥', name: 'Chinese yuan', locale: 'zh-CN', rate: 7.8 },
  { code: 'INR', symbol: '₹', name: 'Indian rupee', locale: 'en-IN', rate: 92 },
  { code: 'SGD', symbol: '$', name: 'Singapore dollar', locale: 'en-SG', rate: 1.44 },
  { code: 'HKD', symbol: '$', name: 'Hong Kong dollar', locale: 'zh-HK', rate: 8.4 },
  { code: 'THB', symbol: '฿', name: 'Thai baht', locale: 'th-TH', rate: 36.5 },
  { code: 'IDR', symbol: 'Rp', name: 'Indonesian rupiah', locale: 'id-ID', rate: 17500, digits: 0 },
  { code: 'ZAR', symbol: 'R', name: 'South African rand', locale: 'en-ZA', rate: 19.6 },
  { code: 'NGN', symbol: '₦', name: 'Nigerian naira', locale: 'en-NG', rate: 1650, digits: 0 },
  { code: 'KES', symbol: 'KSh', name: 'Kenyan shilling', locale: 'en-KE', rate: 140, digits: 0 },
  { code: 'BRL', symbol: 'R$', name: 'Brazilian real', locale: 'pt-BR', rate: 5.9 },
  { code: 'MXN', symbol: '$', name: 'Mexican peso', locale: 'es-MX', rate: 20.4 },
  { code: 'AED', symbol: 'AED', name: 'UAE dirham', locale: 'en-AE', rate: 3.96 },
];

export const CURRENCY_MAP = Object.fromEntries(CURRENCIES.map((c) => [c.code, c]));

export const currencyInfo = (code = 'EUR') => CURRENCY_MAP[code] || CURRENCIES[0];

export const localeFor = (code, fallback = 'nl-NL') => currencyInfo(code).locale || fallback;

/** Reference rate of `code` expressed in EUR. */
export function rateToEUR(code, overrides = {}) {
  if (code === 'EUR') return 1;
  if (overrides?.[code]) return Number(overrides[code]) || 1;
  return currencyInfo(code).rate || 1;
}

/** Convert `amount` from one currency to another using reference rates. */
export function convert(amount, from = 'EUR', to = 'EUR', overrides = {}) {
  const value = Number(amount) || 0;
  if (!from || !to || from === to) return value;
  const inEUR = value / rateToEUR(from, overrides);
  return Math.round(inEUR * rateToEUR(to, overrides) * 100) / 100;
}

/** Sum records that may use different currencies, normalised to `base`. */
export function sumInBase(records, base = 'EUR', overrides = {}, valueFn = (r) => r.total) {
  return (
    Math.round(
      records.reduce((s, r) => s + convert(valueFn(r), r.currency || base, base, overrides) * 100, 0) /
        100,
    )
  );
}
