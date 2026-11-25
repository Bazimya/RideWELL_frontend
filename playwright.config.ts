import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, devices } from '@playwright/test';

/**
 * End-to-end tests drive real Chrome against the real API and a real MongoDB
 * replica set. Nothing is mocked. The backend runs with its own database
 * (ridewell_e2e) and outbox directory so tests never touch development data.
 *
 * Requires: a MongoDB replica set reachable at E2E_MONGODB_URI, and Google Chrome.
 */
export const BACKEND_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../RideWELL_Backend');
export const E2E_OUTBOX = path.join(BACKEND_DIR, 'var/e2e-outbox');
const MONGO = process.env.E2E_MONGODB_URI ?? 'mongodb://127.0.0.1:27017/ridewell_e2e?replicaSet=rs0';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 60_000,
  globalSetup: './e2e/globalSetup.ts',
  use: {
    baseURL: 'http://localhost:5174',
    trace: 'retain-on-failure',
    ...devices['Pixel 7'], // mobile-first
    channel: 'chrome',
  },
  webServer: [
    {
      command: 'npx tsx src/server.ts',
      cwd: BACKEND_DIR,
      url: 'http://localhost:4100/ready',
      reuseExistingServer: false,
      timeout: 60_000,
      env: {
        NODE_ENV: 'development',
        PORT: '4100',
        MONGODB_URI: MONGO,
        CORS_ORIGINS: 'http://localhost:5174',
        APP_BASE_URL: 'http://localhost:5174',
        OUTBOX_DIR: E2E_OUTBOX,
        JOBS_ENABLED: 'false',
        // The same fixed development SMS code you use locally (refused in production).
        DEV_VERIFICATION_CODE: '123456',
        // The suite signs many staff in from one machine; production keeps the default 20 per 15 min (and refuses this setting).
        DEV_RATE_LIMIT_ADMIN_LOGIN: '200',
        LOG_LEVEL: 'warn',
      },
    },
    {
      command: 'npx vite --port 5174',
      url: 'http://localhost:5174',
      reuseExistingServer: false,
      timeout: 60_000,
      env: { VITE_API_PROXY: 'http://localhost:4100' },
    },
  ],
});
