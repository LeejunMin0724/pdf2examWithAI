import { launch, goto, dump, shot } from './lib.mjs';

const { ctx, page } = await launch();
await goto(page, 'https://kr.trip.com/trains/?departdate=2026-09-24');

// 화면에 보이는 모든 li의 위치 수집 유틸
async function visLIs() {
  return page.evaluate(() =>
    [...document.querySelectorAll('li')]
      .map(li => {
        const r = li.getBoundingClientRect();
        return { t: (li.innerText || '').trim().replace(/\n/g, ' ').slice(0, 50), x: r.x + r.width / 2, y: r.y + r.height / 2, vis: r.width > 0 && r.height > 0 };
      })
      .filter(x => x.vis && x.t)
  );
}

// 1) 출발역: 보이는 value input에 직접 입력
const depVal = page.locator('input.value[placeholder="출발역"]').first();
await depVal.click();
await depVal.fill('대전');
await page.waitForTimeout(2500);
await shot(page, 's8-dep-dd');
const l1 = await visLIs();
console.log('DEP DROPDOWN:', JSON.stringify(l1.filter(x => x.t.includes('대전')).slice(0, 5)));
const d1 = l1.find(x => x.t === '대전') || l1.find(x => x.t.startsWith('대전'));
if (d1) { await page.mouse.click(d1.x, d1.y); await page.waitForTimeout(1500); }
console.log('DEP after:', await page.locator('input[placeholder="출발역"][readonly]').first().inputValue().catch(() => '?'));

// 2) 도착역
const arrVal = page.locator('input.value[placeholder="도착역"]').first();
await arrVal.click();
await arrVal.fill('서울');
await page.waitForTimeout(2500);
await shot(page, 's8-arr-dd');
const l2 = await visLIs();
console.log('ARR DROPDOWN:', JSON.stringify(l2.filter(x => x.t.includes('서울')).slice(0, 5)));
const d2 = l2.find(x => x.t === '서울') || l2.find(x => x.t.startsWith('서울'));
if (d2) { await page.mouse.click(d2.x, d2.y); await page.waitForTimeout(1500); }
console.log('ARR after:', await page.locator('input[placeholder="도착역"][readonly]').first().inputValue().catch(() => '?'));

await shot(page, 's8-filled');

// 3) 검색 버튼 좌표 클릭
const btnBox = await page.evaluate(() => {
  const b = [...document.querySelectorAll('button')].find(b => (b.innerText || '').includes('검색'));
  if (!b) return null;
  const r = b.getBoundingClientRect();
  return { x: r.x + r.width / 2, y: r.y + r.height / 2, t: b.innerText.trim() };
});
console.log('BTN:', JSON.stringify(btnBox));
if (btnBox) { await page.mouse.click(btnBox.x, btnBox.y); }
await page.waitForTimeout(15000);

console.log('FINAL URL:', page.url());
const t = await dump(page, 'trip-results3', 20000);
const i = t.indexOf('KTX');
console.log('--- EXCERPT (KTX idx ' + i + ') ---');
console.log(t.slice(Math.max(0, i - 3000), i + 4000));
await shot(page, 'trip-results3');
await ctx.close();
