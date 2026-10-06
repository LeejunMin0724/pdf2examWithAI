import { launch, goto, shot } from './lib.mjs';

const { ctx, page } = await launch();
await goto(page, 'https://kr.trip.com/trains/?departdate=2026-09-24');

// "검색" 텍스트를 가진 보이는 요소 전수 조사
const els = await page.evaluate(() => {
  const out = [];
  for (const e of document.querySelectorAll('*')) {
    const t = (e.innerText || '').trim();
    if (t === '검색' && e.offsetWidth > 0 && e.offsetHeight > 0) {
      const r = e.getBoundingClientRect();
      const top = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
      out.push({
        tag: e.tagName, cls: (e.className || '').toString().slice(0, 50),
        x: r.x + r.width / 2, y: r.y + r.height / 2, w: r.width, h: r.height,
        topAt: top ? `${top.tagName}.${(top.className || '').toString().slice(0, 40)}` : 'none',
        isTop: top === e || e.contains(top),
      });
    }
  }
  return out;
});
console.log('SEARCH ELEMENTS:', JSON.stringify(els, null, 1));

// 폼 입력 필드 위치(출발역 readonly)와 그 근처 구조
const form = await page.evaluate(() => {
  const dep = [...document.querySelectorAll('input[placeholder="출발역"]')].find(i => i.offsetWidth > 0);
  if (!dep) return null;
  const r = dep.getBoundingClientRect();
  return { depX: r.x, depY: r.y, depW: r.width, depH: r.height };
});
console.log('DEP BOX:', JSON.stringify(form));

await shot(page, 's13-probe');
await ctx.close();
