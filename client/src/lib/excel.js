// Excel (.xlsx) and CSV exports for every module.
import * as XLSX from 'xlsx';
import { fmtDate, round2, todayISO } from './format';
import { invoiceBalance, invoiceState } from './metrics';

function sheetFromRows(rows, widths) {
  const ws = XLSX.utils.aoa_to_sheet(rows);
  if (widths) ws['!cols'] = widths.map((w) => ({ wch: w }));
  return ws;
}

export function saveWorkbook(sheets, filename) {
  const wb = XLSX.utils.book_new();
  wb.Props = { Creator: 'DRIPS', Title: filename };
  for (const s of sheets) {
    const ws = s.rows?.length ? sheetFromRows(s.rows, s.widths) : sheetFromRows([[]]);
    XLSX.utils.book_append_sheet(wb, ws, s.name.slice(0, 31));
  }
  const name = filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`;
  XLSX.writeFile(wb, name, { bookType: 'xlsx', compression: true });
  return name;
}

export function saveCsv(rows, filename) {
  const ws = XLSX.utils.aoa_to_sheet(rows);
  const csv = XLSX.utils.sheet_to_csv(ws);
  const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.endsWith('.csv') ? filename : `${filename}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

const stamp = () => `Exported ${fmtDate(todayISO(), 'en-GB')} by DRIPS`;

/* --------------------------------- BOOKS ---------------------------------- */

export function booksWorkbook({ invoices, expenses, ledger, clients, pnl, settings, currency = 'EUR' }) {
  const clientMap = Object.fromEntries(clients.map((c) => [c.id, c.company || c.name]));
  const inv = [...invoices].sort((a, b) => String(b.issueDate).localeCompare(String(a.issueDate)));

  const summary = [
    ['DRIPS — Books & accounting', ''],
    [stamp(), ''],
    [],
    ['Financial year', pnl.year],
    ['Base currency', currency],
    [],
    ['PROFIT & LOSS', ''],
    ['Revenue (ex VAT)', round2(pnl.revenue)],
    ['Operating costs (ex VAT)', round2(pnl.costs)],
    ['Net profit', round2(pnl.profit)],
    ['Profit margin %', pnl.margin],
    [],
    ['BALANCE', ''],
    ['Received from clients', round2(pnl.collected)],
    ['Outstanding receivables', round2(pnl.outstanding)],
    ['Unbilled tracked time', round2(pnl.unbilled)],
    ['VAT collected', round2(pnl.vatCollected)],
    ['VAT reclaimable', round2(pnl.vatPaid)],
    ['VAT to pay / reclaim', round2(pnl.vatCollected - pnl.vatPaid)],
    [],
    ['COSTS BY CATEGORY', ''],
    ...Object.entries(pnl.costsByCategory || {}).map(([k, v]) => [k, v]),
  ];

  const invoiceRows = [
    ['Number', 'Client', 'Issue date', 'Due date', 'Status', 'Currency', 'Subtotal', 'Discount', 'VAT', 'Total', 'Paid', 'Balance', 'Days overdue', 'Reference'],
    ...inv.map((i) => [
      i.number,
      clientMap[i.clientId] || '',
      i.issueDate,
      i.dueDate,
      invoiceState(i),
      i.currency || currency,
      round2(i.net),
      round2(i.discountValue || 0),
      round2(i.taxTotal),
      round2(i.total),
      round2(i.paidAmount || 0),
      round2(invoiceBalance(i)),
      invoiceState(i) === 'overdue' ? -Math.round((new Date(todayISO()) - new Date(i.dueDate)) / 864e5) : 0,
      i.reference || '',
    ]),
  ];

  const payments = [
    ['Invoice', 'Client', 'Payment date', 'Method', 'Amount', 'Currency', 'Note'],
    ...inv.flatMap((i) =>
      (i.payments || []).map((p) => [i.number, clientMap[i.clientId] || '', p.date, p.method, round2(p.amount), i.currency || currency, p.note || '']),
    ),
  ];

  const expRows = [
    ['Date', 'Category', 'Description', 'Vendor', 'Amount (incl VAT)', 'VAT rate %', 'VAT amount', 'Amount (ex VAT)', 'Currency', 'Deductible', 'Receipt', 'Payment method', 'Project'],
    ...[...expenses]
      .sort((a, b) => String(b.date).localeCompare(String(a.date)))
      .map((e) => [
        e.date,
        e.category,
        e.description,
        e.vendor || '',
        round2(e.amount),
        e.vatRate || 0,
        round2(e.vatAmount || 0),
        round2((e.amount || 0) - (e.vatAmount || 0)),
        e.currency || currency,
        e.deductible === false ? 'No' : 'Yes',
        e.receipt ? 'Yes' : 'No',
        e.paymentMethod || '',
        e.projectId || '',
      ]),
  ];

  const ledgerRows = [
    ['Date', 'Type', 'Account', 'Category', 'Description', 'Amount', 'Currency', 'Source'],
    ...[...ledger]
      .sort((a, b) => String(b.date).localeCompare(String(a.date)))
      .map((l) => [l.date, l.type, l.account || 'Business current', l.category || '', l.description, round2(l.amount), l.currency || currency, l.refType || 'manual']),
  ];

  const arRows = [
    ['Debtor ageing', 'Amount'],
    ...Object.entries(
      inv.reduce((acc, i) => {
        if (!['sent', 'partly-paid', 'overdue'].includes(invoiceState(i))) return acc;
        const late = Math.max(0, Math.round((new Date(todayISO()) - new Date(i.dueDate)) / 864e5));
        const key = late === 0 ? 'Not due yet' : late <= 30 ? '1–30 days' : late <= 60 ? '31–60 days' : '60+ days';
        acc[key] = round2((acc[key] || 0) + invoiceBalance(i));
        return acc;
      }, {}),
    ),
  ];

  return saveWorkbook(
    [
      { name: 'Summary', rows: summary, widths: [34, 18] },
      { name: 'Invoices', rows: invoiceRows, widths: [18, 24, 12, 12, 12, 9, 12, 11, 10, 12, 12, 12, 13, 16] },
      { name: 'Payments', rows: payments, widths: [18, 24, 13, 11, 12, 9, 28] },
      { name: 'Expenses', rows: expRows, widths: [12, 24, 34, 18, 16, 11, 12, 15, 9, 11, 9, 14, 16] },
      { name: 'Ledger', rows: ledgerRows, widths: [12, 10, 18, 24, 40, 12, 9, 12] },
      { name: 'Receivables', rows: arRows, widths: [22, 14] },
    ],
    `DRIPS-books-${settings?.business?.name || 'workspace'}-${pnl.year}`.replace(/\s+/g, '-'),
  );
}

/* --------------------------------- BOARD ---------------------------------- */

export function boardWorkbook({ tasks, sprints, projects, clients, title = 'project-board' }) {
  const projectMap = Object.fromEntries(projects.map((p) => [p.id, p.name]));
  const sprintMap = Object.fromEntries(sprints.map((s) => [s.id, s.name]));
  const clientMap = Object.fromEntries((clients || []).map((c) => [c.id, c.company || c.name]));
  const order = ['backlog', 'todo', 'doing', 'review', 'done'];
  const labels = { backlog: 'Backlog', todo: 'To do', doing: 'In progress', review: 'Review', done: 'Done' };

  const sorted = [...tasks].sort(
    (a, b) => order.indexOf(a.column) - order.indexOf(b.column) || (a.order || 0) - (b.order || 0),
  );

  const cards = [
    ['Card', 'Column', 'Story points', 'Priority', 'Assignee', 'Labels', 'Sprint', 'Project', 'Client', 'Due date', 'Created', 'Completed', 'Description'],
    ...sorted.map((t) => [
      t.title,
      labels[t.column] || t.column,
      Number(t.points) || 0,
      t.priority || '',
      t.assignee || '',
      (t.labels || []).join(', '),
      sprintMap[t.sprintId] || '',
      projectMap[t.projectId] || '',
      clientMap[t.clientId] || '',
      t.dueDate || '',
      (t.createdAt || '').slice(0, 10),
      (t.completedAt || '').slice(0, 10),
      t.description || '',
    ]),
  ];

  const sprintRows = [
    ['Sprint', 'Goal', 'Start', 'End', 'Status', 'Capacity', 'Committed points', 'Completed points', 'Cards', 'Burn %'],
    ...sprints.map((s) => {
      const sc = tasks.filter((t) => t.sprintId === s.id);
      const committed = sc.reduce((a, t) => a + (Number(t.points) || 0), 0);
      const done = sc.filter((t) => t.column === 'done').reduce((a, t) => a + (Number(t.points) || 0), 0);
      return [
        s.name,
        s.goal || '',
        s.startDate || '',
        s.endDate || '',
        s.status || '',
        Number(s.capacity) || 0,
        committed,
        done,
        sc.length,
        committed ? round2((done / committed) * 100) : 0,
      ];
    }),
  ];

  const projectRows = [
    ['Project', 'Client', 'Status', 'Start', 'Due', 'Budget', 'Cards', 'Points done'],
    ...projects.map((p) => {
      const pt = tasks.filter((t) => t.projectId === p.id);
      return [
        p.name,
        clientMap[p.clientId] || '',
        p.status || '',
        p.startDate || '',
        p.dueDate || '',
        Number(p.budget) || 0,
        pt.length,
        pt.filter((t) => t.column === 'done').reduce((a, t) => a + (Number(t.points) || 0), 0),
      ];
    }),
  ];

  return saveWorkbook(
    [
      { name: 'Cards', rows: cards, widths: [42, 14, 12, 10, 14, 22, 22, 26, 22, 12, 12, 12, 50] },
      { name: 'Sprints', rows: sprintRows, widths: [26, 44, 12, 12, 12, 10, 16, 16, 8, 9] },
      { name: 'Projects', rows: projectRows, widths: [30, 24, 12, 12, 12, 12, 8, 12] },
    ],
    `DRIPS-${title}-${todayISO()}`,
  );
}

/* --------------------------------- TIME ----------------------------------- */

export function timeWorkbook({ timeEntries, clients, projects, tasks, currency = 'EUR' }) {
  const clientMap = Object.fromEntries(clients.map((c) => [c.id, c.company || c.name]));
  const projectMap = Object.fromEntries(projects.map((p) => [p.id, p.name]));
  const taskMap = Object.fromEntries((tasks || []).map((t) => [t.id, t.title]));
  const rows = [...timeEntries].sort((a, b) => String(b.date).localeCompare(String(a.date)));

  return saveWorkbook(
    [
      {
        name: 'Timesheet',
        rows: [
          ['Date', 'Description', 'Client', 'Project', 'Task', 'Hours', 'Billable', 'Rate', 'Amount', 'Currency', 'Invoiced'],
          ...rows.map((t) => [
            t.date || (t.createdAt || '').slice(0, 10),
            t.description || '',
            clientMap[t.clientId] || '',
            projectMap[t.projectId] || '',
            taskMap[t.taskId] || '',
            round2((t.minutes || 0) / 60),
            t.billable ? 'Yes' : 'No',
            round2(t.rate || 0),
            round2(t.amount || 0),
            t.currency || currency,
            t.invoiced ? 'Yes' : 'No',
          ]),
        ],
        widths: [12, 44, 24, 28, 30, 8, 9, 9, 12, 9, 10],
      },
      {
        name: 'Summary',
        rows: [
          ['Metric', 'Value'],
          ['Total hours', round2(rows.reduce((a, t) => a + (t.minutes || 0) / 60, 0))],
          ['Billable hours', round2(rows.filter((t) => t.billable).reduce((a, t) => a + (t.minutes || 0) / 60, 0))],
          ['Unbilled value', round2(rows.filter((t) => t.billable && !t.invoiced).reduce((a, t) => a + (t.amount || 0), 0))],
          ['Billed value', round2(rows.filter((t) => t.billable && t.invoiced).reduce((a, t) => a + (t.amount || 0), 0))],
        ],
        widths: [26, 14],
      },
    ],
    `DRIPS-timesheet-${todayISO()}`,
  );
}

/* -------------------------------- CLIENTS --------------------------------- */

export function clientsWorkbook({ clients, invoices, proposals, currency = 'EUR' }) {
  const rows = clients.map((c) => {
    const inv = invoices.filter((i) => i.clientId === c.id);
    const open = inv.filter((i) => ['sent', 'partly-paid', 'overdue'].includes(invoiceState(i)));
    return [
      c.company || c.name,
      c.name,
      c.email,
      c.phone,
      [c.street, c.postalCode, c.city].filter(Boolean).join(' '),
      c.country,
      c.regNumber || '',
      c.taxId || '',
      c.status,
      (c.tags || []).join(', '),
      c.hourlyRate || '',
      round2(inv.reduce((a, i) => a + (Number(i.total) || 0), 0)),
      round2(open.reduce((a, i) => a + invoiceBalance(i), 0)),
      proposals.filter((p) => p.clientId === c.id).length,
      c.notes || '',
    ];
  });

  return saveWorkbook(
    [
      {
        name: 'Clients',
        rows: [
          ['Company', 'Contact', 'Email', 'Phone', 'Address', 'Country', 'Reg. number (KvK)', 'Tax ID / VAT', 'Status', 'Tags', 'Hourly rate', `Lifetime value (${currency})`, `Outstanding (${currency})`, 'Proposals', 'Notes'],
          ...rows,
        ],
        widths: [26, 20, 28, 18, 32, 14, 18, 20, 10, 18, 12, 18, 16, 10, 44],
      },
    ],
    `DRIPS-clients-${todayISO()}`,
  );
}

/* ------------------------------- PROPOSALS -------------------------------- */

export function proposalsWorkbook({ proposals, clients, currency = 'EUR' }) {
  const clientMap = Object.fromEntries(clients.map((c) => [c.id, c.company || c.name]));
  return saveWorkbook(
    [
      {
        name: 'Pipeline',
        rows: [
          ['Number', 'Type', 'Title', 'Client', 'Status', 'Mode', 'Currency', 'Subtotal', 'Discount', 'VAT', 'Total', 'Valid until', 'Created', 'Views', 'Accepted by'],
          ...proposals.map((p) => [
            p.number,
            p.type || 'proposal',
            p.title,
            clientMap[p.clientId] || '',
            p.status,
            p.mode || 'hourly',
            p.currency || currency,
            round2(p.net),
            round2(p.discountValue || 0),
            round2(p.taxTotal),
            round2(p.total),
            p.validUntil || '',
            (p.createdAt || '').slice(0, 10),
            p.views || 0,
            p.acceptedBy || '',
          ]),
        ],
        widths: [18, 10, 40, 24, 11, 10, 9, 12, 11, 10, 12, 12, 12, 7, 18],
      },
    ],
    `DRIPS-proposals-${todayISO()}`,
  );
}

/* ---------------------------------- TAX ----------------------------------- */

export function taxWorkbook({ quarters, tax, expenses, profile, year, currency = 'EUR' }) {
  const byCategory = expenses.reduce((acc, e) => {
    const net = (Number(e.amount) || 0) - (Number(e.vatAmount) || 0);
    acc[e.category || 'Other'] = round2((acc[e.category || 'Other'] || 0) + net);
    return acc;
  }, {});

  return saveWorkbook(
    [
      {
        name: `Tax ${year}`,
        rows: [
          ['DRIPS — Tax & set-aside estimate', ''],
          [stamp(), ''],
          ['Profile', profile?.label],
          [],
          ['Revenue (ex VAT)', round2(tax.revenue)],
          ['Deductible costs (ex VAT)', round2(tax.expenses)],
          ['Profit', round2(tax.profit)],
          ...tax.deductions.map((d) => [d.label, round2(-d.amount)]),
          ['Taxable income', round2(tax.taxable)],
          ['Income tax before credits', round2(tax.grossTax)],
          ...tax.creditLines.map((cr) => [cr.label, round2(-cr.amount)]),
          ['Income tax after credits', round2(tax.incomeTax)],
          ...tax.surtaxLines.map((s) => [s.label, round2(s.amount)]),
          ['TOTAL TO SET ASIDE', round2(tax.total)],
          ['Effective rate on profit %', round2(tax.effectiveRate)],
          ['Marginal rate %', round2(tax.marginalRate)],
          ['Net take-home estimate', round2(tax.netTakeHome)],
          ['Tracked business hours', round2(tax.hours)],
        ],
        widths: [40, 16],
      },
      {
        name: 'VAT quarters',
        rows: [
          ['Quarter', 'Revenue (ex VAT)', 'Costs (ex VAT)', 'VAT charged', 'VAT reclaimable', 'VAT to pay (+) / back (−)', 'Income tax share', 'Set-aside %'],
          ...quarters.map((q) => [
            `Q${q.quarter} ${year}`,
            round2(q.revenue),
            round2(q.costs || 0),
            round2(q.outputVat),
            round2(q.inputVat),
            round2(q.due),
            round2(q.incomeTaxShare || 0),
            q.setAsidePct || 0,
          ]),
          ['Total', round2(quarters.reduce((a, q) => a + q.revenue, 0)), round2(quarters.reduce((a, q) => a + (q.costs || 0), 0)), round2(quarters.reduce((a, q) => a + q.outputVat, 0)), round2(quarters.reduce((a, q) => a + q.inputVat, 0)), round2(quarters.reduce((a, q) => a + q.due, 0)), round2(quarters.reduce((a, q) => a + (q.incomeTaxShare || 0), 0)), ''],
        ],
        widths: [14, 18, 16, 14, 18, 22, 16, 12],
      },
      {
        name: 'Deductions by category',
        rows: [['Category', `Amount ex VAT (${currency})`], ...Object.entries(byCategory).sort((a, b) => b[1] - a[1])],
        widths: [32, 22],
      },
    ],
    `DRIPS-tax-${year}`,
  );
}

/* --------------------------------- GOALS ---------------------------------- */

export function goalsWorkbook({ goals, currency = 'EUR' }) {
  return saveWorkbook(
    [
      {
        name: 'Goals',
        rows: [
          ['Goal', 'Category', 'Metric', 'Target', 'Current', 'Progress %', 'Unit', 'Deadline', 'Status', 'Notes'],
          ...goals.map((g) => [
            g.title,
            g.category,
            g.metric,
            round2(g.target),
            round2(g.current),
            g.target ? round2((g.current / g.target) * 100) : 0,
            g.unit || currency,
            g.deadline || '',
            g.status || '',
            g.notes || '',
          ]),
        ],
        widths: [40, 14, 26, 12, 12, 11, 10, 12, 12, 40],
      },
    ],
    `DRIPS-goals-${todayISO()}`,
  );
}
