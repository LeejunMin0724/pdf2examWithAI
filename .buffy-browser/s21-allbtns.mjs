import { launch, goto } from './lib.mjs';

const { ctx, page } = await launch();
await goto(page, 'https://kr.trip.com/trains/?departdate=2026-09-24');

const btns = await page.evaluate(() => {
  const out = [];
  for (const b of document.querySelectorAll('[class*="SearchBtn"], div[role="button"]')) {
    const t = (b.innerText || '').trim();
    if (t !== '검색' || b.offsetWidth === 0) continue;
    const r = b.getBoundingClientRect();
    // 조상 체인에서 힌트 클래스 수집
    const hints = [];
    let e = b;
    for (let k = 0; k < 12 && e; k++) {
      const cls = (e.className || '').toString();
      if (cls) hints.push(cls.slice(0, 50));
      e = e.parentElement;
    }
    out.push({ x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2), cls: (b.className || '').toString().slice(0, 40), hints });
  }
  return out;
});
console.log(JSON.stringify(btns, null, 1));

await ctx.close();
