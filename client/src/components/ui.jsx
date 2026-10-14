import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown, Loader2, Search, X } from 'lucide-react';
import { cx, parseNum, round2, uid as mkId } from '../lib/format';
import { useApp } from '../lib/store';

/* --------------------------------- buttons -------------------------------- */

export function Button({ as: As = 'button', variant = 'outline', size = 'md', icon: Icon, children, className, loading, ...props }) {
  const sizes = { sm: 'btn-sm', md: '', lg: 'btn-lg' };
  return (
    <As
      className={cx('btn', variant !== 'default' && `btn-${variant}`, sizes[size], className)}
      disabled={loading || props.disabled}
      {...props}
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : Icon ? <Icon className={size === 'sm' ? 'h-3.5 w-3.5' : 'h-4 w-4'} aria-hidden /> : null}
      {children}
    </As>
  );
}

export function IconButton({ icon: Icon, label, className, size = 'md', ...props }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={cx('btn btn-ghost btn-icon', size === 'sm' && 'btn-sm', className)}
      {...props}
    >
      <Icon className={size === 'sm' ? 'h-4 w-4' : 'h-[18px] w-[18px]'} aria-hidden />
    </button>
  );
}

/* ---------------------------------- layout -------------------------------- */

export function Card({ className, children, as: As = 'div', ...props }) {
  return (
    <As className={cx('card', className)} {...props}>
      {children}
    </As>
  );
}

export function PageHeader({ eyebrow, title, subtitle, actions, children, icon: Icon }) {
  return (
    <header className="mb-5 flex flex-col gap-3 md:mb-7 md:flex-row md:items-end md:justify-between">
      <div className="min-w-0">
        {eyebrow && <p className="section-eyebrow mb-1.5">{eyebrow}</p>}
        <h1 className="flex items-center gap-2.5 text-xl font-bold md:text-[1.65rem]">
          {Icon && (
            <span className="flag-gradient hidden h-9 w-9 shrink-0 items-center justify-center rounded-xl text-white md:flex">
              <Icon className="h-[18px] w-[18px]" aria-hidden />
            </span>
          )}
          <span className="min-w-0">{title}</span>
        </h1>
        {subtitle && <p className="pretty mt-1.5 max-w-2xl text-sm text-[var(--text-muted)]">{subtitle}</p>}
        {children}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

export function SectionTitle({ children, action, className }) {
  return (
    <div className={cx('mb-3 flex items-center justify-between gap-3', className)}>
      <h2 className="text-sm font-bold uppercase tracking-wide text-[var(--text-muted)]">{children}</h2>
      {action}
    </div>
  );
}

export function Grid({ cols = 2, className, children }) {
  const map = { 2: 'md:grid-cols-2', 3: 'md:grid-cols-2 xl:grid-cols-3', 4: 'md:grid-cols-2 xl:grid-cols-4' };
  return <div className={cx('grid grid-cols-1 gap-4', map[cols], className)}>{children}</div>;
}

/* ---------------------------------- fields -------------------------------- */

export function Field({ label, hint, error, required, className, children, htmlFor }) {
  const id = useId();
  return (
    <div className={cx('min-w-0', className)}>
      {label && (
        <label className="label" htmlFor={htmlFor || id}>
          {label}
          {required && <span className="text-flag-700"> *</span>}
        </label>
      )}
      {typeof children === 'function' ? children(id) : children}
      {error ? (
        <p className="mt-1 text-xs font-medium text-flag-700" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p className="hint">{hint}</p>
      ) : null}
    </div>
  );
}

export function Input({ className, invalid, ...props }) {
  return <input className={cx('input', invalid && 'field-error', className)} aria-invalid={invalid || undefined} {...props} />;
}

export function Textarea({ className, ...props }) {
  return <textarea className={cx('textarea', className)} {...props} />;
}

export function Select({ className, children, ...props }) {
  return (
    <select className={cx('select', className)} {...props}>
      {children}
    </select>
  );
}

export function MoneyInput({ value, onChange, currency = 'EUR', locale = 'nl-NL', className, step = '0.01', min = 0, ...props }) {
  const [text, setText] = useState(String(value ?? ''));
  useEffect(() => {
    if (parseNum(text) !== round2(value)) setText(value === '' || value === null || value === undefined ? '' : String(value));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, currency]);
  return (
    <div className={cx('relative', className)}>
      <input
        className="input tnum pr-12"
        inputMode="decimal"
        step={step}
        min={min}
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          onChange?.(parseNum(e.target.value));
        }}
        onBlur={() => setText(text === '' ? '' : String(round2(parseNum(text))))}
        {...props}
      />
      <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-xs font-semibold text-[var(--text-muted)]">
        {currency}
      </span>
      <span className="sr-only">{`Amount in ${currency} (${locale})`}</span>
    </div>
  );
}

export function Toggle({ checked, onChange, label, description, disabled }) {
  const id = useId();
  return (
    <div className="flex items-start gap-3">
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={!!checked}
        aria-label={label}
        disabled={disabled}
        className="switch mt-0.5"
        data-on={!!checked}
        onClick={() => onChange?.(!checked)}
      />
      <label htmlFor={id} className="cursor-pointer text-sm leading-tight">
        <span className="font-semibold">{label}</span>
        {description && <span className="mt-0.5 block text-xs text-[var(--text-muted)]">{description}</span>}
      </label>
    </div>
  );
}

export function Checkbox({ checked, onChange, label, className, ...props }) {
  return (
    <label className={cx('flex cursor-pointer items-center gap-2 text-sm', className)}>
      <input
        type="checkbox"
        className="h-4 w-4 rounded border-[var(--line)] accent-[#AE1C28]"
        checked={!!checked}
        onChange={(e) => onChange?.(e.target.checked)}
        {...props}
      />
      {label && <span>{label}</span>}
    </label>
  );
}

export function Segmented({ options, value, onChange, size = 'md', className, ariaLabel }) {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={cx('inline-flex items-center gap-1 rounded-xl border border-[var(--line)] bg-[color-mix(in_srgb,var(--text)_3%,transparent)] p-1', className)}
    >
      {options.map((o) => {
        const key = o.value ?? o;
        const label = o.label ?? o;
        const active = key === value;
        return (
          <button
            key={String(key)}
            role="tab"
            type="button"
            aria-selected={active}
            tabIndex={active ? 0 : -1}
            onClick={() => onChange?.(key)}
            className={cx('tab-btn', size === 'sm' && 'px-2.5 py-1 text-xs')}
            data-active={active}
          >
            {o.icon && <o.icon className="mr-1.5 inline h-3.5 w-3.5" aria-hidden />}
            {label}
          </button>
        );
      })}
    </div>
  );
}

/* --------------------------------- display -------------------------------- */

export function Pill({ tone = 'neutral', children, className, icon: Icon }) {
  const tones = {
    neutral: 'chip',
    red: 'chip chip-red',
    blue: 'chip chip-blue',
    green: 'chip chip-green',
    amber: 'chip chip-amber',
  };
  return (
    <span className={cx(tones[tone] || tones.neutral, className)}>
      {Icon && <Icon className="h-3 w-3" aria-hidden />}
      {children}
    </span>
  );
}

const STATUS_TONES = {
  draft: 'neutral',
  sent: 'blue',
  viewed: 'blue',
  accepted: 'green',
  invoiced: 'green',
  declined: 'red',
  expired: 'amber',
  paid: 'green',
  'partly-paid': 'amber',
  overdue: 'red',
  void: 'neutral',
  active: 'green',
  lead: 'amber',
  prospect: 'blue',
  past: 'neutral',
  planned: 'blue',
  completed: 'green',
  'on-track': 'green',
  'at-risk': 'amber',
  behind: 'red',
  blocked: 'red',
};

export function StatusPill({ status, className }) {
  const label = String(status || 'draft').replace('-', ' ');
  return (
    <Pill tone={STATUS_TONES[status] || 'neutral'} className={cx('capitalize', className)}>
      {label}
    </Pill>
  );
}

export function Progress({ value, max = 100, tone = 'brand', className, label, showValue = true }) {
  const p = max ? Math.min(100, Math.max(0, (value / max) * 100)) : 0;
  const colors = { brand: 'var(--color-brand-600)', flag: 'var(--color-flag-700)', mint: 'var(--color-mint-500)', amber: 'var(--color-amber-brand-500)' };
  return (
    <div className={className}>
      {(label || showValue) && (
        <div className="mb-1 flex items-baseline justify-between text-xs">
          {label && <span className="font-medium text-[var(--text-muted)]">{label}</span>}
          {showValue && <span className="tnum font-semibold">{Math.round(p)}%</span>}
        </div>
      )}
      <div
        className="h-2 w-full overflow-hidden rounded-full bg-[color-mix(in_srgb,var(--text)_10%,transparent)]"
        role="progressbar"
        aria-valuenow={Math.round(p)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label || 'progress'}
      >
        <div className="h-full rounded-full transition-[width] duration-500" style={{ width: `${p}%`, background: colors[tone] || colors.brand }} />
      </div>
    </div>
  );
}

export function Avatar({ name, src, size = 36, color, className }) {
  const initials = String(name || '?')
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() || '')
    .join('');
  return src ? (
    <img src={src} alt={name || ''} width={size} height={size} className={cx('shrink-0 rounded-full object-cover', className)} style={{ width: size, height: size }} />
  ) : (
    <span
      aria-hidden
      className={cx('flex shrink-0 items-center justify-center rounded-full font-bold text-white', className)}
      style={{ width: size, height: size, background: color || 'var(--color-brand-600)', fontSize: size * 0.36 }}
    >
      {initials}
    </span>
  );
}

export function KPI({ label, value, delta, icon: Icon, tone = 'brand', hint, children }) {
  const tones = {
    brand: 'var(--color-brand-600)',
    flag: 'var(--color-flag-700)',
    mint: 'var(--color-mint-500)',
    amber: 'var(--color-amber-brand-500)',
  };
  return (
    <Card className="pad relative overflow-hidden">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[0.7rem] font-bold uppercase tracking-[0.08em] text-[var(--text-muted)]">{label}</p>
          <p className="kpi-value mt-1.5 truncate">{value}</p>
          {hint && <p className="mt-1 text-xs text-[var(--text-muted)]">{hint}</p>}
          {delta !== undefined && delta !== null && (
            <p className={cx('mt-1.5 inline-flex items-center gap-1 text-xs font-semibold', delta >= 0 ? 'text-[var(--color-mint-500)]' : 'text-flag-700')}>
              {delta >= 0 ? '▲' : '▼'} {Math.abs(round2(delta))}% <span className="font-normal text-[var(--text-muted)]">vs last period</span>
            </p>
          )}
        </div>
        {Icon && (
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl" style={{ background: `color-mix(in srgb, ${tones[tone]} 12%, transparent)`, color: tones[tone] }}>
            <Icon className="h-5 w-5" aria-hidden />
          </span>
        )}
      </div>
      {children}
    </Card>
  );
}

export function EmptyState({ icon: Icon, title, description, action, className }) {
  return (
    <div className={cx('flex flex-col items-center justify-center rounded-xl border border-dashed border-[var(--line)] px-6 py-12 text-center', className)}>
      {Icon && (
        <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-[color-mix(in_srgb,var(--color-brand-500)_10%,transparent)] text-[var(--color-brand-600)]">
          <Icon className="h-6 w-6" aria-hidden />
        </span>
      )}
      <h3 className="text-base font-bold">{title}</h3>
      {description && <p className="pretty mt-1 max-w-md text-sm text-[var(--text-muted)]">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Skeleton({ className }) {
  return <div className={cx('skel', className)} aria-hidden />;
}

/* ---------------------------------- modal --------------------------------- */

export function Modal({ open, onClose, title, description, children, footer, size = 'md', initialFocus }) {
  const ref = useRef(null);
  const titleId = useId();

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose?.();
        return;
      }
      if (e.key === 'Tab' && ref.current) {
        const nodes = ref.current.querySelectorAll('a[href],button:not([disabled]),textarea,input,select,[tabindex]:not([tabindex="-1"])');
        if (!nodes.length) return;
        const first = initialFocus ? ref.current.querySelector(initialFocus) || nodes[0] : nodes[0];
        const last = nodes[nodes.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const t = setTimeout(() => {
      const el = initialFocus ? ref.current?.querySelector(initialFocus) : ref.current?.querySelector('input,textarea,select,button');
      el?.focus();
    }, 40);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
      clearTimeout(t);
    };
  }, [open, onClose, initialFocus]);

  if (!open) return null;
  const widths = { sm: 'sm:max-w-md', md: 'sm:max-w-xl', lg: 'sm:max-w-3xl', xl: 'sm:max-w-5xl' };

  return createPortal(
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose?.()}>
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={cx('modal-panel', widths[size])}
      >
        <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-[var(--line)] bg-[var(--surface-card)] px-5 py-4">
          <div>
            <h2 id={titleId} className="text-base font-bold">
              {title}
            </h2>
            {description && <p className="mt-0.5 text-xs text-[var(--text-muted)]">{description}</p>}
          </div>
          <IconButton icon={X} label="Close dialog" onClick={onClose} size="sm" />
        </div>
        <div className="px-5 py-4">{children}</div>
        {footer && <div className="sticky bottom-0 flex flex-wrap items-center justify-end gap-2 border-t border-[var(--line)] bg-[var(--surface-card)] px-5 py-3.5">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}

export function ConfirmDialog({ open, onClose, onConfirm, title = 'Are you sure?', message, confirmLabel = 'Delete', tone = 'danger' }) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant={tone === 'danger' ? 'danger' : 'primary'}
            onClick={() => {
              onConfirm?.();
              onClose?.();
            }}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      <p className="text-sm text-[var(--text-muted)]">{message}</p>
    </Modal>
  );
}

/* ---------------------------------- drawer -------------------------------- */

export function Drawer({ open, onClose, title, children, footer, width = 'max-w-lg' }) {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => e.key === 'Escape' && onClose?.();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  if (!open) return null;
  return createPortal(
    <div className="fixed inset-0 z-[55] flex justify-end bg-[rgb(7_13_26/0.5)] backdrop-blur-[2px]" onMouseDown={(e) => e.target === e.currentTarget && onClose?.()}>
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cx('flex h-full w-full flex-col border-l border-[var(--line)] bg-[var(--surface-card)] shadow-[var(--shadow-pop)]', width)}
        style={{ animation: 'var(--animate-fade-up)' }}
      >
        <header className="flex items-center justify-between gap-3 border-b border-[var(--line)] px-5 py-4">
          <h2 className="truncate text-base font-bold">{title}</h2>
          <IconButton icon={X} label="Close panel" onClick={onClose} size="sm" />
        </header>
        <div className="flex-1 overflow-auto px-5 py-4">{children}</div>
        {footer && <footer className="border-t border-[var(--line)] px-5 py-3.5">{footer}</footer>}
      </aside>
    </div>,
    document.body,
  );
}

/* ---------------------------------- misc ---------------------------------- */

export function SearchInput({ value, onChange, placeholder = 'Search…', className, id }) {
  return (
    <div className={cx('relative', className)}>
      <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]" aria-hidden />
      <input
        id={id}
        type="search"
        className="input"
        style={{ paddingLeft: '2.1rem' }}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange?.(e.target.value)}
      />
    </div>
  );
}

export function Dropdown({ trigger, children, align = 'right', className }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const onDoc = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);
  return (
    <div className={cx('relative', className)} ref={ref}>
      <div onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-haspopup="menu">
        {trigger}
      </div>
      {open && (
        <div
          role="menu"
          onClick={() => setOpen(false)}
          className={cx(
            'card absolute z-40 mt-1.5 min-w-[13rem] overflow-hidden p-1 shadow-[var(--shadow-pop)]',
            align === 'right' ? 'right-0' : 'left-0',
          )}
          style={{ animation: 'var(--animate-pop)' }}
        >
          {children}
        </div>
      )}
    </div>
  );
}

export function MenuItem({ icon: Icon, children, onClick, tone, ...props }) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className={cx(
        'flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm font-medium hover:bg-[color-mix(in_srgb,var(--text)_6%,transparent)]',
        tone === 'danger' && 'text-flag-700',
      )}
      {...props}
    >
      {Icon && <Icon className="h-4 w-4 shrink-0" aria-hidden />}
      <span className="min-w-0 flex-1 truncate">{children}</span>
    </button>
  );
}

export function Toaster() {
  const { toasts, dismissToast } = useApp();
  if (!toasts?.length) return null;
  return createPortal(
    <div className="pointer-events-none fixed inset-x-0 bottom-4 z-[80] flex flex-col items-center gap-2 px-4 sm:bottom-6 sm:right-6 sm:left-auto sm:items-end" role="status" aria-live="polite">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={cx(
            'pointer-events-auto flex w-full max-w-sm items-start gap-2.5 rounded-xl border px-3.5 py-3 text-sm shadow-[var(--shadow-pop)]',
            t.type === 'error'
              ? 'border-flag-200 bg-flag-50 text-flag-900 dark:border-flag-800 dark:bg-[#2a0d12] dark:text-flag-100'
              : 'border-[var(--line)] bg-[var(--surface-card)]',
          )}
          style={{ animation: 'var(--animate-fade-up)' }}
        >
          <span
            className={cx('mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-white', t.type === 'error' ? 'bg-flag-700' : 'bg-[var(--color-mint-500)]')}
            aria-hidden
          >
            {t.type === 'error' ? <X className="h-3.5 w-3.5" /> : <Check className="h-3.5 w-3.5" />}
          </span>
          <p className="min-w-0 flex-1 font-medium">{t.message}</p>
          {t.action && (
            <button type="button" className="shrink-0 text-xs font-bold underline" onClick={t.action.onClick}>
              {t.action.label}
            </button>
          )}
          <button type="button" aria-label="Dismiss notification" className="shrink-0 text-[var(--text-muted)] hover:text-[var(--text)]" onClick={() => dismissToast(t.id)}>
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}
    </div>,
    document.body,
  );
}

export function Accordion({ items, className }) {
  const [open, setOpen] = useState(items[0]?.id ?? null);
  return (
    <div className={cx('divide-y divide-[var(--line)] overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--surface-card)]', className)}>
      {items.map((item) => {
        const isOpen = open === item.id;
        return (
          <div key={item.id}>
            <h3>
              <button
                type="button"
                aria-expanded={isOpen}
                aria-controls={`panel-${item.id}`}
                id={`acc-${item.id}`}
                onClick={() => setOpen(isOpen ? null : item.id)}
                className="flex w-full items-center justify-between gap-4 px-4 py-4 text-left text-sm font-semibold transition-colors hover:text-[var(--color-brand-600)] sm:px-5"
              >
                <span>{item.question}</span>
                <ChevronDown className={cx('h-4 w-4 shrink-0 transition-transform duration-200', isOpen && 'rotate-180')} aria-hidden />
              </button>
            </h3>
            <div
              id={`panel-${item.id}`}
              role="region"
              aria-labelledby={`acc-${item.id}`}
              hidden={!isOpen}
              className="px-4 pb-4 text-sm leading-relaxed text-[var(--text-muted)] sm:px-5"
            >
              {item.answer}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** Repeatable list editor used for line items, deliverables, milestones, packages… */
export function Repeater({ items, onChange, addLabel = 'Add row', icon: Icon, render, newItem, min = 0 }) {
  const list = items || [];
  const update = (i, patch) => onChange(list.map((row, idx) => (idx === i ? { ...row, ...patch } : row)));
  const remove = (i) => onChange(list.filter((_, idx) => idx !== i));
  const move = (i, dir) => {
    const next = [...list];
    const j = i + dir;
    if (j < 0 || j >= next.length) return;
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };
  return (
    <div className="space-y-2">
      {list.map((row, i) => (
        <div key={row.id || i} className="rounded-xl border border-[var(--line)] bg-[color-mix(in_srgb,var(--text)_1.5%,transparent)] p-2.5">
          {render(row, i, { update: (patch) => update(i, patch), remove: () => remove(i), moveUp: () => move(i, -1), moveDown: () => move(i, 1), index: i })}
        </div>
      ))}
      <Button variant="outline" size="sm" icon={Icon} onClick={() => onChange([...list, { id: mkId('r'), ...(newItem || {}) }])} disabled={false}>
        {addLabel}
      </Button>
      {list.length > min && null}
    </div>
  );
}
