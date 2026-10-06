import { launch, goto, dump, shot } from './lib.mjs';

const { ctx, page } = await launch();
await goto(page, 'https://www.korail.com/intro', 'load');
await page.waitForTimeout(5000);

const inputs = await page.evaluate(() =>
  [...document.querySelectorAll('input, select, button, a.btn, [role="button"]')]
    .filter(e => e.offsetWidth > 0)
    .map(e => ({
      tag: e.tagName,
      type: e.type || '',
      ph: e.placeholder || '',
      val: (e.value || e.innerText || '').trim().slice(0, 40),
      name: e.name || '',
      id: e.id || '',
      cls: (e.className || '').toString().slice(0, 50),
      x: Math.round(e.getBoundingClientRect().x), y: Math.round(e.getBoundingClientRect().y),
    }))
);
console.log(JSON.stringify(inputs, null, 1));
await shot(page, 'korail-intro');
await ctx.close();
