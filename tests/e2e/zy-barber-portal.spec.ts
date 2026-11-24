import { expect, test, type Page } from '@playwright/test';
import en from '../../frontend/src/i18n/en.json';
import gu from '../../frontend/src/i18n/gu.json';

test('barber portal selects profiles, revokes sessions, and supports the mobile service workflow', async ({ page, context, request, baseURL }, info) => {
  const health = await request.get('/api/health');
  expect(health.ok()).toBe(true);
  expect(Boolean(process.env.SALON_E2E_RUN_ID) &&
    health.headers()['x-salon-isolated-run'] === process.env.SALON_E2E_RUN_ID).toBe(true);
  await context.route('**/*', (route) => new URL(route.request().url()).origin === baseURL ? route.continue() : route.abort());
  const credentials = JSON.parse(process.env.SALON_E2E_BARBERS || '{}') as Record<string, string>;

  async function login(target: Page, id: string) {
    const field = target.getByLabel(en.barber.credential);
    await field.evaluate((input, secret) => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(input, secret);
      input.dispatchEvent(new Event('input', { bubbles: true }));
    }, credentials[id]);
    const signedIn = target.waitForResponse((response) =>
      response.url().toLowerCase().endsWith(`/api/barber/${id}/login`) && response.ok());
    await target.getByRole('button', { name: en.barber.login, exact: true }).click();
    const result = await (await signedIn).json() as { token: string };
    await expect(target.getByRole('heading', { name: en.barber.assignedCustomer })).toBeVisible();
    return result.token;
  }

  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });
  const checkAccess = async (id: string, token: string) =>
    (await request.get(`/api/barber/${id}/dashboard`, { headers: auth(token) })).status();
  const fit = async () => expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);

  const ownerResponse = await request.post('/api/admin/login', { data: { password: process.env.SALON_E2E_OWNER } });
  expect(ownerResponse.ok()).toBe(true);
  const ownerAuth = auth((await ownerResponse.json()).token);
  const duty = (enabled: boolean) => request.patch('/api/admin/barbers/imran/duty', {
    headers: ownerAuth, data: { onDuty: enabled },
  });
  expect((await duty(false)).status()).toBe(204);
  const publicRoster = (await (await request.get('/api/salon/barbers?scope=portal')).json()).barbers;
  expect(publicRoster.every((entry: object) => Object.keys(entry).sort().join() === 'id,name,status')).toBe(true);
  const customerRoster = (await (await request.get('/api/salon/barbers')).json()).barbers;
  expect(customerRoster.some(({ id }: { id: string }) => id === 'imran')).toBe(false);

  await page.setViewportSize({ width: 320, height: 844 });
  await page.goto('/');
  await page.getByRole('link', { name: en.nav.barber, exact: true }).click();
  await expect(page).toHaveURL(/\/barber$/);
  await expect(page.getByRole('heading', { name: en.nav.barber })).toBeVisible();
  for (const name of ['Ravi', 'Amit', 'Imran']) await expect(page.getByRole('link', { name: new RegExp('^' + name) })).toBeVisible();
  await expect(page.getByRole('link', { name: /^Imran/ })).toContainText(en.barber.state_off_duty);
  await fit();
  await page.screenshot({ path: info.outputPath('barber-portal-320.png') });

  const raviCard = page.getByRole('link', { name: /^Ravi/ });
  await raviCard.focus();
  await expect(raviCard).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/barber\/ravi$/);
  const ravi = await login(page, 'ravi');
  expect(await checkAccess('amit', ravi)).toBe(403);

  const start = page.getByRole('button', { name: en.barber.startService });
  if (!(await start.isVisible())) {
    const staff = await request.post('/api/reception/login', { data: { pin: process.env.SALON_E2E_STAFF } });
    expect(staff.ok()).toBe(true);
    const headers = auth((await staff.json()).token);
    const walkIn = await request.post('/api/reception/walk-in', {
      headers, data: { customerName: 'Portal fixture', phoneNumber: '9000000087', serviceIds: ['haircut'], barberPreference: 'ravi' },
    });
    expect(walkIn.status()).toBe(201);
    const next = await request.post('/api/reception/call-next', { headers, data: { barberId: 'ravi' } });
    expect(next.ok()).toBe(true);
    expect((await next.json()).called).toBe(true);
  }
  await expect(start).toBeEnabled();
  expect((await start.boundingBox())?.height).toBeGreaterThanOrEqual(44);
  await start.click();
  await page.getByRole('button', { name: en.barber.doneService }).click();
  await page.getByRole('button', { name: en.barber.startBreak }).click();
  await expect(page.getByText(en.barber.state_break, { exact: true })).toBeVisible();
  await page.getByRole('button', { name: en.barber.endBreak }).click();
  await expect(page.getByText(en.barber.state_available, { exact: true })).toBeVisible();
  await fit();

  await page.getByRole('button', { name: en.barber.switchProfile }).click();
  await expect(page).toHaveURL(/\/barber$/);
  expect(await checkAccess('ravi', ravi)).toBe(401);
  await page.getByRole('link', { name: /^Amit/ }).click();
  const amit = await login(page, 'amit');
  await page.getByRole('button', { name: en.barber.logout }).click();
  await expect(page.getByLabel(en.barber.credential)).toBeVisible();
  expect(await checkAccess('amit', amit)).toBe(401);
  await page.getByRole('link', { name: en.barber.backToProfiles }).click();

  // A previously bookmarked mixed-case route still opens the right sign-in screen.
  await page.getByRole('link', { name: /^Imran/ }).click();
  await expect(page).toHaveURL(/\/barber\/imran$/);
  expect((await duty(true)).status()).toBe(204);
  await page.goto('/barber/Imran');
  await login(page, 'imran');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'Toggle language' }).click();
  await expect(page.getByRole('heading', { name: gu.barber.assignedCustomer })).toBeVisible();
  await fit();
  await page.screenshot({ path: info.outputPath('barber-dashboard-gu-390.png') });
  await page.getByRole('button', { name: gu.barber.switchProfile }).click();
  await expect(page.getByRole('heading', { name: gu.nav.barber })).toBeVisible();
  await fit();
});
