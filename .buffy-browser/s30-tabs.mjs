import { launch, goto, dump, shot } from './lib.mjs';

const { ctx, page } = await launch();
await goto(page, 'https://kr.trip.com/trains/?departdate=2026-09-24');

const tabs = await page.evaluate(() => {
  const out = [];
  for (const e of document.querySelectorAll('[class*="trip-tab-item"], [class*="tab-item"]')) {
    const r = e.getBoundingClientRect();
    if (r.width === 0) continue;
    out.push({
      text: (e.innerText || '').trim().slice(0, 20).replace(/\n/g, ' '),
      cls: (e.className || '').toString().slice(0, 60),
      x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2),
    });
  }
  return out;
});
console.log('TABS:', JSON.stringify(tabs, null, 1));
await shot(page, 's30-tabs');

await ctx.close();
