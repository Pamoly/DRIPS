import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Building2,
  Check,
  Database,
  Download,
  FileText,
  Globe2,
  Palette,
  RefreshCw,
  RotateCcw,
  Save,
  Settings as SettingsIcon,
  ShieldCheck,
  Trash2,
  Upload,
} from 'lucide-react';
import { useApp } from '../lib/store';
import { useMoney } from '../lib/money';
import { downloadJson, fmtDate, round2, todayISO } from '../lib/format';
import { CURRENCIES, currencyInfo } from '../lib/currencies';
import { resolveProfile, TAX_PROFILES } from '../lib/tax';
import { LogoUpload } from '../components/LogoUpload';
import {
  Button,
  Card,
  Field,
  Input,
  Modal,
  PageHeader,
  Pill,
  SectionTitle,
  Segmented,
  Select,
  Textarea,
  Toggle,
} from '../components/ui';

const TABS = [
  { id: 'business', label: 'Business & brand', icon: Building2 },
  { id: 'preferences', label: 'Preferences', icon: Globe2 },
  { id: 'tax', label: 'Tax profile', icon: ShieldCheck },
  { id: 'documents', label: 'Documents', icon: FileText },
  { id: 'currencies', label: 'Currencies', icon: Palette },
  { id: 'data', label: 'Data & backup', icon: Database },
];

export default function Settings() {
  const app = useApp();
  const { settings, updateSettings, collections, meta, theme, setTheme, loadDemo, resetWorkspace, restoreBackup, toast, locale } = app;
  const { m } = useMoney();
  const [tab, setTab] = useState('business');
  const [confirmReset, setConfirmReset] = useState(false);
  const fileRef = useRef(null);

  if (!settings) return null;
  const b = settings.business || {};
  const brand = settings.brand || {};
  const loc = settings.locale || {};
  const tax = settings.tax || {};
  const num = settings.numbering || {};
  const defs = settings.defaults || {};
  const profile = resolveProfile(settings);

  const importBackup = async (file) => {
    if (!file) return;
    try {
      const text = await file.text();
      const payload = JSON.parse(text);
      if (!payload.settings) throw new Error('Not a DRIPS backup file');
      await restoreBackup(payload);
    } catch (err) {
      toast(`Import failed: ${err.message}`, 'error');
    }
  };

  const exportBackup = () => {
    downloadJson(`DRIPS-backup-${todayISO()}.json`, {
      exportedAt: new Date().toISOString(),
      app: 'DRIPS',
      version: 1,
      settings,
      collections,
    });
    toast('Backup downloaded — keep it somewhere safe');
  };

  return (
    <>
      <PageHeader
        eyebrow="Workspace"
        title="Settings"
        subtitle="Your identity, branding, tax profile, document defaults, currencies and data — configured once, applied everywhere."
        icon={SettingsIcon}
        actions={
          <>
            <Pill tone="blue">
              Workspace {(meta.id || '').slice(-6)} · {Object.values(collections).reduce((s, list) => s + (Array.isArray(list) ? list.length : 0), 0)} records
            </Pill>
            <Button variant="outline" icon={Download} onClick={exportBackup}>
              Download backup
            </Button>
          </>
        }
      >
        <div className="mt-3 -mx-1 overflow-x-auto px-1 no-scrollbar">
          <Segmented
            ariaLabel="Settings section"
            value={tab}
            onChange={setTab}
            options={TABS.map((t) => ({ value: t.id, label: t.label, icon: t.icon }))}
          />
        </div>
      </PageHeader>

      {tab === 'business' && (
        <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr] lg:items-start">
          <Card className="pad">
            <SectionTitle>Business identity</SectionTitle>
            <p className="-mt-1 mb-4 text-xs text-[var(--text-muted)]">
              These details print on every proposal, quote, invoice and public signing link.
            </p>
            <LogoUpload
              className="mb-4"
              value={b.logoDataUrl}
              name={b.logoName}
              onChange={(logoDataUrl, logoName) => {
                updateSettings({ business: { logoDataUrl, logoName } });
                toast(logoDataUrl ? 'Logo updated across all documents' : 'Logo removed');
              }}
            />
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Business name" required>
                <Input value={b.name || ''} onChange={(e) => updateSettings({ business: { name: e.target.value } })} placeholder="Studio Noordzij" />
              </Field>
              <Field label="Owner / signatory">
                <Input value={b.owner || ''} onChange={(e) => updateSettings({ business: { owner: e.target.value } })} placeholder="Mila Noordzij" />
              </Field>
              <Field label="Tagline" className="sm:col-span-2">
                <Input value={b.tagline || ''} onChange={(e) => updateSettings({ business: { tagline: e.target.value } })} placeholder="Brand & product design for ambitious teams" />
              </Field>
              <Field label="Email">
                <Input type="email" value={b.email || ''} onChange={(e) => updateSettings({ business: { email: e.target.value } })} />
              </Field>
              <Field label="Phone">
                <Input type="tel" value={b.phone || ''} onChange={(e) => updateSettings({ business: { phone: e.target.value } })} />
              </Field>
              <Field label="Website">
                <Input value={b.website || ''} onChange={(e) => updateSettings({ business: { website: e.target.value } })} />
              </Field>
              <Field label="IBAN">
                <Input value={b.iban || ''} onChange={(e) => updateSettings({ business: { iban: e.target.value } })} placeholder="NL12 ABNA 0483 9201 44" />
              </Field>
              <Field label="Street & number">
                <Input value={b.street || ''} onChange={(e) => updateSettings({ business: { street: e.target.value } })} />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Postal code">
                  <Input value={b.postalCode || ''} onChange={(e) => updateSettings({ business: { postalCode: e.target.value } })} />
                </Field>
                <Field label="City">
                  <Input value={b.city || ''} onChange={(e) => updateSettings({ business: { city: e.target.value } })} />
                </Field>
              </div>
              <Field label="Country">
                <Input value={b.country || ''} onChange={(e) => updateSettings({ business: { country: e.target.value } })} />
              </Field>
              <Field label="Business registration number (KvK)" hint="Shown as “Chamber of Commerce (KvK)” on documents.">
                <Input value={b.regNumber || ''} onChange={(e) => updateSettings({ business: { regNumber: e.target.value } })} placeholder="8742 1930" />
              </Field>
              <Field label="Tax ID / VAT number (BTW-id)" hint="Required on invoices and for EU reverse charge.">
                <Input value={b.taxId || ''} onChange={(e) => updateSettings({ business: { taxId: e.target.value } })} placeholder="NL0038.12.947.B01" />
              </Field>
            </div>
          </Card>

          <div className="space-y-4">
            <Card className="pad">
              <SectionTitle action={<Button size="sm" variant="ghost" icon={RotateCcw} onClick={() => updateSettings({ brand: { primary: '#AE1C28', secondary: '#21468B', documentAccent: '#0E1B3D' } })}>Dutch flag</Button>}>
                Brand colours
              </SectionTitle>
              <div className="space-y-3">
                {[
                  ['primary', 'Primary (accents, totals)'],
                  ['secondary', 'Secondary (headings, links)'],
                  ['documentAccent', 'Document ink (headers, footers)'],
                ].map(([key, label]) => (
                  <label key={key} className="flex items-center gap-3">
                    <input
                      type="color"
                      className="h-10 w-14 cursor-pointer rounded-lg border border-[var(--line)] bg-transparent p-1"
                      value={brand[key] || '#AE1C28'}
                      onChange={(e) => updateSettings({ brand: { [key]: e.target.value } })}
                      aria-label={label}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold">{label}</span>
                      <span className="block font-mono text-xs text-[var(--text-muted)]">{brand[key]}</span>
                    </span>
                  </label>
                ))}
                <div aria-hidden className="flag-bar h-2 w-full rounded-full" />
                <p className="text-xs leading-relaxed text-[var(--text-muted)]">
                  The default palette mixes the red, white and blue of the Dutch flag — a nod to Rotterdam, where DRIPS
                  was founded.
                </p>
              </div>
            </Card>

            <Card className="pad">
              <SectionTitle>Appearance</SectionTitle>
              <Segmented
                className="w-full"
                ariaLabel="Theme"
                value={theme}
                onChange={setTheme}
                options={[
                  { value: 'light', label: 'Light' },
                  { value: 'dark', label: 'Dark' },
                ]}
              />
              <p className="mt-2 text-xs text-[var(--text-muted)]">Stored in this browser. DRIPS follows your system preference on first visit.</p>
            </Card>

            <Card className="pad">
              <SectionTitle>Document preview</SectionTitle>
              <div className="overflow-hidden rounded-xl border border-[var(--line)] bg-white p-4 text-[#101A30]">
                <div aria-hidden className="mb-3 flex h-1.5 w-full overflow-hidden rounded-full">
                  <span className="flex-1" style={{ background: brand.primary }} />
                  <span className="flex-1 bg-white" />
                  <span className="flex-1" style={{ background: brand.secondary }} />
                </div>
                <div className="flex items-start justify-between gap-3">
                  {b.logoDataUrl ? <img src={b.logoDataUrl} alt="" className="max-h-10 object-contain" /> : <span className="flex h-10 w-10 items-center justify-center rounded-lg text-sm font-extrabold text-white" style={{ background: brand.documentAccent }}>{(b.name || 'D')[0]}</span>}
                  <div className="text-right text-[0.62rem] leading-relaxed text-slate-500">
                    {[b.street && `${b.street}, ${b.postalCode} ${b.city}`.trim(), b.email, b.phone].filter(Boolean).map((l) => (
                      <span key={l} className="block">{l}</span>
                    ))}
                  </div>
                </div>
                <p className="mt-3 text-[0.62rem] font-bold uppercase tracking-[0.16em]" style={{ color: brand.primary }}>
                  Proposal · PROP-{new Date().getFullYear()}-001
                </p>
                <p className="font-display text-base font-extrabold" style={{ color: brand.documentAccent }}>
                  {b.name || 'Your business name'}
                </p>
                <div className="mt-2 space-y-0.5 border-t border-slate-200 pt-2 text-[0.62rem] text-slate-500">
                  {b.regNumber && <p>Chamber of Commerce (KvK): <strong className="text-slate-700">{b.regNumber}</strong></p>}
                  {b.taxId && <p>Tax ID / VAT: <strong className="text-slate-700">{b.taxId}</strong></p>}
                  {b.iban && <p>IBAN: <strong className="text-slate-700">{b.iban}</strong></p>}
                </div>
              </div>
            </Card>
          </div>
        </div>
      )}

      {tab === 'preferences' && (
        <div className="grid gap-4 lg:grid-cols-2 lg:items-start">
          <Card className="pad">
            <SectionTitle>Regional settings</SectionTitle>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Base (reporting) currency" hint="Totals across modules are converted into this currency.">
                <Select value={loc.baseCurrency || 'EUR'} onChange={(e) => updateSettings({ locale: { baseCurrency: e.target.value } })}>
                  {CURRENCIES.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.code} — {c.name}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Number & date format">
                <Select value={loc.numberFormat || 'nl'} onChange={(e) => updateSettings({ locale: { numberFormat: e.target.value } })}>
                  <option value="nl">Dutch — €1.234,56 · 14-10-2026</option>
                  <option value="en">English — €1,234.56 · 10/14/2026</option>
                </Select>
              </Field>
              <Field label="Interface language">
                <Select value={loc.language || 'en'} onChange={(e) => updateSettings({ locale: { language: e.target.value } })}>
                  <option value="en">English</option>
                  <option value="nl">Nederlands</option>
                </Select>
              </Field>
              <Field label="Date format on documents">
                <Select value={loc.dateFormat || 'DD/MM/YYYY'} onChange={(e) => updateSettings({ locale: { dateFormat: e.target.value } })}>
                  {['DD/MM/YYYY', 'MM/DD/YYYY', 'YYYY-MM-DD', 'D MMMM YYYY'].map((f) => (
                    <option key={f} value={f}>
                      {f}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Hours per story point" hint="Used for effort estimates on the board.">
                <Input type="number" min="1" step="0.5" value={defs.hoursPerPoint ?? 4} onChange={(e) => updateSettings({ defaults: { hoursPerPoint: Number(e.target.value) } })} />
              </Field>
              <Field label="Working days per week" hint="Used for utilisation targets.">
                <Input type="number" min="1" max="7" step="1" value={defs.workdays ?? 5} onChange={(e) => updateSettings({ defaults: { workdays: Number(e.target.value) } })} />
              </Field>
            </div>
            <p className="mt-3 text-xs text-[var(--text-muted)]">
              Current locale: <strong>{locale}</strong> · base currency {loc.baseCurrency} ({currencyInfo(loc.baseCurrency).symbol})
            </p>
          </Card>

          <Card className="pad">
            <SectionTitle>Defaults for new documents</SectionTitle>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Default hourly rate">
                <Input type="number" min="0" step="5" value={defs.hourlyRate ?? 85} onChange={(e) => updateSettings({ defaults: { hourlyRate: Number(e.target.value) } })} />
              </Field>
              <Field label="Default document currency">
                <Select value={defs.currency || loc.baseCurrency || 'EUR'} onChange={(e) => updateSettings({ defaults: { currency: e.target.value } })}>
                  {CURRENCIES.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.code}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Payment terms (days)">
                <Input type="number" min="0" step="1" value={defs.paymentTermsDays ?? 14} onChange={(e) => updateSettings({ defaults: { paymentTermsDays: Number(e.target.value) } })} />
              </Field>
              <Field label="Proposal validity (days)">
                <Input type="number" min="1" step="1" value={defs.validityDays ?? 30} onChange={(e) => updateSettings({ defaults: { validityDays: Number(e.target.value) } })} />
              </Field>
              <Field label="Signature name" className="sm:col-span-2">
                <Input value={defs.signature || ''} onChange={(e) => updateSettings({ defaults: { signature: e.target.value } })} placeholder="Mila Noordzij" />
              </Field>
            </div>
          </Card>
        </div>
      )}

      {tab === 'tax' && (
        <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr] lg:items-start">
          <Card className="pad">
            <SectionTitle action={<Pill tone={profile.exact ? 'green' : 'amber'}>{profile.exact ? 'Official parameters' : 'Indicative profile'}</Pill>}>
              Tax profile
            </SectionTitle>
            <p className="-mt-1 mb-4 text-xs text-[var(--text-muted)]">{profile.note}</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Country / profile" className="sm:col-span-2">
                <Select value={tax.country || 'NL'} onChange={(e) => updateSettings({ tax: { country: e.target.value } })}>
                  {Object.values(TAX_PROFILES).map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.label}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Entity type">
                <Select value={tax.entity || 'sole'} onChange={(e) => updateSettings({ tax: { entity: e.target.value } })}>
                  {[
                    ['sole', 'Sole trader / eenmanszaak / ZZP'],
                    ['bv', 'Private limited (BV / Ltd)'],
                    ['vof', 'Partnership (VOF / GbR)'],
                    ['us_llc', 'US LLC / Schedule C'],
                    ['other', 'Other'],
                  ].map(([v, l]) => (
                    <option key={v} value={v}>
                      {l}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Tax year">
                <Input type="number" value={tax.year || new Date().getFullYear()} onChange={(e) => updateSettings({ tax: { year: Number(e.target.value) } })} />
              </Field>
              <Field label="VAT regime">
                <Select value={tax.vatRegime || 'standard'} onChange={(e) => updateSettings({ tax: { vatRegime: e.target.value } })}>
                  <option value="standard">Standard VAT (charge & reclaim)</option>
                  <option value="kor">KOR — small business scheme (no VAT)</option>
                  <option value="none">Not VAT registered</option>
                </Select>
              </Field>
              <Field label="Standard VAT rate (%)">
                <Input type="number" step="0.1" value={tax.vatRate ?? 21} onChange={(e) => updateSettings({ tax: { vatRate: Number(e.target.value) } })} />
              </Field>
              <Field label="Reduced VAT rate (%)">
                <Input type="number" step="0.1" value={tax.vatReducedRate ?? 9} onChange={(e) => updateSettings({ tax: { vatReducedRate: Number(e.target.value) } })} />
              </Field>
              <Field label="Safety buffer on top of tax (%)">
                <Input type="number" min="0" max="20" step="1" value={tax.bufferPct ?? 5} onChange={(e) => updateSettings({ tax: { bufferPct: Number(e.target.value) } })} />
              </Field>
              <Field label="Other taxable income (box 1)">
                <Input type="number" step="100" value={tax.otherIncome ?? 0} onChange={(e) => updateSettings({ tax: { otherIncome: Number(e.target.value) } })} />
              </Field>
            </div>

            <div className="mt-4 space-y-3 border-t border-[var(--line)] pt-4">
              <Toggle checked={!!tax.hoursCriterionMet} onChange={(v) => updateSettings({ tax: { hoursCriterionMet: v } })} label={`Hours criterion met (${profile.hoursCriterion || 1225} hours/year)`} description="Required for the zelfstandigenaftrek and other entrepreneur deductions." />
              <Toggle checked={!!tax.starter} onChange={(v) => updateSettings({ tax: { starter: v } })} label="Startersaftrek applicable" description="First three years of your business, usable at most three times." />
              <Toggle checked={!!tax.aow} onChange={(v) => updateSettings({ tax: { aow: v } })} label="AOW state pension age" description="Lower first-bracket rate and reduced tax credits." />
              <Toggle checked={tax.mixedRule !== false} onChange={(v) => updateSettings({ tax: { mixedRule: v } })} label="Apply the 73,5% rule to food & representation" description="Dutch threshold: 26,5% of meals, drinks and representation is non-deductible." />
              <Toggle checked={!!tax.autoSetAside} onChange={(v) => updateSettings({ tax: { autoSetAside: v } })} label="Suggest a tax transfer after every payment" description="Shows the advised buffer amount when you record an invoice payment." />
            </div>
          </Card>

          <div className="space-y-4">
            <Card className="pad">
              <SectionTitle>Current parameters</SectionTitle>
              <ul className="space-y-2 text-sm">
                {(profile.deductions || []).map((d) => (
                  <li key={d.id} className="flex items-center justify-between gap-3">
                    <span className="text-[var(--text-muted)]">{d.label}</span>
                    <span className="tnum font-semibold">{m(d.amount)}</span>
                  </li>
                ))}
                {profile.exemption && (
                  <li className="flex items-center justify-between gap-3">
                    <span className="text-[var(--text-muted)]">{profile.exemption.label}</span>
                    <span className="tnum font-semibold">{round2(profile.exemption.rate * 100)}%</span>
                  </li>
                )}
                {profile.brackets.map((br, i) => (
                  <li key={i} className="flex items-center justify-between gap-3">
                    <span className="text-[var(--text-muted)]">
                      Bracket {i + 1} {br.upTo === Infinity ? `above ${m(profile.brackets[i - 1]?.upTo || 0)}` : `up to ${m(br.upTo)}`}
                    </span>
                    <span className="tnum font-semibold">{round2(br.rate * 100)}%</span>
                  </li>
                ))}
                {(profile.surtaxes || []).map((s) => (
                  <li key={s.id} className="flex items-center justify-between gap-3">
                    <span className="text-[var(--text-muted)]">{s.label}</span>
                    <span className="tnum font-semibold">{round2(s.rate * 100)}%</span>
                  </li>
                ))}
              </ul>
            </Card>

            <Card className="pad">
              <SectionTitle>Override this profile</SectionTitle>
              <p className="-mt-1 mb-3 text-xs text-[var(--text-muted)]">
                Rates change every year. Set a flat reserve rate, or override the brackets, and DRIPS will use your
                numbers instead of the built-in profile.
              </p>
              <Field label="Flat reserve rate (%)" hint="Applies to the Custom profile or as a quick override.">
                <Input
                  type="number"
                  min="0"
                  max="60"
                  step="0.5"
                  value={tax.custom?.flatRate ?? ''}
                  placeholder="e.g. 34"
                  onChange={(e) => updateSettings({ tax: { custom: { ...tax.custom, flatRate: e.target.value === '' ? undefined : Number(e.target.value) / 100 } } })}
                />
              </Field>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  icon={RotateCcw}
                  onClick={() => {
                    updateSettings({ tax: { custom: {} } });
                    toast('Tax overrides cleared — using the official profile again');
                  }}
                >
                  Clear overrides
                </Button>
                <Button size="sm" variant="ghost" as={Link} to="/app/tax">
                  Open the estimator
                </Button>
              </div>
            </Card>
          </div>
        </div>
      )}

      {tab === 'documents' && (
        <div className="grid gap-4 lg:grid-cols-2 lg:items-start">
          <Card className="pad">
            <SectionTitle>Numbering</SectionTitle>
            <div className="grid gap-3 sm:grid-cols-2">
              {[
                ['proposalPrefix', 'Proposal prefix', 'PROP'],
                ['quotePrefix', 'Quote prefix', 'QUO'],
                ['invoicePrefix', 'Invoice prefix', 'INV'],
                ['clientPrefix', 'Client prefix', 'CL'],
              ].map(([key, label, placeholder]) => (
                <Field key={key} label={label}>
                  <Input value={num[key] || ''} placeholder={placeholder} onChange={(e) => updateSettings({ numbering: { [key]: e.target.value } })} />
                </Field>
              ))}
              <Field label="Next proposal number">
                <Input type="number" min="1" value={num.proposalNext ?? 1} onChange={(e) => updateSettings({ numbering: { proposalNext: Number(e.target.value) } })} />
              </Field>
              <Field label="Next quote number">
                <Input type="number" min="1" value={num.quoteNext ?? 1} onChange={(e) => updateSettings({ numbering: { quoteNext: Number(e.target.value) } })} />
              </Field>
              <Field label="Next invoice number" hint="Invoices must be numbered sequentially — do not reuse numbers.">
                <Input type="number" min="1" value={num.invoiceNext ?? 1001} onChange={(e) => updateSettings({ numbering: { invoiceNext: Number(e.target.value) } })} />
              </Field>
            </div>
            <p className="mt-3 text-xs text-[var(--text-muted)]">
              Format: <code className="font-mono">{num.proposalPrefix}-{new Date().getFullYear()}-001</code> for proposals and{' '}
              <code className="font-mono">{num.invoicePrefix}-{new Date().getFullYear()}-{String(num.invoiceNext ?? 1001).padStart(4, '0')}</code> for invoices.
            </p>
          </Card>

          <Card className="pad">
            <SectionTitle>Template text</SectionTitle>
            <div className="grid gap-3">
              <Field label="Proposal opening line" hint="Inserted into every new proposal.">
                <Textarea rows={3} value={defs.proposalIntro || ''} onChange={(e) => updateSettings({ defaults: { proposalIntro: e.target.value } })} />
              </Field>
              <Field label="Standard terms & conditions">
                <Textarea rows={6} value={defs.proposalTerms || ''} onChange={(e) => updateSettings({ defaults: { proposalTerms: e.target.value } })} />
              </Field>
              <Field label="Invoice payment line">
                <Textarea rows={2} value={defs.invoiceTerms || 'Payable within 14 days by bank transfer.'} onChange={(e) => updateSettings({ defaults: { invoiceTerms: e.target.value } })} />
              </Field>
              <Field label="Reminder email template" hint="Placeholders: {number}, {amount}, {due}, {name}, {iban}">
                <Textarea
                  rows={5}
                  value={defs.reminderTemplate || 'Hi {name},\n\nA friendly reminder about invoice {number} for {amount}, due {due}.\n\nIBAN: {iban}\nReference: {number}\n\nKind regards,'}
                  onChange={(e) => updateSettings({ defaults: { reminderTemplate: e.target.value } })}
                />
              </Field>
            </div>
          </Card>
        </div>
      )}

      {tab === 'currencies' && (
        <Card className="overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--line)] p-3">
            <div>
              <h2 className="text-base font-bold">Currencies & reference rates</h2>
              <p className="text-xs text-[var(--text-muted)]">
                Rates are expressed per 1 EUR. Documents keep their own currency; reports convert into your base currency ({loc.baseCurrency}).
              </p>
            </div>
            <Button
              size="sm"
              variant="outline"
              icon={RotateCcw}
              onClick={() => {
                updateSettings({ rates: {} });
                toast('Reference rates reset to the built-in values');
              }}
            >
              Reset rates
            </Button>
          </div>
          <div className="max-h-[32rem] overflow-auto">
            <table className="tbl">
              <thead>
                <tr>
                  <th scope="col">Code</th>
                  <th scope="col">Currency</th>
                  <th scope="col">Locale</th>
                  <th scope="col" className="num">Units per 1 EUR</th>
                  <th scope="col">Your override</th>
                </tr>
              </thead>
              <tbody>
                {CURRENCIES.map((c) => (
                  <tr key={c.code}>
                    <td className="font-mono text-xs font-bold">{c.code}</td>
                    <td>{c.name}</td>
                    <td className="text-xs text-[var(--text-muted)]">{c.locale}</td>
                    <td className="num text-xs">{c.rate}</td>
                    <td>
                      {c.code === 'EUR' ? (
                        <span className="text-xs text-[var(--text-muted)]">base</span>
                      ) : (
                        <Input
                          type="number"
                          step="0.0001"
                          className="!w-28 !py-1 !text-xs"
                          value={(settings.rates || {})[c.code] ?? ''}
                          placeholder={String(c.rate)}
                          onChange={(e) => updateSettings({ rates: { ...(settings.rates || {}), [c.code]: e.target.value === '' ? undefined : Number(e.target.value) } })}
                          aria-label={`Rate for ${c.code}`}
                        />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="border-t border-[var(--line)] p-3 text-xs text-[var(--text-muted)]">
            Rates are indicative reference values for reporting, not live market feeds — set your own if you invoice in
            a currency with a contracted rate.
          </p>
        </Card>
      )}

      {tab === 'data' && (
        <div className="grid gap-4 lg:grid-cols-2 lg:items-start">
          <Card className="pad">
            <SectionTitle>Workspace contents</SectionTitle>
            <ul className="grid gap-2 sm:grid-cols-2">
              {Object.entries(collections).map(([key, list]) => (
                <li key={key} className="flex items-center justify-between gap-2 rounded-lg border border-[var(--line)] px-3 py-2 text-sm">
                  <span className="capitalize text-[var(--text-muted)]">{key}</span>
                  <span className="tnum font-bold">{Array.isArray(list) ? list.length : 0}</span>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-xs text-[var(--text-muted)]">
              Workspace created {fmtDate(meta.createdAt, locale)} · plan <strong>{meta.plan || 'free'}</strong> · data is
              stored on the DRIPS server and reachable only with your private workspace token.
            </p>
          </Card>

          <div className="space-y-4">
            <Card className="pad">
              <SectionTitle>Backup & restore</SectionTitle>
              <p className="-mt-1 mb-3 text-xs text-[var(--text-muted)]">
                A backup is a single JSON file with your settings and every record. Keep one per quarter — it is also
                your exit route if you ever leave DRIPS.
              </p>
              <div className="flex flex-wrap gap-2">
                <Button variant="primary" icon={Download} onClick={exportBackup}>
                  Download JSON backup
                </Button>
                <input ref={fileRef} type="file" accept="application/json,.json" className="sr-only" onChange={(e) => importBackup(e.target.files?.[0])} />
                <Button variant="outline" icon={Upload} onClick={() => fileRef.current?.click()}>
                  Restore from file
                </Button>
              </div>
            </Card>

            <Card className="pad">
              <SectionTitle>Demo & reset</SectionTitle>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" icon={RefreshCw} onClick={() => loadDemo().catch(() => toast('Could not load demo data', 'error'))}>
                  Load demo workspace
                </Button>
                <Button variant="danger" icon={Trash2} onClick={() => setConfirmReset(true)}>
                  Clear all data
                </Button>
              </div>
              <p className="mt-3 text-xs leading-relaxed text-[var(--text-muted)]">
                The demo workspace contains a full quarter for a Rotterdam design studio: 5 clients, 4 proposals, 7
                invoices, 50+ expenses, tracked time, 3 sprints with 16 cards and 5 goals. Loading it replaces your
                current records.
              </p>
            </Card>

            <Card className="pad">
              <SectionTitle>Privacy & security</SectionTitle>
              <ul className="space-y-2 text-sm text-[var(--text-muted)]">
                {[
                  'No third-party trackers or analytics scripts are loaded.',
                  'Logos are stored as compressed images inside your workspace record.',
                  'Public proposal links only expose the single document you shared.',
                  'Deleting data removes it from the server store immediately.',
                ].map((t) => (
                  <li key={t} className="flex items-start gap-2">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-[var(--color-mint-500)]" aria-hidden />
                    {t}
                  </li>
                ))}
              </ul>
            </Card>
          </div>
        </div>
      )}

      <Modal
        open={confirmReset}
        onClose={() => setConfirmReset(false)}
        size="sm"
        title="Clear all workspace data?"
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirmReset(false)}>
              Keep my data
            </Button>
            <Button
              variant="danger"
              icon={Trash2}
              onClick={async () => {
                await resetWorkspace();
                setConfirmReset(false);
              }}
            >
              Delete everything
            </Button>
          </>
        }
      >
        <p className="text-sm text-[var(--text-muted)]">
          This removes all clients, proposals, invoices, expenses, time entries, projects, cards and goals, and resets
          your settings to the defaults. Download a backup first if you might want them back.
        </p>
        <Button variant="outline" size="sm" className="mt-3" icon={Save} onClick={exportBackup}>
          Download backup first
        </Button>
      </Modal>
    </>
  );
}
