import { expect, test, type Page } from '@playwright/test';
import { backendEnv, localInMinutes, releaseEarningsAsIf, seedDemoData, seedDevConfig, seedOpsAdmin, seedSuperAdmin } from './support';

const SUPER = { email: 'finance.super@ridewell.test', password: 'Nyungwe-Canopy-Walk-27', phone: '+250788200602', totpSecret: 'KRSXG5CTMVRXEZLUKRSXG5CTMVRXEZLU' };
const OPS = { email: 'ops.bookings@ridewell.test', password: 'Akagera-Morning-Drive-61', phone: '+250788200601', totpSecret: 'JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP' };

async function emailSignIn(page: Page, email: string, password: string) {
  await page.goto('/sign-in');
  await page.getByRole('tab', { name: 'Email' }).click();
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
}

test('book from the home page → quote → pay (dev) → accept → PIN start → complete → refund → payout', async ({ page, browser }) => {
  test.setTimeout(300_000);
  seedDevConfig();
  seedDemoData();
  seedOpsAdmin(OPS);
  seedSuperAdmin(SUPER);
  const demoPassword = backendEnv('DEV_DEMO_PASSWORD');

  // ---- Visitor fills the booking form on the home page, then creates an account.
  await page.goto('/');
  await expect(page.getByTestId('price-chip')).toContainText('RWF');
  await page.getByRole('tab', { name: 'Airport transfer' }).first().click();
  await expect(page.getByTestId('price-chip')).toContainText('from 30,000 RWF');
  await page.getByLabel('Pickup address').fill('Kigali Marriott Hotel, KN 3 Ave');
  await page.getByLabel('Pickup date and time').fill(localInMinutes(80));
  await page.getByLabel('How long do you need us? (hours)').fill('2');
  await page.getByLabel('Passengers').fill('2');
  await page.getByLabel('Flight number (optional)').fill('WB 302');
  await page.getByRole('button', { name: 'Sign in to send your request' }).click();

  await expect(page).toHaveURL(/\/sign-in/);
  await page.getByRole('tab', { name: 'Email' }).click();
  await page.getByLabel('First name').fill('Alice');
  await page.getByLabel('Last name').fill('Traveller');
  await page.getByLabel('Email').fill('alice.traveller@example.com');
  await page.getByLabel('Password').fill('Gisenyi-Lakeside-Walk-88');
  await page.getByRole('button', { name: 'Create account' }).click();

  // Back on /book with the details kept.
  await expect(page).toHaveURL(/\/book$/);
  await expect(page.getByLabel('Pickup address')).toHaveValue('Kigali Marriott Hotel, KN 3 Ave');
  await page.getByRole('button', { name: 'Request a quote' }).click();
  await expect(page.getByText('Request sent')).toBeVisible();
  const ref = (await page.getByTestId('booking-ref').textContent())!.trim();
  expect(ref).toMatch(/^RW-/);
  const bookingUrl = page.url();

  // ---- Operations: choose an available demo driver and vehicle, price it, send the quote.
  const opsCtx = await browser.newContext();
  const ops = await opsCtx.newPage();
  await ops.goto('/admin/sign-in');
  await ops.getByLabel('Email').fill(OPS.email);
  await ops.getByLabel('Password').fill(OPS.password);
  await ops.getByRole('button', { name: 'Continue' }).click();
  await ops.getByRole('button', { name: 'Continue' }).click(); // development code pre-filled
  // Staff land on the overview; the new request shows in "Waiting for a quote".
  await expect(ops).toHaveURL(/\/admin\/overview/);
  await expect(ops.getByTestId('tile-awaiting-quote')).not.toHaveText('0');
  await ops.getByRole('navigation', { name: 'Admin' }).getByRole('link', { name: 'Bookings' }).click();
  await ops.getByRole('tab', { name: 'New requests' }).click();
  await ops.getByTestId('bookings-table').getByText(ref).click();
  await expect(ops.getByTestId('staff-booking-ref')).toContainText(ref);
  // The driver who is not accepting trips is listed but cannot be chosen.
  await expect(ops.getByTestId('candidate-Olivier Mugisha [DEMO]').locator('input')).toBeDisabled();
  await ops.getByTestId('candidate-Eric Habimana [DEMO]').click();
  await ops.getByTestId('candidate-Toyota Land Cruiser Prado · DEM101A').click();
  await ops.getByLabel('Price (RWF)').fill('45000');
  await expect(ops.getByTestId('split-preview')).toContainText('platform');
  await ops.getByRole('button', { name: 'Send quote' }).click();
  await expect(ops.locator('.page-head .chip')).toHaveText('Quote ready');

  // ---- Customer pays (development payment, no money moves).
  await page.goto(bookingUrl);
  await expect(page.getByText('45,000', { exact: false }).first()).toBeVisible();
  await page.getByRole('button', { name: /Pay 45,000 RWF \(development/ }).click();
  await expect(page.locator('.page-head .chip')).toHaveText('Paid');
  await expect(page.getByText(/Development payment, no money moved/)).toBeVisible();

  // ---- Driver accepts.
  const driverCtx = await browser.newContext();
  const driver = await driverCtx.newPage();
  await emailSignIn(driver, 'demo.driver.eric.habimana@ridewell.test', demoPassword);
  await driver.getByRole('link', { name: 'My trips' }).first().click();
  await expect(driver.getByText('New trip offers')).toBeVisible();
  await driver.getByTestId(`trip-${ref}`).click();
  await expect(driver.getByTestId('customer-phone')).toHaveCount(0); // no phone before acceptance
  await driver.getByRole('button', { name: 'Accept trip' }).click();
  await expect(driver.getByText(/Waiting for the vehicle owner/)).toBeVisible();

  // ---- Vehicle owner accepts.
  const ownerCtx = await browser.newContext();
  const owner = await ownerCtx.newPage();
  await emailSignIn(owner, 'demo.owner.emmanuel.rukundo@ridewell.test', demoPassword);
  await owner.goto('/owner/trips');
  await expect(owner.getByTestId(`trip-${ref}`)).toBeVisible();
  await expect(owner.getByTestId(`trip-${ref}`)).not.toContainText('Marriott'); // no customer address for owners
  await owner.getByRole('button', { name: 'Accept trip' }).click();
  await expect(owner.getByTestId(`trip-${ref}`).locator('.chip')).toHaveText('Driver confirmed');

  // ---- Customer sees driver, vehicle and PIN.
  await page.reload();
  await expect(page.locator('.page-head .chip')).toHaveText('Driver confirmed');
  await expect(page.getByTestId('driver-name')).toHaveText('Eric');
  await expect(page.getByText('DEM101A')).toBeVisible();
  const pin = (await page.getByTestId('trip-pin').textContent())!.trim();
  expect(pin).toMatch(/^\d{4}$/);

  // ---- Driver: customer phone now visible; wrong PIN refused; right PIN starts; then end.
  await driver.reload();
  await expect(driver.getByTestId('customer-phone')).toHaveCount(0); // email-only customer: no phone on file
  await expect(driver.getByRole('link', { name: /Navigate to pickup/ })).toHaveAttribute('href', /google\.com\/maps/);
  await driver.getByLabel("Customer's 4-digit trip PIN").fill(pin === '0000' ? '1111' : '0000');
  await driver.getByRole('button', { name: 'Start trip' }).click();
  await expect(driver.getByRole('alert')).toContainText('PIN is not correct');
  await driver.getByLabel("Customer's 4-digit trip PIN").fill(pin);
  await driver.getByRole('button', { name: 'Start trip' }).click();
  await expect(driver.locator('.page-head .chip')).toHaveText('On the way');
  driver.once('dialog', (d) => void d.accept());
  await driver.getByRole('button', { name: 'End trip' }).click();
  await expect(driver.locator('.page-head .chip')).toHaveText('Completed');

  await page.reload();
  await expect(page.locator('.page-head .chip')).toHaveText('Completed');
  await expect(page.getByTestId('trip-pin')).toHaveCount(0);

  // ---- Operations sees the full history.
  await ops.reload();
  await expect(ops.locator('.page-head .chip')).toHaveText('Completed');
  await expect(ops.getByText(/development, no money moved/).first()).toBeVisible();

  // ---- Money: the driver's earning is held after the trip, not payable yet.
  await driver.goto('/earnings');
  await expect(driver.getByTestId('earnings-table')).toContainText(ref);
  await expect(driver.getByTestId('earnings-table')).toContainText('Held');
  await expect(driver.getByTestId('total-payable')).toContainText(/^0/);

  // ---- Operations sees the booking balanced and requests a partial refund (cannot approve it).
  await expect(ops.getByTestId('booking-balance')).toContainText('Books balanced');
  await ops.getByLabel('Amount (RWF)').fill('5000');
  await ops.getByLabel('Reason').fill('Late pickup, goodwill credit');
  await ops.getByRole('button', { name: 'Send request' }).click();
  await expect(ops.getByText('Another person must approve it')).toBeVisible();
  await ops.goto('/admin/finance');
  await expect(ops.getByText('5,000 RWF')).toBeVisible();
  await expect(ops.getByRole('button', { name: 'Approve' })).toHaveCount(0);

  // ---- A super admin approves it with the (development) step-up code.
  const superCtx = await browser.newContext();
  const sup = await superCtx.newPage();
  await sup.goto('/admin/sign-in');
  await sup.getByLabel('Email').fill(SUPER.email);
  await sup.getByLabel('Password').fill(SUPER.password);
  await sup.getByRole('button', { name: 'Continue' }).click();
  await sup.getByRole('button', { name: 'Continue' }).click();
  await sup.getByRole('link', { name: 'Finance' }).click();
  await expect(sup.getByText('Late pickup, goodwill credit')).toBeVisible();
  await sup.getByRole('button', { name: 'Approve' }).click();
  await expect(sup.getByText('No refunds here.')).toBeVisible();

  // ---- The customer sees the refund as sent.
  await page.reload();
  await expect(page.getByTestId('refund-status')).toContainText('Refund of 5,000 RWF: sent');

  // ---- The dispute-free period passes (job clock moved), then the payout is recorded with a real-looking reference.
  releaseEarningsAsIf(24 * 30);
  await sup.getByRole('tab', { name: 'Payouts' }).click();
  await expect(sup.getByText('Eric Habimana [DEMO]')).toBeVisible();
  await sup.getByLabel('Transaction reference').first().fill('MOMO-TEST-0001');
  await sup.getByRole('button', { name: /Record payout/ }).first().click();
  await expect(sup.getByText('Payout recorded')).toBeVisible();

  await driver.reload();
  await expect(driver.getByTestId('earnings-table')).toContainText('Paid');
  await expect(driver.getByText('MOMO-TEST-0001')).toBeVisible();

  // ---- The ledger shows the whole story.
  await sup.getByRole('tab', { name: 'Ledger' }).click();
  for (const type of ['customer_payment', 'platform_commission', 'driver_earning', 'refund', 'payout']) await expect(sup.getByTestId('ledger-table').getByText(type, { exact: true }).first()).toBeVisible();
  await Promise.all([opsCtx.close(), driverCtx.close(), ownerCtx.close(), superCtx.close()]);
});
