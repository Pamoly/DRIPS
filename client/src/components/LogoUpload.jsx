import { useRef, useState } from 'react';
import { Check, Image as ImageIcon, Loader2, Trash2, Upload } from 'lucide-react';
import { cx, normaliseImage } from '../lib/format';
import { Button } from './ui';

/**
 * Logo / image uploader with drag & drop, paste support and automatic
 * down-scaling so documents and the DB stay small.
 */
export function LogoUpload({ value, onChange, name, label = 'Business logo', hint, className, maxHeight = 96 }) {
  const inputRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [over, setOver] = useState(false);
  const [error, setError] = useState('');

  const handleFile = async (file) => {
    if (!file) return;
    setError('');
    if (!file.type.startsWith('image/')) {
      setError('Please choose an image file (PNG, JPG, SVG or WebP).');
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      setError('That image is larger than 8 MB. Please use a smaller file.');
      return;
    }
    setBusy(true);
    try {
      const dataUrl = await normaliseImage(file, 720);
      onChange?.(dataUrl, file.name);
    } catch {
      setError('Could not read that image. Try a different file.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={className}>
      <span className="label">{label}</span>
      <div
        className={cx('drop-zone flex flex-col items-center justify-center gap-2 p-4 text-center sm:flex-row sm:text-left', over && 'border-[var(--color-brand-600)]')}
        data-over={over}
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          handleFile(e.dataTransfer.files?.[0]);
        }}
        onPaste={(e) => handleFile(e.clipboardData?.files?.[0])}
        tabIndex={-1}
      >
        {value ? (
          <img
            src={value}
            alt={name || 'Uploaded logo preview'}
            className="max-w-[12rem] rounded-lg border border-[var(--line)] bg-white object-contain p-2"
            style={{ maxHeight }}
          />
        ) : (
          <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl border border-dashed border-[var(--color-brand-300)] bg-white/70 text-[var(--color-brand-600)]">
            {busy ? <Loader2 className="h-6 w-6 animate-spin" aria-hidden /> : <ImageIcon className="h-6 w-6" aria-hidden />}
          </span>
        )}

        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">{value ? name || 'Logo uploaded' : 'Drag & drop your logo here'}</p>
          <p className="mt-0.5 text-xs leading-relaxed text-[var(--text-muted)]">
            {hint || 'PNG, JPG, SVG or WebP up to 8 MB. Automatically resized to 720 px and printed on every PDF and on your public proposal link.'}
          </p>
          {value && (
            <p className="mt-1 flex items-center gap-1 text-xs font-semibold text-[var(--color-mint-600)]">
              <Check className="h-3.5 w-3.5" aria-hidden /> Ready to use on documents
            </p>
          )}
        </div>

        <div className="flex shrink-0 flex-wrap items-center justify-center gap-2">
          <input
            ref={inputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/svg+xml,image/gif"
            className="sr-only"
            id="logo-upload-input"
            onChange={(e) => handleFile(e.target.files?.[0])}
          />
          <Button type="button" size="sm" variant="outline" icon={Upload} onClick={() => inputRef.current?.click()} disabled={busy}>
            {value ? 'Replace' : 'Choose file'}
          </Button>
          {value && (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              icon={Trash2}
              onClick={() => onChange?.('', '')}
              aria-label="Remove logo"
            >
              Remove
            </Button>
          )}
        </div>
      </div>
      {error && (
        <p role="alert" className="mt-1.5 text-xs font-semibold text-flag-700">
          {error}
        </p>
      )}
    </div>
  );
}
