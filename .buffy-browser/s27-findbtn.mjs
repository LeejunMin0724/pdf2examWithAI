import { launch, goto, dump, shot } from './lib.mjs';

const { ctx, page } = await launch();
await goto(page, 'https://kr.trip.com/trains/korail/route/daejeon-to-seoul/');

// "Find Tickets" 텍스트 요소 정보
const btns = await page.evaluate(() =>
  [...document.querySelectorAll('div,button,a,span')]
    .filter(e => /find tickets/i.test((e.innerText || '').trim()) && e.offsetWidth > 0)
    .slice(0, 5)
    .map(e => {
      const r = e.getBoundingClientRect();
      let p = e, hint = '';
      for (let k = 0; k < 6 && p; k++) { const c = (p.className || '').toString(); if (c) { hint = c.slice(0, 50); break; } p = p.parentElement; }
      return { x: r.x + r.width / 2, y: r.y + r.height / 2, tag: e.tagName, cls: hint };
    })
);
console.log('FIND TICKETS:', JSON.stringify(btns, null, 1));

// 날짜 필드 조작 시도: 'Departure time' 근처 input 찾기
const dateInputs = await page.evaluate(() =>
  [...document.querySelectorAll('input')].filter(i => i.offsetWidth > 0)
    .map(i => ({ ph: i.placeholder, val: i.value, ro: i.readOnly, x: Math.round(i.getBoundingClientRect().x), y: Math.round(i.getBoundingClientRect().y) }))
);
console.log('DATE INPUTS:', JSON.stringify(dateInputs, null, 1));

await shot(page, 's27-route');
await ctx.close();
