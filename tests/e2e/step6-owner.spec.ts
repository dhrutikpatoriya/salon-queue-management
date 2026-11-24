import { expect, test, type Locator } from '@playwright/test';
import en from '../../frontend/src/i18n/en.json';
import gu from '../../frontend/src/i18n/gu.json';

async function fillSecret(field: Locator, value: string | undefined) {
  if (!value) throw new Error('Temporary credential is unavailable');
  await field.evaluate((element, secret) => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(element, secret);
    element.dispatchEvent(new Event('input', { bubbles: true }));
  }, value);
}

test('owner saves live service, duty, and hours changes across the salon screens', async ({ page: owner, context, request, baseURL }, testInfo) => {
  const health = await request.get('/api/health');
  expect(health.ok()).toBe(true);
  expect(Boolean(process.env.SALON_E2E_RUN_ID) &&
    health.headers()['x-salon-isolated-run'] === process.env.SALON_E2E_RUN_ID,
  'An isolated in-memory backend is required before any write').toBe(true);
  await context.route('**/*', (route) => new URL(route.request().url()).origin === baseURL ? route.continue() : route.abort());

  const home = await context.newPage();
  const join = await context.newPage();
  const reception = await context.newPage();
  const barber = await context.newPage();
  const tv = await context.newPage();
  const fixedTime = new Date('2026-11-24T06:00:00Z');
  await Promise.all([owner, home, join, reception, barber, tv].map((page) => page.clock.setFixedTime(fixedTime)));
  await tv.setViewportSize({ width: 1920, height: 1080 });

  await owner.goto('/admin');
  await expect(owner.getByRole('heading', { name: en.admin.todayStats })).toHaveCount(0);
  await fillSecret(owner.getByLabel(en.admin.password), process.env.SALON_E2E_OWNER);
  await owner.getByRole('button', { name: en.barber.login, exact: true }).click();
  await expect(owner.getByRole('heading', { name: en.admin.todayStats })).toBeVisible();

  await Promise.all([home.goto('/'), join.goto('/join'), reception.goto('/reception'), barber.goto('/barber/imran'), tv.goto('/display')]);
  await expect(home.getByRole('link', { name: en.home.joinButton })).toBeVisible();
  await fillSecret(reception.getByPlaceholder(en.reception.pinPlaceholder), process.env.SALON_E2E_STAFF);
  await reception.getByRole('button', { name: en.reception.pinSubmit }).click();
  const addWalkIn = reception.getByRole('button', { name: en.reception.addWalkIn });
  await expect(addWalkIn).toBeEnabled();
  const barberCredentials = JSON.parse(process.env.SALON_E2E_BARBERS || '{}') as Record<string, string>;
  await fillSecret(barber.getByLabel(en.barber.credential), barberCredentials.imran);
  await barber.getByRole('button', { name: en.barber.login, exact: true }).click();
  await expect(barber.getByText(en.barber.state_available, { exact: true })).toBeVisible();
  await expect(tv.getByText('Imran', { exact: true })).toBeVisible();

  const sample = 'Fixture Owner Treatment';
  await owner.getByRole('button', { name: en.admin.addService }).click();
  await owner.getByLabel(en.admin.nameEn).fill(sample);
  await owner.getByLabel(en.admin.nameGu).fill('પરીક્ષણ સેવા');
  await owner.getByLabel(en.admin.category).selectOption('spa');
  await owner.getByLabel(en.admin.price).fill('200');
  await owner.getByLabel(en.admin.duration).fill('25');
  await owner.getByRole('button', { name: en.admin.saveService }).click();
  const service = owner.getByRole('heading', { name: sample, exact: true }).locator('../..');
  await expect(service).toBeVisible();
  await join.getByPlaceholder(en.join.namePlaceholder).fill('Fixture Owner Customer');
  await join.getByPlaceholder(en.join.phonePlaceholder).fill('9000000091');
  await join.getByText('Classic Haircut', { exact: true }).first().click();
  await join.getByText(sample, { exact: true }).click();
  await join.getByRole('heading', { name: 'Imran', exact: true }).click();
  await join.getByRole('button', { name: en.join.confirmButton }).click();
  await expect(join).toHaveURL(/\/status\/[^/]+$/);
  await expect(join.getByText('₹200', { exact: true }).first()).toBeVisible();

  await service.getByRole('button', { name: en.admin.edit, exact: true }).click();
  await owner.getByLabel(en.admin.price).fill('280');
  await owner.getByLabel(en.admin.duration).fill('40');
  await owner.getByRole('button', { name: en.admin.saveService }).click();
  await expect(service).toContainText('₹280');
  await expect(join.getByText('₹200', { exact: true }).first()).toBeVisible();
  await expect(join.getByText('₹280', { exact: true })).toHaveCount(0);

  const imran = owner.getByRole('heading', { name: 'Imran', exact: true }).locator('../..');
  await imran.getByRole('button', { name: en.admin.takeOffDuty }).click();
  await expect(tv.getByText('Imran', { exact: true })).toHaveCount(0);
  await expect(barber.getByText(en.barber.state_off_duty, { exact: true })).toBeVisible();
  await expect(join.getByText(en.settings.preferredOffDuty, { exact: true })).toBeVisible();
  await imran.getByRole('button', { name: en.admin.putOnDuty }).click();
  await expect(tv.getByText('Imran', { exact: true })).toBeVisible();

  await owner.getByLabel(en.admin.openTime).fill('10:00');
  await owner.getByLabel(en.admin.closeTime).fill('13:00');
  await owner.getByRole('checkbox', { name: en.admin.onlineJoining }).uncheck();
  await owner.getByRole('button', { name: en.admin.saveHours }).click();
  await expect(home.getByRole('button', { name: en.home.joinButton })).toBeDisabled();
  await expect(home.getByText(/10:00.*13:00/)).toBeVisible();
  await expect(home.getByText(/12:30/)).toBeVisible();
  await expect(addWalkIn).toBeEnabled();
  await expect(tv.getByText(en.display.open, { exact: true })).toBeVisible();
  const newJoin = await context.newPage();
  await newJoin.goto('/join');
  await expect(newJoin.getByRole('button', { name: en.join.confirmButton })).toBeDisabled();
  await expect(newJoin.getByText(new RegExp(en.settings.onlineDisabled))).toBeVisible();

  await addWalkIn.click();
  await reception.getByPlaceholder(en.join.namePlaceholder).fill('Fixture Walk-in During Online Closure');
  await reception.getByPlaceholder(en.join.phonePlaceholder).fill('9000000092');
  await reception.getByRole('button', { name: new RegExp(sample) }).click();
  await reception.getByRole('button', { name: en.reception.walkInSubmitBtn }).click();
  await expect(reception.getByText('Fixture Walk-in During Online Closure', { exact: true })).toBeVisible();
  await service.getByRole('button', { name: en.admin.deactivate }).click();
  await expect(newJoin.getByText(sample, { exact: true })).toHaveCount(0);
  await expect(join.getByText(sample, { exact: true })).toBeVisible();

  await owner.screenshot({ path: testInfo.outputPath('owner-dashboard-en.png'), fullPage: true });
  await owner.setViewportSize({ width: 390, height: 844 });
  await owner.getByRole('button', { name: 'Toggle language' }).click();
  await expect(owner.getByRole('heading', { name: gu.admin.todayStats })).toBeVisible();
  expect(await owner.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await expect(owner.getByRole('button', { name: gu.admin.saveHours })).toBeEnabled();
  await owner.screenshot({ path: testInfo.outputPath('owner-dashboard-gu-390.png'), fullPage: true });
  await owner.getByRole('button', { name: gu.barber.logout }).click();
  await expect(owner.getByLabel(gu.admin.password)).toBeVisible();
});
