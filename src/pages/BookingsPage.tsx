import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import { api } from '../api/client';
import type { BookingListRow } from '../api/types';
import { ErrorText, Loading, StatusChip } from '../components/ui';
import { Reveal } from '../components/motion';
import { IconArrow, IconCar, IconPlane, IconSteering } from '../components/icons';
import { fmtKigali, fmtRwf } from '../components/time';

export const serviceLabel = (t: (k: string) => string, b: { service: string; airport: unknown }) =>
  b.airport ? t('booking.airportShort') : b.service === 'driver_on_demand' ? t('booking.driverOnDemandShort') : t('booking.chauffeurShort');

export function ServiceIcon({ b }: { b: { service: string; airport: unknown } }) {
  return b.airport ? <IconPlane /> : b.service === 'driver_on_demand' ? <IconSteering /> : <IconCar />;
}

export function BookingsPage() {
  const { t } = useTranslation();
  const [rows, setRows] = useState<BookingListRow[] | null>(null);
  const [error, setError] = useState<unknown>(null);
  useEffect(() => {
    api<{ bookings: BookingListRow[] }>('/bookings').then((r) => setRows(r.bookings)).catch(setError);
  }, []);

  return (
    <div className="page container" style={{ maxWidth: 860 }}>
      <Reveal className="page-head">
        <div>
          <p className="eyebrow">RideWELL</p>
          <h1>{t('booking.myBookings')}</h1>
        </div>
        <Link className="btn" to="/book">
          {t('booking.bookNow')} <IconArrow width={18} height={18} />
        </Link>
      </Reveal>
      <ErrorText error={error} />
      {!rows ? (
        <Loading />
      ) : rows.length === 0 ? (
        <p className="card muted">{t('booking.none')}</p>
      ) : (
        <div className="grid">
          {rows.map((b, i) => (
            <Reveal key={b.id} index={Math.min(i, 6)}>
              <Link to={`/bookings/${b.id}`} className="card lift list-row" data-testid={`booking-${b.ref}`}>
                <div className="row" style={{ gap: '1rem', flexWrap: 'nowrap', minWidth: 0 }}>
                  <div className="icon-tile" style={{ margin: 0, flex: '0 0 auto' }}>
                    <ServiceIcon b={b} />
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <strong>
                      {serviceLabel(t, b)} · {fmtKigali(b.startAt)}
                    </strong>
                    <div className="muted small" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {b.ref} · {b.pickup}
                      {b.dropoff ? ` → ${b.dropoff}` : ''}
                    </div>
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <StatusChip status={b.status} />
                  {b.quoteAmountRwf !== null && <div className="small muted">{fmtRwf(b.quoteAmountRwf)} RWF</div>}
                </div>
              </Link>
            </Reveal>
          ))}
        </div>
      )}
    </div>
  );
}
