import { launch, goto, dump, shot } from './lib.mjs';

const { ctx, page } = await launch();
await goto(page, 'https://kr.trip.com/trains/?departdate=2026-09-24');

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

async function pickCity(ph, query, exact) {
  await page.locator(`input[placeholder="${ph}"]:visible`).first().click();
  await page.waitForTimeout(1800);
  const editable = page.locator(`input[placeholder="${ph}"]:visible:not([readonly])`).first();
  await editable.fill('');
  await editable.pressSequentially(query, { delay: 150 });
  await page.waitForTimeout(2800);
  const lis = await visLIs();
  console.log(`DD[${query}]:`, JSON.stringify(lis.filter(x => x.t.includes(query)).slice(0, 4)));
  const hit = lis.find(x => x.t === exact) || lis.find(x => x.t.startsWith(exact));
  if (hit) { await page.mouse.click(hit.x, hit.y); await page.waitForTimeout(1500); }
  else { console.log('NO MATCH for', exact); await page.keyboard.press('Escape'); }
}

await pickCity('출발역', '대전', '대전');
await pickCity('도착역', '서울', '서울');

console.log('DEP:', await page.locator('input[placeholder="출발역"][readonly]').first().inputValue().catch(() => '?'));
console.log('ARR:', await page.locator('input[placeholder="도착역"][readonly]').first().inputValue().catch(() => '?'));

await page.keyboard.press('Escape');
await page.waitForTimeout(600);
await shot(page, 's9-filled');

const btnBox = await page.evaluate(() => {
  const b = [...document.querySelectorAll('button')].find(b => (b.innerText || '').includes('검색'));
  if (!b) return null;
  const r = b.getBoundingClientRect();
  return { x: r.x + r.width / 2, y: r.y + r.height / 2, t: b.innerText.trim() };
});
console.log('BTN:', JSON.stringify(btnBox));
if (btnBox) await page.mouse.click(btnBox.x, btnBox.y);
await page.waitForTimeout(15000);

console.log('FINAL URL:', page.url());
const t = await dump(page, 'trip-results4', 20000);
const i = t.indexOf('KTX');
console.log('--- EXCERPT (KTX idx ' + i + ') ---');
console.log(t.slice(Math.max(0, i - 3000), i + 4000));
await shot(page, 'trip-results4');
await ctx.close();
