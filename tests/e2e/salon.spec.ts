import { expect, test, type Locator, type Page, type WebSocketRoute } from '@playwright/test';
import en from '../../frontend/src/i18n/en.json';
import gu from '../../frontend/src/i18n/gu.json';

const clock = new Date('2026-11-24T06:00:00Z');
const liveTimeout = { timeout: 5000 };

test.beforeEach(async ({ context, request, baseURL }) => {
  const health = await request.get('/api/health');
  expect(health.ok()).toBe(true);
  const confirmed = Boolean(process.env.SALON_E2E_RUN_ID) &&
    health.headers()['x-salon-isolated-run'] === process.env.SALON_E2E_RUN_ID;
  expect(confirmed, 'Isolated test mode and in-memory SQLite must be confirmed before any writes').toBe(true);
  await context.route('**/*', (route) => {
    if (new URL(route.request().url()).origin === baseURL) return route.continue();
    return route.abort();
  });
});

async function enterSecret(field: Locator, value: string | undefined) {
  if (!value) throw new Error('Temporary test credential is unavailable');
  // Keep credential values out of Playwright action logs, including failure output.
  await field.evaluate((element, secret) => {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
    setter?.call(element, secret);
    element.dispatchEvent(new Event('input', { bubbles: true }));
  }, value);
}

async function signInBarber(page: Page, name: string) {
  const credentials = JSON.parse(process.env.SALON_E2E_BARBERS || '{}');
  await page.goto(`/barber/${name}`);
  await enterSecret(page.getByLabel(en.barber.credential), credentials[name]);
  const signedIn = page.waitForResponse((response) => response.url().endsWith(`/barber/${name}/login`) && response.ok());
  await page.getByRole('button', { name: en.barber.login, exact: true }).click();
  const token: string = (await (await signedIn).json()).token;
  await expect(page.getByRole('heading', { name: en.barber.assignedCustomer })).toBeVisible();
  return token;
}

async function walkIn(page: Page, name: string, phone: string, barber?: string) {
  await page.getByRole('button', { name: en.reception.addWalkIn }).click();
  await page.getByPlaceholder(en.join.namePlaceholder).fill(name);
  await page.getByPlaceholder(en.join.phonePlaceholder).fill(phone);
  await page.getByRole('button', { name: /Classic Haircut/ }).click();
  if (barber) await page.getByRole('button', { name: barber, exact: true }).click();
  const created = page.waitForResponse((response) => response.url().endsWith('/reception/walk-in') && response.status() === 201);
  await page.getByRole('button', { name: en.reception.walkInSubmitBtn }).click();
  const result = (await (await created).json()).ticket as { id: string; tokenDisplay: string };
  await expect(page.getByPlaceholder(en.join.namePlaceholder)).toBeHidden();
  return result;
}

function callNext(page: Page, barber: string) {
  const card = page.getByText(barber, { exact: true }).locator('../../..');
  return card.getByRole('button', { name: en.reception.callNextBtn, exact: true });
}

async function fitsScreen(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  expect(overflow, 'Page should not scroll horizontally').toBe(false);
}

async function usable(control: Locator) {
  await expect(control).toBeVisible();
  await expect(control).toBeEnabled();
  const box = await control.boundingBox();
  expect(box?.height).toBeGreaterThanOrEqual(44);
  await control.click({ trial: true });
}

test('reception, customer, barber and TV stay synchronized through a service and reconnect', async ({ page: reception, context }, testInfo) => {
  const customer = await context.newPage();
  const barber = await context.newPage();
  const tv = await context.newPage();
  await Promise.all([reception, customer, barber, tv].map((page) => page.clock.setFixedTime(clock)));
  await barber.setViewportSize({ width: 390, height: 844 });
  await tv.setViewportSize({ width: 1920, height: 1080 });

  let socketBlocked = false;
  const connections = new Map<WebSocketRoute, WebSocketRoute>();
  await tv.routeWebSocket(/\/socket\.io\//, (socket) => {
    if (socketBlocked) {
      socket.close();
      return;
    }
    connections.set(socket, socket.connectToServer());
  });
  await tv.route('**/socket.io/**', (route) => socketBlocked ? route.abort() : route.continue());

  await reception.goto('/reception');
  await enterSecret(reception.getByPlaceholder(en.reception.pinPlaceholder), process.env.SALON_E2E_STAFF);
  await reception.getByRole('button', { name: en.reception.pinSubmit }).click();
  const first = await walkIn(reception, 'Fixture Walk-in One', '9000000001', 'Ravi');
  expect(first.tokenDisplay).toBe('S-1');

  // A real online join supplies the private customer status credential through normal UI.
  await customer.goto('/join');
  await customer.getByPlaceholder(en.join.namePlaceholder).fill('Fixture Online Customer');
  await customer.getByPlaceholder(en.join.phonePlaceholder).fill('9000000002');
  await customer.getByRole('button', { name: en.join.confirmButton }).click();
  await expect(customer).toHaveURL(/\/status\/[^/]+$/);
  await expect(customer.getByText(en.status.statusWaiting, { exact: true })).toBeVisible();
  const onlineId = new URL(customer.url()).pathname.split('/').at(-1);

  const privateValues = [first.id, onlineId!, 'Fixture Walk-in One', 'Fixture Online Customer', '9000000001', '9000000002', 'Classic Haircut'];
  for (let index = 3; index <= 7; index++) {
    const name = `Fixture Waiting ${index}`;
    const phone = `900000000${index}`;
    const ticket = await walkIn(reception, name, phone);
    privateValues.push(name, phone, ticket.id);
  }
  const barberToken = await signInBarber(barber, 'amit');
  await tv.goto('/display');
  await expect(tv.getByRole('heading', { name: en.display.upNext })).toBeVisible();
  const waiting = tv.getByRole('listitem').locator('span').filter({ hasText: /^S-\d+$/ });
  const amit = tv.getByText('Amit', { exact: true }).locator('../..');
  const ravi = tv.getByText('Ravi', { exact: true }).locator('../..');
  await expect(waiting).toHaveText(['S-1', 'S-2', 'S-3', 'S-4', 'S-5']);
  await expect.poll(() => connections.size).toBeGreaterThan(0);

  await callNext(reception, 'Amit').click();
  await Promise.all([
    expect(customer.getByText(en.status.statusCalled, { exact: true })).toBeVisible(liveTimeout),
    expect(amit.getByText('S-2', { exact: true })).toBeVisible(liveTimeout),
    expect(amit).toHaveClass(/animate-pulse/, liveTimeout),
    expect(barber.getByRole('button', { name: en.barber.startService })).toBeVisible(liveTimeout),
  ]);
  await expect(waiting).toHaveText(['S-1', 'S-3', 'S-4', 'S-5', 'S-6']);
  await expect(tv.locator('body')).not.toContainText(/Fixture|900000000[1-7]|Classic Haircut/);
  const publicData = await (await tv.request.get('/api/display')).text();
  expect(privateValues.every((value) => !publicData.includes(value)), 'TV API omits private fixture information').toBe(true);
  await tv.screenshot({ path: testInfo.outputPath('tv-called-1920x1080.png') });
  await customer.screenshot({ path: testInfo.outputPath('customer-called.png') });
  await reception.screenshot({ path: testInfo.outputPath('reception-called.png') });

  await expect(barber.getByRole('button', { name: en.barber.startBreak })).toHaveCount(0);
  const rejectBreak = await barber.request.patch('/api/barber/amit/availability', {
    headers: { Authorization: `Bearer ${barberToken}` }, data: { status: 'break' },
  });
  expect(rejectBreak.status()).toBe(409);
  const start = barber.getByRole('button', { name: en.barber.startService });
  await usable(start);
  await start.click();
  await Promise.all([
    expect(customer.getByText(en.status.statusInChair, { exact: true })).toBeVisible(liveTimeout),
    expect(amit.getByText(en.barber.state_in_chair, { exact: true })).toBeVisible(liveTimeout),
    expect(barber.getByRole('button', { name: en.barber.doneService })).toBeVisible(liveTimeout),
  ]);
  await expect(barber.getByRole('button', { name: en.barber.startBreak })).toHaveCount(0);
  await fitsScreen(barber);
  await barber.screenshot({ path: testInfo.outputPath('barber-in-chair-390x844.png') });
  const done = barber.getByRole('button', { name: en.barber.doneService });
  await usable(done);
  await done.click();
  await Promise.all([
    expect(customer.getByText(en.status.statusDone, { exact: true }).first()).toBeVisible(liveTimeout),
    expect(amit.getByText(en.barber.state_available, { exact: true })).toBeVisible(liveTimeout),
    expect(barber.getByText(en.barber.noAssignment, { exact: true })).toBeVisible(liveTimeout),
    expect(callNext(reception, 'Amit')).toBeEnabled(liveTimeout),
  ]);
  await barber.getByRole('button', { name: en.barber.startBreak }).click();
  await expect(amit.getByText(en.barber.state_break, { exact: true })).toBeVisible(liveTimeout);
  await expect(callNext(reception, 'Amit')).toBeDisabled();
  await barber.getByRole('button', { name: en.barber.endBreak }).click();
  await expect(callNext(reception, 'Amit')).toBeEnabled(liveTimeout);

  socketBlocked = true;
  await Promise.all([...connections].flatMap(([socket, upstream]) => [socket.close(), upstream.close()]));
  connections.clear();
  await expect(tv.getByRole('status').filter({ hasText: en.display.reconnecting })).toBeVisible(liveTimeout);
  await tv.screenshot({ path: testInfo.outputPath('tv-reconnecting.png') });
  await callNext(reception, 'Ravi').click();
  await expect(callNext(reception, 'Ravi')).toBeDisabled();
  socketBlocked = false;
  await expect(tv.getByText(en.display.reconnecting, { exact: true })).toBeHidden(liveTimeout);
  await expect(ravi.getByText('S-1', { exact: true })).toBeVisible(liveTimeout);
  await expect(ravi).not.toHaveClass(/animate-pulse/);
  await expect(waiting).toHaveText(['S-3', 'S-4', 'S-5', 'S-6', 'S-7']);
  await fitsScreen(tv);
  await tv.screenshot({ path: testInfo.outputPath('tv-recovered-1920x1080.png') });
});

test('barber and TV render English and Gujarati with usable controls and no horizontal overflow', async ({ page: barber, context }, testInfo) => {
  const tv = await context.newPage();
  await tv.setViewportSize({ width: 1920, height: 1080 });
  await tv.clock.setFixedTime(clock);
  await barber.setViewportSize({ width: 390, height: 844 });
  await signInBarber(barber, 'imran');
  await tv.goto('/display');
  await expect(barber.getByRole('heading', { name: en.barber.assignedCustomer })).toBeVisible();
  await fitsScreen(barber);
  await usable(barber.getByRole('button', { name: en.barber.startBreak }));

  await barber.setViewportSize({ width: 320, height: 800 });
  await fitsScreen(barber);
  await usable(barber.getByRole('button', { name: en.barber.startBreak }));
  await barber.getByRole('button', { name: 'Toggle language', exact: true }).click();
  await expect(barber.getByRole('heading', { name: gu.barber.assignedCustomer })).toBeVisible();
  await fitsScreen(barber);
  await usable(barber.getByRole('button', { name: gu.barber.startBreak }));
  await usable(barber.getByRole('button', { name: gu.barber.logout }));
  await barber.screenshot({ path: testInfo.outputPath('barber-gujarati-320x800.png') });

  await barber.setViewportSize({ width: 390, height: 844 });
  await fitsScreen(barber);
  await usable(barber.getByRole('button', { name: gu.barber.startBreak }));

  const navigation = tv.getByRole('navigation');
  await expect(navigation).toHaveCount(0);
  await expect(tv.getByRole('heading', { name: en.display.upNext })).toBeVisible();
  await fitsScreen(tv);
  await usable(tv.getByRole('button', { name: en.display.fullscreen }));
  await tv.getByRole('button', { name: en.languageLabel, exact: true }).click();
  await expect(tv.getByRole('heading', { name: gu.display.upNext })).toBeVisible();
  await fitsScreen(tv);
  await usable(tv.getByRole('button', { name: gu.languageLabel, exact: true }));
  await tv.screenshot({ path: testInfo.outputPath('tv-gujarati-1920x1080.png') });
});
