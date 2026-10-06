import { launch, goto, dump, shot } from './lib.mjs';

const { ctx, page } = await launch();
await goto(page, 'https://kr.trip.com/trains/?departdate=2026-09-24');

// 위젯 탭바 내 탭 찾기
async function findTab(label) {
  return page.evaluate((lbl) => {
    const out = [];
    for (const e of document.querySelectorAll('*')) {
      const t = (e.innerText || '').trim();
      if (t === lbl && e.offsetWidth > 0 && e.offsetWidth < 300 && e.children.length <= 1) {
        const r = e.getBoundingClientRect();
        let hint = '', p = e;
        for (let k = 0; k < 8 && p; k++) { const c = (p.className || '').toString(); if (c.includes('tab') || c.includes('trip-search')) { hint = c.slice(0, 50); break; } p = p.parentElement; }
        out.push({ x: r.x + r.width / 2, y: r.y + r.height / 2, hint });
      }
    }
    return out;
  }, label);
}

// 숙소 탭 → 기차 탭 전환
const hotel = await findTab('숙소');
console.log('숙소 TAB:', JSON.stringify(hotel));
if (hotel.length) { const h = hotel.find(x => x.hint.includes('trip-search')) || hotel[0]; await page.mouse.click(h.x, h.y); await page.waitForTimeout(2500); }
const train = await findTab('기차');
console.log('기차 TAB:', JSON.stringify(train));
if (train.length) { const t = train.find(x => x.hint.includes('trip-search')) || train[0]; await page.mouse.click(t.x, t.y); await page.waitForTimeout(3000); }
await shot(page, 's24-after-tabs');

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
const t = await dump(page, 'trip-results13', 20000);
const i = t.indexOf('KTX');
console.log('--- EXCERPT (KTX idx ' + i + ') ---');
console.log(t.slice(Math.max(0, i - 2500), i + 5000));
await shot(page, 'trip-results13');
await ctx.close();
