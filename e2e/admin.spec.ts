import { expect, test, type Page } from '@playwright/test';
import { bootstrapSuperAdmin, seedDevConfig } from './support';

/**
 * Staff sign-in in development: no authenticator yet, so after the password the
 * code step shows the development code, pre-filled. (The real authenticator
 * setup path is covered by the backend tests, which run without a development code.)
 */
async function devSignIn(page: Page, email: string, password: string): Promise<void> {
  await page.goto('/admin/sign-in');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByText('Development mode: authenticator not required. Use code 123456.')).toBeVisible();
  await expect(page.getByLabel('Authenticator code')).toHaveValue('123456');
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByTestId('admin-whoami')).toBeVisible();
}

test('super admin creates a staff account with ticked permissions; the staff member sees only those; changes apply immediately', async ({ page, browser }) => {
  test.setTimeout(180_000);
  seedDevConfig();
  const founder = { email: 'founder@ridewell.test', first: 'Founder', last: 'One', password: 'Kigali-Heights-Morning-77' };
  bootstrapSuperAdmin(founder);

  // ---- Founder: wrong password gets the generic message; then signs in with the development code.
  await page.goto('/admin/sign-in');
  await page.getByLabel('Email').fill(founder.email);
  await page.getByLabel('Password').fill('Not-the-password-123');
  await page.getByRole('button', { name: 'Continue' }).click();
  // First request on a cold server (bcrypt, index builds) can take a few seconds.
  await expect(page.getByRole('alert')).toContainText('Email or password is incorrect', { timeout: 20_000 });
  await devSignIn(page, founder.email, founder.password);
  await expect(page.getByTestId('admin-whoami')).toContainText('Super admin');
  await expect(page.getByRole('navigation', { name: 'Admin' }).getByRole('link')).toHaveText(['Overview', 'Bookings', 'Reports', 'Safety', 'Support', 'Applications', 'Users', 'Finance', 'Messages', 'Staff', 'Settings', 'Audit log']);

  // ---- Create a staff account: password set by the founder, permissions ticked.
  await page.getByRole('link', { name: 'Staff' }).click();
  await page.getByLabel('First name').fill('Olivier');
  await page.getByLabel('Last name').fill('Review');
  await page.getByLabel('Email', { exact: true }).fill('olivier@ridewell.test');
  await page.getByLabel('Password', { exact: true }).fill('Rubavu-Beach-Walk-2026');
  await page.getByRole('button', { name: 'Partner reviewer' }).click();
  await expect(page.getByLabel('Review documents, record checks and inspections, approve or reject')).toBeChecked();
  await page.getByLabel('Read the audit log').check();
  await expect(page.getByLabel('Change commission, partner shares and platform rules')).not.toBeChecked();

  await page.getByLabel('Your current authenticator code').fill('000000');
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page.getByRole('alert')).toContainText(/authenticator code is incorrect/);
  await page.getByLabel('Your current authenticator code').fill('123456');
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page.getByText(/Account created\./)).toBeVisible();
  const card = page.getByTestId('staff-olivier@ridewell.test');
  await expect(card).toContainText('partners.review');
  await expect(card).toContainText('audit.view');
  await expect(card).toContainText('Set up at first sign-in');
  // The confirmation field is pre-filled with the development code again.
  await expect(page.getByLabel('Your current authenticator code')).toHaveValue('123456');

  // ---- Staff member signs in; only granted sections appear.
  const staffCtx = await browser.newContext();
  const staff = await staffCtx.newPage();
  await devSignIn(staff, 'olivier@ridewell.test', 'Rubavu-Beach-Walk-2026');
  await expect(staff.getByTestId('admin-whoami')).toContainText('Staff');
  await expect(staff.getByRole('navigation', { name: 'Admin' }).getByRole('link')).toHaveText(['Overview', 'Applications', 'Audit log']);
  // A page outside their permissions: the API refuses it.
  await staff.goto('/admin/staff');
  await expect(staff.getByRole('alert')).toContainText(/permission/i);

  // ---- Founder removes audit-log access; the staff member loses it on the next load.
  await page.reload();
  await page.getByTestId('staff-olivier@ridewell.test').getByRole('button', { name: 'Edit' }).click();
  const editor = page.getByTestId('staff-editor-olivier@ridewell.test');
  await editor.getByLabel('Read the audit log').uncheck();
  await expect(editor.getByLabel('Your current authenticator code')).toHaveValue('123456');
  await editor.getByRole('button', { name: 'Save permissions' }).click();
  await expect(page.getByTestId('staff-olivier@ridewell.test')).not.toContainText('audit.view');

  await staff.goto('/admin/applications');
  await staff.reload();
  await expect(staff.getByRole('navigation', { name: 'Admin' }).getByRole('link')).toHaveText(['Overview', 'Applications']);
  await staffCtx.close();

  // ---- The audit trail records it all.
  await page.getByRole('link', { name: 'Audit log' }).click();
  const audit = page.getByTestId('audit-table');
  await expect(audit).toContainText('staff.created');
  await expect(audit).toContainText('staff.updated');
  await expect(audit).toContainText('auth.admin_login');

  // ---- Settings shows the placeholder warning; sign out works.
  await page.getByRole('link', { name: 'Settings' }).click();
  await expect(page.getByText(/development placeholder values/)).toBeVisible();
  await page.getByRole('button', { name: 'Sign out', exact: true }).click();
  await page.goto('/admin');
  await expect(page).toHaveURL(/\/admin\/sign-in$/);
});
