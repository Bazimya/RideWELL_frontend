import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../../api/client';
import { Card, ErrorText, Loading } from '../../components/ui';

const fmt = (iso: string | null) => (iso ? new Date(iso).toLocaleString() : null);

interface ConfigView {
  version: number;
  isPlaceholder: boolean;
  createdAt: string;
  values: Record<string, unknown>;
}

export function AdminSettingsPage() {
  const { t } = useTranslation();
  const [cfg, setCfg] = useState<ConfigView | null | undefined>(undefined);
  const [error, setError] = useState<unknown>(null);
  useEffect(() => {
    api<{ config: ConfigView | null }>('/admin/config').then((r) => setCfg(r.config)).catch(setError);
  }, []);
  return (
    <Card title={t('admin.config')}>
      <ErrorText error={error} />
      {cfg === undefined ? (
        <Loading />
      ) : cfg === null ? (
        <p className="notice">{t('admin.configMissing')}</p>
      ) : (
        <>
          {cfg.isPlaceholder && <p className="notice warn">{t('admin.configPlaceholder')}</p>}
          <p className="muted">
            v{cfg.version} · {fmt(cfg.createdAt)}
          </p>
          <pre className="json">{JSON.stringify(cfg.values, null, 2)}</pre>
        </>
      )}
    </Card>
  );
}

