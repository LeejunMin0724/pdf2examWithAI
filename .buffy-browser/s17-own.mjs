import { launch, goto } from './lib.mjs';

const { ctx, page } = await launch();
await goto(page, 'https://kr.trip.com/trains/?departdate=2026-09-24');

const dep = page.locator('input[placeholder="출발역"]:visible').first();
await dep.click({ force: true });
await page.waitForTimeout(1500);
const editable = page.locator('input[placeholder="출발역"]:visible:not([readonly])').first();
await editable.fill('');
await editable.pressSequentially('대전', { delay: 150 });
await page.waitForTimeout(2500);

const ownership = await page.evaluate(() => {
  const trainsBox = [...document.querySelectorAll('div.search-box')].find(d => d.querySelector('input[placeholder="출발역"][readonly]'));
  const out = [];
  for (const li of document.querySelectorAll('li')) {
    const t = (li.innerText || '').trim().replace(/\n/g, ' ');
    if (t.includes('대한민국') && li.offsetWidth > 0) {
      const r = li.getBoundingClientRect();
      // 소속 박스 확인
      let e = li, inTrains = false, inHotel = false, depth = 0;
      while (e && depth < 30) {
        e = e.parentElement; depth++;
        if (!e) break;
        const cls = (e.className || '').toString();
        if (e === trainsBox) { inTrains = true; break; }
        if (cls.includes('open-component') || cls.includes('hotel')) { inHotel = true; break; }
      }
      out.push({ t: t.slice(0, 50), x: Math.round(r.x), y: Math.round(r.y), inTrainsBox: inTrains, inHotelWidget: inHotel, depthToAncestor: depth });
    }
  }
  return out;
});
console.log(JSON.stringify(ownership, null, 1));

await ctx.close();
