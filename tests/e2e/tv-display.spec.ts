import { expect, test } from '@playwright/test';
import en from '../../frontend/src/i18n/en.json';
import gu from '../../frontend/src/i18n/gu.json';

test('TV navigation uses a safe previous page or Home and works by keyboard', async ({ page, baseURL }) => {
  await page.goto('/reception');
  await page.getByRole('navigation').getByRole('link', { name: en.nav.display }).click();
  await expect(page).toHaveURL(/\/display$/);
  const back = page.getByRole('button', { name: en.display.back, exact: true });
  await back.focus();
  await expect(back).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/reception$/);

  await page.goto('/display', { referer: baseURL + '/join' });
  await back.click();
  await expect(page).toHaveURL(/\/join$/);

  await page.goto('/display', { referer: 'http://127.0.0.1:15174/' });
  await back.click();
  await expect(page).toHaveURL(baseURL + '/');

  await page.goto('/display');
  await back.click();
  await expect(page).toHaveURL(baseURL + '/');

  await page.goto('/display');
  await page.getByRole('button', { name: en.nav.home, exact: true }).click();
  await expect(page).toHaveURL(baseURL + '/');

  await page.goto('/display');
  const exit = page.getByRole('button', { name: en.display.exitTv });
  await exit.focus();
  await page.keyboard.press('Space');
  await expect(page).toHaveURL(baseURL + '/');
});

test('TV toggles native fullscreen and keeps Exit Display accessible', async ({ page, baseURL }) => {
  await page.goto('/display');
  test.skip(!await page.evaluate(() => document.fullscreenEnabled && typeof document.documentElement.requestFullscreen === 'function'),
    'Browser does not expose the Fullscreen API');
  await page.getByRole('button', { name: en.display.fullscreen }).press('Enter');
  await expect.poll(() => page.evaluate(() => document.fullscreenElement?.tagName)).toBe('MAIN');
  await expect(page.getByRole('button', { name: en.display.exitTv })).toBeVisible();
  await page.getByRole('button', { name: en.display.exitFullscreen }).click();
  await expect.poll(() => page.evaluate(() => document.fullscreenElement === null)).toBe(true);
  await expect(page.getByRole('button', { name: en.display.fullscreen })).toBeVisible();

  await page.getByRole('button', { name: en.display.fullscreen }).click();
  await expect(page.getByRole('button', { name: en.display.exitFullscreen })).toBeVisible();
  await page.getByRole('button', { name: en.display.exitTv }).click();
  await expect(page).toHaveURL(baseURL + '/');
  await expect.poll(() => page.evaluate(() => document.fullscreenElement === null)).toBe(true);
});

test('TV controls and all queue rows fit the TV and tablet layouts in English and Gujarati', async ({ page }, testInfo) => {
  // A full public fixture makes both layout screenshots independent of other tests' queue state.
  await page.route('**/api/display', (route) => route.fulfill({
    json: {
      date: '2026-11-24',
      salonOpen: true,
      barbers: [
        { name: 'Ravi', status: 'called', token: 'S-1' },
        { name: 'Amit', status: 'in_chair', token: 'S-2' },
        { name: 'Imran', status: 'available', token: null },
      ],
      waiting: Array.from({ length: 5 }, (_, i) => ({ token: `S-${3 + i}`, approxWaitMinutes: i === 4 ? null : 5 + i * 5 })),
    },
  }));
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto('/display');
  const waiting = page.getByRole('listitem');
  await expect(waiting).toHaveCount(5);
  await expect(waiting.last()).toContainText('S-7');
  const hasOverflow = (axis: 'horizontal' | 'vertical') => page.evaluate((direction) => {
    const root = document.documentElement;
    return direction === 'horizontal' ? root.scrollWidth > innerWidth : root.scrollHeight > innerHeight;
  }, axis);
  expect(await hasOverflow('horizontal')).toBe(false);
  expect(await hasOverflow('vertical')).toBe(false);
  for (const label of [en.display.back, en.nav.home, en.display.exitTv]) {
    const button = page.getByRole('button', { name: label, exact: true });
    await expect(button).toBeVisible();
    expect((await button.boundingBox())?.height).toBeGreaterThanOrEqual(44);
  }
  await page.screenshot({ path: testInfo.outputPath('tv-display-en-1920x1080.png'), animations: 'disabled' });

  await page.setViewportSize({ width: 768, height: 900 });
  await page.getByRole('button', { name: en.languageLabel }).click();
  await expect(page.getByRole('heading', { name: gu.display.upNext })).toBeVisible();
  for (const label of [gu.display.back, gu.nav.home, gu.display.exitTv]) {
    await expect(page.getByRole('button', { name: label, exact: true })).toBeVisible();
  }
  expect(await hasOverflow('horizontal')).toBe(false);
  await page.screenshot({ path: testInfo.outputPath('tv-display-gu-768x900.png'), animations: 'disabled' });
});
