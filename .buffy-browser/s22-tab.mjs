import { launch, goto, dump, shot } from './lib.mjs';

const { ctx, page } = await launch();
await goto(page, 'https://kr.trip.com/trains/?departdate=2026-09-24');

// 1) '기차표' 탭 클릭 (위젯 탭바 소속 우선)
const tabClicked = await page.evaluate(() => {
  const cands = [...document.querySelectorAll('div[role="tab"], li[role="tab"], a, span, div')]
    .filter(e => (e.innerText || '').trim() === '기차표' && e.offsetWidth > 0 && e.offsetWidth < 300)
    .map(e => {
      const r = e.getBoundingClientRect();
      let hint = '';
      let p = e;
      for (let k = 0; k < 6 && p; k++) { const c = (p.className || '').toString(); if (c.includes('trip-search') || c.includes('tab')) { hint = c.slice(0, 50); break; } p = p.parentElement; }
      return { x: r.x + r.width / 2, y: r.y + r.height / 2, tag: e.tagName, hint };
    });
  return cands;
});
console.log('기차표 TAB CANDIDATES:', JSON.stringify(tabClicked, null, 1));
if (tabClicked.length) {
  const t = tabClicked.find(x => x.hint.includes('trip-search')) || tabClicked[0];
  await page.mouse.click(t.x, t.y);
  await page.waitForTimeout(2500);
}
await shot(page, 's22-after-tab');

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

// 2) 검색 버튼 클릭 (마우스 실제 클릭)
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
const t = await dump(page, 'trip-results11', 20000);
const i = t.indexOf('KTX');
console.log('--- EXCERPT (KTX idx ' + i + ') ---');
console.log(t.slice(Math.max(0, i - 2500), i + 5000));
await shot(page, 'trip-results11');
await ctx.close();
