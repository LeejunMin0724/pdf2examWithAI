import { launch, goto, dump, shot } from './lib.mjs';

const { ctx, page } = await launch();
await goto(page, 'https://kr.trip.com/trains/?departdate=2026-09-24');

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

// open-component 오버레이만 제거 (trip-seo-search-box 본체는 유지)
const hiddenCount = await page.evaluate(() => {
  let n = 0;
  for (const e of document.querySelectorAll('[class*="open-component"]')) { e.style.display = 'none'; n++; }
  return n;
});
console.log('HIDDEN open-components:', hiddenCount);
await page.waitForTimeout(800);

// SearchBtn_container 정확히 클릭
const btn = await page.evaluate(() => {
  const b = [...document.querySelectorAll('div.SearchBtn_container__vR1Vw')].find(e => e.offsetWidth > 0);
  if (!b) return null;
  const r = b.getBoundingClientRect();
  const top = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
  return { x: r.x + r.width / 2, y: r.y + r.height / 2, isTop: b.contains(top) || top === b, topEl: top ? `${top.tagName}.${(top.className || '').toString().slice(0, 30)}` : 'none' };
});
console.log('REAL BTN:', JSON.stringify(btn));
if (btn && btn.isTop) { await page.mouse.click(btn.x, btn.y); }
else if (btn) { await page.evaluate(() => { const b = [...document.querySelectorAll('div.SearchBtn_container__vR1Vw')].find(e => e.offsetWidth > 0); b && b.click(); }); }

await page.waitForTimeout(15000);
console.log('FINAL URL:', page.url());
const t = await dump(page, 'trip-results10', 20000);
const i = t.indexOf('KTX');
console.log('--- EXCERPT (KTX idx ' + i + ') ---');
console.log(t.slice(Math.max(0, i - 2500), i + 5000));
await shot(page, 'trip-results10');
await ctx.close();
