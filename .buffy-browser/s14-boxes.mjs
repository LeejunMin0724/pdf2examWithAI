import { launch, goto, shot } from './lib.mjs';

const { ctx, page } = await launch();
await goto(page, 'https://kr.trip.com/trains/?departdate=2026-09-24');

const boxes = await page.evaluate(() => {
  const out = [];
  const depInputs = [...document.querySelectorAll('input[placeholder="출발역"]')];
  for (const dep of depInputs) {
    // 컨테이너 탐색: open-component 또는 검색 관련 클래스
    let box = dep, info = null;
    for (let k = 0; k < 10 && box.parentElement; k++) {
      box = box.parentElement;
      const cls = (box.className || '').toString();
      if (cls.includes('open-component') || cls.toLowerCase().includes('search')) {
        const r = box.getBoundingClientRect();
        // 컨테이너 내부 input들
        const inputs = [...box.querySelectorAll('input')].map(i => ({
          ph: i.placeholder, val: i.value, ro: i.readOnly,
          vis: i.offsetWidth > 0, x: Math.round(i.getBoundingClientRect().x), y: Math.round(i.getBoundingClientRect().y),
        }));
        // 컨테이너 내부 검색 텍스트
        const searchBtn = [...box.querySelectorAll('*')].find(e => (e.innerText || '').trim() === '검색' && e.offsetWidth > 0);
        const btnPos = searchBtn ? (() => { const r = searchBtn.getBoundingClientRect(); return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2), tag: searchBtn.tagName }; })() : null;
        info = { cls: cls.slice(0, 70), boxX: Math.round(r.x), boxY: Math.round(r.y), boxW: Math.round(r.width), boxH: Math.round(r.height), inputs, searchBtn: btnPos };
        break;
      }
    }
    if (info) out.push(info);
  }
  return out;
});
console.log(JSON.stringify(boxes, null, 1));

await shot(page, 's14-boxes');
await ctx.close();
