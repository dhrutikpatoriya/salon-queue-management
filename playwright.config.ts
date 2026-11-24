import { randomBytes } from 'node:crypto';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { defineConfig } from '@playwright/test';

const frontend = 'http://127.0.0.1:15173';
const backend = 'http://127.0.0.1:15001';
process.env.SALON_E2E_RUN_ID ??= randomBytes(16).toString('hex');
process.env.SALON_E2E_OWNER ??= randomBytes(24).toString('hex');
process.env.SALON_E2E_STAFF ??= randomBytes(16).toString('hex');
process.env.SALON_E2E_BARBERS ??= JSON.stringify(Object.fromEntries(
  ['ravi', 'amit', 'imran'].map((name) => [name, randomBytes(16).toString('hex')]),
));

export default defineConfig({
  testDir: './tests/e2e',
  workers: 1,
  timeout: 60_000,
  expect: { timeout: 5000 },
  outputDir: './test-artifacts',
  reporter: 'list',
  use: {
    browserName: 'chromium',
    channel: process.env.SALON_E2E_BROWSER_CHANNEL,
    baseURL: frontend,
    viewport: { width: 1280, height: 900 },
    serviceWorkers: 'block',
  },
  webServer: [
    {
      command: 'npm --prefix backend run dev',
      url: `${backend}/api/health`,
      reuseExistingServer: false,
      env: {
        PORT: '15001',
        NODE_ENV: 'test',
        SALON_PERSISTENCE_TEST_DIR: '',
        OWNER_PASSWORD: process.env.SALON_E2E_OWNER,
        STAFF_PIN: process.env.SALON_E2E_STAFF,
        BARBER_CREDENTIALS: process.env.SALON_E2E_BARBERS,
        NODE_OPTIONS: `--import=${pathToFileURL(resolve('tests/e2e/clock.mjs')).href}`,
      },
    },
    {
      command: 'npm --prefix frontend run dev -- --host 127.0.0.1 --port 15173 --strictPort',
      url: frontend,
      reuseExistingServer: false,
      env: { SALON_DEV_BACKEND_ORIGIN: backend },
    },
  ],
});
