// Formatting + small pure helpers shared across the whole app.
export const cx = (...parts) => parts.filter(Boolean).join(' ');

export const todayISO = () => new Date().toISOString().slice(0, 10);

export const addDays = (dateOrIso, days) => {
  const d = typeof dateOrIso === 'string' ? new Date(`${dateOrIso}T00:00:00`) : new Date(dateOrIso);
  d.setDate(d.getDate() + days);
  return d;
};

export const isoOf = (d) => (d instanceof Date ? d.toISOString().slice(0, 10) : String(d || '').slice(0, 10));

export const parseNum = (v) => {
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
  if (!v) return 0;
  const s = String(v).replace(/\s|€/g, '').replace(/,/g, '.').replace(/[^0-9.-]/g, '');
  const n = Number.parseFloat(s);
  return Number.isFinite(n) ? n : 0;
};

export const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
export const sum = (arr, fn = (x) => x) => round2(arr.reduce((s, x) => s + (Number(fn(x)) || 0), 0));
export const clamp = (n, min, max) => Math.min(max, Math.max(min, n));
export const pct = (a, b) => (b ? clamp((a / b) * 100, 0, 100) : 0);

export const uid = (p = 'id') =>
  `${p}_${Math.random().toString(36).slice(2, 8)}${Date.now().toString(36).slice(-4)}`;

export const initials = (name = '') =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() || '')
    .join('') || '?';

export const numberFmtCache = new Map();
export function getNumberFormat(currency = 'EUR', locale = 'nl-NL', opts = {}) {
  const key = `${currency}|${locale}|${JSON.stringify(opts)}`;
  if (!numberFmtCache.has(key)) {
    numberFmtCache.set(
      key,
      new Intl.NumberFormat(locale, { style: 'currency', currency, ...opts }),
    );
  }
  return numberFmtCache.get(key);
}

export const fmtMoney = (amount, currency = 'EUR', locale = 'nl-NL', opts = {}) => {
  try {
    return getNumberFormat(currency, locale, opts).format(Number(amount) || 0);
  } catch {
    return `${currency} ${(Number(amount) || 0).toFixed(2)}`;
  }
};

export const fmtCompact = (amount, currency = 'EUR', locale = 'nl-NL') => {
  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      notation: 'compact',
      maximumFractionDigits: 1,
    }).format(Number(amount) || 0);
  } catch {
    return `${currency} ${Math.round(amount || 0)}`;
  }
};

export const fmtNumber = (n, locale = 'nl-NL', digits = 2) =>
  new Intl.NumberFormat(locale, { maximumFractionDigits: digits }).format(Number(n) || 0);

export const fmtDate = (iso, locale = 'nl-NL', opts = {}) => {
  if (!iso) return '—';
  const d = new Date(typeof iso === 'string' && iso.length <= 10 ? `${iso}T00:00:00` : iso);
  if (Number.isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat(locale, { day: '2-digit', month: 'short', year: 'numeric', ...opts }).format(d);
};

export const fmtDateTime = (iso, locale = 'nl-NL') => {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat(locale, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
};

export const relTime = (iso, locale = 'nl-NL') => {
  if (!iso) return '';
  const d = new Date(iso).getTime();
  if (Number.isNaN(d)) return '';
  const diff = d - Date.now();
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
  const abs = Math.abs(diff);
  const units = [
    ['year', 31536e6],
    ['month', 2592e6],
    ['week', 6048e5],
    ['day', 864e5],
    ['hour', 36e5],
    ['minute', 6e4],
  ];
  for (const [unit, ms] of units) if (abs >= ms) return rtf.format(Math.round(diff / ms), unit);
  return rtf.format(Math.round(diff / 1000), 'second');
};

export const daysBetween = (a, b = todayISO()) => {
  const d1 = new Date(`${String(a).slice(0, 10)}T00:00:00`).getTime();
  const d2 = new Date(`${String(b).slice(0, 10)}T00:00:00`).getTime();
  if (Number.isNaN(d1) || Number.isNaN(d2)) return 0;
  return Math.round((d1 - d2) / 864e5);
};

export const quarterOf = (dateOrIso = new Date()) => {
  const d = typeof dateOrIso === 'string' ? new Date(dateOrIso.slice(0, 10)) : dateOrIso;
  return Math.floor(d.getMonth() / 3) + 1;
};

export const yearOf = (dateOrIso = new Date()) =>
  (typeof dateOrIso === 'string' ? new Date(dateOrIso.slice(0, 10)) : dateOrIso).getFullYear();

export const monthKey = (iso) => String(iso || '').slice(0, 7);

export const monthLabel = (key, locale = 'nl-NL') => {
  const [y, m] = key.split('-');
  return new Intl.DateTimeFormat(locale, { month: 'short' }).format(new Date(Number(y), Number(m) - 1, 1));
};

export const minutesToHours = (mins) => round2((Number(mins) || 0) / 60);

export const fmtDuration = (mins) => {
  const m = Math.max(0, Math.round(Number(mins) || 0));
  const h = Math.floor(m / 60);
  return `${h}:${String(m % 60).padStart(2, '0')}`;
};

export const fmtStopwatch = (ms) => {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return [h, m, s].map((n) => String(n).padStart(2, '0')).join(':');
};

export const weekStart = (d = new Date()) => {
  const date = new Date(d);
  const day = (date.getDay() + 6) % 7; // Monday = 0
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() - day);
  return date;
};

export const lastMonths = (count, from = new Date()) => {
  const out = [];
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(from.getFullYear(), from.getMonth() - i, 1);
    out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }
  return out;
};

export function download(filename, data, type = 'text/plain;charset=utf-8') {
  const blob = data instanceof Blob ? data : new Blob([data], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

export const downloadJson = (filename, obj) => download(filename, JSON.stringify(obj, null, 2), 'application/json');

export const readFileAsDataUrl = (file) =>
  new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(String(fr.result));
    fr.onerror = reject;
    fr.readAsDataURL(file);
  });

// Down-scale + normalise uploaded logos so the DB (and PDFs) stay small.
export async function normaliseImage(file, max = 720) {
  const dataUrl = await readFileAsDataUrl(file);
  if (!/^data:image\/(png|jpeg|jpg|webp|svg\+xml);/.test(dataUrl)) return dataUrl;
  if (dataUrl.startsWith('data:image/svg')) return dataUrl;
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, max / Math.max(img.width, img.height));
      const w = Math.max(1, Math.round(img.width * scale));
      const h = Math.max(1, Math.round(img.height * scale));
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, w, h);
      const type = file.type === 'image/jpeg' ? 'image/jpeg' : 'image/png';
      resolve(canvas.toDataURL(type, 0.92));
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

export function copyText(text) {
  if (navigator.clipboard?.writeText) return navigator.clipboard.writeText(text);
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.style.position = 'fixed';
  ta.style.opacity = '0';
  document.body.appendChild(ta);
  ta.select();
  try {
    document.execCommand('copy');
  } catch {
    /* noop */
  }
  ta.remove();
  return Promise.resolve();
}

export const sortBy = (arr, fn, dir = 1) =>
  [...arr].sort((a, b) => {
    const va = fn(a);
    const vb = fn(b);
    if (va === vb) return 0;
    if (va === undefined || va === null || va === '') return 1;
    if (vb === undefined || vb === null || vb === '') return -1;
    return (va > vb ? 1 : -1) * dir;
  });

export const groupBy = (arr, fn) =>
  arr.reduce((acc, item) => {
    const key = fn(item) || '—';
    (acc[key] = acc[key] || []).push(item);
    return acc;
  }, {});

export const debounce = (fn, ms = 400) => {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
};
