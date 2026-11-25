import { expect, test, type Page } from '@playwright/test';
import { authenticator } from 'otplib';
import { PDF_MIN, PNG_1PX, seedDevConfig, seedOpsAdmin } from './support';

authenticator.options = { window: 1 };

const OPS = { email: 'ops.e2e@ridewell.test', password: 'Akagera-Morning-Drive-61', phone: '+250788200501', totpSecret: authenticator.generateSecret(20) };
let lastStep = 0;
async function nextCode(secret: string): Promise<string> {
  for (;;) {
    const step = Math.floor(Date.now() / 30_000);
    if (step > lastStep) {
      lastStep = step;
      return authenticator.generate(secret);
    }
    if (step + 1 > lastStep) {
      lastStep = step + 1;
      return authenticator.clone({ epoch: (step + 1) * 30_000 }).generate(secret);
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
}

async function upload(page: Page, label: string, file: { name: string; mimeType: string; buffer: Buffer }) {
  await page.getByLabel(label, { exact: true }).setInputFiles(file);
}

test('driver applies with documents; an ops admin reviews and approves; the driver sets availability', async ({ page, browser }) => {
  test.setTimeout(150_000);
  seedDevConfig();
  seedOpsAdmin(OPS);

  // ---- Driver: sign up with email and apply ---------------------------------
  await page.goto('/sign-in?mode=register');
  await page.getByRole('tab', { name: 'Email' }).click();
  await page.getByLabel('First name').fill('Eric');
  await page.getByLabel('Last name').fill('Habimana');
  await page.getByLabel('Email').fill('eric.driver@example.com');
  await page.getByLabel('Password').fill('Musanze-Volcano-Road-24');
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await page.goto('/account');

  await page.getByRole('link', { name: /Driver \/ Chauffeur/ }).click();
  await expect(page.getByRole('heading', { name: 'Your driver application' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Submit application' })).toBeDisabled();

  await page.getByLabel('Phone number operations can reach you on').fill('0788200401');
  await page.getByLabel('Licence number').fill('RW-0099887');
  await page.getByLabel('Licence expiry date').fill(`${new Date().getFullYear() + 2}-06-30`);
  await page.getByLabel('Licence categories (comma-separated, e.g. B, C)').fill('B, C');
  await page.getByLabel('Years of professional driving').fill('8');
  await page.getByLabel('Areas you work in (comma-separated)').fill('Kigali, Musanze');
  await page.getByLabel('Languages you speak (comma-separated)').fill('Kinyarwanda, English, French');
  await page.getByLabel('Name 1').fill('Claudine U.');
  await page.getByLabel('Phone 1').fill('0788200402');
  await page.getByLabel('Relationship 1').fill('Former employer');
  await page.getByLabel('Name 2').fill('Patrick N.');
  await page.getByLabel('Phone 2').fill('0788200403');
  await page.getByLabel('Relationship 2').fill('Client');
  await page.getByRole('button', { name: 'Save details' }).click();
  await expect(page.getByText('Saved.', { exact: true })).toBeVisible();

  // A file that is not really a PDF is refused, whatever its name.
  await upload(page, 'National ID or passport', { name: 'id.pdf', mimeType: 'application/pdf', buffer: Buffer.from('<html>not a pdf</html>') });
  await expect(page.getByRole('alert').first()).toContainText('Upload a JPG, PNG or PDF file.');

  await upload(page, 'National ID or passport', { name: 'id.pdf', mimeType: 'application/pdf', buffer: PDF_MIN });
  await upload(page, 'Driving licence', { name: 'licence.pdf', mimeType: 'application/pdf', buffer: PDF_MIN });
  await upload(page, 'Profile photo (your face)', { name: 'me.png', mimeType: 'image/png', buffer: PNG_1PX });
  await expect(page.getByText('9 / 9')).toBeVisible();

  await page.getByRole('button', { name: 'Submit application' }).click();
  await expect(page.locator('.page-head .chip')).toHaveText('Submitted');
  await expect(page.getByText('Your application is with our team.')).toBeVisible();

  // ---- Ops admin: review --------------------------------------------------
  const adminCtx = await browser.newContext();
  const admin = await adminCtx.newPage();
  await admin.goto('/admin/sign-in');
  await admin.getByLabel('Email').fill(OPS.email);
  await admin.getByLabel('Password').fill(OPS.password);
  await admin.getByRole('button', { name: 'Continue' }).click();
  await admin.getByLabel('Authenticator code').fill(await nextCode(OPS.totpSecret));
  await admin.getByRole('button', { name: 'Continue' }).click();
  await expect(admin.getByTestId('admin-whoami')).toBeVisible();
  await admin.getByRole('link', { name: 'Applications' }).click();
  await expect(admin.getByTestId('applications-table')).toContainText('Eric Habimana');
  await admin.getByTestId('applications-table').getByText('Eric Habimana').click();

  await admin.getByRole('button', { name: 'Start review' }).click();
  await expect(admin.locator('.page-head .chip')).toHaveText('Under review');

  // Open a document in the private viewer.
  await admin.getByTestId('doc-profile_photo').getByRole('button', { name: 'View' }).click();
  await expect(admin.getByRole('dialog').getByRole('img')).toBeVisible();
  await admin.getByRole('button', { name: 'Close' }).click();

  for (const kind of ['id_document', 'profile_photo']) {
    await admin.getByTestId(`doc-${kind}`).getByRole('button', { name: 'Approve' }).click();
    await expect(admin.getByTestId(`doc-${kind}`).locator('.chip')).toHaveText('Approved');
  }
  const licence = admin.getByTestId('doc-driving_licence');
  await expect(licence.getByRole('button', { name: 'Approve' })).toBeDisabled(); // expiry date required
  await licence.getByLabel('Expiry date on the document').fill(`${new Date().getFullYear() + 2}-06-30`);
  await licence.getByRole('button', { name: 'Approve' }).click();
  await expect(licence.locator('.chip')).toHaveText('Approved');

  await expect(admin.getByRole('button', { name: 'Approve', exact: true }).last()).toBeDisabled();
  for (const label of ['Interview', 'Driving test', 'References']) {
    await admin.getByLabel(`${label} Notes`).fill('Good');
    await admin.locator('.card.flat', { hasText: label }).getByRole('button', { name: 'Passed' }).click();
    await expect(admin.locator('.card.flat', { hasText: label }).locator('.chip')).toHaveText('Passed');
  }
  await admin.getByRole('button', { name: 'Approve', exact: true }).last().click();
  await expect(admin.locator('.page-head .chip')).toHaveText('Approved');
  await adminCtx.close();

  // ---- Driver: approved, sets availability --------------------------------
  await page.reload();
  await expect(page.getByText("You're approved")).toBeVisible();
  await page.getByLabel("I'm accepting trips").check();
  await page.getByRole('button', { name: 'Save availability' }).click();
  await expect(page.locator('.card', { hasText: 'Availability' }).getByText('Saved.')).toBeVisible();
  await page.goto('/account');
  await expect(page.getByText('Customer · Driver / Chauffeur')).toBeVisible();
});
