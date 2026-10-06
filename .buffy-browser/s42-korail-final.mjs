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

// 3) 날짜: 9/24 선택
await page.locator('li.search_item.n2 span.input').first().click();
await page.waitForTimeout(2000);
const cell24 = page.locator('div.datepicker a').filter({ hasText: /^24$/ }).first();
console.log('CELL24:', await cell24.count());
await cell24.click({ timeout: 5000 });
await page.waitForTimeout(800);
// 적용 버튼
const applyBtn = page.locator('button, a').filter({ hasText: /^적용$/ }).first();
console.log('APPLY:', await applyBtn.count());
await applyBtn.click({ timeout: 5000 });
await page.waitForTimeout(1500);
const dateVal = await page.evaluate(() => document.querySelector('li.search_item.n2 span.input')?.innerText?.trim());
console.log('DATE NOW:', dateVal);
await shot(page, 's42-filled');

// 4) 열차조회
await page.locator('button.search_btn').first().click({ timeout: 10000 });
await page.waitForTimeout(12000);
console.log('FINAL URL:', page.url());
const t = await dump(page, 'korail-results', 20000);
const i = t.indexOf('KTX');
console.log('--- RESULTS (KTX idx ' + i + ') ---');
console.log(t.slice(Math.max(0, i - 3000), i + 8000));
await shot(page, 'korail-results');
await ctx.close();
