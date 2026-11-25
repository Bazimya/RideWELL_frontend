import { expect, test } from '@playwright/test';
import { latestCodeFor } from './support';

test('customer signs up by SMS code, edits profile, keeps the session across reloads, signs out', async ({ page, context }) => {
  const local = '0788200301';
  const e164 = '+250788200301';

  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Arrive');
  // The service panel switches content with its tabs.
  await page.getByRole('tab', { name: 'Airport transfer' }).click();
  await expect(page.getByRole('heading', { name: 'Kigali International, on time.' })).toBeVisible();
  await page.getByRole('link', { name: 'Create your account' }).first().click();

  await expect(page.getByRole('heading', { name: 'Welcome to RideWELL' })).toBeVisible();
  const startedAt = Date.now() - 1000;
  await page.getByLabel('Phone number').fill(local);
  await page.getByRole('button', { name: 'Send code' }).click();
  await expect(page.getByLabel('6-digit code')).toBeVisible();
  // Development mode: the fixed code is shown and pre-filled (no SMS provider yet).
  await expect(page.getByText('Development mode: no SMS is sent. Your code is 123456.')).toBeVisible();
  await expect(page.getByLabel('6-digit code')).toHaveValue('123456');

  await page.getByLabel('6-digit code').fill('000000');
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByRole('alert')).toContainText(/incorrect or has expired/);

  await page.getByLabel('6-digit code').fill(await latestCodeFor(e164, startedAt));
  await page.getByRole('button', { name: 'Continue' }).click();

  await expect(page).toHaveURL(/\/dashboard$/);
  await page.goto('/account');
  await expect(page.getByTestId('account-phone')).toHaveText(e164);

  await page.getByLabel('First name').fill('Aline');
  await page.getByLabel('Email (for receipts and email sign-in)').fill('aline@example.com');
  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect(page.getByText('Saved.', { exact: true })).toBeVisible();

  // Tokens are never in web storage; the refresh cookie is httpOnly + SameSite=Strict.
  const storage = await page.evaluate(() => JSON.stringify({ ...localStorage }) + JSON.stringify({ ...sessionStorage }));
  expect(storage).not.toMatch(/eyJ/);
  const cookie = (await context.cookies()).find((c) => c.name === 'rw_rt');
  expect(cookie?.httpOnly).toBe(true);
  expect(cookie?.sameSite).toBe('Strict');
  expect(cookie?.path).toBe('/api/v1/auth');

  await page.reload();
  await expect(page.getByLabel('First name')).toHaveValue('Aline');

  await page.goto('/admin');
  await expect(page).toHaveURL(/\/account$/);

  await page.getByRole('button', { name: 'Sign out', exact: true }).click();
  await page.goto('/account');
  await expect(page).toHaveURL(/\/sign-in$/);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Welcome to RideWELL' })).toBeVisible();
});

test('customer creates an account with email and password, signs out and back in', async ({ page }) => {
  await page.goto('/sign-in?mode=register');
  await page.getByRole('tab', { name: 'Email' }).click();
  await page.getByLabel('First name').fill('Jean');
  await page.getByLabel('Last name').fill('Mugabo');
  await page.getByLabel('Email').fill('jean@example.com');
  await page.getByLabel('Password').fill('password1234');
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page.getByRole('alert')).toContainText(/too common/);
  await page.getByLabel('Password').fill('Nyungwe-Canopy-Walk-88');
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole('heading', { name: 'Hello, Jean' })).toBeVisible();

  await page.getByRole('button', { name: 'Sign out', exact: true }).click();
  await page.goto('/sign-in');
  await page.getByRole('tab', { name: 'Email' }).click();
  await page.getByLabel('Email').fill('jean@example.com');
  await page.getByLabel('Password').fill('Wrong-password-000');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Email or password is incorrect');
  await page.getByLabel('Password').fill('Nyungwe-Canopy-Walk-88');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
});

test('two tabs restoring the session at once do not trigger refresh-token theft detection', async ({ page, context }) => {
  const e164 = '+250788200302';
  await page.goto('/sign-in');
  const startedAt = Date.now() - 1000;
  await page.getByLabel('Phone number').fill('0788200302');
  await page.getByRole('button', { name: 'Send code' }).click();
  await page.getByLabel('6-digit code').fill(await latestCodeFor(e164, startedAt));
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await page.goto('/account');

  const tabs = await Promise.all([context.newPage(), context.newPage(), context.newPage()]);
  await Promise.all(tabs.map((t) => t.goto('/account')));
  for (const t of tabs) await expect(t.getByTestId('account-phone')).toHaveText(e164);
  await page.reload();
  await expect(page.getByTestId('account-phone')).toHaveText(e164);
});
