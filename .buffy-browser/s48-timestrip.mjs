import { launch, goto, dump, shot } from './lib.mjs';

const { ctx, page } = await launch();
await goto(page, 'https://www.korail.com/intro', 'load');
await page.waitForTimeout(5000);

await page.locator('li.search_item.n2 span.input').first().click();
await page.waitForTimeout(2000);

// 시간 스트립 컨테이너/화살표 구조 파악
const strip = await page.evaluate(() => {
  // '시간선택' 라벨 근처 컨테이너
  const chips = [...document.querySelectorAll('li')].filter(e => /^\d{1,2}시$/.test((e.innerText || '').trim()));
  if (!chips.length) return null;
  let c = chips[0];
  for (let k = 0; k < 6 && c; k++) { c = c.parentElement; if (c && (c.className || '').toString()) break; }
  const container = c;
  const btns = container ? [...container.querySelectorAll('button, a, [class*="btn"], [class*="next"], [class*="prev"]')]
    .filter(b => (b.innerText || '').trim() === '' || /[<>]/.test(b.innerText || ''))
    .map(b => { const r = b.getBoundingClientRect(); return { cls: (b.className || '').toString().slice(0, 50), x: Math.round(r.x), y: Math.round(r.y) }; }) : [];
  return { containerCls: (container?.className || '').toString().slice(0, 60), btns: btns.slice(0, 6) };
});
console.log('STRIP:', JSON.stringify(strip, null, 1));

// 화살표(다음) 클릭 반복: '12시' 칩이 보일 때까지
for (let k = 0; k < 15; k++) {
  const has12 = await page.locator('li').filter({ hasText: /^12시$/ }).first().isVisible().catch(() => false);
  if (has12) { console.log('12시 칩 표시됨 (반복', k, ')'); break; }
  const nextBtn = page.locator('[class*="next"], [class*="btn_r"], [class*="arrow"]').filter({ hasText: '' }).last();
  // 폴백: 스트립 우측 끝 좌표 클릭
  const rightEdge = await page.evaluate(() => {
    const chip = [...document.querySelectorAll('li')].find(e => /^11시$|^1\d시$/.test((e.innerText || '').trim()));
    if (!chip) return null;
    const r = chip.getBoundingClientRect();
    return { x: r.right + 30, y: r.y + r.height / 2 };
  });
  if (rightEdge) await page.mouse.click(rightEdge.x, rightEdge.y).catch(() => {});
  await page.waitForTimeout(600);
}
await shot(page, 's48-strip');

// 12시 클릭
const chip12 = page.locator('li').filter({ hasText: /^12시$/ }).first();
if (await chip12.count() && await chip12.isVisible().catch(() => false)) {
  await chip12.click({ timeout: 5000 });
  console.log('12시 클릭됨');
} else {
  console.log('12시 칩 못찾음 — 11시로 대체 시도');
  await page.locator('li').filter({ hasText: /^11시$/ }).first().click({ timeout: 5000 }).catch(() => {});
}
await page.waitForTimeout(600);

// 9월 캘린더 스코프로 24일 선택
const sepPicker = page.locator('div.datepicker').filter({ hasText: '2026. 09.' }).first();
console.log('SEP PICKER:', await sepPicker.count());
await sepPicker.locator('a').filter({ hasText: /^24$/ }).first().click({ timeout: 6000 });
await page.waitForTimeout(800);
await page.locator('button, a').filter({ hasText: /^적용$/ }).last().click({ timeout: 6000 });
await page.waitForTimeout(1500);
const dv = await page.evaluate(() => document.querySelector('li.search_item.n2 span.input')?.innerText?.trim());
console.log('DATE NOW:', dv);

// 조회
await page.locator('button.search_btn').first().click({ timeout: 10000 });
await page.waitForTimeout(12000);
const t = await dump(page, 'k-924-12h2', 20000);
console.log('EMPTY?:', t.includes('해당 스케줄에 운행하는 열차가 없습니다.'));
const i = t.indexOf('KTX');
console.log(t.slice(Math.max(0, i - 200), i + 9000));
await shot(page, 'k-924-12h2');
await ctx.close();
