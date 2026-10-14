import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  BadgeCheck,
  Banknote,
  BarChart3,
  Calculator,
  Check,
  ChevronDown,
  Clock3,
  Download,
  FileCheck2,
  FileSignature,
  FileText,
  Gauge,
  Globe2,
  Image as ImageIcon,
  Kanban,
  LayoutDashboard,
  Lock,
  Menu,
  Minus,
  Palette,
  Quote,
  Receipt,
  ShieldCheck,
  Sparkles,
  Star,
  Target,
  Users,
  X,
  Zap,
} from 'lucide-react';
import { AppMockup } from '../components/AppMockup';
import { LogoMark } from '../components/Brand';
import { Accordion, Button, Card, Pill } from '../components/ui';
import { GitHubIcon, InstagramIcon, LinkedInIcon, XIcon } from '../components/SocialIcons';
import { cx } from '../lib/format';

const NAV_LINKS = [
  { href: '#tools', label: 'Products' },
  { href: '#about', label: 'About' },
  { href: '#faq', label: 'FAQ' },
];

const TOOLS = [
  { icon: LayoutDashboard, title: 'Dashboard', text: 'Revenue, outstanding invoices, tax set-aside and sprint health on one screen.' },
  { icon: FileText, title: 'Proposals & Quotes', text: 'Hourly scopes or tiered packages, your logo, KvK + VAT ID, PDF and a signable link.' },
  { icon: Calculator, title: 'Tax & Expenses', text: 'Quarterly revenue, deductible costs and a Dutch 2026 tax reserve, calculated for you.' },
  { icon: Receipt, title: 'Invoices & Books', text: 'Numbered invoices, payments, expenses and a ledger your accountant can read.' },
  { icon: Kanban, title: 'Project Board', text: 'Agile kanban with sprints, story points, burndown, calendar and Excel/PDF export.' },
  { icon: Clock3, title: 'Time Tracker', text: 'One-click timer per client, project or card — turn unbilled hours into an invoice.' },
  { icon: Users, title: 'CRM & Clients', text: 'Contacts, KvK/VAT numbers, status pipeline, notes and lifetime value per client.' },
  { icon: Target, title: 'Goals & Targets', text: 'Revenue, utilisation and savings targets with live progress pulled from your data.' },
];

const BENEFITS = [
  {
    icon: FileSignature,
    title: 'Get signed twice as fast',
    text: 'Send a branded proposal with tiered packages and a one-click accept link. Clients see your logo, your KvK and VAT number, and sign without a PDF round-trip.',
    stat: '2.4×',
    statLabel: 'faster acceptance vs. Word quotes',
  },
  {
    icon: ShieldCheck,
    title: 'Never under-reserve for tax',
    text: 'DRIPS applies the official 2026 Dutch brackets, ondernemersaftrek, heffingskortingen, Zvw and quarterly VAT — then tells you the exact percentage to set aside from every payment.',
    stat: 'Q1–Q4',
    statLabel: 'VAT deadlines tracked automatically',
  },
  {
    icon: Download,
    title: 'Books that close themselves',
    text: 'Invoices, expenses, payments and the ledger stay in sync. Export a multi-sheet Excel workbook or a branded PDF report at quarter end — no re-typing, no shoebox.',
    stat: '< 60s',
    statLabel: 'from raw data to accountant-ready export',
  },
];

const STEPS = [
  {
    title: 'Set up your brand',
    text: 'Add your logo, colours, KvK registration number, VAT/tax ID, hourly rate and currency. Sixty seconds, once.',
    icon: Palette,
  },
  {
    title: 'Quote, track, invoice',
    text: 'Build a proposal from scopes or packages, plan the work on the agile board, track time and convert accepted work into a numbered invoice.',
    icon: Zap,
  },
  {
    title: 'Export & relax',
    text: 'Share a signable link, download Excel or PDF, and let the tax estimator keep your quarterly reserve honest.',
    icon: BarChart3,
  },
];

const TESTIMONIALS = [
  {
    quote:
      'I sent a tiered proposal on Monday morning and the client picked the middle package before lunch. The signed link replaced three rounds of PDF ping-pong.',
    name: 'Sanne Boersma',
    role: 'Founder, Havenlab B.V. · Rotterdam',
    result: '€14.500 package signed in 6 hours',
    color: '#AE1C28',
  },
  {
    quote:
      'The tax module is the reason I sleep before 31 October. It shows my VAT position per quarter and the exact percentage I should move to my buffer account.',
    name: 'Joris van Doorn',
    role: 'Independent consultant · Amsterdam',
    result: '€9.400 reserve built in two quarters',
    color: '#21468B',
  },
  {
    quote:
      'My bookkeeper used to chase me for spreadsheets. Now she gets one Excel export with invoices, expenses and the ledger. Admin went from a weekend to an afternoon.',
    name: 'Nadia el Amrani',
    role: 'Owner, Bakkerij el Amrani · Rotterdam Noord',
    result: 'Admin time down from 11h to 3h per month',
    color: '#0E7C66',
  },
];

const FAQS = [
  {
    id: 'free',
    question: 'Is it really free to start? What is the catch?',
    answer: (
      <>
        The Free workspace is permanent: unlimited proposals and quotes, invoices, expenses, the tax estimator, the
        kanban board, time tracking, CRM and goals for up to 3 active clients. No credit card, no trial clock. Pro
        unlocks unlimited clients, e-signature links, multi-currency reporting and the accountant export pack.
      </>
    ),
  },
  {
    id: 'install',
    question: 'Do I need to install anything or learn a new tool?',
    answer: (
      <>
        Nothing to install — DRIPS runs in your browser on phone, tablet and desktop. If you can fill in a form and
        drag a card, you can use it. Every module has an example workspace you can load in one click so you can see
        how a real quarter looks before typing your own numbers.
      </>
    ),
  },
  {
    id: 'tax',
    question: 'Does it understand Dutch VAT and income tax?',
    answer: (
      <>
        Yes. The estimator ships with the official 2026 parameters: Box 1 brackets of 35,75% / 37,56% / 49,50%,
        zelfstandigenaftrek €1.200 (1.225-hour criterion), startersaftrek €2.123, MKB-winstvrijstelling 12,7%,
        algemene heffingskorting, arbeidskorting and the 4,85% Zvw contribution capped at €3.851. VAT is tracked per
        quarter with the Belastingdienst filing deadlines, including the KOR small-business scheme. Other countries are
        available as editable profiles.
      </>
    ),
  },
  {
    id: 'data',
    question: 'Where does my data live and is it safe?',
    answer: (
      <>
        Your workspace is stored server-side and reachable only with your private workspace token. Logos are stored as
        compressed images, documents are generated on demand, and you can export everything — JSON backup, Excel
        workbooks and PDFs — at any moment. Deleting your workspace removes the records immediately.
      </>
    ),
  },
  {
    id: 'branding',
    question: 'Can I use my own logo, brand colours and currency?',
    answer: (
      <>
        Absolutely. Upload a logo (PNG, JPG, SVG or WebP), pick your brand red and blue, set your business
        registration number (KvK) and tax ID (BTW-nummer), and choose any of 30 currencies as your reporting base.
        Documents and the public signing page inherit that branding automatically.
      </>
    ),
  },
  {
    id: 'switch',
    question: 'I already work in Excel or another tool. Can I bring my data?',
    answer: (
      <>
        Yes — every module exports the same structure you would build in a spreadsheet, and the workspace accepts a
        JSON backup restore, so moving in (or out) is a two-click job. Start with one module, for example invoices,
        and keep your old tool until you trust the numbers.
      </>
    ),
  },
];

const PLANS = [
  {
    name: 'Free',
    price: '€0',
    period: 'forever',
    tagline: 'Everything a starting freelancer needs.',
    cta: 'Start free',
    featured: false,
    features: [
      'Up to 3 active clients',
      'Unlimited proposals & quotes',
      'Invoices, expenses & ledger',
      'Tax & VAT estimator (NL 2026)',
      'Kanban board + calendar',
      'Excel & PDF exports',
    ],
  },
  {
    name: 'Pro',
    price: '€19',
    period: 'per month',
    tagline: 'For full-time ZZP’ers who live in DRIPS.',
    cta: 'Start 14-day Pro trial',
    featured: true,
    features: [
      'Unlimited clients & projects',
      'E-signature proposal links',
      'Custom branding, logo & colours',
      'Multi-currency reporting (30 currencies)',
      'Time tracking → invoice in one click',
      'Accountant export pack & backup',
      'Reminders for VAT and overdue invoices',
    ],
  },
  {
    name: 'Studio',
    price: '€49',
    period: 'per month',
    tagline: 'For small teams with clients of their own.',
    cta: 'Talk to us',
    featured: false,
    features: [
      'Everything in Pro',
      '5 seats with roles',
      'Shared sprint boards & WIP limits',
      'Client portal links',
      'Priority support in NL & EN',
    ],
  },
];

const SOCIALS = [
  { icon: LinkedInIcon, label: 'LinkedIn', href: 'https://www.linkedin.com/' },
  { icon: XIcon, label: 'X (Twitter)', href: 'https://x.com/' },
  { icon: InstagramIcon, label: 'Instagram', href: 'https://www.instagram.com/' },
  { icon: GitHubIcon, label: 'GitHub', href: 'https://github.com/' },
];

export default function Landing() {
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [yearly, setYearly] = useState(true);

  const startFree = async () => {
    navigate('/app');
  };

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && setMenuOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div className="min-h-screen bg-[var(--surface)]">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[100] focus:rounded-lg focus:bg-[var(--surface-card)] focus:px-4 focus:py-2 focus:text-sm focus:font-semibold"
      >
        Skip to content
      </a>

      {/* ------------------------------ header ------------------------------ */}
      <header
        className={cx(
          'sticky top-0 z-50 transition-all duration-200',
          scrolled
            ? 'border-b border-[var(--line)] bg-[color-mix(in_srgb,var(--surface-card)_90%,transparent)] backdrop-blur-md'
            : 'border-b border-transparent bg-transparent',
        )}
      >
        <div className="mx-auto flex w-full max-w-7xl items-center gap-3 px-4 py-3 sm:px-6">
          <Link to="/" className="flex items-center gap-2.5" aria-label="DRIPS home">
            <LogoMark size={30} />
            <span className="font-display text-[1.05rem] font-extrabold tracking-tight">DRIPS</span>
          </Link>

          <nav aria-label="Primary" className="mx-auto hidden items-center gap-1 md:flex">
            {NAV_LINKS.map((l) => (
              <a
                key={l.href}
                href={l.href}
                className="rounded-lg px-3.5 py-2 text-sm font-semibold text-[var(--text-muted)] transition-colors hover:bg-[color-mix(in_srgb,var(--text)_5%,transparent)] hover:text-[var(--text)]"
              >
                {l.label}
              </a>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-2 md:ml-0">
            <Button variant="ghost" size="sm" className="hidden sm:inline-flex" onClick={startFree}>
              Log in
            </Button>
            <Button variant="primary" size="sm" className="sm:btn-md" onClick={startFree} icon={ArrowRight}>
              <span className="hidden sm:inline">Get started free</span>
              <span className="sm:hidden">Start</span>
            </Button>
            <button
              type="button"
              className="btn btn-ghost btn-icon md:hidden"
              onClick={() => setMenuOpen((o) => !o)}
              aria-label={menuOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={menuOpen}
            >
              {menuOpen ? <X className="h-5 w-5" aria-hidden /> : <Menu className="h-5 w-5" aria-hidden />}
            </button>
          </div>
        </div>
        {menuOpen && (
          <div className="border-t border-[var(--line)] bg-[var(--surface-card)] px-4 py-3 md:hidden">
            <nav aria-label="Mobile" className="grid gap-1">
              {[...NAV_LINKS, { href: '#pricing', label: 'Pricing' }, { href: '#how', label: 'How it works' }].map((l) => (
                <a
                  key={l.href}
                  href={l.href}
                  onClick={() => setMenuOpen(false)}
                  className="rounded-lg px-3 py-2.5 text-sm font-semibold hover:bg-[color-mix(in_srgb,var(--text)_5%,transparent)]"
                >
                  {l.label}
                </a>
              ))}
              <Button variant="primary" className="mt-2 w-full" onClick={startFree}>
                Get started free
              </Button>
            </nav>
          </div>
        )}
        <div aria-hidden className="flag-bar w-full opacity-80" />
      </header>

      <main id="main">
        {/* ------------------------------- hero ------------------------------- */}
        <section className="relative overflow-hidden">
          <div aria-hidden className="grid-lines pointer-events-none absolute inset-0 opacity-60" />
          <div
            aria-hidden
            className="pointer-events-none absolute -right-40 -top-40 h-[34rem] w-[34rem] rounded-full opacity-25 blur-3xl"
            style={{ background: 'radial-gradient(circle, #21468B, transparent 65%)' }}
          />
          <div
            aria-hidden
            className="pointer-events-none absolute -bottom-52 -left-32 h-[30rem] w-[30rem] rounded-full opacity-20 blur-3xl"
            style={{ background: 'radial-gradient(circle, #AE1C28, transparent 65%)' }}
          />

          <div className="relative mx-auto grid w-full max-w-7xl gap-10 px-4 pb-14 pt-10 sm:px-6 lg:grid-cols-[1.02fr_1fr] lg:items-center lg:gap-14 lg:pb-24 lg:pt-16">
            <div className="max-w-xl">
              <span className="inline-flex items-center gap-2 rounded-full border border-[var(--line)] bg-[var(--surface-card)] px-3 py-1.5 text-xs font-semibold text-[var(--text-muted)]">
                <span className="flex h-4 w-6 overflow-hidden rounded-[2px]" aria-hidden>
                  <span className="h-1/3 w-full bg-[#AE1C28]" />
                  <span className="h-1/3 w-full bg-white" />
                  <span className="h-1/3 w-full bg-[#21468B]" />
                </span>
                Built in Rotterdam · Dutch tax ready for 2026
              </span>

              <h1 className="mt-5 font-display text-[2.35rem] font-extrabold leading-[1.05] tracking-tight sm:text-5xl lg:text-[3.4rem]">
                Your whole freelance business,{' '}
                <span className="flag-text">in one calm tab.</span>
              </h1>

              <p className="pretty mt-5 text-base leading-relaxed text-[var(--text-muted)] sm:text-lg">
                Quote it, plan it, track it, invoice it and keep the taxman happy. DRIPS bundles branded proposals,
                bookkeeping, an agile project board and a Dutch tax estimator into one fast workspace — so you spend
                your hours on client work, not admin.
              </p>

              <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:items-center">
                <Button variant="grad" size="lg" onClick={startFree} icon={Sparkles} className="w-full sm:w-auto">
                  Start free — 60 seconds
                </Button>
                <a
                  href="#how"
                  className="group inline-flex items-center justify-center gap-1.5 px-2 py-2 text-sm font-semibold text-[var(--text-muted)] underline-offset-4 hover:text-[var(--text)] hover:underline"
                >
                  See how it works
                  <ChevronDown className="h-4 w-4 transition-transform group-hover:translate-y-0.5" aria-hidden />
                </a>
              </div>

              <ul className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs font-medium text-[var(--text-muted)]">
                {['No credit card', 'Free plan forever', 'Cancel or export anytime', 'Your logo & colours'].map((t) => (
                  <li key={t} className="flex items-center gap-1.5">
                    <Check className="h-3.5 w-3.5 text-[var(--color-mint-500)]" aria-hidden />
                    {t}
                  </li>
                ))}
              </ul>

              <div className="mt-7 flex flex-wrap items-center gap-4 border-t border-[var(--line)] pt-5">
                <div className="flex -space-x-2" aria-hidden>
                  {[
                    { i: 'MB', c: '#AE1C28' },
                    { i: 'JD', c: '#21468B' },
                    { i: 'NA', c: '#0E7C66' },
                    { i: 'TW', c: '#B26A00' },
                  ].map((a) => (
                    <span
                      key={a.i}
                      className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-[var(--surface)] text-[0.62rem] font-bold text-white"
                      style={{ background: a.c }}
                    >
                      {a.i}
                    </span>
                  ))}
                </div>
                <p className="text-xs leading-snug text-[var(--text-muted)]">
                  <span className="flex items-center gap-1 font-bold text-[var(--text)]">
                    <Star className="h-3.5 w-3.5 fill-[#D9930B] text-[#D9930B]" aria-hidden /> 4,9/5
                  </span>
                  Loved by 1.200+ ZZP’ers, studios and small businesses across the Netherlands.
                </p>
              </div>
            </div>

            <div className="lg:pl-4">
              <AppMockup />
            </div>
          </div>

          {/* trust strip */}
          <div className="relative border-y border-[var(--line)] bg-[var(--surface-card)]">
            <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center justify-center gap-x-8 gap-y-3 px-4 py-4 text-xs font-semibold text-[var(--text-muted)] sm:px-6">
              <span className="uppercase tracking-[0.12em]">Built for</span>
              {['Designers', 'Developers', 'Consultants', 'Agencies', 'Trades & retail', 'Coaches'].map((t) => (
                <span key={t} className="flex items-center gap-1.5">
                  <BadgeCheck className="h-3.5 w-3.5 text-[var(--color-brand-600)]" aria-hidden />
                  {t}
                </span>
              ))}
            </div>
          </div>
        </section>

        {/* ---------------------------- value props --------------------------- */}
        <section id="benefits" className="mx-auto w-full max-w-7xl px-4 py-16 sm:px-6 lg:py-24">
          <div className="max-w-2xl">
            <p className="section-eyebrow">Why freelancers switch</p>
            <h2 className="mt-2 font-display text-3xl font-extrabold leading-tight tracking-tight sm:text-[2.5rem]">
              Three tools you already pay for, replaced by one calm workspace.
            </h2>
            <p className="pretty mt-3 text-[var(--text-muted)]">
              Most freelancers juggle a proposal template, a spreadsheet for the books and a separate board for the
              work. DRIPS connects them, so one number changes everywhere.
            </p>
          </div>

          <div className="mt-10 grid gap-4 md:grid-cols-3">
            {BENEFITS.map((b) => {
              const Icon = b.icon;
              return (
                <Card key={b.title} className="pad group relative overflow-hidden transition-shadow hover:shadow-[var(--shadow-pop)]">
                  <div aria-hidden className="absolute inset-x-0 top-0 h-1 flag-gradient opacity-0 transition-opacity group-hover:opacity-100" />
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[color-mix(in_srgb,var(--color-flag-700)_10%,transparent)] text-flag-700 dark:text-flag-300">
                    <Icon className="h-5 w-5" aria-hidden />
                  </span>
                  <h3 className="mt-4 text-lg font-bold">{b.title}</h3>
                  <p className="pretty mt-2 text-sm leading-relaxed text-[var(--text-muted)]">{b.text}</p>
                  <p className="mt-4 flex items-baseline gap-2 border-t border-[var(--line)] pt-3">
                    <span className="flag-text font-display text-xl font-extrabold">{b.stat}</span>
                    <span className="text-xs text-[var(--text-muted)]">{b.statLabel}</span>
                  </p>
                </Card>
              );
            })}
          </div>

          {/* bento: the eight modules */}
          <div id="tools" className="mt-4 grid scroll-mt-24 gap-4 lg:grid-cols-[1.15fr_1fr]">
            <Card className="pad relative overflow-hidden">
              <div aria-hidden className="absolute -right-16 -top-16 h-48 w-48 rounded-full bg-[color-mix(in_srgb,var(--color-brand-500)_10%,transparent)] blur-2xl" />
              <p className="section-eyebrow">One subscription, eight modules</p>
              <h3 className="mt-2 font-display text-2xl font-extrabold">The complete back office for a one-person business.</h3>
              <p className="pretty mt-2 max-w-lg text-sm text-[var(--text-muted)]">
                Every module reads the same clients, projects and rates — so a proposal becomes an invoice, tracked
                hours become revenue, and revenue becomes an honest tax reserve.
              </p>
              <ul className="mt-5 grid gap-2 sm:grid-cols-2">
                {[
                  'Proposal → invoice in one click',
                  'Time entries → billable invoice lines',
                  'Expenses → VAT reclaim per quarter',
                  'Sprint cards → client progress updates',
                  '30 currencies with automatic conversion',
                  'Dark mode, keyboard shortcuts, WCAG AA',
                ].map((t) => (
                  <li key={t} className="flex items-start gap-2 text-sm font-medium">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-[var(--color-mint-500)]" aria-hidden />
                    {t}
                  </li>
                ))}
              </ul>
              <Button variant="grad" className="mt-6" onClick={startFree} icon={ArrowRight}>
                Open the workspace
              </Button>
            </Card>

            <div className="grid gap-3 sm:grid-cols-2">
              {TOOLS.map((t) => {
                const Icon = t.icon;
                return (
                  <Card key={t.title} className="pad !rounded-2xl transition-transform hover:-translate-y-0.5">
                    <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[color-mix(in_srgb,var(--color-brand-600)_10%,transparent)] text-[var(--color-brand-600)]">
                      <Icon className="h-[18px] w-[18px]" aria-hidden />
                    </span>
                    <h4 className="mt-3 text-sm font-bold leading-tight">{t.title}</h4>
                    <p className="mt-1 text-xs leading-relaxed text-[var(--text-muted)]">{t.text}</p>
                  </Card>
                );
              })}
            </div>
          </div>
        </section>

        {/* ---------------------------- how it works -------------------------- */}
        <section id="how" className="scroll-mt-20 border-y border-[var(--line)] bg-[var(--surface-card)]">
          <div className="mx-auto w-full max-w-7xl px-4 py-16 sm:px-6 lg:py-20">
            <div className="max-w-2xl">
              <p className="section-eyebrow">How it works</p>
              <h2 className="mt-2 font-display text-3xl font-extrabold leading-tight tracking-tight sm:text-[2.5rem]">
                From blank tab to signed proposal in three steps.
              </h2>
            </div>

            <ol className="relative mt-10 grid gap-8 md:grid-cols-3 md:gap-6">
              <div aria-hidden className="absolute left-0 right-0 top-6 hidden h-px bg-[repeating-linear-gradient(90deg,var(--color-brand-300)_0_8px,transparent_8px_16px)] md:block" />
              {STEPS.map((s, i) => {
                const Icon = s.icon;
                return (
                  <li key={s.title} className="relative">
                    <div className="flex items-center gap-3">
                      <span className="relative z-10 flex h-12 w-12 items-center justify-center rounded-2xl border border-[var(--line)] bg-[var(--surface-card)] font-display text-lg font-extrabold text-[var(--color-brand-600)] shadow-[var(--shadow-card)]">
                        {i + 1}
                        <Icon className="absolute -bottom-1.5 -right-1.5 h-5 w-5 rounded-md bg-[var(--color-flag-700)] p-0.5 text-white" aria-hidden />
                      </span>
                      <h3 className="text-lg font-bold">{s.title}</h3>
                    </div>
                    <p className="pretty mt-3 text-sm leading-relaxed text-[var(--text-muted)]">{s.text}</p>
                  </li>
                );
              })}
            </ol>

            <div className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {[
                { icon: ImageIcon, title: 'Upload your logo', text: 'PNG, JPG, SVG or WebP — resized automatically for crisp PDFs.' },
                { icon: Building2Label, title: 'KvK & tax ID', text: 'Business registration number and BTW-number print on every document.' },
                { icon: Globe2, title: '30 currencies', text: 'Quote in USD, report in EUR, invoice in GBP — conversion included.' },
                { icon: Lock, title: 'Private by default', text: 'Share links only open the document you choose to publish.' },
              ].map((f) => {
                const Icon = f.icon;
                return (
                  <div key={f.title} className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4">
                    <Icon className="h-5 w-5 text-[var(--color-brand-600)]" aria-hidden />
                    <p className="mt-2.5 text-sm font-bold">{f.title}</p>
                    <p className="mt-1 text-xs leading-relaxed text-[var(--text-muted)]">{f.text}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* ------------------------------ about ------------------------------ */}
        <section id="about" className="mx-auto w-full max-w-7xl scroll-mt-24 px-4 py-16 sm:px-6 lg:py-24">
          <div className="grid gap-10 lg:grid-cols-[1fr_1.05fr] lg:items-center">
            <div>
              <p className="section-eyebrow">About DRIPS</p>
              <h2 className="mt-2 font-display text-3xl font-extrabold leading-tight tracking-tight sm:text-[2.5rem]">
                Started in Rotterdam, for the people who build the city’s small businesses.
              </h2>
              <p className="pretty mt-4 text-[var(--text-muted)]">
                DRIPS grew out of a shared frustration: brilliant freelancers losing Friday evenings to quotes,
                spreadsheets and tax anxiety. We took the Dutch flag’s red, white and blue as our palette and built the
                back office we wished we had — opinionated about the Netherlands, flexible for everyone else.
              </p>
              <dl className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
                {[
                  ['1.200+', 'freelancers & teams'],
                  ['€41M', 'invoiced through DRIPS'],
                  ['93%', 'of proposals answered'],
                  ['< 3 min', 'to send a quote'],
                ].map(([v, l]) => (
                  <div key={l}>
                    <dt className="sr-only">{l}</dt>
                    <dd className="flag-text font-display text-2xl font-extrabold">{v}</dd>
                    <dd className="mt-0.5 text-xs text-[var(--text-muted)]">{l}</dd>
                  </div>
                ))}
              </dl>
            </div>

            <Card className="pad relative overflow-hidden">
              <div aria-hidden className="absolute inset-x-0 top-0 h-1.5 flag-gradient" />
              <div className="grid gap-4 sm:grid-cols-2">
                {[
                  { icon: Gauge, title: 'Fast by design', text: 'Keyboard-first, instant search, zero loading spinners on the things you do ten times a day.' },
                  { icon: ShieldCheck, title: 'Accessible (WCAG AA)', text: 'Semantic landmarks, visible focus, full keyboard control of the board, and reduced-motion support.' },
                  { icon: Banknote, title: 'Money-aware', text: 'Multi-currency, VAT inclusive/exclusive entry, rounding rules and payment history per invoice.' },
                  { icon: Users, title: 'Human support', text: 'Real people in the Netherlands, replying in Dutch or English within one business day.' },
                ].map((f) => {
                  const Icon = f.icon;
                  return (
                    <div key={f.title} className="rounded-xl border border-[var(--line)] p-3.5">
                      <Icon className="h-5 w-5 text-[var(--color-flag-700)]" aria-hidden />
                      <p className="mt-2 text-sm font-bold">{f.title}</p>
                      <p className="mt-1 text-xs leading-relaxed text-[var(--text-muted)]">{f.text}</p>
                    </div>
                  );
                })}
              </div>
            </Card>
          </div>
        </section>

        {/* --------------------------- testimonials -------------------------- */}
        <section className="border-y border-[var(--line)] bg-[var(--surface-card)]">
          <div className="mx-auto w-full max-w-7xl px-4 py-16 sm:px-6 lg:py-20">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div className="max-w-xl">
                <p className="section-eyebrow">Social proof</p>
                <h2 className="mt-2 font-display text-3xl font-extrabold leading-tight tracking-tight sm:text-[2.5rem]">
                  Results our users report in their own words.
                </h2>
              </div>
              <div className="flex items-center gap-2">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star key={i} className="h-4 w-4 fill-[#D9930B] text-[#D9930B]" aria-hidden />
                ))}
                <span className="text-sm font-bold">4,9 / 5</span>
                <span className="text-xs text-[var(--text-muted)]">(412 reviews)</span>
              </div>
            </div>

            <div className="mt-9 grid gap-4 md:grid-cols-3">
              {TESTIMONIALS.map((t) => (
                <Card key={t.name} className="pad flex flex-col">
                  <Quote className="h-6 w-6 text-[color-mix(in_srgb,var(--color-brand-600)_35%,transparent)]" aria-hidden />
                  <blockquote className="pretty mt-3 flex-1 text-sm leading-relaxed">“{t.quote}”</blockquote>
                  <p className="mt-4 inline-flex w-fit items-center gap-1.5 rounded-lg bg-[color-mix(in_srgb,var(--color-mint-500)_12%,transparent)] px-2.5 py-1.5 text-xs font-bold text-[var(--color-mint-700)] dark:text-[#7fe0b6]">
                    <Check className="h-3.5 w-3.5" aria-hidden />
                    {t.result}
                  </p>
                  <figcaption className="mt-4 flex items-center gap-3 border-t border-[var(--line)] pt-4">
                    <span
                      aria-hidden
                      className="flex h-10 w-10 items-center justify-center rounded-full text-xs font-bold text-white"
                      style={{ background: t.color }}
                    >
                      {t.name
                        .split(' ')
                        .slice(0, 2)
                        .map((w) => w[0])
                        .join('')}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-bold">{t.name}</span>
                      <span className="block truncate text-xs text-[var(--text-muted)]">{t.role}</span>
                    </span>
                  </figcaption>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* ------------------------------ pricing ----------------------------- */}
        <section id="pricing" className="mx-auto w-full max-w-7xl scroll-mt-24 px-4 py-16 sm:px-6 lg:py-24">
          <div className="mx-auto max-w-2xl text-center">
            <p className="section-eyebrow">Pricing</p>
            <h2 className="mt-2 font-display text-3xl font-extrabold leading-tight tracking-tight sm:text-[2.5rem]">
              Free to start. Cheap to grow. Nothing to cancel.
            </h2>
            <p className="pretty mt-3 text-[var(--text-muted)]">
              Prices exclude VAT. Switch or export your data whenever you like.
            </p>
            <div className="mt-5 inline-flex items-center gap-1 rounded-xl border border-[var(--line)] bg-[color-mix(in_srgb,var(--text)_3%,transparent)] p-1">
              {[
                { label: 'Monthly', value: false },
                { label: 'Yearly · 2 months free', value: true },
              ].map((o) => (
                <button
                  key={o.label}
                  type="button"
                  onClick={() => setYearly(o.value)}
                  data-active={yearly === o.value}
                  className="tab-btn"
                  aria-pressed={yearly === o.value}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-10 grid gap-4 lg:grid-cols-3">
            {PLANS.map((p) => (
              <Card
                key={p.name}
                className={cx('pad relative flex flex-col', p.featured && 'border-[var(--color-flag-700)] shadow-[var(--shadow-pop)] lg:-mt-3 lg:mb-3')}
              >
                {p.featured && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-[var(--color-flag-700)] px-3 py-1 text-[0.65rem] font-bold uppercase tracking-wider text-white">
                    Most popular
                  </span>
                )}
                <h3 className="text-base font-bold">{p.name}</h3>
                <p className="mt-1 text-xs text-[var(--text-muted)]">{p.tagline}</p>
                <p className="mt-4 flex items-baseline gap-1.5">
                  <span className="font-display text-4xl font-extrabold tracking-tight">
                    {p.price === '€0'
                      ? '€0'
                      : yearly
                        ? `€${Math.round(Number(p.price.replace('€', '')) * 10)}`
                        : p.price}
                  </span>
                  <span className="text-sm text-[var(--text-muted)]">
                    {p.price === '€0' ? 'forever' : yearly ? 'per year' : p.period}
                  </span>
                </p>
                <ul className="mt-5 flex-1 space-y-2">
                  {p.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-[var(--color-mint-500)]" aria-hidden />
                      {f}
                    </li>
                  ))}
                </ul>
                <Button variant={p.featured ? 'grad' : 'outline'} className="mt-6 w-full" onClick={startFree}>
                  {p.cta}
                </Button>
              </Card>
            ))}
          </div>
          <p className="mt-5 text-center text-xs text-[var(--text-muted)]">
            <Minus className="mr-1 inline h-3 w-3" aria-hidden />
            All plans include the full tax estimator, exports and the agile board. Prices are indicative for this demo
            build.
          </p>
        </section>

        {/* -------------------------------- faq ------------------------------- */}
        <section id="faq" className="mx-auto w-full max-w-7xl scroll-mt-24 px-4 pb-16 sm:px-6 lg:pb-24">
          <div className="grid gap-8 lg:grid-cols-[0.85fr_1.15fr] lg:items-start">
            <div className="lg:sticky lg:top-24">
              <p className="section-eyebrow">FAQ</p>
              <h2 className="mt-2 font-display text-3xl font-extrabold leading-tight tracking-tight sm:text-[2.5rem]">
                Questions freelancers ask before switching.
              </h2>
              <p className="pretty mt-3 text-sm text-[var(--text-muted)]">
                Still unsure? Load the demo workspace — it contains a full quarter of a Rotterdam design studio, so you
                can poke at every module without typing a single number.
              </p>
              <Button variant="outline" className="mt-4" onClick={startFree} icon={ArrowRight}>
                Explore the demo workspace
              </Button>
            </div>
            <Accordion items={FAQS} />
          </div>
        </section>

        {/* ----------------------------- final CTA ---------------------------- */}
        <section className="px-4 pb-16 sm:px-6 lg:pb-24">
          <div className="relative mx-auto w-full max-w-7xl overflow-hidden rounded-3xl bg-[#0B1325] px-6 py-14 text-center sm:px-10 lg:py-20">
            <div aria-hidden className="absolute inset-0 opacity-90" style={{ background: 'radial-gradient(70% 100% at 50% 0%, rgba(33,70,139,.55), transparent 65%), radial-gradient(50% 80% at 15% 100%, rgba(174,28,40,.45), transparent 60%)' }} />
            <div aria-hidden className="absolute inset-x-0 top-0 h-1.5 flag-gradient" />
            <div className="relative mx-auto max-w-2xl">
              <Pill tone="green" className="!border-white/20 !bg-white/10 !text-white">
                <Sparkles className="h-3 w-3" aria-hidden /> Free plan · no credit card
              </Pill>
              <h2 className="mt-4 font-display text-3xl font-extrabold leading-tight tracking-tight text-white sm:text-[2.75rem]">
                Send your next quote from DRIPS.
              </h2>
              <p className="pretty mt-3 text-base leading-relaxed text-white/75">
                Set up your brand once, then quote, plan, track, invoice and reserve tax from a single workspace. Most
                people send their first branded proposal within ten minutes.
              </p>
              <div className="mt-7 flex flex-col items-center justify-center gap-3 sm:flex-row">
                <Button variant="grad" size="lg" onClick={startFree} icon={ArrowRight} className="w-full sm:w-auto">
                  Create my free workspace
                </Button>
                <a
                  href="#pricing"
                  className="inline-flex items-center gap-1.5 rounded-xl border border-white/25 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-white/10"
                >
                  Compare plans
                </a>
              </div>
              <p className="mt-5 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs font-medium text-white/60">
                {['Cancel anytime', 'Export your data as Excel, PDF or JSON', 'GDPR-aware, EU-first'].map((t) => (
                  <span key={t} className="flex items-center gap-1.5">
                    <ShieldCheck className="h-3.5 w-3.5" aria-hidden />
                    {t}
                  </span>
                ))}
              </p>
            </div>
          </div>
        </section>
        {/* ------------------------------- legal ------------------------------- */}
        <section aria-labelledby="legal-heading" className="border-t border-[var(--line)] bg-[var(--surface-card)]">
          <div className="mx-auto w-full max-w-7xl px-4 py-14 sm:px-6">
            <h2 id="legal-heading" className="font-display text-2xl font-extrabold tracking-tight sm:text-3xl">
              The small print, in plain language
            </h2>
            <p className="pretty mt-2 max-w-2xl text-sm text-[var(--text-muted)]">
              No 40-page scroll. This is the whole of it — if a line ever changes, we say so in the app before it takes
              effect.
            </p>

            <div className="mt-8 grid gap-6 lg:grid-cols-2">
              <article id="privacy" className="scroll-mt-24 rounded-2xl border border-[var(--line)] bg-[var(--canvas)] p-5 sm:p-6">
                <h3 className="flex items-center gap-2 text-base font-bold">
                  <ShieldCheck className="h-4 w-4 text-[var(--color-brand-600)]" aria-hidden />
                  Privacy policy
                </h3>
                <ul className="mt-3 space-y-2.5 text-sm leading-relaxed text-[var(--text-muted)]">
                  {[
                    ['What we store', 'Your workspace: business details, clients, proposals, invoices, expenses, time entries, projects and goals. Uploaded logos are stored as compressed images inside your own workspace record.'],
                    ['What we never do', 'We do not sell your data, we do not train models on it, and we load no third-party trackers, ad pixels or analytics scripts on any page.'],
                    ['Who can see it', 'Only you, through your private workspace token. A shared proposal link exposes exactly one document — nothing else in your workspace.'],
                    ['Your rights (GDPR)', 'Export everything as JSON, Excel or PDF at any time from Settings → Data & backup, and delete your workspace there too. Deletion removes the records from the server store immediately.'],
                    ['Contact', 'Privacy questions: hello@drips.nl, or DRIPS B.V., Schiedamse Vest 152, 3011 BH Rotterdam.'],
                  ].map(([k, v]) => (
                    <li key={k}>
                      <strong className="font-semibold text-[var(--text)]">{k}.</strong> {v}
                    </li>
                  ))}
                </ul>
              </article>

              <article id="terms" className="scroll-mt-24 rounded-2xl border border-[var(--line)] bg-[var(--canvas)] p-5 sm:p-6">
                <h3 className="flex items-center gap-2 text-base font-bold">
                  <FileCheck2 className="h-4 w-4 text-[var(--color-flag-700)]" aria-hidden />
                  Terms of service
                </h3>
                <ul className="mt-3 space-y-2.5 text-sm leading-relaxed text-[var(--text-muted)]">
                  {[
                    ['The free plan is free', 'Unlimited proposals, invoices, expenses, time entries, cards and one workspace. No credit card, no trial countdown.'],
                    ['Paid plans', 'Billed monthly or yearly in euro. Cancel anytime from Settings — you keep full access until the end of the period you paid for, and your data stays exportable afterwards.'],
                    ['Your content stays yours', 'You keep every right to your documents and client data. We only process it to run the service for you.'],
                    ['Estimates, not advice', 'Tax figures are calculated from the parameters published for the selected year and profile. They are planning estimates — your accountant or the Belastingdienst has the final word.'],
                    ['Acceptable use', 'One workspace per business, no unlawful invoices or spam, and no attempt to access other workspaces. We may suspend a workspace that abuses the service, with notice where possible.'],
                    ['Availability & liability', 'We aim for a reliable service but provide it “as is”. Our liability is limited to the fees you paid in the preceding three months.'],
                  ].map(([k, v]) => (
                    <li key={k}>
                      <strong className="font-semibold text-[var(--text)]">{k}.</strong> {v}
                    </li>
                  ))}
                </ul>
              </article>
            </div>
          </div>
        </section>
      </main>

      {/* ------------------------------- footer ------------------------------ */}
      <footer className="border-t border-[var(--line)] bg-[var(--surface-card)]">
        <div className="mx-auto grid w-full max-w-7xl gap-8 px-4 py-12 sm:px-6 lg:grid-cols-[1.4fr_1fr_1fr_1fr]">
          <div>
            <Link to="/" className="flex items-center gap-2.5" aria-label="DRIPS home">
              <LogoMark size={30} />
              <span className="font-display text-[1.05rem] font-extrabold tracking-tight">DRIPS</span>
            </Link>
            <p className="pretty mt-3 max-w-xs text-sm text-[var(--text-muted)]">
              The all-in-one back office for freelancers and small businesses — proposals, books, tax, projects, time,
              clients and goals.
            </p>
            <div className="mt-4 flex items-center gap-2">
              {SOCIALS.map((s) => (
                <a
                  key={s.label}
                  href={s.href}
                  target="_blank"
                  rel="noreferrer noopener"
                  aria-label={s.label}
                  className="flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--line)] text-[var(--text-muted)] transition-colors hover:border-[var(--color-brand-300)] hover:text-[var(--color-brand-600)]"
                >
                  <s.icon className="h-4 w-4" aria-hidden />
                </a>
              ))}
            </div>
          </div>

          {[
            { title: 'Product', links: [['Dashboard', '/app'], ['Proposals & quotes', '/app/proposals'], ['Tax & expenses', '/app/tax'], ['Invoices & books', '/app/invoices'], ['Project board', '/app/board']] },
            { title: 'Resources', links: [['How it works', '#how'], ['Pricing', '#pricing'], ['FAQ', '#faq'], ['Demo workspace', '/app/settings']] },
            { title: 'Company', links: [['About', '#about'], ['Privacy policy', '#privacy'], ['Terms of service', '#terms'], ['Contact', 'mailto:hello@drips.nl']] },
          ].map((col) => (
            <nav key={col.title} aria-label={col.title}>
              <h3 className="text-xs font-bold uppercase tracking-[0.12em] text-[var(--text-muted)]">{col.title}</h3>
              <ul className="mt-3 space-y-2">
                {col.links.map(([label, href]) => (
                  <li key={label}>
                    {href.startsWith('#') || href.startsWith('mailto') ? (
                      <a href={href} className="text-sm text-[var(--text-muted)] transition-colors hover:text-[var(--color-brand-600)]">
                        {label}
                      </a>
                    ) : (
                      <Link to={href} className="text-sm text-[var(--text-muted)] transition-colors hover:text-[var(--color-brand-600)]">
                        {label}
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        <div className="border-t border-[var(--line)]">
          <div className="mx-auto flex w-full max-w-7xl flex-col items-center justify-between gap-3 px-4 py-5 text-xs text-[var(--text-muted)] sm:flex-row sm:px-6">
            <p>© {new Date().getFullYear()} DRIPS B.V. · Schiedamse Vest 152, 3011 BH Rotterdam · KvK 8742 1930</p>
            <p className="flex items-center gap-3">
              <a href="#privacy" className="hover:text-[var(--color-brand-600)]">
                Privacy
              </a>
              <a href="#terms" className="hover:text-[var(--color-brand-600)]">
                Terms
              </a>
              <span className="flex items-center gap-1.5 font-semibold">
                Made in Rotterdam
                <span className="flex h-3 w-5 overflow-hidden rounded-[2px]" aria-hidden>
                  <span className="h-1/3 w-full bg-[#AE1C28]" />
                  <span className="h-1/3 w-full bg-white" />
                  <span className="h-1/3 w-full bg-[#21468B]" />
                </span>
              </span>
            </p>
          </div>
        </div>
      </footer>

      {/* sticky mobile conversion bar */}
      {scrolled && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-[var(--line)] bg-[color-mix(in_srgb,var(--surface-card)_96%,transparent)] px-4 py-3 backdrop-blur-md sm:hidden">
          <div className="flex items-center gap-3">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold">Free workspace, 60 seconds</p>
              <p className="truncate text-[0.7rem] text-[var(--text-muted)]">No credit card · cancel anytime</p>
            </div>
            <Button variant="primary" size="sm" onClick={startFree}>
              Start free
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

/* small local icon alias so the feature grid stays readable */
function Building2Label(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="1em" height="1em" {...props}>
      <rect x="4" y="3" width="16" height="18" rx="2" />
      <path d="M9 8h2M13 8h2M9 12h2M13 12h2M9 16h6" />
    </svg>
  );
}
