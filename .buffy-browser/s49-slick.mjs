import { launch, goto, dump, shot } from './lib.mjs';

const { ctx, page } = await launch();
await goto(page, 'https://www.korail.com/intro', 'load');
await page.waitForTimeout(5000);

await page.locator('li.search_item.n2 span.input').first().click();
await page.waitForTimeout(2000);

// slick 캐러셀 다음 버튼으로 12시 페이지 이동 (00시=페이지1, 05~09=2, 10~14=3 추정)
const slickNext = page.locator('.slick-next, button.slick-arrow[aria-label*="Next"], [class*="slick"] [class*="next"]').first();
console.log('SLICK NEXT:', await slickNext.count());
let clicked12 = false;
for (let k = 0; k < 6 && !clicked12; k++) {
  const chip12 = page.locator('.slick-slide li, .slick-slide a').filter({ hasText: /^12시$/ }).first();
  const vis = await chip12.isVisible().catch(() => false);
  if (vis) { await chip12.click({ timeout: 4000 }); clicked12 = true; console.log('12시 클릭 (반복', k, ')'); break; }
  await slickNext.click({ timeout: 4000 }).catch(() => {});
  await page.waitForTimeout(800);
}
if (!clicked12) console.log('12시 못찾음');

await shot(page, 's49-after-12');

// slick 슬라이드가 이동해 캘린더 a가 stale일 수 있으므로 재스코프
const sepPicker = page.locator('div.datepicker').filter({ hasText: '2026. 09.' }).first();
// 24일: 현재 슬라이드 이슈 무시하고 다시 찾기
const a24 = page.locator('div.datepicker a[aria-disabled="false"]').filter({ hasText: /^24$/ }).first();
console.log('A24:', await a24.count());
await a24.click({ timeout: 6000 });
await page.waitForTimeout(800);
await page.locator('button, a').filter({ hasText: /^적용$/ }).last().click({ timeout: 6000 });
await page.waitForTimeout(1500);
const dv = await page.evaluate(() => document.querySelector('li.search_item.n2 span.input')?.innerText?.trim());
console.log('DATE NOW:', dv);

// 조회
await page.locator('button.search_btn').first().click({ timeout: 10000 });
await page.waitForTimeout(12000);
const t = await dump(page, 'k-924-12h3', 20000);
console.log('EMPTY?:', t.includes('해당 스케줄에 운행하는 열차가 없습니다.'));
const i = t.indexOf('KTX');
console.log(t.slice(Math.max(0, i - 200), i + 9000));
await shot(page, 'k-924-12h3');
await ctx.close();
