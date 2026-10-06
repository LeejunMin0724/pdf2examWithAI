import { launch, goto, dump, shot } from './lib.mjs';

const { ctx, page } = await launch();
await goto(page, 'https://www.korail.com/intro', 'load');
await page.waitForTimeout(5000);

// 대전→서울, 9/24 설정
await page.locator('div.station_item.n1 span.input').first().click();
await page.waitForTimeout(1500);
await page.locator('li, button, a, span').filter({ hasText: /^대전$/ }).first().click({ timeout: 5000 });
await page.waitForTimeout(1000);
await page.locator('div.station_item.n2 span.input').first().click();
await page.waitForTimeout(1500);
await page.locator('li, button, a, span').filter({ hasText: /^서울$/ }).first().click({ timeout: 5000 });
await page.waitForTimeout(1000);
await page.locator('li.search_item.n2 span.input').first().click();
await page.waitForTimeout(2000);
await page.locator('div.datepicker a').filter({ hasText: /^24$/ }).first().click({ timeout: 5000 });
await page.waitForTimeout(800);
await page.locator('button, a').filter({ hasText: /^적용$/ }).first().click({ timeout: 5000 });
await page.waitForTimeout(1500);

// 조회
await page.locator('button.search_btn').first().click({ timeout: 10000 });
await page.waitForTimeout(12000);
console.log('URL:', page.url());
const t0 = await dump(page, 'k-924', 20000);
console.log('9/24 결과 있음?:', !t0.includes('해당 스케줄에 운행하는 열차가 없습니다.'));

// 다음날 클릭
const next = page.locator('button, a').filter({ hasText: '26년09월25일' }).first();
console.log('NEXT BTN:', await next.count());
if (await next.count()) {
  await next.click({ timeout: 8000 });
  await page.waitForTimeout(12000);
  const t1 = await dump(page, 'k-925', 20000);
  console.log('9/25 결과 있음?:', !t1.includes('해당 스케줄에 운행하는 열차가 없습니다.'));
  const i = t1.indexOf('KTX');
  console.log('--- 9/25 결과 ---');
  console.log(t1.slice(Math.max(0, i - 300), i + 9000));
  await shot(page, 'k-925');
}
await ctx.close();
