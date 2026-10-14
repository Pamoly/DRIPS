// Branded PDF generation (proposals, quotes, invoices, board + reports).
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { fmtDate, fmtMoney, round2 } from './format';
import { localeFor } from './currencies';

const A4 = { w: 595.28, h: 841.89 };
const M = 48; // page margin
const CONTENT_W = A4.w - M * 2;

export const hexToRgb = (hex, fallback = [14, 27, 61]) => {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(String(hex || '').trim());
  if (!m) return fallback;
  return [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)];
};

const money = (v, currency = 'EUR', locale = 'nl-NL') => fmtMoney(v, currency, locale);

function brandColors(settings) {
  return {
    primary: hexToRgb(settings?.brand?.primary || '#AE1C28'),
    secondary: hexToRgb(settings?.brand?.secondary || '#21468B'),
    ink: hexToRgb(settings?.brand?.documentAccent || '#0E1B3D'),
    muted: [102, 112, 133],
    line: [226, 230, 240],
    soft: [247, 248, 252],
  };
}

function newDoc(settings) {
  const doc = new jsPDF({ unit: 'pt', format: 'a4', compress: true });
  doc.setProperties({
    title: 'DRIPS document',
    creator: settings?.business?.name || 'DRIPS',
    author: settings?.business?.owner || settings?.business?.name || 'DRIPS',
  });
  return doc;
}

/** Dutch-flag ribbon + logo + business block. Returns the y position to continue from. */
function letterhead(doc, settings, opts = {}) {
  const c = brandColors(settings);
  const b = settings?.business || {};
  // flag ribbon
  const barH = 7;
  doc.setFillColor(...c.primary);
  doc.rect(0, 0, A4.w / 3, barH, 'F');
  doc.setFillColor(255, 255, 255);
  doc.rect(A4.w / 3, 0, A4.w / 3, barH, 'F');
  doc.setFillColor(...c.secondary);
  doc.rect((2 * A4.w) / 3, 0, A4.w / 3, barH, 'F');

  let y = M + 6;
  let textX = M;
  const logo = opts.logo === false ? '' : b.logoDataUrl;
  if (logo) {
    try {
      const props = doc.getImageProperties(logo);
      const maxH = 54;
      const maxW = 150;
      const scale = Math.min(maxH / props.height, maxW / props.width);
      const w = props.width * scale;
      const h = props.height * scale;
      doc.addImage(logo, props.fileType || 'PNG', M, y - 8, w, h);
      y = Math.max(y, y - 8 + h + 10);
      textX = M;
    } catch {
      /* unsupported logo — fall back to text */
    }
  }

  const lines = [];
  if (!logo && b.name) lines.push({ t: b.name, size: 18, style: 'bold', color: c.ink, gap: 4 });
  const details = [
    b.street && b.postalCode ? `${b.street}, ${b.postalCode} ${b.city || ''}`.trim() : b.city,
    b.country,
    b.email,
    b.phone,
    b.website,
  ].filter(Boolean);
  const ids = [
    b.regNumber ? `Chamber of Commerce (KvK): ${b.regNumber}` : '',
    b.taxId ? `Tax ID / VAT: ${b.taxId}` : '',
    b.iban ? `IBAN: ${b.iban}` : '',
  ].filter(Boolean);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.6);
  doc.setTextColor(...c.muted);
  const rightLines = [...details, ...ids];
  rightLines.forEach((line, i) => {
    doc.text(line, A4.w - M, y - 2 + i * 11.5, { align: 'right' });
  });
  lines.forEach((l) => {
    doc.setFont('helvetica', l.style);
    doc.setFontSize(l.size);
    doc.setTextColor(...l.color);
    doc.text(l.t, textX, y);
    y += l.size + l.gap;
  });

  y = Math.max(y, y - 6 + rightLines.length * 11.5) + 18;
  doc.setDrawColor(...c.line);
  doc.setLineWidth(0.8);
  doc.line(M, y, A4.w - M, y);
  return y + 22;
}

function sectionTitle(doc, text, y, c) {
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(...c.secondary);
  doc.text(String(text).toUpperCase(), M, y);
  return y + 12;
}

function body(doc, text, y, width = CONTENT_W, size = 9.6, color) {
  const c = color || brandColors({}).ink;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(size);
  doc.setTextColor(...c);
  const lines = doc.splitTextToSize(String(text || ''), width);
  doc.text(lines, M, y);
  return y + lines.length * (size + 3.4);
}

function footer(doc, settings, c) {
  const total = doc.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    doc.setDrawColor(...c.line);
    doc.line(M, A4.h - 40, A4.w - M, A4.h - 40);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.8);
    doc.setTextColor(...c.muted);
    const left = [settings?.business?.name, settings?.business?.regNumber && `KvK ${settings.business.regNumber}`, settings?.business?.taxId]
      .filter(Boolean)
      .join(' · ');
    doc.text(left, M, A4.h - 26);
    doc.text(`${i} / ${total}`, A4.w - M, A4.h - 26, { align: 'right' });
  }
}

function totalsTable(doc, { net, discountValue, taxRate, taxTotal, total, currency, locale }, y, c) {
  const rows = [['Subtotal', money(net + discountValue, currency, locale)]];
  if (discountValue > 0) rows.push(['Discount', `− ${money(discountValue, currency, locale)}`]);
  rows.push([`VAT ${taxRate}%`, money(taxTotal, currency, locale)]);
  autoTable(doc, {
    startY: y,
    margin: { left: A4.w - M - 230, right: M },
    theme: 'plain',
    styles: { font: 'helvetica', fontSize: 9.4, cellPadding: { top: 3.5, bottom: 3.5, left: 6, right: 6 }, textColor: c.ink },
    columnStyles: { 0: { cellWidth: 110, textColor: c.muted }, 1: { cellWidth: 120, halign: 'right' } },
    body: rows,
    foot: [['Total due', money(total, currency, locale)]],
    footStyles: {
      fillColor: c.ink,
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 10.5,
      cellPadding: { top: 7, bottom: 7, left: 6, right: 6 },
    },
  });
  return doc.lastAutoTable.finalY + 16;
}

/* ------------------------------- PROPOSAL -------------------------------- */

export function proposalPDF(proposal, { client, settings }) {
  const c = brandColors(settings);
  const doc = newDoc(settings);
  const currency = proposal.currency || settings?.locale?.baseCurrency || 'EUR';
  const locale = localeFor(currency, settings?.locale?.numberFormat === 'en' ? 'en-US' : 'nl-NL');
  const isQuote = proposal.type === 'quote';

  let y = letterhead(doc, settings);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  doc.setTextColor(...c.ink);
  doc.text(isQuote ? 'Quote' : 'Proposal', M, y);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.6);
  doc.setTextColor(...c.muted);
  const meta = [
    `${isQuote ? 'Quote' : 'Proposal'} no. ${proposal.number || '—'}`,
    `Date: ${fmtDate(proposal.createdAt || proposal.updatedAt, locale)}`,
    proposal.validUntil ? `Valid until: ${fmtDate(proposal.validUntil, locale)}` : '',
    proposal.paymentTerms ? `Payment terms: ${proposal.paymentTerms} days` : '',
  ].filter(Boolean);
  meta.forEach((line, i) => doc.text(line, A4.w - M, y - 10 + i * 12, { align: 'right' }));
  y += 10;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(...c.primary);
  const titleLines = doc.splitTextToSize(proposal.title || '', CONTENT_W);
  doc.text(titleLines, M, y + 8);
  y += 8 + titleLines.length * 16;

  // prepared for
  doc.setFillColor(...c.soft);
  doc.roundedRect(M, y, CONTENT_W / 2 - 8, 62, 6, 6, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.8);
  doc.setTextColor(...c.muted);
  doc.text('PREPARED FOR', M + 12, y + 16);
  doc.setFontSize(11);
  doc.setTextColor(...c.ink);
  doc.text(client?.company || client?.name || '—', M + 12, y + 32);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...c.muted);
  const forLines = [
    client?.name && client?.company ? client.name : '',
    client?.email,
    [client?.street, client?.postalCode, client?.city].filter(Boolean).join(' '),
    client?.regNumber ? `KvK ${client.regNumber}` : '',
    client?.taxId ? `VAT ${client.taxId}` : '',
  ]
    .filter(Boolean)
    .slice(0, 3);
  forLines.forEach((l, i) => doc.text(l, M + 12, y + 45 + i * 10.5));

  const boxY = y;
  y += 78;

  if (proposal.objective) {
    y = sectionTitle(doc, 'Objective', y, c);
    y = body(doc, proposal.objective, y) + 6;
  }
  if (proposal.scopeSummary) {
    y = sectionTitle(doc, 'Scope of work', y, c);
    y = body(doc, proposal.scopeSummary, y) + 6;
  }
  void boxY;

  if (Array.isArray(proposal.deliverables) && proposal.deliverables.length) {
    y = sectionTitle(doc, 'Deliverables', y, c);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.6);
    doc.setTextColor(...c.ink);
    proposal.deliverables.forEach((d) => {
      doc.setTextColor(...c.primary);
      doc.text('•', M + 2, y);
      doc.setTextColor(...c.ink);
      const lines = doc.splitTextToSize(String(d), CONTENT_W - 16);
      doc.text(lines, M + 12, y);
      y += lines.length * 13 + 1;
    });
    y += 10;
  }

  if (y > A4.h - 260) {
    doc.addPage();
    y = M;
  }

  y = sectionTitle(doc, isQuote ? 'Price breakdown' : 'Investment', y, c);

  if (proposal.mode === 'packages' && (proposal.packages || []).length) {
    const rows = (proposal.packages || []).map((p, i) => [
      i === Number(proposal.selectedPackage) ? `${p.name}  ★ selected` : p.name,
      p.tagline || '',
      money(p.price, currency, locale),
    ]);
    autoTable(doc, {
      startY: y,
      margin: { left: M, right: M },
      head: [['Package', 'What it includes', 'Price']],
      body: rows,
      theme: 'grid',
      styles: { font: 'helvetica', fontSize: 9.2, cellPadding: 6, textColor: c.ink, lineColor: c.line, lineWidth: 0.6, valign: 'top' },
      headStyles: { fillColor: c.ink, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8.6 },
      columnStyles: { 0: { cellWidth: 150, fontStyle: 'bold' }, 2: { cellWidth: 90, halign: 'right' } },
      didParseCell: (data) => {
        if (data.section === 'body' && data.column.index === 0 && String(data.cell.raw).includes('selected')) {
          data.cell.styles.fillColor = [253, 243, 244];
          data.cell.styles.textColor = c.primary;
        }
      },
    });
    y = doc.lastAutoTable.finalY + 14;

    (proposal.packages || []).forEach((p) => {
      if (!p.features?.length) return;
      if (y > A4.h - 140) {
        doc.addPage();
        y = M;
      }
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9.4);
      doc.setTextColor(...c.secondary);
      doc.text(p.name, M, y);
      y += 12;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9.2);
      doc.setTextColor(...c.ink);
      const features = p.features.map((f) => `✓  ${f}`);
      const half = Math.ceil(features.length / 2);
      const colA = features.slice(0, half);
      const colB = features.slice(half);
      const startY = y;
      [colA, colB].forEach((col, ci) => {
        let cy = startY;
        col.forEach((f) => {
          const lines = doc.splitTextToSize(f, CONTENT_W / 2 - 18);
          doc.text(lines, M + ci * (CONTENT_W / 2), cy);
          cy += lines.length * 12 + 1;
        });
        y = Math.max(y, cy);
      });
      y += 12;
    });
  } else {
    const rows = (proposal.items || []).map((it) => [
      it.description || '',
      it.detail ? doc.splitTextToSize(String(it.detail), 210) : '',
      `${round2(it.qty)} ${it.unit || 'h'}`,
      money(it.rate, currency, locale),
      money(round2(it.qty) * round2(it.rate), currency, locale),
    ]);
    autoTable(doc, {
      startY: y,
      margin: { left: M, right: M },
      head: [['Description', 'Details', 'Qty', 'Rate', 'Amount']],
      body: rows,
      theme: 'striped',
      styles: { font: 'helvetica', fontSize: 9.2, cellPadding: 6, textColor: c.ink, lineColor: c.line, valign: 'top' },
      headStyles: { fillColor: c.ink, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8.6 },
      alternateRowStyles: { fillColor: c.soft },
      columnStyles: {
        0: { cellWidth: 150, fontStyle: 'bold' },
        1: { cellWidth: 210, textColor: c.muted, fontSize: 8.6 },
        2: { cellWidth: 50, halign: 'right' },
        3: { cellWidth: 70, halign: 'right' },
        4: { cellWidth: 80, halign: 'right' },
      },
    });
    y = doc.lastAutoTable.finalY + 14;
  }

  y = totalsTable(doc, proposal, y, c);

  if (proposal.timeline) {
    if (y > A4.h - 150) {
      doc.addPage();
      y = M;
    }
    y = sectionTitle(doc, 'Timeline', y, c);
    y = body(doc, proposal.timeline, y) + 8;
  }

  if ((proposal.milestones || []).length) {
    if (y > A4.h - 170) {
      doc.addPage();
      y = M;
    }
    y = sectionTitle(doc, 'Payment schedule', y, c);
    autoTable(doc, {
      startY: y,
      margin: { left: M, right: M },
      head: [['Milestone', 'Target date', '% of total', 'Amount']],
      body: proposal.milestones.map((m) => [
        m.name,
        m.due ? fmtDate(m.due, locale) : '—',
        `${m.amount || 0}%`,
        money(((proposal.total || 0) * (m.amount || 0)) / 100, currency, locale),
      ]),
      theme: 'striped',
      styles: { font: 'helvetica', fontSize: 9.2, cellPadding: 5.5, textColor: c.ink, lineColor: c.line },
      headStyles: { fillColor: c.secondary, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8.6 },
      alternateRowStyles: { fillColor: c.soft },
      columnStyles: { 2: { halign: 'right', cellWidth: 70 }, 3: { halign: 'right', cellWidth: 90 } },
    });
    y = doc.lastAutoTable.finalY + 16;
  }

  if (proposal.notes) {
    if (y > A4.h - 150) {
      doc.addPage();
      y = M;
    }
    y = sectionTitle(doc, 'Notes', y, c);
    y = body(doc, proposal.notes, y) + 8;
  }

  if (proposal.terms) {
    if (y > A4.h - 190) {
      doc.addPage();
      y = M;
    }
    y = sectionTitle(doc, 'Terms & conditions', y, c);
    y = body(doc, proposal.terms, y, CONTENT_W, 8.6, c.muted) + 10;
  }

  if (y > A4.h - 170) {
    doc.addPage();
    y = M;
  }
  y = sectionTitle(doc, 'Acceptance', y, c);
  doc.setDrawColor(...c.line);
  doc.roundedRect(M, y, CONTENT_W, 78, 6, 6, 'S');
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.2);
  doc.setTextColor(...c.muted);
  doc.text(
    doc.splitTextToSize(
      `By signing below (or by accepting the online link) ${client?.company || 'the client'} agrees to the scope, timeline and investment described in this ${isQuote ? 'quote' : 'proposal'}.`,
      CONTENT_W - 24,
    ),
    M + 12,
    y + 16,
  );
  if (proposal.status === 'accepted') {
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...hexToRgb('#12A06A'));
    doc.text(
      `Accepted by ${proposal.acceptedBy || 'client'} on ${fmtDate(proposal.decidedAt || proposal.acceptedAt, locale)}`,
      M + 12,
      y + 56,
    );
  } else {
    doc.setDrawColor(...c.muted);
    doc.line(M + 12, y + 60, M + 220, y + 60);
    doc.line(M + 260, y + 60, M + 460, y + 60);
    doc.setFontSize(7.8);
    doc.setTextColor(...c.muted);
    doc.text('Signature client', M + 12, y + 71);
    doc.text('Date', M + 260, y + 71);
  }

  footer(doc, settings, c);
  doc.setProperties({ title: `${proposal.number || 'Proposal'} — ${proposal.title || ''}` });
  return doc;
}

/* -------------------------------- INVOICE -------------------------------- */

export function invoicePDF(invoice, { client, settings, payments = [] }) {
  const c = brandColors(settings);
  const doc = newDoc(settings);
  const currency = invoice.currency || settings?.locale?.baseCurrency || 'EUR';
  const locale = localeFor(currency, settings?.locale?.numberFormat === 'en' ? 'en-US' : 'nl-NL');

  let y = letterhead(doc, settings);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  doc.setTextColor(...c.ink);
  doc.text('Invoice', M, y);

  const statusColors = {
    paid: hexToRgb('#12A06A'),
    overdue: hexToRgb('#B4232F'),
    sent: c.secondary,
    draft: c.muted,
  };
  const statusKey = invoice.status === 'paid' ? 'paid' : invoice.status === 'draft' ? 'draft' : 'sent';
  const label = (invoice.status || 'draft').toUpperCase();
  doc.setFontSize(8.4);
  const badgeColor = statusColors[statusKey] || c.muted;
  const w = doc.getTextWidth(label) + 18;
  doc.setFillColor(...badgeColor);
  doc.roundedRect(A4.w - M - w, y - 11, w, 16, 4, 4, 'F');
  doc.setTextColor(255, 255, 255);
  doc.text(label, A4.w - M - w + 9, y);

  y += 16;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.4);
  doc.setTextColor(...c.muted);
  const facts = [
    ['Invoice number', invoice.number || '—'],
    ['Invoice date', fmtDate(invoice.issueDate, locale)],
    ['Due date', fmtDate(invoice.dueDate, locale)],
    invoice.reference ? ['Reference', invoice.reference] : null,
  ].filter(Boolean);
  facts.forEach((f, i) => {
    doc.setTextColor(...c.muted);
    doc.text(f[0], A4.w - M, y + i * 12, { align: 'right' });
    doc.setTextColor(...c.ink);
    doc.setFont('helvetica', 'bold');
    doc.text(String(f[1]), A4.w - M - 120, y + i * 12, { align: 'right' });
    doc.setFont('helvetica', 'normal');
  });

  // bill to
  doc.setFillColor(...c.soft);
  doc.roundedRect(M, y + 6, 260, 74, 6, 6, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.8);
  doc.setTextColor(...c.muted);
  doc.text('BILLED TO', M + 12, y + 22);
  doc.setFontSize(11);
  doc.setTextColor(...c.ink);
  doc.text(client?.company || client?.name || '—', M + 12, y + 38);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...c.muted);
  [
    client?.name && client?.company ? client.name : '',
    [client?.street, client?.postalCode].filter(Boolean).join(' '),
    [client?.city, client?.country].filter(Boolean).join(', '),
    client?.taxId ? `VAT ${client.taxId}` : client?.regNumber ? `KvK ${client.regNumber}` : '',
  ]
    .filter(Boolean)
    .forEach((l, i) => doc.text(l, M + 12, y + 52 + i * 10.5));

  y += 100;

  autoTable(doc, {
    startY: y,
    margin: { left: M, right: M },
    head: [['Description', 'Qty', 'Unit price', 'Amount']],
    body: (invoice.items || []).map((it) => [
      it.detail ? `${it.description}\n${it.detail}` : it.description || '',
      `${round2(it.qty)} ${it.unit || ''}`.trim(),
      money(it.rate, currency, locale),
      money(round2(it.qty) * round2(it.rate), currency, locale),
    ]),
    theme: 'striped',
    styles: { font: 'helvetica', fontSize: 9.4, cellPadding: 6, textColor: c.ink, lineColor: c.line, valign: 'top' },
    headStyles: { fillColor: c.ink, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8.8 },
    alternateRowStyles: { fillColor: c.soft },
    columnStyles: {
      0: { cellWidth: 260 },
      1: { cellWidth: 70, halign: 'right' },
      2: { cellWidth: 90, halign: 'right' },
      3: { cellWidth: 90, halign: 'right', fontStyle: 'bold' },
    },
  });
  y = doc.lastAutoTable.finalY + 14;

  y = totalsTable(doc, invoice, y, c);

  const paid = Number(invoice.paidAmount) || 0;
  if (paid > 0) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(...hexToRgb('#12A06A'));
    doc.text(`Paid: ${money(paid, currency, locale)}`, A4.w - M, y - 6, { align: 'right' });
    const bal = round2((Number(invoice.total) || 0) - paid);
    if (bal > 0.005) {
      doc.setTextColor(...c.primary);
      doc.text(`Balance due: ${money(bal, currency, locale)}`, A4.w - M, y + 8, { align: 'right' });
    }
    y += 18;
  }

  if ((payments || []).length) {
    y = sectionTitle(doc, 'Payment history', y + 6, c);
    autoTable(doc, {
      startY: y,
      margin: { left: M, right: M },
      head: [['Date', 'Method', 'Note', 'Amount']],
      body: payments.map((p) => [fmtDate(p.date, locale), p.method || 'bank', p.note || '—', money(p.amount, currency, locale)]),
      theme: 'grid',
      styles: { font: 'helvetica', fontSize: 8.8, cellPadding: 5, textColor: c.ink, lineColor: c.line },
      headStyles: { fillColor: c.soft, textColor: c.muted, fontStyle: 'bold', fontSize: 8 },
      columnStyles: { 3: { halign: 'right', cellWidth: 90 } },
    });
    y = doc.lastAutoTable.finalY + 14;
  }

  const b = settings?.business || {};
  if (y > A4.h - 170) {
    doc.addPage();
    y = M;
  }
  y = sectionTitle(doc, 'Payment details', y, c);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.4);
  doc.setTextColor(...c.ink);
  const payLines = [
    b.iban ? `IBAN: ${b.iban}` : '',
    b.name ? `Account name: ${b.name}` : '',
    `Reference: ${invoice.number || '—'}`,
    invoice.terms || `Please pay within ${invoice.paymentTerms || 14} days of the invoice date.`,
  ].filter(Boolean);
  payLines.forEach((l, i) => {
    const lines = doc.splitTextToSize(l, CONTENT_W);
    doc.setTextColor(...(i === payLines.length - 1 ? c.muted : c.ink));
    doc.text(lines, M, y + i * 0);
    y += lines.length * 12.5;
  });

  if (invoice.notes) {
    y += 8;
    y = sectionTitle(doc, 'Notes', y, c);
    y = body(doc, invoice.notes, y, CONTENT_W, 8.8, c.muted);
  }

  y = Math.max(y, A4.h - 120);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(...c.primary);
  doc.text('Thank you for your business.', M, y);

  footer(doc, settings, c);
  doc.setProperties({ title: `Invoice ${invoice.number || ''}` });
  return doc;
}

/* ------------------------------ BOARD / REPORTS --------------------------- */

const COLUMN_LABELS = {
  backlog: 'Backlog',
  todo: 'To do',
  doing: 'In progress',
  review: 'Review',
  done: 'Done',
};

export function boardPDF({ tasks, sprints, projects, settings, title = 'Project board' }) {
  const c = brandColors(settings);
  const doc = newDoc(settings);
  let y = letterhead(doc, settings);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.setTextColor(...c.ink);
  doc.text(title, M, y);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.4);
  doc.setTextColor(...c.muted);
  doc.text(`Exported ${fmtDate(new Date(), 'nl-NL')} · ${tasks.length} cards · ${sprints.length} sprints`, M, y + 16);
  y += 40;

  const projectMap = Object.fromEntries(projects.map((p) => [p.id, p.name]));
  const sprintMap = Object.fromEntries(sprints.map((s) => [s.id, s.name]));

  autoTable(doc, {
    startY: y,
    margin: { left: M, right: M },
    head: [['Card', 'Column', 'Points', 'Priority', 'Assignee', 'Sprint', 'Project', 'Due']],
    body: tasks.map((t) => [
      t.title,
      COLUMN_LABELS[t.column] || t.column,
      t.points || 0,
      t.priority || '—',
      t.assignee || '—',
      sprintMap[t.sprintId] || '—',
      projectMap[t.projectId] || '—',
      t.dueDate ? fmtDate(t.dueDate, 'nl-NL') : '—',
    ]),
    theme: 'striped',
    styles: { font: 'helvetica', fontSize: 8.6, cellPadding: 5, textColor: c.ink, lineColor: c.line, valign: 'top' },
    headStyles: { fillColor: c.ink, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 },
    alternateRowStyles: { fillColor: c.soft },
    columnStyles: { 2: { halign: 'center', cellWidth: 42 }, 7: { cellWidth: 66 } },
  });
  y = doc.lastAutoTable.finalY + 18;

  if (sprints.length) {
    autoTable(doc, {
      startY: y,
      margin: { left: M, right: M },
      head: [['Sprint', 'Goal', 'Start', 'End', 'Capacity (pts)', 'Committed', 'Done', 'Status']],
      body: sprints.map((s) => {
        const cards = tasks.filter((t) => t.sprintId === s.id);
        const pts = cards.reduce((acc, t) => acc + (Number(t.points) || 0), 0);
        const done = cards.filter((t) => t.column === 'done').reduce((acc, t) => acc + (Number(t.points) || 0), 0);
        return [s.name, s.goal || '—', fmtDate(s.startDate, 'nl-NL'), fmtDate(s.endDate, 'nl-NL'), s.capacity || 0, pts, done, s.status || '—'];
      }),
      theme: 'grid',
      styles: { font: 'helvetica', fontSize: 8.6, cellPadding: 5, textColor: c.ink, lineColor: c.line },
      headStyles: { fillColor: c.secondary, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 },
      columnStyles: { 4: { halign: 'center' }, 5: { halign: 'center' }, 6: { halign: 'center' } },
    });
  }

  footer(doc, settings, c);
  return doc;
}

/**
 * Generic multi-section report: sections = [{ title, table?: {head, body, numericColumns}, text?, rows? }]
 */
export function reportPDF({ title, subtitle, sections = [], settings }) {
  const c = brandColors(settings);
  const doc = newDoc(settings);
  let y = letterhead(doc, settings);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.setTextColor(...c.ink);
  doc.text(title, M, y);
  if (subtitle) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.4);
    doc.setTextColor(...c.muted);
    const lines = doc.splitTextToSize(subtitle, CONTENT_W);
    doc.text(lines, M, y + 16);
    y += 16 + lines.length * 12;
  }
  y += 30;

  for (const section of sections) {
    if (y > A4.h - 180) {
      doc.addPage();
      y = M;
    }
    y = sectionTitle(doc, section.title, y, c);
    if (section.text) y = body(doc, section.text, y, CONTENT_W, 9.4, c.ink) + 6;
    if (section.kv) {
      section.kv.forEach(([k, v]) => {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9.4);
        doc.setTextColor(...c.muted);
        doc.text(k, M, y);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...c.ink);
        doc.text(String(v), A4.w - M, y, { align: 'right' });
        y += 13;
      });
      y += 6;
    }
    if (section.table) {
      autoTable(doc, {
        startY: y,
        margin: { left: M, right: M },
        head: [section.table.head],
        body: section.table.body,
        foot: section.table.foot ? [section.table.foot] : undefined,
        theme: 'striped',
        styles: { font: 'helvetica', fontSize: 8.8, cellPadding: 5, textColor: c.ink, lineColor: c.line, valign: 'top' },
        headStyles: { fillColor: c.ink, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8.2 },
        alternateRowStyles: { fillColor: c.soft },
        footStyles: { fillColor: c.soft, textColor: c.ink, fontStyle: 'bold', fontSize: 9 },
        columnStyles: Object.fromEntries(
          (section.table.numericColumns || []).map((i) => [i, { halign: 'right' }]),
        ),
      });
      y = doc.lastAutoTable.finalY + 20;
    }
  }

  footer(doc, settings, c);
  return doc;
}

export const savePdf = (doc, filename) => doc.save(filename.endsWith('.pdf') ? filename : `${filename}.pdf`);
