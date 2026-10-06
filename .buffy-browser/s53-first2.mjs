import { launch, goto, dump, shot } from './lib.mjs';

const { ctx, page } = await launch();
await goto(page, 'https://www.korail.com/intro', 'load');
await page.waitForTimeout(5000);

await page.locator('li.search_item.n2 span.input').first().click();
await page.waitForTimeout(2000);

// 1) 24일 클릭
await page.locator('div.datepicker a[aria-disabled="false"]').filter({ hasText: /^24/ }).first().click({ timeout: 6000 });
await page.waitForTimeout(1000);

// 2) slick-next로 05시 페이지 이동 후 클릭
const slickNext = page.locator('.slick-next').first();
let ok5 = false;
for (let k = 0; k < 5 && !ok5; k++) {
  const chip5 = page.locator('.slick-slide li').filter({ hasText: /^05시$/ }).first();
  if (await chip5.isVisible().catch(() => false)) {
    try { await chip5.click({ timeout: 3000 }); ok5 = true; console.log('05시 클릭 (반복', k, ')'); } catch { /* outside viewport → next */ }
  }
  if (!ok5) { await slickNext.click({ timeout: 4000 }).catch(() => {}); await page.waitForTimeout(900); }
}
console.log('05시 OK?:', ok5);
await page.waitForTimeout(500);
await shot(page, 's53-before-apply');

// 3) 적용 + 조회
await page.locator('button, a').filter({ hasText: /^적용$/ }).last().click({ timeout: 6000 });
await page.waitForTimeout(1500);
const dv = await page.evaluate(() => document.querySelector('li.search_item.n2 span.input')?.innerText?.trim());
console.log('DATE NOW:', dv);

await page.locator('button.search_btn').first().click({ timeout: 10000 });
await page.waitForTimeout(12000);
const t = await dump(page, 'k-924-5h2', 20000);
console.log('EMPTY?:', t.includes('해당 스케줄에 운행하는 열차가 없습니다.'));
const i = t.indexOf('KTX');
console.log(t.slice(Math.max(0, i - 200), i + 9000));
await shot(page, 'k-924-5h2');
await ctx.close();
