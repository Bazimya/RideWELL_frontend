import fs from 'node:fs';
import { expect, request as pwRequest, test, type APIRequestContext, type Page } from '@playwright/test';
import { backendEnv, seedDemoData, seedDevConfig, seedOpsAdmin, seedSuperAdmin } from './support';

const SUPER = { email: 'dash.super@ridewell.test', password: 'Nyungwe-Canopy-Walk-63', phone: '+250788200711', totpSecret: 'KRSXG5CTMVRXEZLUKRSXG5CTMVRXEZLU' };
const OPS = { email: 'dash.ops@ridewell.test', password: 'Akagera-Morning-Drive-27', phone: '+250788200712', totpSecret: 'JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP' };

async function emailSignIn(page: Page, email: string, password: string) {
  await page.goto('/sign-in');
  await page.getByRole('tab', { name: 'Email' }).click();
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
}
async function adminSignIn(page: Page, email: string, password: string) {
  await page.goto('/admin/sign-in');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('button', { name: 'Continue' }).click(); // development code pre-filled
  await expect(page).toHaveURL(/\/admin\/overview/, { timeout: 20_000 });
}
async function apiAs(api: APIRequestContext, token: string) {
  return async <T>(method: 'GET' | 'POST' | 'PUT', path: string, data?: unknown): Promise<T> => {
    const res = await api.fetch(`/api/v1${path}`, { method, data, headers: { Authorization: `Bearer ${token}` } });
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

test('dashboards on real data: customer next steps, rating, help, inbox; staff overview, support, reports and delivery log', async ({ page, browser, baseURL }) => {
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

  // ---- Set-up through the real API (the booking test covers these steps in the browser): book, quote, pay (dev), accept, start, complete.
  const api = await pwRequest.newContext({ baseURL });
  const sa = await apiAs(api, await adminToken(api, SUPER.email, SUPER.password));
  const cust = await apiAs(api, await emailToken(api, customerEmail, customerPassword));
  const startAt = new Date(Date.now() + 90 * 60_000).toISOString();
  const booking = await cust<{ id: string; ref: string }>('POST', '/bookings', { service: 'chauffeur', pickup: { address: 'Kigali Convention Centre' }, startAt, durationHours: 2, passengers: 1 });
  const cands = await sa<{ drivers: Array<{ id: string; label: string }>; vehicles: Array<{ id: string; label: string }> }>('GET', `/admin/bookings/${booking.id}/candidates`);
  const driverId = cands.drivers.find((d) => d.label === 'Eric Habimana [DEMO]')!.id;
  const vehicleId = cands.vehicles.find((v) => v.label.includes('DEM101A'))!.id;
  await sa('POST', `/admin/bookings/${booking.id}/quote`, { amountRwf: 45_000, driverId, vehicleId, durationHours: 2 });
  await cust('POST', `/bookings/${booking.id}/pay`);
  const drv = await apiAs(api, await emailToken(api, driverEmail, demo));
  await drv('POST', `/driver/trips/${booking.id}/accept`);
  await (await apiAs(api, await emailToken(api, ownerEmail, demo)))('POST', `/owner/trips/${booking.id}/accept`);
  const { tripPin } = await cust<{ tripPin: string }>('GET', `/bookings/${booking.id}`);
  await drv('POST', `/driver/trips/${booking.id}/start`, { pin: tripPin });
  await drv('POST', `/driver/trips/${booking.id}/complete`);

  // ---- Customer: the home dashboard asks for a rating; the bell shows unread messages.
  await emailSignIn(page, customerEmail, customerPassword);
  const actions = page.getByTestId('dash-actions');
  await expect(actions).toContainText(`How was your trip ${booking.ref}? Rate your driver`);
  await expect(page.getByTestId('bell-count')).toBeVisible();

  // The inbox has the trip's messages, with the PIN masked; opening it clears the count.
  await page.getByTestId('bell').click();
  const inbox = page.getByTestId('inbox');
  await expect(inbox).toContainText(`your trip ${booking.ref} is complete`);
  await expect(inbox).toContainText('Your trip PIN is ••••');
  await expect(inbox).not.toContainText(`Your trip PIN is ${tripPin}`);
  await page.reload();
  await expect(page.getByTestId('bell-count')).toHaveCount(0);

  // Rate from the dashboard link.
  await page.getByRole('link', { name: 'Home', exact: true }).click();
  await actions.getByRole('listitem').filter({ hasText: booking.ref }).getByRole('link', { name: 'Rate' }).click();
  await expect(page).toHaveURL(new RegExp(`/bookings/${booking.id}$`));
  await page.getByTestId('star-5').click();
  await page.getByLabel('Anything to add? (optional)').fill('Calm, on time, spotless car.');
  await page.getByRole('button', { name: 'Send rating' }).click();
  await expect(page.getByTestId('rating-given')).toBeVisible();

  // Help from the booking page.
  await page.getByRole('link', { name: 'Ask the team' }).click();
  await expect(page).toHaveURL(/\/support\?booking=/);
  await page.getByLabel('Your message').fill('I left an umbrella in the car. Can the driver keep it for me?');
  await page.getByRole('button', { name: 'Send', exact: true }).click();
  await expect(page.getByTestId('support-sent')).toContainText(/Your reference is S-[0-9A-F]{6}/);
  const supportRef = (await page.getByTestId('support-sent').textContent())!.match(/S-[0-9A-F]{6}/)![0];

  // ---- Operations: the overview counts the request; reply from the Support page.
  const opsCtx = await browser.newContext();
  const ops = await opsCtx.newPage();
  await adminSignIn(ops, OPS.email, OPS.password);
  await expect(ops.getByTestId('tile-support')).not.toHaveText('0');
  await expect(ops.getByTestId('admin-overview')).toContainText('Messages are not really being sent');
  await ops.getByRole('navigation', { name: 'Admin' }).getByRole('link', { name: 'Support' }).click();
  const req = ops.locator('.card').filter({ hasText: supportRef });
  await req.getByLabel('Reply to the customer').fill('Yes, Eric has it. He will drop it at your hotel reception tomorrow.');
  await req.getByRole('button', { name: 'Send reply and close' }).click();
  await expect(ops.locator('.card').filter({ hasText: supportRef })).toHaveCount(0);

  // Operations cannot see money: no Finance tab in Reports.
  await ops.getByRole('navigation', { name: 'Admin' }).getByRole('link', { name: 'Reports' }).click();
  await expect(ops.getByTestId('report-operations')).toBeVisible();
  await expect(ops.getByRole('tab', { name: 'Finance' })).toHaveCount(0);
  await expect(ops.getByTestId('report-drivers')).toContainText('Eric Habimana');

  // Delivery log: every message is visible, and the development outbox is called out.
  await ops.getByRole('navigation', { name: 'Admin' }).getByRole('link', { name: 'Messages' }).click();
  await expect(ops.getByTestId('providers')).toContainText('SMS provider: outbox');
  await expect(ops.getByTestId('deliveries')).toContainText('We replied to your support request');
  await opsCtx.close();

  // ---- Customer reads the reply.
  await page.goto('/support');
  await expect(page.getByTestId('support-list').locator('li').filter({ hasText: supportRef }).getByTestId('support-reply')).toContainText('drop it at your hotel reception');

  // ---- Driver: the home dashboard shows the rating.
  const driverCtx = await browser.newContext();
  const driver = await driverCtx.newPage();
  await emailSignIn(driver, driverEmail, demo);
  await expect(driver.getByTestId('dash-rating')).toContainText('★');
  await driverCtx.close();

  // ---- Super admin: financial report keeps development money apart; the CSV export downloads.
  const saCtx = await browser.newContext({ acceptDownloads: true });
  const admin = await saCtx.newPage();
  await adminSignIn(admin, SUPER.email, SUPER.password);
  await admin.getByRole('navigation', { name: 'Admin' }).getByRole('link', { name: 'Reports' }).click();
  await expect(admin.getByTestId('chart-requests')).toBeVisible();
  await admin.getByRole('tab', { name: 'Finance' }).click();
  await expect(admin.getByTestId('report-finance')).toContainText('paid with the development provider');
  await expect(admin.getByTestId('report-dev-money')).toContainText('45,000 RWF');
  const [download] = await Promise.all([admin.waitForEvent('download'), admin.getByTestId('export-csv').click()]);
  expect(download.suggestedFilename()).toMatch(/^ridewell-ledger-\d{4}-\d{2}-\d{2}-to-\d{4}-\d{2}-\d{2}\.csv$/);
  const csv = fs.readFileSync((await download.path())!, 'utf8');
  expect(csv.split('\r\n')[0]).toContain('development_no_money_moved');
  expect(csv).toContain(`"${booking.ref}"`);
  await saCtx.close();
  await api.dispose();
});
