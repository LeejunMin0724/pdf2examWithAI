import { launch, goto, shot } from './lib.mjs';

const { ctx, page } = await launch();
await goto(page, 'https://www.korail.com/intro', 'load');
await page.waitForTimeout(5000);

await page.locator('li.search_item.n2 span.input').first().click();
await page.waitForTimeout(2000);

const struct = await page.evaluate(() => {
  const dp = [...document.querySelectorAll('div.datepicker')].filter(e => e.offsetWidth > 200);
  if (!dp.length) return null;
  const d = dp[0];
  // 월 표시(p.date)와 형제 요소들
  const dateP = d.querySelector('p.date');
  const parent = dateP?.parentElement;
  const sibs = parent ? [...parent.children].map(c => ({ tag: c.tagName, cls: (c.className || '').toString().slice(0, 50), t: (c.innerText || '').trim().slice(0, 20) })) : [];
  // 24일 셀 후보
  const cells = [...d.querySelectorAll('a, button, td span, li span')].filter(e => (e.innerText || '').trim() === '24').slice(0, 4).map(e => {
    const r = e.getBoundingClientRect();
    return { tag: e.tagName, cls: (e.className || '').toString().slice(0, 40), x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2), disabled: e.getAttribute('aria-disabled') || e.className.includes('dim') || '' };
  });
  return { sibs, cells };
});
console.log(JSON.stringify(struct, null, 1));
await shot(page, 's41-cal');
await ctx.close();
