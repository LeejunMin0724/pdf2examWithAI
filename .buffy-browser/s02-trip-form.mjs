import { launch, goto, dump, shot } from './lib.mjs';

const { ctx, page } = await launch();
await goto(page, 'https://kr.trip.com/trains/?departdate=2026-09-24');

// input 필드 나열
const inputs = await page.evaluate(() =>
  [...document.querySelectorAll('input')].map((i, idx) => ({
    idx,
    type: i.type,
    placeholder: i.placeholder || '',
    ariaLabel: i.getAttribute('aria-label') || '',
    cls: (i.className || '').slice(0, 60),
    visible: !!(i.offsetWidth || i.offsetHeight),
  })).filter(x => x.visible)
);
console.log('VISIBLE INPUTS:', JSON.stringify(inputs, null, 1));

await shot(page, 'trip-form');
await dump(page, 'trip-form', 2000);

await ctx.close();
