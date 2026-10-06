import { launch, goto, shot } from './lib.mjs';

const { ctx, page } = await launch();
await goto(page, 'https://www.korail.com/intro', 'load');
await page.waitForTimeout(5000);

const fields = await page.evaluate(() => {
  const out = [];
  for (const e of document.querySelectorAll('*')) {
    const t = (e.innerText || '').trim();
    if ((t === '서울' || t === '부산' || /^2026-09-22/.test(t) || t === '총 1 명') && e.children.length === 0 && e.offsetWidth > 0) {
      const r = e.getBoundingClientRect();
      let p = e, chain = [];
      for (let k = 0; k < 4 && p; k++) { chain.push(`${p.tagName}.${(p.className || '').toString().slice(0, 40)}`); p = p.parentElement; }
      out.push({ t: t.slice(0, 30), tag: e.tagName, cls: (e.className || '').toString().slice(0, 40), x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2), chain });
    }
  }
  return out;
});
console.log(JSON.stringify(fields, null, 1));

await shot(page, 's37-fields');
await ctx.close();
