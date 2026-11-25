import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import { api } from '../api/client';
import type { CustomerBooking } from '../api/types';
import { BookingForm, clearDraft, draftToBody, emptyDraft, loadDraft, saveDraft, type BookingDraft } from '../components/BookingForm';
import { Card, ErrorText } from '../components/ui';
import { Reveal } from '../components/motion';

/** Full booking form. Picks up a draft started on the home page before sign-in. */
export function BookPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [draft, setDraft] = useState<BookingDraft>(() => loadDraft() ?? emptyDraft());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);

  const submit = async (d: BookingDraft) => {
    setBusy(true);
    setError(null);
    try {
      const b = await api<CustomerBooking>('/bookings', { method: 'POST', body: draftToBody(d, t('booking.airportName')) });
      clearDraft();
      navigate(`/bookings/${b.id}`, { replace: true, state: { justBooked: true } });
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="page container" style={{ maxWidth: 760 }}>
      <Reveal>
        <p className="eyebrow">{t('booking.eyebrow')}</p>
        <h1>{t('booking.title')}</h1>
      </Reveal>
      <Reveal index={1}>
        <Card>
          <BookingForm
            value={draft}
            onChange={(d) => {
              setDraft(d);
              saveDraft(d);
            }}
            onSubmit={(d) => void submit(d)}
            submitLabel={t('booking.submit')}
            busy={busy}
            footer={<ErrorText error={error} />}
          />
        </Card>
      </Reveal>
    </div>
  );
}
