import { Link } from 'react-router-dom';
import { cx } from '../lib/format';

/** DRIPS mark — the “D” cut from the three stripes of the Dutch flag. */
export function LogoMark({ size = 32, className, rounded = 'rounded-xl' }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      role="img"
      aria-label="DRIPS logo"
      className={cx(rounded, className)}
    >
      <rect width="32" height="32" rx="8" fill="#0E1B3D" />
      <defs>
        <clipPath id="drips-d">
          <path d="M8.5 6.5h7.6c5.3 0 9 3.7 9 9.5s-3.7 9.5-9 9.5H8.5z" />
        </clipPath>
      </defs>
      <g clipPath="url(#drips-d)">
        <rect x="8" y="6" width="17" height="6.6" fill="#AE1C28" />
        <rect x="8" y="12.6" width="17" height="6.2" fill="#F4F6FB" />
        <rect x="8" y="18.8" width="17" height="7.4" fill="#21468B" />
      </g>
      <path
        d="M13 11v10h2.9c2.8 0 4.7-1.9 4.7-5s-1.9-5-4.7-5z"
        fill="#0E1B3D"
      />
    </svg>
  );
}

export function Wordmark({ size = 20, withText = true, className, subtitle }) {
  return (
    <Link to="/" className={cx('group inline-flex items-center gap-2.5', className)} aria-label="DRIPS home">
      <LogoMark size={size + 12} />
      {withText && (
        <span className="leading-none">
          <span className="block font-display text-[1.05rem] font-extrabold tracking-tight">DRIPS</span>
          {subtitle && <span className="mt-0.5 block text-[0.62rem] font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">{subtitle}</span>}
        </span>
      )}
    </Link>
  );
}

/** Dutch-flag rule used as a decorative divider on marketing + documents. */
export function FlagRule({ className }) {
  return <div aria-hidden className={cx('flag-bar w-full rounded-full', className)} />;
}
