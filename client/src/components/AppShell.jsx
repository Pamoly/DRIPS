import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Calculator,
  FileText,
  Kanban,
  LayoutDashboard,
  Plus,
  Receipt,
  Search,
  Settings,
  Target,
  Timer,
  Users,
} from 'lucide-react';
import { useApp } from '../lib/store';
import { cx } from '../lib/format';
import { LogoMark } from './Brand';
import { CommandPalette } from './CommandPalette';
import { CurrencyPicker } from './CurrencyPicker';
import { NotificationsBell } from './NotificationsBell';

export const NAV = [
  { to: '/app', label: 'Dashboard', icon: LayoutDashboard, emoji: '📊', end: true },
  { to: '/app/proposals', label: 'Proposals & Quotes', icon: FileText, emoji: '📄' },
  { to: '/app/tax', label: 'Tax & Expenses', icon: Calculator, emoji: '🧮' },
  { to: '/app/invoices', label: 'Invoices & Books', icon: Receipt, emoji: '💰' },
  { to: '/app/board', label: 'Project Board', icon: Kanban, emoji: '📋' },
  { to: '/app/time', label: 'Time Tracker', icon: Timer, emoji: '⏱️' },
  { to: '/app/clients', label: 'CRM & Clients', icon: Users, emoji: '👥' },
  { to: '/app/goals', label: 'Goals & Targets', icon: Target, emoji: '🎯' },
  { to: '/app/settings', label: 'Settings', icon: Settings, emoji: '⚙️' },
];

export default function AppShell({ children }) {
  const { status, startWorkspace, settings, theme, toggleTheme } = useApp();
  const navigate = useNavigate();
  const [mobileNav, setMobileNav] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const mainRef = useRef(null);

  useEffect(() => {
    if (status === 'idle' || status === 'error') startWorkspace();
  }, [status, startWorkspace]);

  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPaletteOpen((o) => !o);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    setMobileNav(false);
  }, [location.pathname]);

  const business = settings?.business || {};
  const navList = NAV.slice(0, 8);

  const sidebar = (
    <div className={cx('flex h-full flex-col', collapsed && 'items-center')}>
      <div className={cx('flex items-center gap-2.5 px-4 py-4', collapsed && 'justify-center px-2')}>
        <LogoMark size={30} />
        {!collapsed && (
          <span className="min-w-0">
            <span className="block font-display text-[1.02rem] font-extrabold leading-none tracking-tight">DRIPS</span>
            <span className="mt-1 block truncate text-[0.68rem] text-[var(--text-muted)]">
              {business.name || 'Your workspace'}
            </span>
          </span>
        )}
      </div>
      <nav aria-label="Main" className="flex-1 space-y-0.5 overflow-y-auto px-2.5 pb-3">
        {navList.map((item) => (
          <NavLink key={item.to} item={item} collapsed={collapsed} />
        ))}
        <div className="my-2 divider" />
        <NavLink item={NAV[8]} collapsed={collapsed} />
      </nav>
      {!collapsed && (
        <div className="mx-2.5 mb-3 rounded-xl border border-[var(--line)] bg-[color-mix(in_srgb,var(--color-brand-500)_7%,transparent)] p-3">
          <p className="text-[0.7rem] font-bold uppercase tracking-wider text-[var(--color-brand-600)]">Pro tip</p>
          <p className="mt-1 text-xs leading-relaxed text-[var(--text-muted)]">
            Press <span className="kbd">Ctrl</span> + <span className="kbd">K</span> to search clients, invoices and cards — or jump to any tool.
          </p>
        </div>
      )}
      <button
        type="button"
        onClick={() => setCollapsed((c) => !c)}
        className="hidden items-center justify-center gap-2 border-t border-[var(--line)] py-2.5 text-xs font-semibold text-[var(--text-muted)] hover:text-[var(--text)] lg:flex"
        aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      >
        {collapsed ? '»' : '« Collapse'}
      </button>
    </div>
  );

  if (status === 'loading' || status === 'idle') {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4">
        <LogoMark size={52} className="animate-pulse" />
        <p className="text-sm font-medium text-[var(--text-muted)]">Preparing your workspace…</p>
        <div className="h-1 w-40 overflow-hidden rounded-full bg-[var(--line)]">
          <div className="flag-gradient h-full w-1/2 animate-[shimmer_1.2s_linear_infinite]" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen lg:flex">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[100] focus:rounded-lg focus:bg-[var(--surface-card)] focus:px-4 focus:py-2 focus:text-sm focus:font-semibold">
        Skip to content
      </a>

      {/* desktop sidebar */}
      <aside
        className={cx(
          'sticky top-0 z-30 hidden h-screen shrink-0 border-r border-[var(--line)] bg-[var(--surface-card)] lg:block',
          collapsed ? 'w-[4.6rem]' : 'w-[16rem]',
        )}
      >
        {sidebar}
      </aside>

      {/* mobile drawer */}
      {mobileNav && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label="Close navigation"
            className="absolute inset-0 bg-[rgb(7_13_26/0.55)] backdrop-blur-[2px]"
            onClick={() => setMobileNav(false)}
          />
          <div className="absolute inset-y-0 left-0 w-[16.5rem] border-r border-[var(--line)] bg-[var(--surface-card)] shadow-[var(--shadow-pop)]" style={{ animation: 'var(--animate-fade-up)' }}>
            {sidebar}
          </div>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 border-b border-[var(--line)] bg-[color-mix(in_srgb,var(--surface-card)_88%,transparent)] backdrop-blur-md">
          <div className="flex items-center gap-2 px-3 py-2.5 sm:px-5">
            <button
              type="button"
              className="btn btn-ghost btn-icon lg:hidden"
              aria-label="Open navigation"
              aria-expanded={mobileNav}
              onClick={() => setMobileNav(true)}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
                <path d="M3 6h18M3 12h18M3 18h18" />
              </svg>
            </button>

            <button
              type="button"
              onClick={() => setPaletteOpen(true)}
              className="group flex min-w-0 flex-1 items-center gap-2 rounded-xl border border-[var(--line)] bg-[color-mix(in_srgb,var(--text)_2%,transparent)] px-3 py-2 text-left text-sm text-[var(--text-muted)] transition-colors hover:border-[var(--color-brand-300)] sm:max-w-md"
              aria-label="Search everything (Ctrl K)"
            >
              <Search className="h-4 w-4 shrink-0" aria-hidden />
              <span className="truncate">Search clients, invoices, cards…</span>
              <span className="ml-auto hidden shrink-0 items-center gap-1 sm:flex">
                <span className="kbd">Ctrl</span>
                <span className="kbd">K</span>
              </span>
            </button>

            <div className="ml-auto flex items-center gap-1.5">
              <CurrencyPicker />
              <NotificationsBell />
              <button
                type="button"
                className="btn btn-ghost btn-icon"
                onClick={toggleTheme}
                aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
                title={theme === 'dark' ? 'Light theme' : 'Dark theme'}
              >
                {theme === 'dark' ? (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
                    <circle cx="12" cy="12" r="4" />
                    <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
                  </svg>
                ) : (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
                  </svg>
                )}
              </button>
              <button type="button" className="btn btn-primary btn-sm hidden sm:inline-flex" icon={Plus} onClick={() => navigate('/app/proposals/new')}>
                New proposal
              </button>
            </div>
          </div>
          <div aria-hidden className="flag-bar w-full opacity-70" />
        </header>

        <main id="main" ref={mainRef} className="flex-1 px-3 pb-24 pt-4 sm:px-5 lg:pb-10 lg:pt-6">
          <div className="mx-auto w-full max-w-[1400px]">{children}</div>
        </main>

        <footer className="hidden border-t border-[var(--line)] px-5 py-4 text-xs text-[var(--text-muted)] lg:block">
          <div className="mx-auto flex w-full max-w-[1400px] flex-wrap items-center justify-between gap-2">
            <p>
              DRIPS · Built in Rotterdam 🇳🇱 · {business.name ? `${business.name} · ` : ''}
              {business.regNumber ? `KvK ${business.regNumber}` : 'Add your KvK number in Settings'}
            </p>
            <p className="flex items-center gap-3">
              <Link to="/app/settings" className="hover:underline">
                Settings
              </Link>
              <Link to="/" className="hover:underline">
                About DRIPS
              </Link>
            </p>
          </div>
        </footer>
      </div>

      {/* mobile bottom nav */}
      <nav aria-label="Quick tools" className="fixed inset-x-0 bottom-0 z-40 border-t border-[var(--line)] bg-[color-mix(in_srgb,var(--surface-card)_96%,transparent)] backdrop-blur-md lg:hidden">
        <ul className="flex items-stretch justify-between px-1 pb-[env(safe-area-inset-bottom)]">
          {[NAV[0], NAV[1], NAV[4], NAV[3], NAV[8]].map((item) => (
            <li key={item.to} className="flex-1">
              <MobileNavLink item={item} />
            </li>
          ))}
        </ul>
      </nav>

      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
    </div>
  );
}

function NavLink({ item, collapsed }) {
  const Icon = item.icon;
  return (
    <Link
      to={item.to}
      end={item.end}
      title={collapsed ? item.label : undefined}
      className={({ isActive }) =>
        cx(
          'group relative flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors',
          collapsed && 'justify-center px-0',
          isActive
            ? 'bg-[color-mix(in_srgb,var(--color-flag-700)_10%,transparent)] text-[var(--color-flag-700)] dark:text-[var(--color-flag-300)]'
            : 'text-[var(--text-muted)] hover:bg-[color-mix(in_srgb,var(--text)_5%,transparent)] hover:text-[var(--text)]',
        )
      }
    >
      {({ isActive }) => (
        <>
          {isActive && <span aria-hidden className="absolute inset-y-1.5 left-0 w-[3px] rounded-full bg-[var(--color-flag-700)]" />}
          <Icon className="h-[18px] w-[18px] shrink-0" aria-hidden />
          {!collapsed && <span className="truncate">{item.label}</span>}
        </>
      )}
    </Link>
  );
}

function MobileNavLink({ item }) {
  const Icon = item.icon;
  return (
    <Link
      to={item.to}
      end={item.end}
      className={({ isActive }) =>
        cx(
          'flex flex-col items-center gap-0.5 px-1 py-2 text-[0.62rem] font-bold',
          isActive ? 'text-[var(--color-flag-700)] dark:text-[var(--color-flag-300)]' : 'text-[var(--text-muted)]',
        )
      }
    >
      <Icon className="h-[19px] w-[19px]" aria-hidden />
      <span className="max-w-[4.5rem] truncate">{item.label.split(' ')[0]}</span>
    </Link>
  );
}

export function useQuickCreate() {
  const navigate = useNavigate();
  const app = useApp();
  return useMemo(
    () => [
      { label: 'New proposal', icon: FileText, run: () => navigate('/app/proposals/new') },
      { label: 'New invoice', icon: Receipt, run: () => navigate('/app/invoices?new=1') },
      { label: 'New expense', icon: Calculator, run: () => navigate('/app/tax?new=1') },
      { label: 'New client', icon: Users, run: () => navigate('/app/clients?new=1') },
      { label: 'New card', icon: Kanban, run: () => navigate('/app/board?new=1') },
      { label: 'Start timer', icon: Timer, run: () => navigate('/app/time') },
      { label: 'New goal', icon: Target, run: () => navigate('/app/goals?new=1') },
      { label: 'Workspace settings', icon: Settings, run: () => navigate('/app/settings') },
      { label: 'Dashboard', icon: LayoutDashboard, run: () => navigate('/app') },
    ],
    [navigate, app],
  );
}
