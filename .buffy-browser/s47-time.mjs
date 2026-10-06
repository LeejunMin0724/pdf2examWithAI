import { launch, goto, dump, shot } from './lib.mjs';

const { ctx, page } = await launch();
await goto(page, 'https://www.korail.com/intro', 'load');
await page.waitForTimeout(5000);

await page.locator('li.search_item.n2 span.input').first().click();
await page.waitForTimeout(2000);

// '시' 텍스트 버튼 전수 조사
const chips = await page.evaluate(() =>
  [...document.querySelectorAll('button, a, li, span')]
    .filter(e => /^\d{1,2}시$/.test((e.innerText || '').trim()) && e.offsetWidth > 0)
    .slice(0, 24)
    .map(e => { const r = e.getBoundingClientRect(); return { t: e.innerText.trim(), tag: e.tagName, cls: (e.className || '').toString().slice(0, 40), x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) }; })
);
console.log('TIME CHIPS:', JSON.stringify(chips, null, 1));

// 12시 클릭 (좌표)
const c12 = chips.find(c => c.t === '12시');
if (c12) { await page.mouse.click(c12.x, c12.y); await page.waitForTimeout(800); }

// 24일 클릭
await page.locator('.datepicker a').filter({ hasText: /^24$/ }).first().click({ timeout: 6000 });
await page.waitForTimeout(800);
await page.locator('button, a').filter({ hasText: /^적용$/ }).last().click({ timeout: 6000 });
await page.waitForTimeout(1500);
const dv = await page.evaluate(() => document.querySelector('li.search_item.n2 span.input')?.innerText?.trim());
console.log('DATE NOW:', dv);

// 조회
await page.locator('button.search_btn').first().click({ timeout: 10000 });
await page.waitForTimeout(12000);
const t = await dump(page, 'k-924-12h', 20000);
console.log('EMPTY?:', t.includes('해당 스케줄에 운행하는 열차가 없습니다.'));
const i = t.indexOf('KTX');
console.log(t.slice(Math.max(0, i - 200), i + 9000));
await shot(page, 'k-924-12h');
await ctx.close();
