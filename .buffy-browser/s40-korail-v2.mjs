import { launch, goto, dump, shot } from './lib.mjs';

const { ctx, page } = await launch();
await goto(page, 'https://www.korail.com/intro', 'load');
await page.waitForTimeout(5000);

// 출발역/도착역
await page.locator('div.station_item.n1 span.input').first().click();
await page.waitForTimeout(1500);
await page.locator('li, button, a, span').filter({ hasText: /^대전$/ }).first().click({ timeout: 5000 });
await page.waitForTimeout(1000);
await page.locator('div.station_item.n2 span.input').first().click();
await page.waitForTimeout(1500);
await page.locator('li, button, a, span').filter({ hasText: /^서울$/ }).first().click({ timeout: 5000 });
await page.waitForTimeout(1000);

// 날짜 클릭
await page.locator('li.search_item.n2 span.input').first().click();
await page.waitForTimeout(2000);

// 캘린더 헤더 덤프 (월 표시 및 이전 버튼 클래스 파악)
const calInfo = await page.evaluate(() => {
  const dp = [...document.querySelectorAll('div.datepicker')].filter(e => e.offsetWidth > 200);
  if (!dp.length) return null;
  const d = dp[0];
  const btns = [...d.querySelectorAll('button, a')].map(b => ({ t: (b.innerText || '').trim().slice(0, 15), cls: (b.className || '').toString().slice(0, 40) }));
  const all = [...d.querySelectorAll('*')].filter(e => /20\d\d\.\s*\d+/.test((e.innerText || '')) && e.children.length === 0).slice(0, 3).map(e => ({ tag: e.tagName, cls: (e.className || '').toString().slice(0, 30), t: e.innerText.trim() }));
  return { btns: btns.slice(0, 10), monthLabels: all };
});
console.log('CAL INFO:', JSON.stringify(calInfo, null, 1));
await shot(page, 's40-calendar');
await ctx.close();
