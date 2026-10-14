// Tiny atomic JSON document store — no native deps, no external services.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = process.env.DRIPS_DATA_DIR || path.join(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');

export const COLLECTIONS = [
  'clients',
  'proposals',
  'invoices',
  'expenses',
  'timeEntries',
  'projects',
  'sprints',
  'tasks',
  'goals',
  'ledger',
  'activity',
];

export const uid = (prefix = 'id') =>
  `${prefix}_${crypto.randomBytes(6).toString('hex')}${Date.now().toString(36).slice(-4)}`;

export const token = () => crypto.randomBytes(16).toString('hex');

function emptyWorkspace() {
  return {
    id: uid('ws'),
    token: token(),
    createdAt: new Date().toISOString(),
    plan: 'free',
    settings: defaultSettings(),
    collections: Object.fromEntries(COLLECTIONS.map((c) => [c, []])),
  };
}

export function defaultSettings() {
  return {
    business: {
      name: '',
      owner: '',
      email: '',
      phone: '',
      website: '',
      street: '',
      postalCode: '',
      city: '',
      country: 'Netherlands',
      regNumber: '', // KvK / Chamber of Commerce number
      taxId: '', // BTW-id / VAT number
      iban: '',
      logoDataUrl: '',
      logoName: '',
      tagline: '',
    },
    brand: {
      primary: '#AE1C28', // Dutch flag red
      secondary: '#21468B', // Dutch flag blue
      documentAccent: '#0E1B3D',
    },
    locale: {
      baseCurrency: 'EUR',
      language: 'en',
      dateFormat: 'DD/MM/YYYY',
      numberFormat: 'nl',
    },
    tax: {
      country: 'NL',
      year: 2026,
      vatRegime: 'standard', // standard | kor | none
      vatRate: 21,
      vatReducedRate: 9,
      entity: 'sole', // sole | bv | us_llc | uk_sole | other
      hoursCriterionMet: true,
      starter: false,
      otherIncome: 0,
      bufferPct: 5,
    },
    numbering: {
      proposalPrefix: 'PROP',
      proposalNext: 1,
      invoicePrefix: 'INV',
      invoiceNext: 1001,
      quotePrefix: 'QUO',
      quoteNext: 1,
      clientPrefix: 'CL',
      clientNext: 100,
    },
    defaults: {
      hourlyRate: 85,
      currency: 'EUR',
      paymentTermsDays: 14,
      validityDays: 30,
      proposalIntro:
        'Thank you for the opportunity to work together. This proposal outlines the scope, timeline and investment for the work described below.',
      proposalTerms:
        'Invoices are payable within 14 days of the invoice date. A 30% deposit is due on acceptance to secure the start date. Work outside the agreed scope is billed at the standard hourly rate. All prices exclude VAT unless stated otherwise.',
      signature: '',
    },
    rates: {}, // optional per-currency overrides, EUR based
  };
}

let state = null;

export function load() {
  if (state) return state;
  try {
    const raw = fs.readFileSync(DB_FILE, 'utf8');
    state = JSON.parse(raw);
  } catch {
    state = { workspaces: [] };
  }
  if (!Array.isArray(state.workspaces)) state.workspaces = [];
  // forward-compat: make sure every workspace has every collection
  for (const ws of state.workspaces) {
    ws.collections = ws.collections || {};
    for (const c of COLLECTIONS) if (!Array.isArray(ws.collections[c])) ws.collections[c] = [];
    ws.settings = { ...defaultSettings(), ...(ws.settings || {}) };
    ws.settings.business = { ...defaultSettings().business, ...(ws.settings.business || {}) };
    ws.settings.brand = { ...defaultSettings().brand, ...(ws.settings.brand || {}) };
    ws.settings.locale = { ...defaultSettings().locale, ...(ws.settings.locale || {}) };
    ws.settings.tax = { ...defaultSettings().tax, ...(ws.settings.tax || {}) };
    ws.settings.numbering = { ...defaultSettings().numbering, ...(ws.settings.numbering || {}) };
    ws.settings.defaults = { ...defaultSettings().defaults, ...(ws.settings.defaults || {}) };
  }
  return state;
}

let writeTimer = null;
export function save() {
  // debounce + atomic replace so we never leave a half written file behind
  if (writeTimer) clearTimeout(writeTimer);
  writeTimer = setTimeout(() => {
    writeTimer = null;
    try {
      fs.mkdirSync(DATA_DIR, { recursive: true });
      const tmp = `${DB_FILE}.${process.pid}.tmp`;
      fs.writeFileSync(tmp, JSON.stringify(state, null, 2));
      fs.renameSync(tmp, DB_FILE);
    } catch (err) {
      console.error('[db] save failed', err);
    }
  }, 60);
}

export function saveSync() {
  if (writeTimer) {
    clearTimeout(writeTimer);
    writeTimer = null;
  }
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(DB_FILE, JSON.stringify(state, null, 2));
}

export function getWorkspaceByToken(t) {
  return load().workspaces.find((w) => w.token === t) || null;
}

export function getWorkspaceById(id) {
  return load().workspaces.find((w) => w.id === id) || null;
}

export function createWorkspace(patch = {}) {
  const ws = { ...emptyWorkspace(), ...patch };
  load().workspaces.push(ws);
  save();
  return ws;
}

export function deleteWorkspace(id) {
  const s = load();
  const i = s.workspaces.findIndex((w) => w.id === id);
  if (i >= 0) s.workspaces.splice(i, 1);
  save();
  return i >= 0;
}

export function findPublicProposal(publicToken) {
  for (const ws of load().workspaces) {
    const p = ws.collections.proposals.find((x) => x.publicToken === publicToken);
    if (p) return { ws, proposal: p };
  }
  return null;
}

export function logActivity(ws, type, message) {
  ws.collections.activity.unshift({
    id: uid('act'),
    ts: new Date().toISOString(),
    type,
    message,
  });
  ws.collections.activity = ws.collections.activity.slice(0, 120);
}

export { emptyWorkspace, DB_FILE };
