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

// 검색 SPAN의 부모 체인 확인
const chain = await page.evaluate(() => {
  const span = [...document.querySelectorAll('span')].find(s => (s.innerText || '').trim() === '검색' && s.offsetWidth > 0);
  if (!span) return null;
  let e = span, out = [];
  for (let k = 0; k < 6 && e; k++) { out.push({ tag: e.tagName, cls: (e.className || '').toString().slice(0, 60), role: e.getAttribute('role') }); e = e.parentElement; }
  return out;
});
console.log('CHAIN:', JSON.stringify(chain, null, 1));

// JS 클릭 시도
const clicked = await page.evaluate(() => {
  const span = [...document.querySelectorAll('span')].find(s => (s.innerText || '').trim() === '검색' && s.offsetWidth > 0);
  if (!span) return false;
  // 클릭 핸들러가 있는 조상 찾기
  let e = span;
  for (let k = 0; k < 8 && e; k++) {
    if (typeof e.onclick === 'function' || e.getAttribute('role') === 'button' || e.tagName === 'BUTTON') { e.click(); return `clicked:${e.tagName}.${(e.className || '').toString().slice(0, 30)}`; }
    e = e.parentElement;
  }
  span.click();
  return 'clicked:span';
});
console.log('CLICK RESULT:', clicked);
await page.waitForTimeout(15000);

console.log('FINAL URL:', page.url());
const t = await dump(page, 'trip-results8', 20000);
const i = t.indexOf('KTX');
console.log('--- EXCERPT (KTX idx ' + i + ') ---');
console.log(t.slice(Math.max(0, i - 2500), i + 4500));
await shot(page, 'trip-results8');
await ctx.close();
