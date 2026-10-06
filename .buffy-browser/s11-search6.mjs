import { launch, goto, dump, shot } from './lib.mjs';

const { ctx, page } = await launch();
await goto(page, 'https://kr.trip.com/trains/?departdate=2026-09-24');

async function visLIs() {
  return page.evaluate(() =>
    [...document.querySelectorAll('li')]
      .map(li => {
        const r = li.getBoundingClientRect();
        return { t: (li.innerText || '').trim().replace(/\n/g, ' ').slice(0, 60), x: r.x + r.width / 2, y: r.y + r.height / 2, vis: r.width > 0 && r.height > 0 };
      })
      .filter(x => x.vis && x.t)
  );
}

async function closePanel() {
  await page.keyboard.press('Escape');
  await page.waitForTimeout(500);
  await page.mouse.click(700, 780);
  await page.waitForTimeout(800);
}

async function pickCity(ph, query) {
  // 클릭 시도(가림 있으면 force)
  const target = page.locator(`input[placeholder="${ph}"]:visible`).first();
  await target.click({ force: true, timeout: 8000 }).catch(async e => {
    console.log(`${ph} 클릭 실패, force 재시도`);
  });
  await page.waitForTimeout(1800);
  const editable = page.locator(`input[placeholder="${ph}"]:visible:not([readonly])`).first();
  await editable.fill('');
  await editable.pressSequentially(query, { delay: 150 });
  await page.waitForTimeout(2800);
  const lis = await visLIs();
  const hit = lis.find(x => x.t.includes(`${query}, 대한민국`));
  console.log(`DD[${query}] hit:`, JSON.stringify(hit));
  if (hit) { await page.mouse.click(hit.x, hit.y); await page.waitForTimeout(1500); }
  await closePanel();
}

await pickCity('출발역', '대전');
await pickCity('도착역', '서울');

console.log('DEP:', await page.locator('input[placeholder="출발역"][readonly]').first().inputValue().catch(() => '?'));
console.log('ARR:', await page.locator('input[placeholder="도착역"][readonly]').first().inputValue().catch(() => '?'));
await shot(page, 's11-filled');

const btnBox = await page.evaluate(() => {
  const els = [...document.querySelectorAll('button, div[role="button"], a, span, input')];
  const b = els.find(e => (e.innerText || e.value || '').trim() === '검색' && e.offsetWidth > 0);
  if (!b) return null;
  const r = b.getBoundingClientRect();
  return { x: r.x + r.width / 2, y: r.y + r.height / 2, tag: b.tagName };
});
console.log('BTN:', JSON.stringify(btnBox));

if (btnBox) {
  await page.mouse.click(btnBox.x, btnBox.y);
} else {
  await page.keyboard.press('Enter');
}
await page.waitForTimeout(15000);

console.log('FINAL URL:', page.url());
const t = await dump(page, 'trip-results6', 20000);
const i = t.indexOf('KTX');
console.log('--- EXCERPT (KTX idx ' + i + ') ---');
console.log(t.slice(Math.max(0, i - 2500), i + 4500));
await shot(page, 'trip-results6');
await ctx.close();
