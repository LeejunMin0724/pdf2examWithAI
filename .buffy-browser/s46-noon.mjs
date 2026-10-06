import { launch, goto, dump, shot } from './lib.mjs';

const { ctx, page } = await launch();
await goto(page, 'https://www.korail.com/intro', 'load');
await page.waitForTimeout(5000);

// 역은 이미 대전/서울
const depNow = await page.evaluate(() => document.querySelector('div.station_item.n1 span.input')?.innerText?.trim());
const arrNow = await page.evaluate(() => document.querySelector('div.station_item.n2 span.input')?.innerText?.trim());
console.log('FIELDS:', depNow, '/', arrNow);
if (depNow !== '대전' || arrNow !== '서울') {
  // 필요 시 재선택 (모달 스코프)
  console.log('역 재선택 필요');
}

// 날짜 선택: 24일 클릭 후 '적용'을 누르되 시간은 12시 유지
await page.locator('li.search_item.n2 span.input').first().click();
await page.waitForTimeout(2000);
// 시간 버튼 중 '12시' 클릭 (기본)
const h12 = page.locator('.datepicker button, .datepicker a, .datepicker li').filter({ hasText: /^12시$/ }).first();
console.log('12시 BTN:', await h12.count());
if (await h12.count()) { await h12.click({ timeout: 5000 }); await page.waitForTimeout(600); }
await page.locator('.datepicker a').filter({ hasText: /^24$/ }).first().click({ timeout: 6000 });
await page.waitForTimeout(800);
await page.locator('button, a').filter({ hasText: /^적용$/ }).last().click({ timeout: 6000 });
await page.waitForTimeout(1500);
const dv = await page.evaluate(() => document.querySelector('li.search_item.n2 span.input')?.innerText?.trim());
console.log('DATE NOW:', dv);

// 조회
await page.locator('button.search_btn').first().click({ timeout: 10000 });
await page.waitForTimeout(12000);
const t = await dump(page, 'k-924-noon', 20000);
console.log('EMPTY?:', t.includes('해당 스케줄에 운행하는 열차가 없습니다.'));
const i = t.indexOf('KTX');
console.log(t.slice(Math.max(0, i - 200), i + 9000));
await shot(page, 'k-924-noon');
await ctx.close();
