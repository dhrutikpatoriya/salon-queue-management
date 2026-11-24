import { randomBytes } from 'node:crypto';
import { expect, test, type Locator } from '@playwright/test';
import en from '../../frontend/src/i18n/en.json';
import gu from '../../frontend/src/i18n/gu.json';

async function enter(field: Locator, secret: string) {
  if (!secret) throw new Error('Missing test credential');
  await field.evaluate((input, value) => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  }, secret);
}

test('owner rotates credentials without exposing them and revokes only affected sessions', async ({ page, context, request, baseURL }, testInfo) => {
  const health = await request.get('/api/health');
  expect(health.ok()).toBe(true);
  expect(Boolean(process.env.SALON_E2E_RUN_ID) &&
    health.headers()['x-salon-isolated-run'] === process.env.SALON_E2E_RUN_ID).toBe(true);
  await context.route('**/*', (route) => new URL(route.request().url()).origin === baseURL ? route.continue() : route.abort());
  const original = {
    owner: process.env.SALON_E2E_OWNER!,
    reception: process.env.SALON_E2E_STAFF!,
    barbers: JSON.parse(process.env.SALON_E2E_BARBERS || '{}') as Record<string, string>,
  };
  const next = Object.fromEntries(['owner', 'reception'].map((id) => [id, 'Aa-' + randomBytes(20).toString('hex')]));
  async function login(path: string, field: string, value: string) {
    const response = await request.post(path, { data: { [field]: value } });
    return { status: response.status(), token: response.ok() ? (await response.json()).token as string : undefined };
  }
  async function session(path: string, token?: string) {
    if (!token) throw new Error('Expected a test session');
    return (await request.get(path, { headers: { Authorization: `Bearer ${token}` } })).status();
  }

  const oldStaff = await login('/api/reception/login', 'pin', original.reception);
  const roster = ['ravi', 'amit', 'imran'] as const;
  const originalSessions = new Map<string, string>();
  for (const id of roster) {
    const signIn = await login(`/api/barber/${id}/login`, 'credential', original.barbers[id] ?? 'missing-fixture');
    expect(signIn.status).toBe(original.barbers[id] ? 200 : 503);
    if (signIn.token) originalSessions.set(id, signIn.token);
  }
  const oldOwner = await login('/api/admin/login', 'password', original.owner);
  expect([oldStaff.status, oldOwner.status]).toEqual([200, 200]);

  await page.goto('/admin');
  await enter(page.getByLabel(en.admin.password), original.owner);
  await page.getByRole('button', { name: en.barber.login, exact: true }).click();
  const section = page.getByRole('heading', { name: en.security.title }).locator('..');
  await expect(section).toBeVisible();
  for (const name of [en.security.receptionist, 'Ravi', 'Amit', 'Imran', en.security.owner]) {
    await expect(section.getByRole('heading', { name, exact: true })).toBeVisible();
  }

  async function submit(name: string, credential: string, current = original.owner, setting = false) {
    const row = section.getByRole('heading', { name, exact: true }).locator('../..');
    await row.getByRole('button', { name: name === en.security.owner ? en.security.changeOwner : setting ? en.security.setPasscode : en.security.changePasscode }).click();
    await enter(section.getByLabel(en.security.currentOwnerPassword), current);
    await enter(section.getByLabel(en.security.newCredential, { exact: true }), credential);
    await enter(section.getByLabel(en.security.confirmation), credential);
    await section.getByRole('button', { name: en.security.save }).click();
  }

  await submit(en.security.receptionist, next.reception, 'incorrect fixture credential');
  await expect(page.getByRole('alert')).toHaveText(en.admin.reauthenticationFailed);
  await submit(en.security.receptionist, next.reception);
  await expect(page.getByText(en.admin.credentialChanged, { exact: true })).toBeVisible();
  expect(await session('/api/reception/session', oldStaff.token)).toBe(401);
  expect((await login('/api/reception/login', 'pin', original.reception)).status).toBe(401);
  const staff = await login('/api/reception/login', 'pin', next.reception);
  expect(staff.status).toBe(200);
  expect(await session('/api/reception/dashboard', staff.token)).toBe(200);
  const authenticated = new Map<string, string>();
  const pin = () => Array.from(randomBytes(20), (byte) => String(byte % 10)).join('');
  for (const id of roster) {
    const name = id[0].toUpperCase() + id.slice(1);
    const barberPage = await context.newPage();
    await barberPage.goto(`/barber/${name}`);
    const field = barberPage.getByLabel(en.barber.credential);
    const signInButton = barberPage.getByRole('button', { name: en.barber.login, exact: true });
    let previous = original.barbers[id];
    let previousToken = originalSessions.get(id);
    const row = section.getByRole('heading', { name, exact: true }).locator('../..');
    if (!previous) {
      await enter(field, 'unused fixture');
      await signInButton.click();
      await expect(barberPage.getByRole('alert')).toHaveText(en.barber.credentialUnavailable);
      previous = pin();
      await submit(name, previous, original.owner, true);
      await expect(row.getByRole('button', { name: en.security.changePasscode })).toBeVisible();
      previousToken = (await login(`/api/barber/${id}/login`, 'credential', previous)).token;
      expect(Boolean(previousToken)).toBe(true);
    }
    const updated = pin();
    await submit(name, updated);
    await expect(section.getByLabel(en.security.currentOwnerPassword)).toHaveCount(0);
    expect(await session(`/api/barber/${id}/dashboard`, previousToken)).toBe(401);
    await enter(field, previous);
    await signInButton.click();
    await expect(barberPage.getByRole('alert')).toHaveText(en.barber.invalidCredential);
    await enter(field, updated);
    const signedIn = barberPage.waitForResponse((response) =>
      response.url().toLowerCase().endsWith(`/api/barber/${id}/login`) && response.ok());
    await signInButton.click();
    const issued = (await (await signedIn).json()).token as string;
    authenticated.set(id, issued);
    await expect(barberPage.getByRole('heading', { name: en.barber.assignedCustomer })).toBeVisible();

    for (const other of roster.filter((candidate) => candidate !== id)) {
      expect(await session(`/api/barber/${other}/dashboard`, issued)).toBe(403);
      const unrelated = authenticated.get(other) ?? originalSessions.get(other);
      if (unrelated) expect(await session(`/api/barber/${other}/dashboard`, unrelated)).toBe(200);
    }

    // The preceding E2E suite may have left a Called fixture on this shared test server.
    const start = barberPage.getByRole('button', { name: en.barber.startService });
    const done = barberPage.getByRole('button', { name: en.barber.doneService });
    const goOnBreak = barberPage.getByRole('button', { name: en.barber.startBreak });
    if (!(await start.isVisible())) {
      const walkIn = await request.post('/api/reception/walk-in', {
        headers: { Authorization: `Bearer ${staff.token}` },
        data: { customerName: 'Credential test fixture', phoneNumber: `900000008${roster.indexOf(id)}`, serviceIds: ['haircut'], barberPreference: id },
      });
      expect(walkIn.status()).toBe(201);
      const call = await request.post('/api/reception/call-next', {
        headers: { Authorization: `Bearer ${staff.token}` }, data: { barberId: id },
      });
      expect(call.ok()).toBe(true);
      expect((await call.json()).called).toBe(true);
    }
    await expect(start).toBeVisible();
    await expect(goOnBreak).toHaveCount(0);
    if (id !== 'ravi') {
      const dashboard = await request.get(`/api/barber/${id}/dashboard`, { headers: { Authorization: `Bearer ${issued}` } });
      const assigned = (await dashboard.json()).assignment.id;
      for (const path of [id, 'ravi']) {
        const denied = await request.post(`/api/barber/${path}/assignments/${encodeURIComponent(assigned)}/start`,
          { headers: { Authorization: `Bearer ${authenticated.get('ravi')}` } });
        expect(denied.status()).toBe(path === id ? 403 : 404);
      }
    }
    await start.click();
    await expect(done).toBeVisible();
    await expect(goOnBreak).toHaveCount(0);
    await done.click();
    await expect(goOnBreak).toBeVisible();
    await goOnBreak.click();
    const end = barberPage.getByRole('button', { name: en.barber.endBreak });
    await expect(end).toBeVisible();
    await end.click();
    await expect(barberPage.getByText(en.barber.state_available, { exact: true })).toBeVisible();
    await barberPage.close();
  }
  await section.screenshot({ path: testInfo.outputPath('staff-access-en.png') });

  await submit(en.security.owner, next.owner);
  await expect(page.getByText(en.admin.ownerPasswordChanged, { exact: true })).toBeVisible();
  expect(await session('/api/admin/dashboard', oldOwner.token)).toBe(401);
  expect((await login('/api/admin/login', 'password', original.owner)).status).toBe(401);
  await enter(page.getByLabel(en.admin.password), next.owner);
  await page.getByRole('button', { name: en.barber.login, exact: true }).click();
  await expect(section).toBeVisible();
  expect(await session('/api/reception/session', staff.token)).toBe(200);
  for (const id of roster) expect(await session(`/api/barber/${id}/dashboard`, authenticated.get(id))).toBe(200);

  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'Toggle language' }).click();
  const localized = page.getByRole('heading', { name: gu.security.title }).locator('..');
  await expect(localized).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await localized.screenshot({ path: testInfo.outputPath('staff-access-gu-390.png') });
});
