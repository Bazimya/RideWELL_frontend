import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { BACKEND_DIR, E2E_OUTBOX } from '../playwright.config';

/** Start every run from an empty e2e database and outbox. Refuses any other database. */
export default function globalSetup() {
  const uri = process.env.E2E_MONGODB_URI ?? 'mongodb://127.0.0.1:27017/ridewell_e2e?replicaSet=rs0';
  if (!/\/ridewell_e2e(\?|$)/.test(uri)) throw new Error(`Refusing to wipe a database that is not ridewell_e2e: ${uri}`);
  execFileSync(
    process.execPath,
    ['--input-type=module', '-e', "import m from 'mongoose'; await m.connect(process.argv[1]); await m.connection.dropDatabase(); await m.disconnect();", uri],
    { cwd: BACKEND_DIR, stdio: 'inherit' },
  );
  fs.rmSync(E2E_OUTBOX, { recursive: true, force: true });
  fs.mkdirSync(E2E_OUTBOX, { recursive: true });
}
