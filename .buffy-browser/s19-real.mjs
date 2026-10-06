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

// SEO 오버레이 숨기기
const hiddenCount = await page.evaluate(() => {
  let n = 0;
  for (const e of document.querySelectorAll('[class*="seo"], [class*="open-component"], [class*="season-ticket"]')) {
    e.style.display = 'none'; n++;
  }
  return n;
});
console.log('HIDDEN OVERLAYS:', hiddenCount);
await page.waitForTimeout(1000);
await shot(page, 's19-after-hide');

// 이제 보이는 검색 버튼 (오버레이 제거 후)
const btn = await page.evaluate(() => {
  const els = [...document.querySelectorAll('div[role="button"], button, span')];
  const b = els.find(e => (e.innerText || '').trim() === '검색' && e.offsetWidth > 0);
  if (!b) return null;
  const r = b.getBoundingClientRect();
  const top = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
  return { x: r.x + r.width / 2, y: r.y + r.height / 2, tag: b.tagName, cls: (b.className || '').toString().slice(0, 50), isTop: b.contains(top) || top === b };
});
console.log('REAL BTN:', JSON.stringify(btn));
if (btn) { await page.mouse.click(btn.x, btn.y); }
await page.waitForTimeout(15000);

console.log('FINAL URL:', page.url());
const t = await dump(page, 'trip-results9', 20000);
const i = t.indexOf('KTX');
console.log('--- EXCERPT (KTX idx ' + i + ') ---');
console.log(t.slice(Math.max(0, i - 2500), i + 5000));
await shot(page, 'trip-results9');
await ctx.close();
