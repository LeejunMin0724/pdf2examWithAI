import { launch, goto, dump, shot } from './lib.mjs';

const { ctx, page } = await launch();
await goto(page, 'https://www.korail.com/intro', 'load');
await page.waitForTimeout(5000);

await page.locator('li.search_item.n2 span.input').first().click();
await page.waitForTimeout(2000);

// 24일 클릭
await page.locator('div.datepicker a[aria-disabled="false"]').filter({ hasText: /^24/ }).first().click({ timeout: 6000 });
await page.waitForTimeout(1000);
// 05시 클릭 (첫 페이지에 있음)
const chip5 = page.locator('.slick-slide li').filter({ hasText: /^05시$/ }).first();
console.log('05시 CHIP:', await chip5.count());
if (await chip5.count() && await chip5.isVisible().catch(() => false)) {
  await chip5.click({ timeout: 4000 });
} else {
  // slick 이전 이동 후 재시도
  const slickPrev = page.locator('.slick-prev').first();
  for (let k = 0; k < 4; k++) {
    if (await chip5.isVisible().catch(() => false)) { await chip5.click({ timeout: 4000 }); break; }
    await slickPrev.click({ timeout: 4000 }).catch(() => {});
    await page.waitForTimeout(800);
  }
}
console.log('5시 클릭 완료');
await page.waitForTimeout(500);
await page.locator('button, a').filter({ hasText: /^적용$/ }).last().click({ timeout: 6000 });
await page.waitForTimeout(1500);
const dv = await page.evaluate(() => document.querySelector('li.search_item.n2 span.input')?.innerText?.trim());
console.log('DATE NOW:', dv);

await page.locator('button.search_btn').first().click({ timeout: 10000 });
await page.waitForTimeout(12000);
const t = await dump(page, 'k-924-5h', 20000);
console.log('EMPTY?:', t.includes('해당 스케줄에 운행하는 열차가 없습니다.'));
const i = t.indexOf('KTX');
console.log(t.slice(Math.max(0, i - 200), i + 9000));
await shot(page, 'k-924-5h');
await ctx.close();
