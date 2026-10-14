// Demo dataset so the workspace feels alive on first run.
import { uid, defaultSettings } from './db.js';

const day = 864e5;
const now = () => new Date();
const iso = (offsetDays = 0, base = now()) =>
  new Date(base.getTime() + offsetDays * day).toISOString().slice(0, 10);
const ts = (offsetDays = 0) => new Date(now().getTime() + offsetDays * day).toISOString();
const money = (n) => Math.round(n * 100) / 100;

function totals(doc) {
  const items = doc.items || [];
  const packages = doc.packages || [];
  let subtotal = 0;
  if (doc.mode === 'packages') {
    const chosen = packages[Number(doc.selectedPackage ?? 0)] || packages[0];
    subtotal = chosen ? money(chosen.price) * (chosen.qty || 1) : 0;
  }
  else if (doc.mode === 'fixed') subtotal = money(doc.fixedPrice || 0);
  else subtotal = items.reduce((s, it) => s + money(it.qty) * money(it.rate), 0);
  const d = doc.discount || { type: 'percent', value: 0 };
  const discountValue = d.type === 'percent' ? money((subtotal * d.value) / 100) : money(d.value);
  const net = Math.max(0, money(subtotal - discountValue));
  const taxTotal = money((net * (doc.taxRate || 0)) / 100);
  return {
    subtotal: money(subtotal),
    discountValue,
    net,
    taxTotal,
    total: money(net + taxTotal),
    discount: d,
  };
}

export function buildDemo(ws) {
  const settings = {
    ...defaultSettings(),
    business: {
      ...defaultSettings().business,
      name: 'Studio Noordzij',
      owner: 'Mila Noordzij',
      email: 'hello@studionoordzij.nl',
      phone: '+31 6 24 88 10 43',
      website: 'studionoordzij.nl',
      street: 'Schiedamse Vest 152',
      postalCode: '3011 BH',
      city: 'Rotterdam',
      country: 'Netherlands',
      regNumber: '8742 1930',
      taxId: 'NL0038.12.947.B01',
      iban: 'NL12 ABNA 0483 9201 44',
      tagline: 'Brand & product design for ambitious teams',
    },
    defaults: {
      ...defaultSettings().defaults,
      hourlyRate: 95,
      currency: 'EUR',
      paymentTermsDays: 14,
      validityDays: 30,
      signature: 'Mila Noordzij',
    },
  };

  const clients = [
    {
      id: 'cli_havenlab', name: 'Sanne Boersma', company: 'Havenlab B.V.', email: 'sanne@havenlab.nl',
      phone: '+31 10 223 8890', website: 'havenlab.nl', street: 'Wilhelminakade 173', postalCode: '3072 AP',
      city: 'Rotterdam', country: 'Netherlands', regNumber: '6612 4483', taxId: 'NL8564.22.109.B01',
      status: 'active', tags: ['retainer', 'priority'], notes: 'Main contact for the platform redesign. Prefers async updates on Fridays.',
      hourlyRate: 105, createdAt: ts(-260), color: '#AE1C28',
    },
    {
      id: 'cli_molenwind', name: 'Joris van Doorn', company: 'Molenwind Energy', email: 'joris@molenwind.eu',
      phone: '+31 20 799 4412', website: 'molenwind.eu', street: 'Keizersgracht 241', postalCode: '1016 EA',
      city: 'Amsterdam', country: 'Netherlands', regNumber: '7099 2211', taxId: 'NL8586.44.901.B01',
      status: 'active', tags: ['saaS'], notes: 'Series A startup, needs investor-ready collateral.',
      hourlyRate: 95, createdAt: ts(-140), color: '#21468B',
    },
    {
      id: 'cli_bakkerij', name: 'Nadia el Amrani', company: 'Bakkerij el Amrani', email: 'info@bakkerij-elamrani.nl',
      phone: '+31 10 436 1180', website: 'bakkerij-elamrani.nl', street: 'Zwaanshals 218', postalCode: '3035 BK',
      city: 'Rotterdam', country: 'Netherlands', regNumber: '2448 9902', taxId: '',
      status: 'lead', tags: ['local'], notes: 'Small webshop + brand refresh. Budget sensitive, KOR scheme.',
      hourlyRate: 75, createdAt: ts(-32), color: '#0E7C66',
    },
    {
      id: 'cli_deltafit', name: 'Tom Wessels', company: 'DeltaFit', email: 'tom@deltafit.app',
      phone: '+31 6 11 20 5577', website: 'deltafit.app', street: 'Coolsingel 63', postalCode: '3012 AA',
      city: 'Rotterdam', country: 'Netherlands', regNumber: '8223 1170', taxId: 'NL0021.77.442.B02',
      status: 'past', tags: ['mobile'], notes: 'App launch finished in Q2 — possible phase 2 next year.',
      hourlyRate: 90, createdAt: ts(-320), color: '#B26A00',
    },
    {
      id: 'cli_gemeente', name: 'Ilse Kramer', company: 'Gemeente Delft', email: 'i.kramer@delft.nl',
      phone: '+31 15 267 8111', website: 'delft.nl', street: 'Stadhouderlaan 40', postalCode: '2613 GX',
      city: 'Delft', country: 'Netherlands', regNumber: '5278 0011', taxId: 'NL0019.99.111.B03',
      status: 'prospect', tags: ['public', 'tender'], notes: 'Public tender — strict accessibility (WCAG AA) requirements.',
      hourlyRate: 110, createdAt: ts(-12), color: '#5B3FA8',
    },
  ];

  const projects = [
    {
      id: 'prj_haven', name: 'Havenlab platform redesign', clientId: 'cli_havenlab', status: 'active',
      color: '#AE1C28', startDate: iso(-42), dueDate: iso(28), budget: 24000, hourlyRate: 105,
      description: 'Design system + onboarding flow rebuild for the logistics platform.', createdAt: ts(-42),
    },
    {
      id: 'prj_molenwind', name: 'Molenwind investor kit', clientId: 'cli_molenwind', status: 'active',
      color: '#21468B', startDate: iso(-18), dueDate: iso(14), budget: 9500, hourlyRate: 95,
      description: 'Pitch deck, one-pager and marketing site refresh ahead of the Series A round.', createdAt: ts(-18),
    },
    {
      id: 'prj_bakkerij', name: 'Bakkerij webshop', clientId: 'cli_bakkerij', status: 'planned',
      color: '#0E7C66', startDate: iso(10), dueDate: iso(60), budget: 4200, hourlyRate: 75,
      description: 'Shopify storefront, logo refresh and local SEO basics.', createdAt: ts(-8),
    },
  ];

  const sprints = [
    {
      id: 'spr_11', name: 'Sprint 11 — Onboarding', projectId: 'prj_haven', goal: 'Ship the new signup + first-run experience',
      startDate: iso(-9), endDate: iso(4), capacity: 40, status: 'active', createdAt: ts(-10),
    },
    {
      id: 'spr_12', name: 'Sprint 12 — Design system', projectId: 'prj_haven', goal: 'Tokens, buttons and data-table components in Storybook',
      startDate: iso(5), endDate: iso(18), capacity: 38, status: 'planned', createdAt: ts(-4),
    },
    {
      id: 'spr_mw', name: 'Molenwind — Pitch week', projectId: 'prj_molenwind', goal: 'Investor deck v2 locked and exported',
      startDate: iso(-4), endDate: iso(7), capacity: 24, status: 'active', createdAt: ts(-5),
    },
  ];

  const T = (title, column, points, opts = {}) => ({
    id: uid('tsk'), title, description: opts.description || '', column, points,
    priority: opts.priority || 'medium', assignee: opts.assignee || 'Mila',
    labels: opts.labels || [], projectId: opts.projectId || 'prj_haven',
    sprintId: opts.sprintId || 'spr_11', clientId: opts.clientId || 'cli_havenlab',
    dueDate: opts.dueDate || '', order: opts.order || 0,
    createdAt: ts(-(opts.age || 6)), completedAt: column === 'done' ? ts(-1) : '',
    subtasks: opts.subtasks || [],
  });

  const tasks = [
    T('Discovery workshop recap', 'done', 3, { priority: 'high', labels: ['research'], age: 20, sprintId: 'spr_11' }),
    T('Audit current onboarding funnel', 'done', 5, { labels: ['research', 'analytics'], age: 18, sprintId: 'spr_11' }),
    T('Competitive teardown (3 tools)', 'done', 3, { labels: ['research'], age: 16, sprintId: 'spr_11' }),
    T('Signup flow — wireframes', 'done', 5, { priority: 'high', labels: ['ux'], age: 12, sprintId: 'spr_11' }),
    T('Hi-fi signup screens', 'review', 8, { priority: 'high', labels: ['ui'], age: 9, sprintId: 'spr_11', dueDate: iso(2) }),
    T('Empty states & error copy', 'doing', 3, { labels: ['content'], age: 7, sprintId: 'spr_11', dueDate: iso(1) }),
    T('Accessibility pass (WCAG AA)', 'doing', 5, { priority: 'high', labels: ['a11y'], age: 6, sprintId: 'spr_11', dueDate: iso(3), description: 'Contrast, focus order, screen-reader labels.' }),
    T('Handoff tokens to engineering', 'todo', 3, { labels: ['handoff'], age: 5, sprintId: 'spr_11', dueDate: iso(4) }),
    T('Prototype usability test (5 users)', 'todo', 8, { priority: 'medium', labels: ['research'], age: 4, sprintId: 'spr_11' }),
    T('Design tokens v1', 'backlog', 5, { labels: ['system'], age: 3, sprintId: 'spr_12', dueDate: iso(9) }),
    T('Button + input components', 'backlog', 8, { labels: ['system'], age: 3, sprintId: 'spr_12' }),
    T('Data table component', 'backlog', 8, { priority: 'low', labels: ['system'], age: 2, sprintId: 'spr_12' }),
    T('Deck narrative v2', 'doing', 5, { priority: 'high', projectId: 'prj_molenwind', clientId: 'cli_molenwind', sprintId: 'spr_mw', labels: ['deck'], age: 5, dueDate: iso(2) }),
    T('Financial model charts', 'todo', 3, { projectId: 'prj_molenwind', clientId: 'cli_molenwind', sprintId: 'spr_mw', labels: ['deck'], age: 4 }),
    T('Landing page hero variants', 'todo', 5, { projectId: 'prj_molenwind', clientId: 'cli_molenwind', sprintId: 'spr_mw', labels: ['web'], age: 3 }),
    T('Logo directions for bakery', 'backlog', 3, { projectId: 'prj_bakkerij', clientId: 'cli_bakkerij', sprintId: '', labels: ['brand'], age: 2 }),
  ];

  const mkItem = (description, qty, unit, rate, detail = '') => ({
    id: uid('it'), description, detail, qty, unit, rate: money(rate),
  });

  const proposals = [
    {
      id: 'prp_01', number: 'PROP-2026-014', type: 'proposal', clientId: 'cli_havenlab', projectId: 'prj_haven',
      title: 'Platform redesign & design system', status: 'accepted', currency: 'EUR', mode: 'packages',
      objective: 'Cut time-to-first-value for new logistics planners from 3 days to under 4 hours.',
      scopeSummary: 'Research, UX architecture, a production-ready design system and engineering handoff.',
      items: [mkItem('Discovery & service blueprint', 24, 'hours', 105, 'Interviews, funnel audit, blueprint workshop')],
      packages: [
        { id: uid('pk'), name: 'Essentials', tagline: 'Focused redesign of the signup journey', price: 6800, qty: 1, featured: false, features: ['Funnel audit', 'Wireframes for 6 screens', '1 round of feedback', 'Figma handoff'] },
        { id: uid('pk'), name: 'Growth', tagline: 'Full onboarding + design system foundation', price: 14500, qty: 1, featured: true, features: ['Everything in Essentials', 'Hi-fi UI for 18 screens', 'Design tokens v1', 'WCAG AA accessibility pass', 'Usability testing with 5 planners', '2 feedback rounds'] },
        { id: uid('pk'), name: 'Scale', tagline: 'Quarterly design partnership', price: 27500, qty: 1, featured: false, features: ['Everything in Growth', '12 weeks of embedded design capacity', 'Component library in Storybook', 'Monthly stakeholder review'] },
      ],
      selectedPackage: 1, deliverables: ['Research report', 'Figma design system', 'Annotated prototypes', 'Engineering handoff pack'],
      milestones: [
        { id: uid('ms'), name: 'Kick-off & research', due: iso(-30), amount: 30, note: '30% deposit' },
        { id: uid('ms'), name: 'Concept approval', due: iso(4), amount: 40, note: '' },
        { id: uid('ms'), name: 'Final handoff', due: iso(32), amount: 30, note: '' },
      ],
      timeline: '8 weeks, starting 2 November', investmentNote: 'Selected package: Growth',
      taxRate: 21, validUntil: iso(12), paymentTerms: 14,
      notes: 'Includes two feedback rounds per phase. Additional rounds billed at €105/hour.',
      terms: settings.defaults.proposalTerms,
      intro: settings.defaults.proposalIntro,
      views: 6, acceptedAt: ts(-6), acceptedBy: 'Sanne Boersma',
      createdAt: ts(-20), updatedAt: ts(-6), publicToken: 'havenlab-growth-2026',
    },
    {
      id: 'prp_02', number: 'PROP-2026-015', type: 'proposal', clientId: 'cli_molenwind', projectId: 'prj_molenwind',
      title: 'Series A investor kit', status: 'sent', currency: 'EUR', mode: 'hourly',
      objective: 'Give the founding team a crisp, data-backed story for their Series A raise.',
      scopeSummary: 'Narrative, deck design, one-pager and a refreshed marketing homepage.',
      items: [
        mkItem('Narrative workshop', 6, 'hours', 95, 'Positioning, story arc, key metrics'),
        mkItem('Investor deck design (18 slides)', 32, 'hours', 95),
        mkItem('Data visualisation set', 10, 'hours', 95, 'Custom charts in Figma'),
        mkItem('One-pager & leave-behind', 8, 'hours', 95),
        mkItem('Homepage hero refresh', 12, 'hours', 95),
      ],
      packages: [], taxRate: 21, validUntil: iso(18), paymentTerms: 14,
      discount: { type: 'percent', value: 5 },
      notes: 'Fixed weekly cadence: two deep-work blocks per week, shared progress board.',
      terms: settings.defaults.proposalTerms, intro: settings.defaults.proposalIntro,
      views: 2, createdAt: ts(-9), updatedAt: ts(-2), publicToken: 'molenwind-kit-2026',
    },
    {
      id: 'prp_03', number: 'QUO-2026-006', type: 'quote', clientId: 'cli_bakkerij', projectId: 'prj_bakkerij',
      title: 'Bakery webshop & brand refresh', status: 'draft', currency: 'EUR', mode: 'fixed',
      fixedPrice: 4200,
      objective: 'Let neighbourhood customers order bread online without a big agency budget.',
      scopeSummary: 'Shopify setup, six product templates, new logo and a local SEO starter pack.',
      items: [mkItem('Shopify storefront', 1, 'project', 2600), mkItem('Logo & brand basics', 1, 'project', 1000), mkItem('Local SEO starter', 1, 'project', 600)],
      packages: [], taxRate: 0, validUntil: iso(30), paymentTerms: 30,
      notes: 'Client falls under the KOR scheme — no VAT charged. Photography excluded.',
      terms: settings.defaults.proposalTerms, intro: settings.defaults.proposalIntro,
      views: 0, createdAt: ts(-3), updatedAt: ts(-3), publicToken: 'bakkerij-quote-2026',
    },
    {
      id: 'prp_04', number: 'PROP-2026-013', type: 'proposal', clientId: 'cli_gemeente', projectId: '',
      title: 'Accessible citizen portal audit', status: 'viewed', currency: 'EUR', mode: 'hourly',
      objective: 'Bring the citizen portal up to WCAG 2.2 AA before the January relaunch.',
      scopeSummary: 'Automated + manual audit, remediation backlog and a two-day team workshop.',
      items: [mkItem('Automated audit & report', 16, 'hours', 110), mkItem('Manual screen-reader testing', 20, 'hours', 110), mkItem('Remediation workshop', 12, 'hours', 110)],
      packages: [], taxRate: 21, validUntil: iso(-2), paymentTerms: 30,
      notes: 'Public tender reference DLF-2026-118.', terms: settings.defaults.proposalTerms,
      intro: settings.defaults.proposalIntro, views: 1, createdAt: ts(-16), updatedAt: ts(-5),
      publicToken: 'delft-audit-2026',
    },
  ].map((p) => ({ ...p, discount: p.discount || { type: 'percent', value: 0 }, ...totals(p) }));

  const invoiceRows = [
    { n: 'INV-2026-1004', c: 'cli_deltafit', p: 'prj_deltafit', issue: iso(-152), due: iso(-138), status: 'paid', items: [mkItem('App launch sprint (May)', 46, 'hours', 90)], tax: 21, paidOffset: -148 },
    { n: 'INV-2026-1005', c: 'cli_havenlab', p: 'prj_haven', issue: iso(-96), due: iso(-82), status: 'paid', items: [mkItem('Discovery & service blueprint', 24, 'hours', 105)], tax: 21, paidOffset: -90 },
    { n: 'INV-2026-1006', c: 'cli_molenwind', p: 'prj_molenwind', issue: iso(-64), due: iso(-50), status: 'paid', items: [mkItem('Brand sprint — positioning', 30, 'hours', 95)], tax: 21, paidOffset: -58 },
    { n: 'INV-2026-1007', c: 'cli_havenlab', p: 'prj_haven', issue: iso(-38), due: iso(-24), status: 'paid', items: [mkItem('Onboarding UX architecture', 52, 'hours', 105), mkItem('Usability testing round 1', 9, 'hours', 105)], tax: 21, paidOffset: -30 },
    { n: 'INV-2026-1008', c: 'cli_havenlab', p: 'prj_haven', issue: iso(-9), due: iso(5), status: 'sent', items: [mkItem('Hi-fi design & tokens (Sprint 10-11)', 61, 'hours', 105)], tax: 21 },
    { n: 'INV-2026-1009', c: 'cli_molenwind', p: 'prj_molenwind', issue: iso(-4), due: iso(-1), status: 'sent', items: [mkItem('Investor deck v1', 26, 'hours', 95)], tax: 21 },
    { n: 'INV-2026-1010', c: 'cli_gemeente', p: '', issue: iso(-1), due: iso(29), status: 'draft', items: [mkItem('Accessibility audit — phase 1', 16, 'hours', 110)], tax: 21 },
  ];

  const invoices = invoiceRows.map((r) => {
    const doc = {
      id: uid('inv'), number: r.n, clientId: r.c, projectId: r.p, reference: '', status: r.status,
      currency: 'EUR', issueDate: r.issue, dueDate: r.due, items: r.items, taxRate: r.tax,
      discount: { type: 'percent', value: 0 }, notes: '', terms: 'Payable within 14 days by bank transfer.',
      payments: r.paidOffset
        ? [{ id: uid('pay'), date: iso(r.paidOffset), amount: 0, method: 'bank', note: 'Full payment received' }]
        : [],
      createdAt: ts(parseInt(r.issue.slice(8), 10) * 0), updatedAt: ts(-1),
    };
    const t = totals(doc);
    if (doc.payments.length) doc.payments[0].amount = t.total;
    return { ...doc, ...t, paidAmount: doc.payments.length ? t.total : 0 };
  });

  const expenseSeed = [
    ['Software & subscriptions', 'Figma Professional', 45, 21, 'subscription'],
    ['Software & subscriptions', 'Adobe Creative Cloud', 62.99, 21, 'subscription'],
    ['Software & subscriptions', 'Notion Plus', 9.6, 21, 'subscription'],
    ['Hardware & equipment', 'MacBook Pro 14" (3-year depreciation)', 2499, 21, 'asset'],
    ['Hardware & equipment', 'Studio display + arm', 689, 21, 'asset'],
    ['Home office', 'Home office share (28 m², 24% correction)', 260, 0, 'monthly'],
    ['Home office', 'Desk chair (ergonomic)', 349, 21, 'one-off'],
    ['Travel & transport', 'NS Business — client visits', 128.4, 9, 'monthly'],
    ['Travel & transport', 'Bike maintenance (business use)', 74, 21, 'one-off'],
    ['Marketing & sales', 'Portfolio site hosting + domain', 132, 21, 'subscription'],
    ['Marketing & sales', 'Conference ticket — Dutch Design Week', 395, 21, 'one-off'],
    ['Professional services', 'Bookkeeper (quarterly filing)', 450, 21, 'quarterly'],
    ['Professional services', 'Liability insurance', 88, 21, 'quarterly'],
    ['Education', 'Accessibility certification course', 549, 21, 'one-off'],
    ['Meals & representation', 'Client lunch — Havenlab', 46.5, 9, 'mixed'],
    ['Bank & payment fees', 'Business account + payment processing', 39, 21, 'quarterly'],
    ['Office supplies', 'Prints, stationery & studio supplies', 57.2, 21, 'one-off'],
    ['Telephone & internet', 'Business mobile + fibre (70% business)', 78, 21, 'monthly'],
  ];

  const expenses = expenseSeed.flatMap(([category, description, amount, vatRate, cadence], i) => {
    const dates =
      cadence === 'monthly' ? [-8, -38, -68, -98, -128, -158, -188, -218, -248]
      : cadence === 'quarterly' ? [-14, -104, -194, -284]
      : [-3 - i * 13];
    return dates.slice(0, cadence === 'monthly' ? 9 : cadence === 'quarterly' ? 4 : 1).map((off, k) => {
      const amountThis = cadence === 'monthly' ? amount : amount / (dates.length || 1);
      const gross = money(amountThis);
      return {
        id: uid('exp'), date: iso(off), category, description: cadence === 'monthly' && k > 0 ? `${description} (${k + 1}/9)` : description,
        vendor: description.split(' ')[0], amount: gross, currency: 'EUR', vatRate,
        vatAmount: money((gross * vatRate) / (100 + vatRate)), deductible: category !== 'Meals & representation' ? true : true,
        mixedCost: category === 'Meals & representation', receipt: k % 3 !== 2, paymentMethod: i % 3 === 0 ? 'card' : 'bank',
        clientId: '', projectId: i % 4 === 0 ? 'prj_haven' : '', createdAt: ts(off),
      };
    });
  });

  const timeSeeds = [
    ['Hi-fi signup screens', 'prj_haven', 'cli_havenlab', 3.5, true, 105],
    ['Accessibility pass on onboarding', 'prj_haven', 'cli_havenlab', 2.25, true, 105],
    ['Investor deck v2 narrative', 'prj_molenwind', 'cli_molenwind', 4, true, 95],
    ['Data visualisation set', 'prj_molenwind', 'cli_molenwind', 1.75, true, 95],
    ['Portfolio update & case writing', '', '', 1.5, false, 0],
    ['Sprint planning + refinement', 'prj_haven', 'cli_havenlab', 1.25, false, 105],
    ['Client call — Gemeente Delft tender', '', 'cli_gemeente', 0.75, false, 110],
    ['Bakery logo directions', 'prj_bakkerij', 'cli_bakkerij', 2.5, true, 75],
  ];

  const timeEntries = timeSeeds.flatMap(([description, projectId, clientId, hours, billable, rate], i) =>
    [0, -1, -2, -6, -8].slice(0, i < 3 ? 5 : 3).map((off, k) => ({
      id: uid('tim'), date: iso(off - k), description, projectId, clientId, taskId: '',
      start: '', end: '', minutes: Math.round(((hours + k * 0.25) * 60) / 15) * 15,
      billable, rate: money(rate), amount: money((Math.round(((hours + k * 0.25) * 60) / 15) * 15 / 60) * rate),
      currency: 'EUR', invoiced: off < -5, createdAt: ts(off - k),
    })),
  );

  const goals = [
    { id: uid('gal'), title: 'Reach €96.000 revenue in 2026', category: 'revenue', metric: 'Invoiced revenue', target: 96000, current: 71400, unit: 'EUR', deadline: `${new Date().getFullYear()}-12-31`, status: 'on-track', notes: 'Two retainers + project work.', createdAt: ts(-200) },
    { id: uid('gal'), title: 'Keep a 6-month tax buffer', category: 'tax', metric: 'Tax set-aside saved', target: 24000, current: 15800, unit: 'EUR', deadline: `${new Date().getFullYear()}-12-31`, status: 'at-risk', notes: 'Move 30% of every payment into the buffer account.', createdAt: ts(-200) },
    { id: uid('gal'), title: 'Raise billable utilisation to 70%', category: 'operations', metric: 'Billable hours / week', target: 28, current: 23.5, unit: 'hours', deadline: iso(70), status: 'on-track', notes: '', createdAt: ts(-90) },
    { id: uid('gal'), title: 'Sign 2 retainer clients', category: 'growth', metric: 'Retainer contracts', target: 2, current: 1, unit: 'clients', deadline: iso(120), status: 'behind', notes: 'Havenlab renewed; pitch Molenwind in Q1.', createdAt: ts(-120) },
    { id: uid('gal'), title: 'Cut admin time to <4h/week', category: 'operations', metric: 'Admin hours per week', target: 4, current: 6.5, unit: 'hours', deadline: iso(90), status: 'behind', notes: 'Automate invoicing from tracked time.', createdAt: ts(-60) },
  ];

  const ledger = [
    { id: uid('led'), date: iso(-250), type: 'income', account: 'Business current', category: 'Opening balance', description: 'Opening balance transfer from private account', amount: 12000, currency: 'EUR', refType: 'manual' },
    { id: uid('led'), date: iso(-30), type: 'expense', account: 'Tax buffer', category: 'Tax set-aside', description: 'Q3 income tax + Zvw reserve transfer', amount: 4200, currency: 'EUR', refType: 'manual' },
    { id: uid('led'), date: iso(-14), type: 'expense', account: 'Business current', category: 'Professional services', description: 'Bookkeeper — Q3 VAT return', amount: 450, currency: 'EUR', refType: 'manual' },
  ];

  const activity = [
    { id: uid('act'), ts: ts(-0.2), type: 'accept', message: 'PROP-2026-014 was accepted by Sanne Boersma' },
    { id: uid('act'), ts: ts(-1), type: 'create', message: 'Created invoice INV-2026-1010' },
    { id: uid('act'), ts: ts(-2), type: 'view', message: 'PROP-2026-015 viewed by the client' },
    { id: uid('act'), ts: ts(-4), type: 'payment', message: 'Payment of €6.435,75 recorded on INV-2026-1007' },
  ];

  return {
    settings,
    collections: {
      clients, proposals, invoices, expenses, timeEntries, projects, sprints, tasks, goals, ledger, activity,
    },
  };
}
