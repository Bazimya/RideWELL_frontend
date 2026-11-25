import { expect, request as pwRequest, test, type APIRequestContext, type Page } from '@playwright/test';
import { backendEnv, seedDemoData, seedDevConfig, seedOpsAdmin, seedSuperAdmin } from './support';

const SUPER = { email: 'tracking.super@ridewell.test', password: 'Musanze-Volcano-Trail-41', phone: '+250788200611', totpSecret: 'KRSXG5CTMVRXEZLUKRSXG5CTMVRXEZLU' };
const OPS = { email: 'tracking.ops@ridewell.test', password: 'Huye-Campus-Morning-53', phone: '+250788200612', totpSecret: 'JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP' };
/** Kigali Marriott (pickup), ~6 km away, and ~300 m away. */
const PICKUP = { address: 'Kigali Marriott Hotel, KN 3 Ave', lat: -1.9536, lng: 30.0605 };
const FAR = { latitude: -1.99, longitude: 30.1 };
const NEAR = { latitude: -1.9555, longitude: 30.0625 };

async function emailSignIn(page: Page, email: string, password: string) {
  await page.goto('/sign-in');
  await page.getByRole('tab', { name: 'Email' }).click();
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
}

/** Real API calls for the set-up steps the booking test already covers in the browser. */
async function apiAs(api: APIRequestContext, token: string) {
  return async <T>(method: 'GET' | 'POST' | 'PUT', path: string, data?: unknown, headers: Record<string, string> = {}): Promise<T> => {
    const res = await api.fetch(`/api/v1${path}`, { method, data, headers: { Authorization: `Bearer ${token}`, ...headers } });
    if (!res.ok()) throw new Error(`${method} ${path} → ${res.status()} ${await res.text()}`);
    return (res.status() === 204 ? null : await res.json()) as T;
  };
}
async function emailToken(api: APIRequestContext, email: string, password: string) {
  const r = await api.post('/api/v1/auth/email/login', { data: { email, password } });
  expect(r.ok()).toBe(true);
  return (await r.json()).accessToken as string;
}
async function adminToken(api: APIRequestContext, email: string, password: string) {
  const step = await (await api.post('/api/v1/auth/admin/login', { data: { email, password } })).json();
  const r = await api.post('/api/v1/auth/admin/login/mfa', { data: { mfaToken: step.mfaToken, code: '123456' } });
  expect(r.ok()).toBe(true);
  return (await r.json()).accessToken as string;
}

test('driver shares location → customer sees it live → trip ends and sharing stops → staff open it only in an emergency', async ({ page, browser, baseURL }) => {
  test.setTimeout(240_000);
  seedDevConfig();
  seedDemoData();
  seedSuperAdmin(SUPER);
  seedOpsAdmin(OPS);
  const demo = backendEnv('DEV_DEMO_PASSWORD');
  const customerEmail = backendEnv('DEV_CUSTOMER_EMAIL');
  const customerPassword = backendEnv('DEV_CUSTOMER_PASSWORD');
  const driverEmail = 'demo.driver.eric.habimana@ridewell.test';
  const ownerEmail = 'demo.owner.emmanuel.rukundo@ridewell.test';

  // ---- Set-up through the real API: a super admin widens the tracking window (bookings need 60 min notice),
  //      the customer books a chauffeur with a map-located pickup, it is quoted, paid (development) and accepted.
  const api = await pwRequest.newContext({ baseURL });
  const sa = await apiAs(api, await adminToken(api, SUPER.email, SUPER.password));
  const { config } = await sa<{ config: { values: Record<string, unknown> } }>('GET', '/admin/config');
  await sa('PUT', '/admin/config', { values: { ...config.values, trackingWindowBeforePickupMinutes: 180 }, note: 'e2e: tracking window' }, { 'X-2FA-Code': '123456' });
  const cust = await apiAs(api, await emailToken(api, customerEmail, customerPassword));
  const startAt = new Date(Date.now() + 90 * 60_000).toISOString();
  const booking = await cust<{ id: string; ref: string }>('POST', '/bookings', { service: 'chauffeur', pickup: PICKUP, dropoff: { address: 'Kigali International Airport', lat: -1.96863, lng: 30.13945 }, startAt, durationHours: 2, passengers: 1 });
  const cands = await sa<{ drivers: Array<{ id: string; label: string }>; vehicles: Array<{ id: string; label: string }> }>('GET', `/admin/bookings/${booking.id}/candidates`);
  const driverId = cands.drivers.find((d) => d.label === 'Eric Habimana [DEMO]')!.id;
  const vehicleId = cands.vehicles.find((v) => v.label.includes('DEM101A'))!.id;
  await sa('POST', `/admin/bookings/${booking.id}/quote`, { amountRwf: 45_000, driverId, vehicleId, durationHours: 2 });
  await cust('POST', `/bookings/${booking.id}/pay`);
  await (await apiAs(api, await emailToken(api, driverEmail, demo)))('POST', `/driver/trips/${booking.id}/accept`);
  await (await apiAs(api, await emailToken(api, ownerEmail, demo)))('POST', `/owner/trips/${booking.id}/accept`);

  // ---- The customer's page before the driver shares.
  await emailSignIn(page, customerEmail, customerPassword);
  await page.goto(`/bookings/${booking.id}`);
  await expect(page.getByTestId('tracking-card')).toContainText('Waiting for your driver to share their location');

  // ---- The driver (phone GPS simulated by the browser) starts sharing.
  const driverCtx = await browser.newContext({ geolocation: FAR, permissions: ['geolocation'] });
  const driver = await driverCtx.newPage();
  await emailSignIn(driver, driverEmail, demo);
  await driver.goto(`/driver/trips/${booking.id}`);
  await driver.getByRole('button', { name: 'Start sharing my location' }).click();
  await expect(driver.getByTestId('sharing-status')).toContainText('last sent', { timeout: 15_000 });

  // ---- The customer sees it arrive over the live socket, with time, accuracy and an honest distance.
  const card = page.getByTestId('tracking-card');
  await expect(card.getByTestId('location-freshness')).toContainText("Driver's location, updated", { timeout: 15_000 });
  await expect(card).toHaveAttribute('data-live', 'socket');
  await expect(card.getByTestId('location-freshness')).toContainText('accurate to ±');
  await expect(card.getByTestId('tracking-estimate')).toContainText(/km from your pickup in a straight line/);
  await expect(card.getByTestId('map-marker-driver')).toBeVisible();
  await expect(card.getByTestId('map-marker-pickup')).toBeVisible();
  await expect(card).toContainText('It is not continuous tracking');

  // ---- The driver moves close to pickup; the next update (10 s interval) is pushed without a reload.
  await driverCtx.setGeolocation(NEAR);
  await expect(card.getByTestId('tracking-estimate')).toContainText(/^\d+ m from your pickup/, { timeout: 30_000 });

  // ---- Operations: no emergency, so no location.
  const opsCtx = await browser.newContext();
  const ops = await opsCtx.newPage();
  await ops.goto('/admin/sign-in');
  await ops.getByLabel('Email').fill(OPS.email);
  await ops.getByLabel('Password').fill(OPS.password);
  await ops.getByRole('button', { name: 'Continue' }).click();
  await ops.getByRole('button', { name: 'Continue' }).click();
  await expect(ops).toHaveURL(/\/admin\/overview/);
  await ops.goto(`/admin/bookings/${booking.id}`);
  await expect(ops.getByTestId('staff-booking-ref')).toContainText(booking.ref);
  await expect(ops.getByTestId('emergency-location')).toHaveCount(0);

  // ---- PIN start, then end: sharing stops on the driver's side and the customer's live view closes.
  const pin = (await page.getByTestId('trip-pin').textContent())!.trim();
  await driver.getByLabel("Customer's 4-digit trip PIN").fill(pin);
  await driver.getByRole('button', { name: 'Start trip' }).click();
  await expect(driver.locator('.page-head .chip')).toHaveText('On the way');
  driver.once('dialog', (d) => void d.accept());
  await driver.getByRole('button', { name: 'End trip' }).click();
  await expect(driver.locator('.page-head .chip')).toHaveText('Completed');
  await expect(driver.getByTestId('share-location')).toHaveCount(0);
  // The customer's live view closes (the socket ends it; the page then drops the card when it sees the trip completed).
  await expect(page.getByTestId('location-freshness')).toHaveCount(0, { timeout: 25_000 });
  const late = await (await apiAs(api, await emailToken(api, driverEmail, demo)))('POST', `/driver/trips/${booking.id}/location`, { lat: NEAR.latitude, lng: NEAR.longitude, accuracyM: 5, recordedAt: new Date().toISOString() }).catch((e: Error) => e.message);
  expect(String(late)).toContain('tracking_closed');

  // ---- A safety report after the trip: operations can now open the last known location, with a reason.
  await cust('POST', `/bookings/${booking.id}/safety-report`, { message: 'Something happened on this trip, please check.' });
  await ops.reload();
  const em = ops.getByTestId('emergency-location');
  await expect(em).toContainText('open safety report');
  await em.getByLabel('Reason (at least 10 characters)').fill('Customer safety report after trip, checking route');
  await em.getByRole('button', { name: 'Open location (logged)' }).click();
  await expect(em.getByTestId('map-marker-driver')).toBeVisible();
  await expect(em).toContainText('access logged');

  await Promise.all([driverCtx.close(), opsCtx.close(), api.dispose()]);
});
