import { launch, goto, dump, shot } from './lib.mjs';

const { ctx, page } = await launch();
await goto(page, 'https://kr.trip.com/trains/?departdate=2026-09-24');

// 1) 위젯 내부 '기차' 탭 찾기 (trip-search__wrap 조상 소속)
const tabCands = await page.evaluate(() => {
  const out = [];
  for (const e of document.querySelectorAll('*')) {
    const t = (e.innerText || '').trim();
    if (t === '기차' && e.offsetWidth > 0 && e.children.length === 0) {
      const r = e.getBoundingClientRect();
      let hint = '', p = e;
      for (let k = 0; k < 8 && p; k++) { const c = (p.className || '').toString(); if (c.includes('trip-search') || c.includes('tab')) { hint = c.slice(0, 60); break; } p = p.parentElement; }
      out.push({ x: r.x + r.width / 2, y: r.y + r.height / 2, hint });
    }
  }
  return out;
});
console.log('기차 TAB:', JSON.stringify(tabCands));
if (tabCands.length) {
  const t = tabCands.find(x => x.hint.includes('trip-search')) || tabCands[0];
  await page.mouse.click(t.x, t.y);
  await page.waitForTimeout(3000);
}
await shot(page, 's23-after-tab');

async function visLIs() {
  return page.evaluate(() =>
    [...document.querySelectorAll('li')]
      .map(li => { const r = li.getBoundingClientRect(); return { t: (li.innerText || '').trim().replace(/\n/g, ' ').slice(0, 60), x: r.x + r.width / 2, y: r.y + r.height / 2, vis: r.width > 0 && r.height > 0 }; })
      .filter(x => x.vis && x.t)
  );
}
async function pickCity(ph, query) {
  await page.locator(`input[placeholder="${ph}"]:visible`).first().click({ force: true, timeout: 8000 });
  await page.waitForTimeout(1500);
  const editable = page.locator(`input[placeholder="${ph}"]:visible:not([readonly])`).first();
  await editable.fill('');
  await editable.pressSequentially(query, { delay: 150 });
  await page.waitForTimeout(2500);
  const lis = await visLIs();
  const hit = lis.find(x => x.t.includes(`${query}, 대한민국`));
  if (hit) { await page.mouse.click(hit.x, hit.y); await page.waitForTimeout(1200); }
  await page.keyboard.press('Escape');
  await page.waitForTimeout(400);
  await page.mouse.click(700, 780);
  await page.waitForTimeout(600);
}

await pickCity('출발역', '대전');
await pickCity('도착역', '서울');
console.log('DEP:', await page.locator('input[placeholder="출발역"][readonly]').first().inputValue().catch(() => '?'));
console.log('ARR:', await page.locator('input[placeholder="도착역"][readonly]').first().inputValue().catch(() => '?'));

// 검색 클릭
const btn = await page.evaluate(() => {
  const b = [...document.querySelectorAll('div.SearchBtn_container__vR1Vw')].find(e => e.offsetWidth > 0);
  if (!b) return null;
  const r = b.getBoundingClientRect();
  return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
});
console.log('BTN:', JSON.stringify(btn));
if (btn) await page.mouse.click(btn.x, btn.y);

await page.waitForTimeout(15000);
console.log('FINAL URL:', page.url());
const t = await dump(page, 'trip-results12', 20000);
const i = t.indexOf('KTX');
console.log('--- EXCERPT (KTX idx ' + i + ') ---');
console.log(t.slice(Math.max(0, i - 2500), i + 5000));
await shot(page, 'trip-results12');
await ctx.close();
