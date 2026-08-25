import { useId, useRef, useState, type DragEvent } from 'react';
import { assetUrl, errorMessage, importImageFromUrl, uploadFiles } from '../lib/api';

/**
 * One image control used everywhere in the admin: drop or pick a file, or
 * paste a link and import it.
 *
 * Importing downloads the image and re-hosts it under /uploads rather than
 * storing the foreign URL, so a product photo cannot silently break when the
 * other site changes, removes it, or starts blocking hot-links. If the import
 * fails (some hosts refuse server-side fetches) the raw link is offered as a
 * fallback so the operator is never stuck.
 */
interface Props {
  /** Current server-relative URLs. */
  value: string[];
  onChange: (urls: string[]) => void;
  /** Maximum images; 1 renders the single-image variant. */
  max?: number;
  label?: string;
  hint?: string;
  /**
   * Hide the built-in thumbnails when the caller renders its own richer list
   * (the product gallery adds alt text and ordering per image).
   */
  showPreviews?: boolean;
  /** Preview shape, e.g. "21 / 8" for a hero banner. Defaults to 3:4. */
  previewAspect?: string;
  /** Compact variant for tight panels. */
  compact?: boolean;
}

export function ImageInput({
  value,
  onChange,
  max = 1,
  label,
  hint,
  showPreviews = true,
  previewAspect,
  compact = false,
}: Props) {
  const inputId = useId();
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<null | 'upload' | 'import'>(null);
  const [error, setError] = useState<string | null>(null);
  const [fallbackUrl, setFallbackUrl] = useState<string | null>(null);
  const [link, setLink] = useState('');
  const [dragging, setDragging] = useState(false);

  const single = max === 1;
  const full = value.length >= max;
  // For one-image slots, replacing is the common action, so the controls stay.
  const showControls = single || !full;
  const remaining = max - value.length;

  const add = (urls: string[]) => onChange(single ? urls.slice(-1) : [...value, ...urls].slice(0, max));

  const handleFiles = async (files: File[]) => {
    if (files.length === 0) return;
    setError(null);
    setFallbackUrl(null);
    setBusy('upload');
    try {
      const uploaded = await uploadFiles(files.slice(0, Math.max(1, remaining)));
      add(uploaded.map((u) => u.url));
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(null);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const handleImport = async () => {
    const url = link.trim();
    if (!url) return;
    setError(null);
    setFallbackUrl(null);
    setBusy('import');
    try {
      const imported = await importImageFromUrl(url);
      add([imported.url]);
      setLink('');
    } catch (err) {
      setError(errorMessage(err));
      // Some hosts block server-side fetches; let the operator link it directly.
      if (/^https?:\/\//i.test(url)) setFallbackUrl(url);
    } finally {
      setBusy(null);
    }
  };

  const useLinkAnyway = () => {
    if (!fallbackUrl) return;
    add([fallbackUrl]);
    setFallbackUrl(null);
    setError(null);
    setLink('');
  };

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragging(false);
    if (full || busy) return;
    void handleFiles([...e.dataTransfer.files].filter((f) => f.type.startsWith('image/')));
  };

  return (
    <div className={compact ? 'imgin imgin--compact' : 'imgin'}>
      {label && <span className="imgin-label">{label}</span>}

      {showPreviews && value.length > 0 && (
        <ul className={`imgin-previews${single ? ' imgin-previews--single' : ''}`}>
          {value.map((url, i) => (
            <li
              key={`${url}-${i}`}
              className="imgin-preview"
              style={previewAspect ? { aspectRatio: previewAspect, width: '100%' } : undefined}
            >
              <img src={assetUrl(url) ?? url} alt="" loading="lazy" />
              {!single && i === 0 && <span className="imgin-primary">Primary</span>}
              <button
                type="button"
                className="imgin-remove"
                aria-label="Remove image"
                title="Remove"
                onClick={() => onChange(value.filter((_, idx) => idx !== i))}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}

      {showControls && (
        <>
          <div
            className={`imgin-drop${dragging ? ' imgin-drop--over' : ''}`}
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
          >
            <input
              ref={fileRef}
              id={inputId}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/avif"
              multiple={!single}
              hidden
              onChange={(e) => void handleFiles([...(e.target.files ?? [])])}
            />
            <label htmlFor={inputId} className="imgin-drop-label">
              <strong>
                {busy === 'upload'
                  ? 'Uploading…'
                  : value.length > 0
                    ? 'Drop to replace or browse'
                    : 'Drop an image or browse'}
              </strong>
              <span>JPEG, PNG, WebP or AVIF · up to 5 MB{single ? '' : ` · ${remaining} left`}</span>
            </label>
          </div>

          <div className="imgin-or">
            <span>or import from a link</span>
          </div>

          <div className="imgin-link">
            <input
              type="url"
              placeholder="https://example.com/photo.jpg"
              value={link}
              onChange={(e) => setLink(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  void handleImport();
                }
              }}
              disabled={busy !== null}
            />
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => void handleImport()}
              disabled={busy !== null || link.trim().length === 0}
            >
              {busy === 'import' ? 'Importing…' : 'Import'}
            </button>
          </div>
        </>
      )}

      {error && (
        <p className="imgin-error" role="alert">
          {error}
          {fallbackUrl && (
            <button type="button" className="imgin-fallback" onClick={useLinkAnyway}>
              Use the link anyway
            </button>
          )}
        </p>
      )}

      {hint && !error && <p className="imgin-hint">{hint}</p>}
    </div>
  );
}
