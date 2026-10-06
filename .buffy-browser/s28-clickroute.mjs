import { launch, goto, dump, shot } from './lib.mjs';

const { ctx, page } = await launch();
await goto(page, 'https://kr.trip.com/trains/korail/route/daejeon-to-seoul/');

// 예약 관련 클릭 요소 탐색
const cands = await page.evaluate(() => {
  const out = [];
  for (const e of document.querySelectorAll('div,button,a,span')) {
    const t = (e.innerText || '').trim();
    if (/^(예약|예매|바로 예약|조회|바로 예약하기|예약하기)$/.test(t) && e.offsetWidth > 0) {
      const r = e.getBoundingClientRect();
      let p = e, hint = '';
      for (let k = 0; k < 4 && p; k++) { const c = (p.className || '').toString(); if (c) { hint = c.slice(0, 40); break; } p = p.parentElement; }
      out.push({ x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2), tag: e.tagName, cls: hint, t: t.slice(0, 20) });
    }
  }
  return out.slice(0, 10);
});
console.log('CANDS:', JSON.stringify(cands, null, 1));

if (cands.length) {
  await page.mouse.click(cands[0].x, cands[0].y);
  await page.waitForTimeout(15000);
  console.log('FINAL URL:', page.url());
  const t = await dump(page, 'route-click-result', 20000);
  const i = t.indexOf('KTX');
  console.log('EXCERPT (KTX idx ' + i + '):', t.slice(Math.max(0, i - 2000), i + 4000));
  await shot(page, 'route-click-result');
}

await ctx.close();
