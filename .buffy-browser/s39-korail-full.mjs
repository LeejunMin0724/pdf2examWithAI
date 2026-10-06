import { launch, goto, dump, shot } from './lib.mjs';

const { ctx, page } = await launch();
await goto(page, 'https://www.korail.com/intro', 'load');
await page.waitForTimeout(5000);

// 1) 출발역: 대전
await page.locator('div.station_item.n1 span.input').first().click();
await page.waitForTimeout(1500);
await page.locator('li, button, a, span').filter({ hasText: /^대전$/ }).first().click({ timeout: 5000 });
await page.waitForTimeout(1000);

// 2) 도착역: 서울
await page.locator('div.station_item.n2 span.input').first().click();
await page.waitForTimeout(1500);
await page.locator('li, button, a, span').filter({ hasText: /^서울$/ }).first().click({ timeout: 5000 });
await page.waitForTimeout(1000);

// 3) 날짜 필드 클릭 → 캘린더 구조 덤프
await page.locator('li.search_item.n2 span.input').first().click();
await page.waitForTimeout(2000);
await shot(page, 's39-calendar');
const calText = await page.evaluate(() => {
  const dialogs = [...document.querySelectorAll('div')].filter(e => {
    const cls = (e.className || '').toString();
    return (cls.includes('calendar') || cls.includes('Calendar') || cls.includes('datepick')) && e.offsetWidth > 200;
  });
  return dialogs.slice(-2).map(e => ({ cls: (e.className || '').toString().slice(0, 60), text: (e.innerText || '').slice(0, 1000) }));
});
console.log('CALENDAR:', JSON.stringify(calText, null, 1));

// 24일 셀 클릭 시도
const d24 = page.locator('td a, td button, td span, li a, li span').filter({ hasText: /^24$/ }).first();
console.log('D24 COUNT:', await d24.count());
if (await d24.count()) {
  await d24.click({ timeout: 5000 });
  await page.waitForTimeout(1000);
}
await shot(page, 's39-after-date');

// 날짜 값 확인
const dateVal = await page.evaluate(() => document.querySelector('li.search_item.n2 span.input')?.innerText?.trim());
console.log('DATE NOW:', dateVal);

// 4) 열차조회 클릭
await page.locator('button.search_btn').first().click();
await page.waitForTimeout(12000);
console.log('FINAL URL:', page.url());
const t = await dump(page, 'korail-results', 20000);
const i = t.indexOf('KTX');
console.log('--- RESULTS (KTX idx ' + i + ') ---');
console.log(t.slice(Math.max(0, i - 3000), i + 6000));
await shot(page, 'korail-results');
await ctx.close();
