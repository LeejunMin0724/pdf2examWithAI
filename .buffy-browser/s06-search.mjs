import { launch, goto, dump, shot } from './lib.mjs';

const { ctx, page } = await launch();
await goto(page, 'https://kr.trip.com/trains/?departdate=2026-09-24');

// 1) 출발역: readonly input 클릭 → 패널에서 "대전" 클릭
await page.locator('input[class*="CityPicker_input"]').nth(0).click();
await page.waitForTimeout(1500);
await page.locator('li', { hasText: /^대전$/ }).first().click({ timeout: 10000 }).catch(async () => {
  await page.locator('li', { hasText: '대전' }).first().click({ timeout: 10000 });
});
await page.waitForTimeout(1500);

// 2) 도착역: readonly input 클릭 → 패널에서 "서울" 클릭
const arrRo = page.locator('input[class*="CityPicker_input"][readonly]').filter({ hasText: '' }).nth(1);
// 도착역 readonly input: placeholder=도착역
await page.locator('input[placeholder="도착역"][readonly], input[placeholder="도착역"]').last().click();
await page.waitForTimeout(1500);
await page.locator('li', { hasText: /^서울$/ }).first().click({ timeout: 10000 }).catch(async () => {
  await page.locator('li', { hasText: '서울' }).first().click({ timeout: 10000 });
});
await page.waitForTimeout(1500);

await dump(page, 'trip-pre', 800);
await shot(page, 'trip-pre');

// 3) 검색 버튼 클릭
const btn = page.locator('button:has-text("검색")').first();
if (await btn.count()) {
  await btn.click();
} else {
  await page.keyboard.press('Enter');
}
await page.waitForTimeout(15000);

console.log('FINAL URL:', page.url());
const t = await dump(page, 'trip-results', 20000);
console.log(t.slice(0, 6000));
await shot(page, 'trip-results');
await ctx.close();
