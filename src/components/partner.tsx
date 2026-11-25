import { useEffect, useRef, useState, type CSSProperties, type DragEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { fetchDocumentBlobUrl, uploadFile } from '../api/client';
import type { DocView, PartnerStatus, Requirement } from '../api/types';
import { ErrorText, StatusChip, fmtDate } from './ui';
import { IconFile, IconUpload } from './icons';

const ORDER: PartnerStatus[] = ['draft', 'applied', 'under_review', 'approved'];

/** draft → submitted → under review → approved, with the current step pulsing. */
export function StatusTimeline({ status }: { status: PartnerStatus }) {
  const { t } = useTranslation();
  const steps: PartnerStatus[] = status === 'rejected' ? ['draft', 'applied', 'under_review', 'rejected'] : status === 'suspended' ? ['draft', 'applied', 'under_review', 'approved', 'suspended'] : ORDER;
  const current = steps.indexOf(status);
  return (
    <ol className="timeline" aria-label="Application progress">
      {steps.map((s, i) => (
        <li key={s} className={`${i <= current ? 'done' : ''} ${i === current ? 'current' : ''}`} aria-current={i === current ? 'step' : undefined}>
          {t(`status.${s}`)}
        </li>
      ))}
    </ol>
  );
}

/** Checklist with a progress ring that fills as items are completed. */
export function Checklist({ items, title }: { items: Requirement[]; title: string }) {
  const done = items.filter((i) => i.done).length;
  const pct = items.length ? Math.round((done / items.length) * 100) : 0;
  return (
    <div>
      <div className="row" style={{ gap: '1rem', marginBottom: '1rem' }}>
        <div className="progress-ring" style={{ '--p': pct } as CSSProperties} role="img" aria-label={`${done} of ${items.length} done`}>
          <span>{pct}%</span>
        </div>
        <div>
          <h3 style={{ margin: 0 }}>{title}</h3>
          <p className="muted small" style={{ margin: 0 }}>
            {done} / {items.length}
          </p>
        </div>
      </div>
      <ul className="checklist">
        {items.map((i) => (
          <li key={i.key} className={i.done ? 'done' : ''}>
            {i.label}
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Private document viewer (5-minute, session-bound link; object URL revoked on close). */
export function DocViewer({ doc, onClose }: { doc: DocView; onClose: () => void }) {
  const { t } = useTranslation();
  const [src, setSrc] = useState<{ url: string; type: string } | null>(null);
  const [error, setError] = useState<unknown>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    let url: string | null = null;
    fetchDocumentBlobUrl(doc.id)
      .then((r) => {
        url = r.url;
        setSrc(r);
      })
      .catch(setError);
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      if (url) URL.revokeObjectURL(url);
    };
  }, [doc.id, onClose]);
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal glass" role="dialog" aria-modal="true" aria-label={t(`docs.${doc.kind}`)} onClick={(e) => e.stopPropagation()}>
        <div className="row between" style={{ marginBottom: '0.8rem' }}>
          <div className="row">
            <strong>{t(`docs.${doc.kind}`)}</strong>
            <StatusChip status={doc.status} />
          </div>
          <button ref={closeRef} type="button" className="ghost small" onClick={onClose}>
            {t('docs.close')}
          </button>
        </div>
        <div className="viewer">
          {/* PDFs with scripts or embedded files are refused at upload; the browser's PDF viewer renders the rest. */}
          {error ? <ErrorText error={error} /> : !src ? <span className="spinner" /> : src.type === 'application/pdf' ? <iframe title={t(`docs.${doc.kind}`)} src={src.url} /> : <img src={src.url} alt={t(`docs.${doc.kind}`)} />}
        </div>
        {src && (
          <a className="btn ghost small" style={{ marginTop: '0.75rem' }} href={src.url} target="_blank" rel="noopener noreferrer">
            {t('docs.view')} ↗
          </a>
        )}
        <p className="hint" style={{ marginTop: '0.6rem' }}>
          {t('docs.linkNote')}
        </p>
      </div>
    </div>
  );
}

/**
 * Drop zone / file picker for one document kind, with the files already
 * uploaded for it. Uploads go straight to the API, which checks and cleans them.
 */
export function UploadTile<T>({
  kind,
  docs,
  endpoint,
  onUploaded,
  disabled,
  imagesOnly,
  onRemove,
}: {
  kind: string;
  docs: DocView[];
  endpoint: string;
  onUploaded: (result: T) => void;
  disabled?: boolean;
  imagesOnly?: boolean;
  onRemove?: (doc: DocView) => void;
}) {
  const { t } = useTranslation();
  const [busy, setBusy] = useState(false);
  const [drag, setDrag] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [viewing, setViewing] = useState<DocView | null>(null);
  const mine = docs.filter((d) => d.kind === kind && d.status !== 'superseded');

  const send = async (file: File | undefined) => {
    if (!file || disabled) return;
    setBusy(true);
    setError(null);
    try {
      onUploaded(await uploadFile<T>(endpoint, kind, file));
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };
  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDrag(false);
    void send(e.dataTransfer.files[0]);
  };

  return (
    <div>
      <div
        className={`upload-tile ${drag ? 'dragging' : ''} ${mine.length ? 'has-file' : ''}`}
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled) setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={onDrop}
        aria-busy={busy}
      >
        <div className="doc-ico">{busy ? <span className="spinner" /> : mine.length ? <IconFile /> : <IconUpload />}</div>
        <div className="grow">
          <strong style={{ display: 'block' }}>{t(`docs.${kind}`)}</strong>
          <span className="hint">{busy ? t('docs.uploading') : imagesOnly ? t('docs.photoHint') : t('docs.dropHint')}</span>
          {mine.length > 0 && (
            <ul className="file-list">
              {mine.map((d, i) => (
                <li key={d.id} className="row" style={{ gap: '0.35rem' }}>
                  <StatusChip status={d.status} />
                  <button type="button" className="link small" onClick={() => setViewing(d)} aria-label={`${t('docs.view')} ${t(`docs.${kind}`)} ${i + 1}`}>
                    {t('docs.view')}
                  </button>
                  {d.expiresAt && <span className="hint">{t('docs.expires', { date: fmtDate(d.expiresAt) })}</span>}
                  {onRemove && d.status !== 'approved' && !disabled && (
                    <button type="button" className="link small" onClick={() => onRemove(d)}>
                      {t('docs.remove')}
                    </button>
                  )}
                  {d.status === 'rejected' && d.reviewNote && <span className="hint" style={{ color: 'var(--danger)' }}>“{d.reviewNote}”</span>}
                </li>
              ))}
            </ul>
          )}
        </div>
        {!disabled && (
          <input
            type="file"
            aria-label={t(`docs.${kind}`)}
            accept={imagesOnly ? 'image/jpeg,image/png' : 'image/jpeg,image/png,application/pdf'}
            disabled={busy}
            onChange={(e) => {
              void send(e.target.files?.[0]);
              e.target.value = '';
            }}
          />
        )}
      </div>
      <ErrorText error={error} />
      {viewing && <DocViewer doc={viewing} onClose={() => setViewing(null)} />}
    </div>
  );
}
