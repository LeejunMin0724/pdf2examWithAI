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
  await page.locator(`input[placeholder="${ph}"]:visible`).first().click({ force: true, timeout: 8000 });
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

// 기차표 입력(출발역 input)과 같은 컨테이너 안의 검색 컨트롤만 탐색
const btnBox = await page.evaluate(() => {
  const dep = [...document.querySelectorAll('input[placeholder="출발역"]')].find(i => i.offsetWidth > 0);
  if (!dep) return null;
  let box = dep;
  for (let k = 0; k < 8 && box.parentElement; k++) {
    box = box.parentElement;
    if ((box.className || '').toString().includes('open-component')) break;
  }
  const cands = [...box.querySelectorAll('button, div[role="button"], span, a, input')]
    .filter(e => (e.innerText || e.value || '').trim() === '검색' && e.offsetWidth > 0)
    .map(e => { const r = e.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2, tag: e.tagName, cls: (e.className || '').toString().slice(0, 40) }; });
  return cands[0] || null;
});
console.log('BTN(trains box):', JSON.stringify(btnBox));

if (btnBox) {
  await page.mouse.click(btnBox.x, btnBox.y);
} else {
  console.log('버튼 미발견 → Enter 시도');
  await page.locator('input[placeholder="도착역"]:visible:not([readonly])').first().press('Enter');
}
await page.waitForTimeout(15000);

console.log('FINAL URL:', page.url());
const t = await dump(page, 'trip-results7', 20000);
const i = t.indexOf('KTX');
console.log('--- EXCERPT (KTX idx ' + i + ') ---');
console.log(t.slice(Math.max(0, i - 2500), i + 4500));
await shot(page, 'trip-results7');
await ctx.close();
