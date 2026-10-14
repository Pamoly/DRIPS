import express from 'express';
import cors from 'cors';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  COLLECTIONS,
  uid,
  load,
  save,
  saveSync,
  createWorkspace,
  deleteWorkspace,
  getWorkspaceByToken,
  findPublicProposal,
  logActivity,
  defaultSettings,
} from './db.js';
import { buildDemo } from './seed.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 8787);
const DIST = path.resolve(__dirname, '../client/dist');

const app = express();
app.use(cors());
app.use(express.json({ limit: '40mb' })); // room for base64 logos / backups
app.disable('x-powered-by');

/* ---------------------------------- helpers --------------------------------- */

const money = (n) => Math.round((Number(n) || 0) * 100) / 100;

function computeTotals(doc) {
  const items = Array.isArray(doc.items) ? doc.items : [];
  const packages = Array.isArray(doc.packages) ? doc.packages : [];
  const discount = doc.discount || { type: 'percent', value: 0 };
  let subtotal = 0;

  if (doc.mode === 'packages' && packages.length) {
    const idx = Number(doc.selectedPackage ?? 0);
    const chosen = packages[idx] || packages[0];
    subtotal = chosen ? money(chosen.price) * (Number(chosen.qty) || 1) : 0;
  } else if (doc.mode === 'fixed' && doc.fixedPrice) {
    subtotal = money(doc.fixedPrice);
  } else {
    subtotal = items.reduce((s, it) => s + money(it.qty) * money(it.rate), 0);
  }

  const discountValue =
    discount.type === 'percent'
      ? money((subtotal * money(discount.value)) / 100)
      : money(discount.value);
  const net = Math.max(0, money(subtotal - discountValue));
  const rate = money(doc.taxRate ?? 0);
  const taxTotal = money((net * rate) / 100);
  return {
    subtotal: money(subtotal),
    discountValue: money(discountValue),
    net: money(net),
    taxRate: rate,
    taxTotal,
    total: money(net + taxTotal),
  };
}

function auth(req, res, next) {
  const header = req.headers.authorization || '';
  const t = header.startsWith('Bearer ') ? header.slice(7) : req.headers['x-workspace-token'];
  const ws = t ? getWorkspaceByToken(t) : null;
  if (!ws) return res.status(401).json({ error: 'missing or invalid workspace token' });
  req.ws = ws;
  next();
}

function stamp(ws, record, prefix) {
  const now = new Date().toISOString();
  return {
    id: uid(prefix),
    createdAt: now,
    updatedAt: now,
    ...record,
  };
}

function nextNumber(ws, kind) {
  const n = ws.settings.numbering;
  const year = new Date().getFullYear();
  if (kind === 'proposal') {
    const value = `${n.proposalPrefix}-${year}-${String(n.proposalNext).padStart(3, '0')}`;
    n.proposalNext += 1;
    return value;
  }
  if (kind === 'quote') {
    const value = `${n.quotePrefix}-${year}-${String(n.quoteNext).padStart(3, '0')}`;
    n.quoteNext += 1;
    return value;
  }
  const value = `${n.invoicePrefix}-${year}-${String(n.invoiceNext).padStart(4, '0')}`;
  n.invoiceNext += 1;
  return value;
}

/* ---------------------------------- routes ---------------------------------- */

app.get('/api/health', (_req, res) => res.json({ ok: true, ts: Date.now() }));

// Create (or return) the workspace for this browser session.
app.post('/api/bootstrap', (req, res) => {
  load();
  const existingToken = req.body?.token;
  if (existingToken) {
    const ws = getWorkspaceByToken(existingToken);
    if (ws) return res.json({ token: ws.token, workspace: ws.id, created: false });
  }
  const ws = createWorkspace();
  res.json({ token: ws.token, workspace: ws.id, created: true });
});

app.get('/api/state', auth, (req, res) => {
  const ws = req.ws;
  res.json({
    id: ws.id,
    plan: ws.plan,
    createdAt: ws.createdAt,
    settings: ws.settings,
    collections: ws.collections,
  });
});

app.put('/api/settings', auth, (req, res) => {
  const ws = req.ws;
  const incoming = req.body || {};
  for (const group of ['business', 'brand', 'locale', 'tax', 'numbering', 'defaults', 'rates']) {
    if (incoming[group] && typeof incoming[group] === 'object') {
      ws.settings[group] = { ...ws.settings[group], ...incoming[group] };
    }
  }
  if (typeof incoming.plan === 'string') ws.plan = incoming.plan;
  save();
  res.json({ settings: ws.settings });
});

// Generic collection CRUD ---------------------------------------------------
for (const collection of COLLECTIONS) {
  if (collection === 'activity') continue;

  app.post(`/api/${collection}`, auth, (req, res) => {
    const ws = req.ws;
    let record = req.body || {};
    if (collection === 'proposals' || collection === 'invoices') {
      if (!record.number) record.number = nextNumber(ws, collection === 'proposals' ? record.type || 'proposal' : 'invoice');
      if (collection === 'proposals' && !record.publicToken) record.publicToken = uid('share').replace('share_', '');
      record = { ...record, ...computeTotals(record) };
    }
    const created = stamp(ws, record, collection.slice(0, 3));
    ws.collections[collection].unshift(created);
    logActivity(
      ws,
      'create',
      `Created ${collection.replace(/s$/, '')} “${created.title || created.name || created.number || created.description || 'entry'}”`,
    );
    save();
    res.status(201).json(created);
  });

  app.put(`/api/${collection}/:id`, auth, (req, res) => {
    const ws = req.ws;
    const list = ws.collections[collection];
    const i = list.findIndex((x) => x.id === req.params.id);
    if (i < 0) return res.status(404).json({ error: 'not found' });
    let patch = req.body || {};
    const merged = { ...list[i], ...patch, id: list[i].id, updatedAt: new Date().toISOString() };
    if (collection === 'proposals' || collection === 'invoices') Object.assign(merged, computeTotals(merged));
    list[i] = merged;
    save();
    res.json(merged);
  });

  app.patch(`/api/${collection}/:id`, auth, (req, res) => {
    const ws = req.ws;
    const list = ws.collections[collection];
    const i = list.findIndex((x) => x.id === req.params.id);
    if (i < 0) return res.status(404).json({ error: 'not found' });
    const patch = req.body || {};
    list[i] = { ...list[i], ...patch, id: list[i].id, updatedAt: new Date().toISOString() };
    if (collection === 'proposals' || collection === 'invoices') Object.assign(list[i], computeTotals(list[i]));
    save();
    res.json(list[i]);
  });

  app.delete(`/api/${collection}/:id`, auth, (req, res) => {
    const ws = req.ws;
    const list = ws.collections[collection];
    const i = list.findIndex((x) => x.id === req.params.id);
    if (i < 0) return res.status(404).json({ error: 'not found' });
    const [removed] = list.splice(i, 1);
    logActivity(
      ws,
      'delete',
      `Deleted ${collection.replace(/s$/, '')} “${removed.title || removed.name || removed.number || ''}”`,
    );
    save();
    res.json({ ok: true, id: req.params.id });
  });

  // Bulk replace (used by board drag & drop re-ordering)
  app.put(`/api/${collection}`, auth, (req, res) => {
    const ws = req.ws;
    const rows = Array.isArray(req.body?.rows) ? req.body.rows : null;
    if (!rows) return res.status(400).json({ error: 'rows[] required' });
    ws.collections[collection] = rows;
    save();
    res.json({ ok: true, count: rows.length });
  });
}

/* ------------------------------ proposals extras ----------------------------- */

app.post('/api/proposals/:id/duplicate', auth, (req, res) => {
  const ws = req.ws;
  const src = ws.collections.proposals.find((p) => p.id === req.params.id);
  if (!src) return res.status(404).json({ error: 'not found' });
  const copy = {
    ...src,
    id: uid('pro'),
    number: nextNumber(ws, src.type === 'quote' ? 'quote' : 'proposal'),
    publicToken: uid('share').replace('share_', ''),
    status: 'draft',
    title: `${src.title} (copy)`,
    acceptedAt: null,
    acceptedBy: null,
    views: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  ws.collections.proposals.unshift(copy);
  save();
  res.status(201).json(copy);
});

app.post('/api/proposals/:id/convert', auth, (req, res) => {
  const ws = req.ws;
  const p = ws.collections.proposals.find((x) => x.id === req.params.id);
  if (!p) return res.status(404).json({ error: 'not found' });
  const items =
    p.mode === 'packages'
      ? (p.packages || []).map((pk) => ({
          id: uid('it'),
          description: pk.name,
          detail: (pk.features || []).join(' · '),
          qty: pk.qty || 1,
          unit: 'package',
          rate: money(pk.price),
        }))
      : (p.items || []).map((it) => ({ ...it, id: uid('it') }));
  const issueDate = new Date().toISOString().slice(0, 10);
  const terms = Number(ws.settings.defaults.paymentTermsDays || 14);
  const due = new Date(Date.now() + terms * 864e5).toISOString().slice(0, 10);
  const invoice = stamp(
    ws,
    {
      number: nextNumber(ws, 'invoice'),
      clientId: p.clientId,
      proposalId: p.id,
      reference: p.number,
      status: 'draft',
      currency: p.currency,
      issueDate,
      dueDate: due,
      items,
      taxRate: p.taxRate ?? ws.settings.tax.vatRate,
      discount: p.discount || { type: 'percent', value: 0 },
      notes: `Converted from ${p.number} — ${p.title}`,
      payments: [],
    },
    'inv',
  );
  Object.assign(invoice, computeTotals(invoice));
  ws.collections.invoices.unshift(invoice);
  p.status = p.status === 'accepted' ? 'invoiced' : p.status;
  logActivity(ws, 'convert', `Converted ${p.number} into invoice ${invoice.number}`);
  save();
  res.status(201).json(invoice);
});

/* -------------------------------- invoices --------------------------------- */

app.post('/api/invoices/:id/payments', auth, (req, res) => {
  const ws = req.ws;
  const inv = ws.collections.invoices.find((x) => x.id === req.params.id);
  if (!inv) return res.status(404).json({ error: 'not found' });
  const amount = money(req.body?.amount ?? inv.total - (inv.paidAmount || 0));
  if (!amount) return res.status(400).json({ error: 'amount must be greater than zero' });
  inv.payments = Array.isArray(inv.payments) ? inv.payments : [];
  inv.payments.push({
    id: uid('pay'),
    date: req.body?.date || new Date().toISOString().slice(0, 10),
    amount,
    method: req.body?.method || 'bank',
    note: req.body?.note || '',
  });
  inv.paidAmount = money(inv.payments.reduce((s, p) => s + money(p.amount), 0));
  inv.status = inv.paidAmount + 0.005 >= money(inv.total) ? 'paid' : 'partly-paid';
  logActivity(ws, 'payment', `Payment of ${amount} ${inv.currency} recorded on ${inv.number}`);
  save();
  res.json(inv);
});

/* ------------------------------- public share ------------------------------- */

app.get('/api/public/proposal/:token', (req, res) => {
  const found = findPublicProposal(req.params.token);
  if (!found) return res.status(404).json({ error: 'This link is no longer available.' });
  const { ws, proposal } = found;
  res.json({
    proposal,
    business: { ...ws.settings.business },
    brand: ws.settings.brand,
    locale: ws.settings.locale,
    client: ws.collections.clients.find((c) => c.id === proposal.clientId) || null,
  });
});

app.post('/api/public/proposal/:token/view', (req, res) => {
  const found = findPublicProposal(req.params.token);
  if (!found) return res.status(404).json({ error: 'not found' });
  const { proposal } = found;
  proposal.views = (proposal.views || 0) + 1;
  proposal.lastViewedAt = new Date().toISOString();
  if (proposal.status === 'sent') proposal.status = 'viewed';
  save();
  res.json({ views: proposal.views, status: proposal.status });
});

app.post('/api/public/proposal/:token/decision', (req, res) => {
  const found = findPublicProposal(req.params.token);
  if (!found) return res.status(404).json({ error: 'not found' });
  const { ws, proposal } = found;
  const accept = req.body?.decision !== 'decline';
  proposal.status = accept ? 'accepted' : 'declined';
  proposal.decidedAt = new Date().toISOString();
  proposal.acceptedBy = accept ? req.body?.name || 'Client' : req.body?.name || '';
  proposal.declineReason = accept ? '' : req.body?.reason || '';
  logActivity(ws, accept ? 'accept' : 'decline', `${proposal.number} was ${proposal.status} by ${proposal.acceptedBy || 'client'}`);
  save();
  res.json({ proposal });
});

/* --------------------------------- utilities -------------------------------- */

app.post('/api/demo', auth, (req, res) => {
  const ws = req.ws;
  const demo = buildDemo(ws);
  ws.collections = demo.collections;
  ws.settings = { ...defaultSettings(), ...demo.settings, ...req.body?.keepSettings };
  logActivity(ws, 'demo', 'Demo dataset loaded');
  save();
  res.json({ settings: ws.settings, collections: ws.collections });
});

app.post('/api/reset', auth, (req, res) => {
  const ws = req.ws;
  ws.collections = Object.fromEntries(COLLECTIONS.map((c) => [c, []]));
  ws.settings = defaultSettings();
  logActivity(ws, 'reset', 'Workspace reset');
  save();
  res.json({ settings: ws.settings, collections: ws.collections });
});

app.post('/api/backup', auth, (req, res) => {
  const ws = req.ws;
  const payload = req.body || {};
  if (!payload.settings || typeof payload.settings !== 'object')
    return res.status(400).json({ error: 'invalid backup file' });
  ws.settings = { ...defaultSettings(), ...payload.settings };
  ws.collections = Object.fromEntries(COLLECTIONS.map((c) => [c, []]));
  const cols = payload.collections || {};
  for (const c of COLLECTIONS) if (Array.isArray(cols[c])) ws.collections[c] = cols[c];
  logActivity(ws, 'restore', 'Workspace restored from backup');
  save();
  res.json({ settings: ws.settings, collections: ws.collections });
});

/* --------------------------- static SPA (production) ------------------------ */

if (fs.existsSync(DIST)) {
  app.use(express.static(DIST, { maxAge: '1h', index: false }));
  app.get(/^(?!\/api).*/, (_req, res) => res.sendFile(path.join(DIST, 'index.html')));
} else {
  app.get('/', (_req, res) =>
    res
      .status(200)
      .send('DRIPS API is running. Start the web client with `npm run dev` (Vite on :5173).'),
  );
}

app.use((err, _req, res, _next) => {
  console.error('[api]', err);
  res.status(500).json({ error: err.message || 'server error' });
});

const server = app.listen(PORT, '0.0.0.0', () => {
  load();
  console.log(`DRIPS API listening on http://0.0.0.0:${PORT}`);
});

const shutdown = () => {
  saveSync();
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 1500);
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
