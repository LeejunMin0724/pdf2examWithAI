import { launch, goto, dump, shot } from './lib.mjs';

const { ctx, page } = await launch();
await goto(page, 'https://kr.trip.com/trains/korail/route/daejeon-to-seoul/');

const btns = await page.evaluate(() => {
  const out = [];
  for (const e of document.querySelectorAll('div,span,button,a')) {
    const t = (e.innerText || '').trim();
    if (t === '검색' && e.offsetWidth > 0) {
      const r = e.getBoundingClientRect();
      let p = e, hint = '';
      for (let k = 0; k < 4 && p; k++) { const c = (p.className || '').toString(); if (c) { hint = c.slice(0, 40); break; } p = p.parentElement; }
      out.push({ x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2), tag: e.tagName, cls: hint });
    }
  }
  return out;
});
console.log('SEARCH BTNS:', JSON.stringify(btns, null, 1));
if (btns.length) {
  await page.mouse.click(btns[0].x, btns[0].y);
  await page.waitForTimeout(15000);
  console.log('FINAL URL:', page.url());
  const t = await dump(page, 'route-search-result', 20000);
  const i = t.indexOf('KTX');
  console.log('EXCERPT (KTX idx ' + i + '):', t.slice(Math.max(0, i - 2500), i + 4000));
  await shot(page, 'route-search-result');
}
await ctx.close();
