import { useEffect, useState, type CSSProperties } from 'react';
import { Link, useNavigate } from 'react-router';
import { api, type ApiError } from '../api/client';
import type { CustomerBooking } from '../api/types';
import { BookingForm, clearDraft, draftToBody, emptyDraft, loadDraft, saveDraft, type BookingDraft, type Kind } from '../components/BookingForm';
import { ErrorText } from '../components/ui';
import { fmtRwf } from '../components/time';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../auth/AuthContext';
import { HeroScene } from '../components/HeroScene';
import { Reveal } from '../components/motion';
import { IconArrow, IconCar, IconChat, IconPlane, IconShield, IconSteering } from '../components/icons';

interface Prices {
  prices: { airportTransferFromRwf: number | null; driverHourlyRwf: number | null; chauffeurHourlyFromRwf: number | null } | null;
  isPlaceholder: boolean;
}

/**
 * Home. The service panel leads, as the booking form will once booking opens
 * (Phase 4). Nothing here shows prices, drivers, vehicles or reviews that do not
 * exist yet.
 */
export function HomePage() {
  const { t } = useTranslation();
  const { status, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [draft, setDraft] = useState<BookingDraft>(() => loadDraft() ?? emptyDraft());
  const [prices, setPrices] = useState<Prices | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const signedIn = status === 'signedIn';
  useEffect(() => {
    api<Prices>('/public/prices', { noRefresh: true }).then(setPrices).catch(() => setPrices(null));
  }, []);

  const submit = async (d: BookingDraft) => {
    saveDraft(d);
    // An account is needed to send a request: keep the details and come back to /book after sign-in.
    if (!signedIn || isAdmin) {
      navigate('/sign-in?mode=register', { state: { from: '/book' } });
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const b = await api<CustomerBooking>('/bookings', { method: 'POST', body: draftToBody(d, t('booking.airportName')) });
      clearDraft();
      navigate(`/bookings/${b.id}`, { state: { justBooked: true } });
    } catch (err) {
      setError(err as ApiError);
    } finally {
      setBusy(false);
    }
  };
  const primary = signedIn ? (isAdmin ? '/admin' : '/account') : '/sign-in?mode=register';

  const services: Record<Kind, { title: string; text: string; ticks: string[]; Icon: typeof IconSteering }> = {
    driver: { title: t('home.driverTitle'), text: t('home.driverText'), ticks: t('home.driverTicks', { returnObjects: true }) as string[], Icon: IconSteering },
    chauffeur: { title: t('home.chauffeurTitle'), text: t('home.chauffeurText'), ticks: t('home.chauffeurTicks', { returnObjects: true }) as string[], Icon: IconCar },
    airport: { title: t('home.airportTitle'), text: t('home.airportText'), ticks: t('home.airportTicks', { returnObjects: true }) as string[], Icon: IconPlane },
  };
  const s = services[draft.kind];
  const p = prices?.prices;
  const price =
    draft.kind === 'airport' && p?.airportTransferFromRwf
      ? t('home.fromPrice', { price: fmtRwf(p.airportTransferFromRwf) })
      : draft.kind === 'driver' && p?.driverHourlyRwf
        ? t('home.perHour', { price: fmtRwf(p.driverHourlyRwf) })
        : draft.kind === 'chauffeur' && p?.chauffeurHourlyFromRwf
          ? t('home.fromPerHour', { price: fmtRwf(p.chauffeurHourlyFromRwf) })
          : null;

  const steps = [1, 2, 3, 4].map((n) => ({ n, title: t(`home.step${n}Title`), text: t(`home.step${n}Text`) }));
  const why = [
    { Icon: IconSteering, title: t('home.why1Title'), text: t('home.why1Text') },
    { Icon: IconShield, title: t('home.why2Title'), text: t('home.why2Text') },
    { Icon: IconShield, title: t('home.why3Title'), text: t('home.why3Text') },
    { Icon: IconChat, title: t('home.why4Title'), text: t('home.why4Text') },
  ];

  return (
    <>
      <section className="hero" aria-labelledby="hero-title">
        <HeroScene />
        <div className="container">
          <div className="hero-copy">
            <p className="eyebrow line">
              <span style={{ '--i': 0 } as CSSProperties}>{t('home.eyebrow')}</span>
            </p>
            <h1 id="hero-title" className="display">
              <span className="line">
                <span style={{ '--i': 1 } as CSSProperties}>{t('home.title1')}</span>
              </span>
              <span className="line">
                <span style={{ '--i': 2 } as CSSProperties} className="accent">
                  {t('home.title2')}
                </span>
              </span>
            </h1>
            <p className="lead">{t('home.lead')}</p>
            <div className="hero-actions">
              <Link className="btn" to={primary}>
                {signedIn ? t(isAdmin ? 'nav.admin' : 'nav.account') : t('home.ctaPrimary')} <IconArrow width={18} height={18} />
              </Link>
              <a className="btn ghost" href="#how">
                {t('home.ctaSecondary')}
              </a>
            </div>
          </div>
        </div>
      </section>

      <div className="container" id="services">
        <section className="service-panel glass" aria-label={t('home.panelLabel')}>
          <div className="service-body" style={{ marginTop: 0, alignItems: 'start' }}>
            <div key={draft.kind} className="page-enter">
              <div className="icon-tile">
                <s.Icon />
              </div>
              <h2 style={{ fontSize: 'clamp(1.4rem, 3vw, 2rem)' }}>{s.title}</h2>
              <p className="muted" style={{ maxWidth: '52ch' }}>
                {s.text}
              </p>
              <ul className="ticks">
                {s.ticks.map((tick) => (
                  <li key={tick}>{tick}</li>
                ))}
              </ul>
              {price && (
                <p style={{ marginTop: '1.25rem' }}>
                  <span className="price-chip" data-testid="price-chip">
                    <strong>{price}</strong>
                  </span>
                  <span className="hint" style={{ display: 'block', marginTop: '0.4rem' }}>
                    {prices?.isPlaceholder ? t('home.pricePlaceholder') : t('home.priceIndicative')}
                  </span>
                </p>
              )}
            </div>
            <div>
              <BookingForm
                compact
                value={draft}
                onChange={(d) => {
                  setDraft(d);
                  saveDraft(d);
                }}
                busy={busy}
                submitLabel={signedIn && !isAdmin ? t('booking.submit') : t('booking.signInToBook')}
                footer={<ErrorText error={error} />}
                onSubmit={(d) => void submit(d)}
              />
            </div>
          </div>
        </section>
      </div>

      <section className="section" id="how" aria-labelledby="how-title">
        <div className="container">
          <Reveal>
            <p className="eyebrow">{t('home.howEyebrow')}</p>
            <h2 id="how-title" className="h2" style={{ maxWidth: '18ch' }}>
              {t('home.howTitle')}
            </h2>
          </Reveal>
          <div className="grid-4" style={{ marginTop: '2.5rem' }}>
            {steps.map((st, i) => (
              <Reveal key={st.n} index={i} className="card lift">
                <span className="step-num">0{st.n}</span>
                <h3 style={{ marginTop: '0.9rem' }}>{st.title}</h3>
                <p className="muted" style={{ margin: 0 }}>
                  {st.text}
                </p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className="section paper" aria-labelledby="why-title">
        <div className="container">
          <Reveal>
            <p className="eyebrow">{t('home.whyEyebrow')}</p>
            <h2 id="why-title" className="h2" style={{ maxWidth: '20ch' }}>
              {t('home.whyTitle')}
            </h2>
          </Reveal>
          <div className="grid-4" style={{ marginTop: '2.5rem' }}>
            {why.map((w, i) => (
              <Reveal key={w.title} index={i} className="card lift">
                <div className="icon-tile">
                  <w.Icon />
                </div>
                <h3>{w.title}</h3>
                <p className="muted" style={{ margin: 0 }}>
                  {w.text}
                </p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className="section" aria-labelledby="partner-title">
        <div className="container">
          <Reveal className="cta-band">
            <div style={{ maxWidth: 620, position: 'relative' }}>
              <p className="eyebrow">{t('home.partnerEyebrow')}</p>
              <h2 id="partner-title" className="h2">
                {t('home.partnerTitle')}
              </h2>
              <p className="lead">{t('home.partnerText')}</p>
              <div className="hero-actions" style={{ animation: 'none' }}>
                <Link className="btn" to={signedIn ? '/partner/driver' : '/sign-in?mode=register'}>
                  {t('home.partnerDrive')} <IconArrow width={18} height={18} />
                </Link>
                <Link className="btn ghost" to={signedIn ? '/partner/owner' : '/sign-in?mode=register'}>
                  {t('home.partnerList')}
                </Link>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      <footer className="site-footer">
        <div className="container row between">
          <span>
            <strong style={{ color: 'var(--text)' }}>RideWELL</strong> · {t('home.footerLine')}
          </span>
          <span>{t('home.footerRights', { year: new Date().getFullYear() })}</span>
        </div>
      </footer>
    </>
  );
}
