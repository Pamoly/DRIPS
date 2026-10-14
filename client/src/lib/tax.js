// Freelancer tax engine.
//
// The Netherlands profile uses the official 2026 parameters (Belastingdienst):
//   Box 1 brackets  35.75% / 37.56% / 49.50%  (€38.883 / €78.426)
//   Zelfstandigenaftrek €1.200 (1.225-hour criterion) · Startersaftrek €2.123
//   MKB-winstvrijstelling 12.7% · Zvw 4.85% (max €3.851, grondslag €79.409)
//   Algemene heffingskorting max €3.115 · Arbeidskorting max €5.685
// Other countries ship as clearly-labelled indicative templates that can be
// edited in Settings → Tax profile.

const seg = (upTo, base, rate) => ({ upTo, base, rate });

export function piecewise(segments = [], x = 0) {
  let lower = 0;
  for (const s of segments) {
    if (x <= s.upTo) return Math.max(0, s.base + s.rate * (x - lower));
    lower = s.upTo;
  }
  return 0;
}

export function bracketTax(brackets = [], income = 0) {
  let tax = 0;
  let lower = 0;
  const parts = [];
  for (const b of brackets) {
    if (income <= lower) break;
    const slice = Math.min(income, b.upTo) - lower;
    if (slice > 0) {
      tax += slice * b.rate;
      parts.push({ from: lower, to: Math.min(income, b.upTo), rate: b.rate, tax: slice * b.rate });
    }
    lower = b.upTo;
  }
  return { tax, parts };
}

export const TAX_PROFILES = {
  NL: {
    id: 'NL',
    label: 'Netherlands 2026 · ZZP / eenmanszaak',
    currency: 'EUR',
    exact: true,
    note: 'Official 2026 Box 1 rates, ondernemersaftrek, heffingskortingen and Zvw.',
    hoursCriterion: 1225,
    deductions: [
      { id: 'zelfstandigenaftrek', label: 'Zelfstandigenaftrek', amount: 1200, when: 'hours' },
      { id: 'startersaftrek', label: 'Startersaftrek', amount: 2123, when: 'starter' },
    ],
    exemption: { id: 'mkb', label: 'MKB-winstvrijstelling', rate: 0.127 },
    brackets: [
      { upTo: 38883, rate: 0.3575 },
      { upTo: 78426, rate: 0.3756 },
      { upTo: Infinity, rate: 0.495 },
    ],
    credits: [
      {
        id: 'algemene-heffingskorting',
        label: 'Algemene heffingskorting',
        segments: [seg(29736, 3115, 0), seg(78426, 3115, -0.06398), seg(Infinity, 0, 0)],
        aowSegments: [seg(29736, 1556, 0), seg(78426, 1556, -0.03197), seg(Infinity, 0, 0)],
      },
      {
        id: 'arbeidskorting',
        label: 'Arbeidskorting',
        segments: [
          seg(11965, 0, 0.08324),
          seg(25845, 996, 0.31009),
          seg(45592, 5300, 0.0195),
          seg(132920, 5685, -0.0651),
          seg(Infinity, 0, 0),
        ],
        aowSegments: [
          seg(11965, 0, 0.04156),
          seg(25845, 498, 0.15483),
          seg(45592, 2647, 0.00974),
          seg(132920, 2840, -0.0325),
          seg(Infinity, 0, 0),
        ],
      },
    ],
    surtaxes: [
      { id: 'zvw', label: 'Zvw (healthcare contribution)', rate: 0.0485, cap: 79409, base: 'taxable' },
    ],
    vat: {
      standard: 21,
      reduced: 9,
      zero: 0,
      korThreshold: 20000,
      filing: 'quarterly',
      // due dates = last day of the month after the quarter
      due: [
        { quarter: 1, month: 3, day: 30 },
        { quarter: 2, month: 6, day: 31 },
        { quarter: 3, month: 9, day: 31 },
        { quarter: 4, month: 0, day: 31, nextYear: true },
      ],
    },
  },

  BE: {
    id: 'BE',
    label: 'Belgium · zelfstandige (indicative)',
    currency: 'EUR',
    exact: false,
    note: 'Indicative template — adjust brackets and social contributions in Settings.',
    deductions: [],
    exemption: null,
    brackets: [
      { upTo: 15200, rate: 0.25 },
      { upTo: 26830, rate: 0.4 },
      { upTo: 46440, rate: 0.45 },
      { upTo: Infinity, rate: 0.5 },
    ],
    credits: [],
    surtaxes: [{ id: 'social', label: 'Social contributions (20.5%)', rate: 0.205, cap: 23000, base: 'profit' }],
    vat: { standard: 21, reduced: 12, zero: 0, korThreshold: 25000, filing: 'quarterly', due: [] },
  },

  DE: {
    id: 'DE',
    label: 'Germany · Freiberufler (indicative)',
    currency: 'EUR',
    exact: false,
    note: 'Indicative template — Grundfreibetrag approximated as a deduction.',
    deductions: [{ id: 'grundfreibetrag', label: 'Grundfreibetrag', amount: 12348, when: 'always' }],
    exemption: null,
    brackets: [
      { upTo: 17438, rate: 0.14 },
      { upTo: 69878, rate: 0.24 },
      { upTo: 277825, rate: 0.42 },
      { upTo: Infinity, rate: 0.45 },
    ],
    credits: [],
    surtaxes: [{ id: 'kv', label: 'Health & nursing insurance (~19%)', rate: 0.19, cap: 66150, base: 'profit' }],
    vat: { standard: 19, reduced: 7, zero: 0, korThreshold: 25000, filing: 'quarterly', due: [] },
  },

  UK: {
    id: 'UK',
    label: 'United Kingdom · sole trader (indicative)',
    currency: 'GBP',
    exact: false,
    note: 'Indicative template — personal allowance + Class 4 NI.',
    deductions: [{ id: 'pa', label: 'Personal allowance', amount: 12570, when: 'always' }],
    exemption: null,
    brackets: [
      { upTo: 50270, rate: 0.2 },
      { upTo: 125140, rate: 0.4 },
      { upTo: Infinity, rate: 0.45 },
    ],
    credits: [],
    surtaxes: [{ id: 'ni', label: 'Class 4 National Insurance (6%)', rate: 0.06, cap: 50270, base: 'profit', floor: 12570 }],
    vat: { standard: 20, reduced: 5, zero: 0, korThreshold: 90000, filing: 'quarterly', due: [] },
  },

  US: {
    id: 'US',
    label: 'United States · Schedule C (indicative)',
    currency: 'USD',
    exact: false,
    note: 'Indicative template — self-employment tax + federal brackets. Add state tax manually.',
    deductions: [
      { id: 'std', label: 'Standard deduction (single)', amount: 16100, when: 'always' },
      { id: 'se-half', label: 'Deductible half of SE tax', amount: 0, when: 'auto' },
    ],
    exemption: null,
    brackets: [
      { upTo: 12400, rate: 0.1 },
      { upTo: 50400, rate: 0.12 },
      { upTo: 105700, rate: 0.22 },
      { upTo: 201775, rate: 0.24 },
      { upTo: 256225, rate: 0.32 },
      { upTo: 640600, rate: 0.35 },
      { upTo: Infinity, rate: 0.37 },
    ],
    credits: [],
    surtaxes: [
      { id: 'se', label: 'Self-employment tax (15.3% on 92.35%)', rate: 0.153, cap: 184500, base: 'seBase' },
    ],
    vat: { standard: 0, reduced: 0, zero: 0, korThreshold: 0, filing: 'quarterly', due: [] },
    quarterlyDue: ['04-15', '06-15', '09-15', '01-15'],
  },

  CUSTOM: {
    id: 'CUSTOM',
    label: 'Custom profile',
    currency: 'EUR',
    exact: false,
    note: 'Flat-rate reserve: set your own percentage and DRIPS will apply it.',
    deductions: [],
    exemption: null,
    brackets: [{ upTo: Infinity, rate: 0.3 }],
    credits: [],
    surtaxes: [],
    vat: { standard: 21, reduced: 9, zero: 0, korThreshold: 0, filing: 'quarterly', due: [] },
  },
};

export function resolveProfile(settings) {
  const country = settings?.tax?.country || 'NL';
  const base = TAX_PROFILES[country] || TAX_PROFILES.NL;
  const custom = settings?.tax?.custom?.[country] || settings?.tax?.custom || {};
  const profile = { ...base };
  for (const key of ['brackets', 'credits', 'surtaxes', 'deductions', 'exemption', 'vat']) {
    if (custom[key] !== undefined && custom[key] !== null) profile[key] = custom[key];
  }
  if (typeof custom.flatRate === 'number') profile.brackets = [{ upTo: Infinity, rate: custom.flatRate }];
  return profile;
}

/**
 * Full income-tax + healthcare calculation for one tax year.
 * @param {object} profile resolved tax profile
 * @param {object} input  { revenue, expenses, otherIncome, hours, starter, aow }
 */
export function computeTax(profile, input = {}) {
  const revenue = Number(input.revenue) || 0;
  const expenses = Number(input.expenses) || 0;
  const otherIncome = Number(input.otherIncome) || 0;
  const profit = revenue - expenses;
  const hours = Number(input.hours) || 0;
  const hoursOk = input.hoursCriterionMet !== undefined ? !!input.hoursCriterionMet : hours >= (profile.hoursCriterion || 0);
  const starter = !!input.starter;
  const aow = !!input.aow;

  const lines = [];
  let afterDeductions = profit;
  for (const d of profile.deductions || []) {
    const applies =
      d.when === 'always' || (d.when === 'hours' && hoursOk) || (d.when === 'starter' && starter);
    const amount = applies ? Math.max(0, Math.min(Number(d.amount) || 0, Math.max(0, afterDeductions))) : 0;
    if (amount > 0) {
      afterDeductions -= amount;
      lines.push({ label: d.label, amount: -amount, kind: 'deduction' });
    }
  }

  // US style: deductible half of self-employment tax
  const seSurtax = (profile.surtaxes || []).find((s) => s.base === 'seBase');
  if (seSurtax) {
    const seBase = Math.max(0, profit) * 0.9235;
    const se = Math.min(seBase, seSurtax.cap || Infinity) * seSurtax.rate;
    const half = se / 2;
    if (half > 0) {
      afterDeductions -= half;
      lines.push({ label: 'Deductible half of self-employment tax', amount: -half, kind: 'deduction' });
    }
  }

  let exemption = 0;
  if (profile.exemption && afterDeductions > 0) {
    exemption = afterDeductions * (profile.exemption.rate || 0);
    afterDeductions -= exemption;
    lines.push({ label: profile.exemption.label, amount: -exemption, kind: 'deduction' });
  }

  const taxable = Math.max(0, afterDeductions) + Math.max(0, otherIncome);
  const { tax: grossTax, parts } = bracketTax(profile.brackets, taxable);

  let credits = 0;
  for (const c of profile.credits || []) {
    const segments = aow && c.aowSegments ? c.aowSegments : c.segments;
    const value = Math.min(piecewise(segments, taxable), grossTax - credits);
    if (value > 0) {
      credits += value;
      lines.push({ label: c.label, amount: -value, kind: 'credit' });
    }
  }

  const incomeTax = Math.max(0, grossTax - credits);

  let surtax = 0;
  for (const s of profile.surtaxes || []) {
    let base = 0;
    if (s.base === 'seBase') base = Math.max(0, profit) * 0.9235;
    else if (s.base === 'profit') base = Math.max(0, profit);
    else base = taxable;
    const floor = s.floor ? Math.max(0, base - s.floor) : base;
    const capped = s.cap ? Math.min(floor, s.cap - (s.floor || 0)) : floor;
    const value = Math.max(0, capped) * (s.rate || 0);
    surtax += value;
    lines.push({ label: s.label, amount: value, kind: 'surtax' });
  }

  const total = incomeTax + surtax;
  return {
    profile,
    revenue,
    expenses,
    profit,
    hours,
    hoursOk,
    deductions: lines.filter((l) => l.kind === 'deduction'),
    exemption,
    taxable,
    brackets: parts,
    grossTax,
    credits,
    creditLines: lines.filter((l) => l.kind === 'credit'),
    incomeTax,
    surtax,
    surtaxLines: lines.filter((l) => l.kind === 'surtax'),
    total,
    netTakeHome: profit + otherIncome - total,
    effectiveRate: profit > 0 ? (total / profit) * 100 : 0,
    marginalRate: (profile.brackets.find((b) => taxable <= b.upTo)?.rate || 0) * 100,
    taxRateOnRevenue: revenue > 0 ? (total / revenue) * 100 : 0,
  };
}

/* ---------------------------------- VAT ----------------------------------- */

export const VAT_RATES = [
  { value: 21, label: '21% · standard rate' },
  { value: 9, label: '9% · reduced rate' },
  { value: 0, label: '0% · reverse charge / EU export' },
  { value: 6, label: '6% · legacy reduced (BE/NL pre-2019)' },
  { value: 20, label: '20% · UK standard' },
  { value: 19, label: '19% · DE standard' },
];

export function vatFromInclusive(gross, rate) {
  return (gross * rate) / (100 + rate);
}
export function vatFromExclusive(net, rate) {
  return (net * rate) / 100;
}

/** VAT position for a quarter from invoices (output VAT) and expenses (input VAT). */
export function computeVatQuarter({ invoices = [], expenses = [], year, quarter, regime = 'standard' }) {
  const inQuarter = (iso) => {
    const d = new Date(String(iso).slice(0, 10));
    return d.getFullYear() === year && Math.floor(d.getMonth() / 3) + 1 === quarter;
  };
  if (regime === 'kor')
    return {
      year,
      quarter,
      regime,
      revenue: invoices.filter((i) => i.status !== 'draft' && inQuarter(i.issueDate)).reduce((s, i) => s + (i.net || 0), 0),
      outputVat: 0,
      inputVat: 0,
      due: 0,
      note: 'KOR — small business scheme: no VAT charged, no VAT return needed.',
    };

  const qInvoices = invoices.filter((i) => i.status !== 'draft' && i.status !== 'void' && inQuarter(i.issueDate));
  const qExpenses = expenses.filter((e) => inQuarter(e.date));
  const outputVat = qInvoices.reduce((s, i) => s + (Number(i.taxTotal) || 0), 0);
  const inputVat = qExpenses
    .filter((e) => e.deductible !== false)
    .reduce((s, e) => s + (Number(e.vatAmount) || vatFromInclusive(Number(e.amount) || 0, Number(e.vatRate) || 0)), 0);
  const revenue = qInvoices.reduce((s, i) => s + (Number(i.net) || 0), 0);
  const costs = qExpenses.reduce((s, e) => s + (Number(e.amount) || 0) - (Number(e.vatAmount) || 0), 0);
  return {
    year,
    quarter,
    regime,
    revenue,
    costs,
    outputVat: round(outputVat),
    inputVat: round(inputVat),
    due: round(outputVat - inputVat),
    invoices: qInvoices.length,
    expenses: qExpenses.length,
    note: outputVat - inputVat >= 0 ? 'Amount to pay to the tax office.' : 'Amount the tax office owes you back.',
  };
}

export const round = (n) => Math.round((Number(n) || 0) * 100) / 100;

/** Deadline for a VAT return / income-tax reserve for a profile + quarter. */
export function vatDeadline(profile, year, quarter) {
  const rule = profile?.vat?.due?.find((d) => d.quarter === quarter);
  if (!rule) {
    if (profile?.quarterlyDue?.[quarter - 1]) return `${profile.quarterlyDue[quarter - 1].slice(0, 2)}/${profile.quarterlyDue[quarter - 1].slice(3)}`;
    return null;
  }
  const y = rule.nextYear ? year + 1 : year;
  const month = String(((rule.month + 11) % 12) + 1).padStart(2, '0');
  return `${y}-${month}-${String(rule.day).padStart(2, '0')}`;
}

/** Recommended set-aside percentage, rounded up to a safe whole number. */
export function recommendedSetAside(effectiveRate, bufferPct = 5) {
  return Math.min(60, Math.ceil(effectiveRate + Number(bufferPct || 0)));
}

export const QUARTERS = [1, 2, 3, 4];
