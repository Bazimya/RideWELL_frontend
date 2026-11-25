import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { BACKEND_DIR, E2E_OUTBOX } from '../playwright.config';

/** Read the latest 6-digit code texted to `e164` (dev outbox; no real SMS is sent). */
export async function latestCodeFor(e164: string, notBefore = 0): Promise<string> {
  for (let i = 0; i < 50; i++) {
    const file = path.join(E2E_OUTBOX, 'sms.jsonl');
    if (fs.existsSync(file)) {
      const msgs = fs
        .readFileSync(file, 'utf8')
        .split('\n')
        .filter(Boolean)
        .map((l) => JSON.parse(l) as { to: string; text: string; at: string })
        .filter((m) => m.to === e164 && Date.parse(m.at) >= notBefore);
      const code = msgs.at(-1)?.text.match(/\b(\d{6})\b/)?.[1];
      if (code) return code;
    }
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error(`No code texted to ${e164}`);
}

/** Run the real founder bootstrap script (create-super-admin) with a known password. */
export function bootstrapSuperAdmin(opts: { email: string; first: string; last: string; password: string }): string {
  return execFileSync('npx', ['tsx', 'src/scripts/createSuperAdmin.ts', '--email', opts.email, '--first', opts.first, '--last', opts.last, '--password', opts.password], {
    cwd: BACKEND_DIR,
    env: { ...process.env, MONGODB_URI: process.env.E2E_MONGODB_URI ?? 'mongodb://127.0.0.1:27017/ridewell_e2e?replicaSet=rs0', LOG_LEVEL: 'silent' },
    encoding: 'utf8',
  });
}

/** Seed the development placeholder config through the real seed script. */
export function seedDevConfig(): void {
  execFileSync('npx', ['tsx', 'src/scripts/seedDev.ts'], {
    cwd: BACKEND_DIR,
    env: {
      ...process.env,
      MONGODB_URI: process.env.E2E_MONGODB_URI ?? 'mongodb://127.0.0.1:27017/ridewell_e2e?replicaSet=rs0',
      LOG_LEVEL: 'silent',
    },
    stdio: 'ignore',
  });
}

/** Create a super admin directly with known credentials, through the real dev-accounts seed. */
export function seedSuperAdmin(creds: { email: string; password: string; phone: string; totpSecret: string }): void {
  seed('DEV_SUPER_ADMIN', creds);
}

/** Create an operations staff account directly with known credentials, through the real dev-accounts seed. */
export function seedOpsAdmin(creds: { email: string; password: string; phone: string; totpSecret: string }): void {
  seed('DEV_OPS_ADMIN', creds);
}

function seed(prefix: string, creds: { email: string; password: string; phone: string; totpSecret: string }): void {
  execFileSync('npx', ['tsx', 'src/scripts/seedDevAccounts.ts'], {
    cwd: BACKEND_DIR,
    env: {
      ...process.env,
      MONGODB_URI: process.env.E2E_MONGODB_URI ?? 'mongodb://127.0.0.1:27017/ridewell_e2e?replicaSet=rs0',
      [`${prefix}_EMAIL`]: creds.email,
      [`${prefix}_PASSWORD`]: creds.password,
      [`${prefix}_PHONE`]: creds.phone,
      [`${prefix}_TOTP_SECRET`]: creds.totpSecret,
      LOG_LEVEL: 'silent',
    },
    stdio: 'ignore',
  });
}

/** A real 1x1 PNG and a minimal well-formed PDF for upload tests. */
export const PNG_1PX = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
export const PDF_MIN = Buffer.from('%PDF-1.4\n1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj\n2 0 obj << /Type /Pages /Kids [] /Count 0 >> endobj\ntrailer << /Root 1 0 R >>\n%%EOF\n', 'latin1');

/** Development accounts + labelled demo partners (approved drivers, owners, vehicles) in the e2e database. */
export function seedDemoData(): void {
  const env = { ...process.env, MONGODB_URI: process.env.E2E_MONGODB_URI ?? 'mongodb://127.0.0.1:27017/ridewell_e2e?replicaSet=rs0', LOG_LEVEL: 'silent' };
  execFileSync('npx', ['tsx', 'src/scripts/seedDevAccounts.ts'], { cwd: BACKEND_DIR, env, stdio: 'ignore' });
  execFileSync('npx', ['tsx', 'src/scripts/seedDemoData.ts'], { cwd: BACKEND_DIR, env, stdio: 'ignore' });
}

/** A value from the backend .env (demo password etc.), read at run time, never hard-coded. */
export function backendEnv(key: string): string {
  const line = fs.readFileSync(path.join(BACKEND_DIR, '.env'), 'utf8').split('\n').find((l) => l.startsWith(`${key}=`));
  if (!line) throw new Error(`${key} missing from the backend .env`);
  return line.slice(key.length + 1);
}

/** A datetime-local value `minutes` from now in the browser's zone. */
export function localInMinutes(minutes: number): string {
  const d = new Date(Date.now() + minutes * 60_000);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}

/** Run the real earnings-release job as if `hours` had passed (dev script; moves the job's clock, never the data). */
export function releaseEarningsAsIf(hours: number): void {
  execFileSync('npx', ['tsx', 'src/scripts/devReleaseEarnings.ts', '--hours', String(hours)], {
    cwd: BACKEND_DIR,
    env: { ...process.env, MONGODB_URI: process.env.E2E_MONGODB_URI ?? 'mongodb://127.0.0.1:27017/ridewell_e2e?replicaSet=rs0', LOG_LEVEL: 'silent' },
    stdio: 'ignore',
  });
}
