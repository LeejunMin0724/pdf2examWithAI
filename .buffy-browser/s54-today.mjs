import { launch, goto, dump, shot } from './lib.mjs';

const { ctx, page } = await launch();
await goto(page, 'https://www.korail.com/intro', 'load');
await page.waitForTimeout(5000);

// 날짜: 22일(오늘) 선택 + 12시
await page.locator('li.search_item.n2 span.input').first().click();
await page.waitForTimeout(2000);
await page.locator('div.datepicker a[aria-disabled="false"]').filter({ hasText: /^22/ }).first().click({ timeout: 6000 });
await page.waitForTimeout(1000);
const slickNext = page.locator('.slick-next').first();
for (let k = 0; k < 6; k++) {
  const chip12 = page.locator('.slick-slide li').filter({ hasText: /^12시$/ }).first();
  if (await chip12.isVisible().catch(() => false)) { await chip12.click({ timeout: 4000 }).catch(() => {}); console.log('12시 클릭'); break; }
  await slickNext.click({ timeout: 4000 }).catch(() => {});
  await page.waitForTimeout(800);
}
await page.waitForTimeout(500);
await page.locator('button, a').filter({ hasText: /^적용$/ }).last().click({ timeout: 6000 });
await page.waitForTimeout(1500);
const dv = await page.evaluate(() => document.querySelector('li.search_item.n2 span.input')?.innerText?.trim());
console.log('DATE NOW:', dv);

await page.locator('button.search_btn').first().click({ timeout: 10000 });
await page.waitForTimeout(12000);
const t = await dump(page, 'k-922', 20000);
console.log('EMPTY?:', t.includes('해당 스케줄에 운행하는 열차가 없습니다.'));
const i = t.indexOf('KTX');
console.log(t.slice(Math.max(0, i - 200), i + 9000));
await shot(page, 'k-922');
await ctx.close();
