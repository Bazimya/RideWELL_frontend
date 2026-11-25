import { useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import { useTranslation } from 'react-i18next';
import { ApiError } from '../api/client';

export function Field({ label, hint, className = '', ...input }: { label: string; hint?: string; className?: string } & InputHTMLAttributes<HTMLInputElement>) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  return (
    <div className={`field ${className}`}>
      <label htmlFor={id}>{label}</label>
      <input id={id} aria-describedby={hintId} {...input} />
      {hint && (
        <p className="hint" id={hintId}>
          {hint}
        </p>
      )}
    </div>
  );
}

export function SelectField({ label, children, className = '', ...select }: { label: string; className?: string; children: ReactNode } & SelectHTMLAttributes<HTMLSelectElement>) {
  const id = useId();
  return (
    <div className={`field ${className}`}>
      <label htmlFor={id}>{label}</label>
      <select id={id} {...select}>
        {children}
      </select>
    </div>
  );
}

export function TextArea({ label, className = '', ...ta }: { label: string; className?: string } & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const id = useId();
  return (
    <div className={`field ${className}`}>
      <label htmlFor={id}>{label}</label>
      <textarea id={id} {...ta} />
    </div>
  );
}

/** Shows the server's safe error message (and any unmet items), or a generic one. */
export function ErrorText({ error }: { error: unknown }) {
  const { t } = useTranslation();
  if (!error) return null;
  let msg = t('common.error');
  let items: string[] = [];
  if (error instanceof ApiError) {
    msg = error.code === 'network_error' ? t('common.networkError') : error.message;
    if (Array.isArray(error.details)) {
      items = (error.details as Array<{ label?: string; message?: string; path?: string }>)
        .map((d) => d.label ?? (d.path ? `${d.path}: ${d.message}` : d.message ?? ''))
        .filter(Boolean);
    }
  }
  return (
    <div className="error" role="alert">
      {msg}
      {items.length > 0 && (
        <ul className="small" style={{ margin: '0.4rem 0 0', paddingLeft: '1.2rem' }}>
          {items.map((i) => (
            <li key={i}>{i}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function Card({ title, children, className = '', actions }: { title?: string; children: ReactNode; className?: string; actions?: ReactNode }) {
  return (
    <section className={`card ${className}`}>
      {(title || actions) && (
        <div className="row between" style={{ marginBottom: '1rem' }}>
          {title && <h2 className="h2" style={{ fontSize: '1.3rem', margin: 0 }}>{title}</h2>}
          {actions}
        </div>
      )}
      {children}
    </section>
  );
}

export function Loading() {
  const { t } = useTranslation();
  return (
    <div className="loading" role="status">
      <span className="spinner" aria-hidden="true" />
      {t('common.loading')}
    </div>
  );
}

export function StatusChip({ status }: { status: string }) {
  const { t } = useTranslation();
  return <span className={`chip s-${status}`}>{t(`status.${status}`, { defaultValue: status.replace(/_/g, ' ') })}</span>;
}

/** Turn "a, b ,c" into ["a","b","c"]. */
export const splitList = (s: string) =>
  s
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean);

export const toDateInput = (iso: string | null | undefined) => (iso ? iso.slice(0, 10) : '');
export const fmtDate = (iso: string | null | undefined) => (iso ? new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : '—');
export const fmtDateTime = (iso: string | null | undefined) => (iso ? new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : '—');

/** Centered glass card used for sign-in style screens. */
export function AuthShell({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <div className="auth-wrap">
      <div className="auth-card glass">
        <h1 className="h2" style={{ marginBottom: subtitle ? '0.3rem' : '1.25rem' }}>
          {title}
        </h1>
        {subtitle && (
          <p className="muted" style={{ marginTop: 0, marginBottom: '1.5rem' }}>
            {subtitle}
          </p>
        )}
        {children}
      </div>
    </div>
  );
}
