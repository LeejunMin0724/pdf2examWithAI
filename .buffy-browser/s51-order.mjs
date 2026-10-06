import { launch, goto, dump, shot } from './lib.mjs';

const { ctx, page } = await launch();
await goto(page, 'https://www.korail.com/intro', 'load');
await page.waitForTimeout(5000);

await page.locator('li.search_item.n2 span.input').first().click();
await page.waitForTimeout(2000);

// 1) 24일 먼저 클릭 (9월, disabled:false)
const a24 = page.locator('div.datepicker a[aria-disabled="false"]').filter({ hasText: /^24/ }).first();
console.log('A24:', await a24.count());
await a24.click({ timeout: 6000 });
await page.waitForTimeout(1000);

// 2) 12시 선택 (리셋 후 다시)
const slickNext = page.locator('.slick-next').first();
let ok12 = false;
for (let k = 0; k < 6 && !ok12; k++) {
  const chip12 = page.locator('.slick-slide li').filter({ hasText: /^12시$/ }).first();
  if (await chip12.isVisible().catch(() => false)) { await chip12.click({ timeout: 4000 }); ok12 = true; console.log('12시 클릭'); break; }
  await slickNext.click({ timeout: 4000 }).catch(() => {});
  await page.waitForTimeout(800);
}
await page.waitForTimeout(500);
await shot(page, 's51-before-apply');

// 3) 적용
await page.locator('button, a').filter({ hasText: /^적용$/ }).last().click({ timeout: 6000 });
await page.waitForTimeout(1500);
const dv = await page.evaluate(() => document.querySelector('li.search_item.n2 span.input')?.innerText?.trim());
console.log('DATE NOW:', dv);

// 4) 조회
await page.locator('button.search_btn').first().click({ timeout: 10000 });
await page.waitForTimeout(12000);
const t = await dump(page, 'k-924-final', 20000);
console.log('EMPTY?:', t.includes('해당 스케줄에 운행하는 열차가 없습니다.'));
const i = t.indexOf('KTX');
console.log(t.slice(Math.max(0, i - 200), i + 9000));
await shot(page, 'k-924-final');
await ctx.close();
