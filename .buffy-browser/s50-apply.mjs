import { launch, goto, dump, shot } from './lib.mjs';

const { ctx, page } = await launch();
await goto(page, 'https://www.korail.com/intro', 'load');
await page.waitForTimeout(5000);

await page.locator('li.search_item.n2 span.input').first().click();
await page.waitForTimeout(2000);

// slick으로 12시 이동 + 클릭
const slickNext = page.locator('.slick-next').first();
for (let k = 0; k < 6; k++) {
  const chip12 = page.locator('.slick-slide li').filter({ hasText: /^12시$/ }).first();
  if (await chip12.isVisible().catch(() => false)) { await chip12.click({ timeout: 4000 }); console.log('12시 클릭'); break; }
  await slickNext.click({ timeout: 4000 }).catch(() => {});
  await page.waitForTimeout(800);
}
await page.waitForTimeout(500);

// 24일: 선택되지 않은 경우에만 클릭 (selected 클래스 확인)
const sel24 = await page.evaluate(() => {
  const links = [...document.querySelectorAll('div.datepicker a')].filter(a => (a.innerText || '').trim().startsWith('24'));
  return links.map(a => ({ cls: (a.className || '').toString().slice(0, 60), disabled: a.getAttribute('aria-disabled'), txt: a.innerText.trim().replace(/\s+/g, ' ') }));
});
console.log('24 CELLS:', JSON.stringify(sel24));
const a24any = page.locator('div.datepicker a').filter({ hasText: '24' }).first();
if (await a24any.count()) { await a24any.click({ force: true, timeout: 4000 }).catch(() => console.log('24 클릭 스킵')); }

await page.locator('button, a').filter({ hasText: /^적용$/ }).last().click({ timeout: 6000 });
await page.waitForTimeout(1500);
const dv = await page.evaluate(() => document.querySelector('li.search_item.n2 span.input')?.innerText?.trim());
console.log('DATE NOW:', dv);

// 조회
await page.locator('button.search_btn').first().click({ timeout: 10000 });
await page.waitForTimeout(12000);
const t = await dump(page, 'k-924-12h4', 20000);
console.log('EMPTY?:', t.includes('해당 스케줄에 운행하는 열차가 없습니다.'));
const i = t.indexOf('KTX');
console.log(t.slice(Math.max(0, i - 200), i + 9000));
await shot(page, 'k-924-12h4');
await ctx.close();
