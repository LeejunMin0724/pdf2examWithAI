import { launch, goto, shot } from './lib.mjs';

const { ctx, page } = await launch();
await goto(page, 'https://kr.trip.com/trains/?departdate=2026-09-24');

const dep = page.locator('input[class*="CityPicker_input"]').nth(0);
await dep.click();
await page.waitForTimeout(1000);
await dep.fill('');
await dep.pressSequentially('대전', { delay: 150 });
await page.waitForTimeout(3000);
await shot(page, 'trip-dd2');

const struct = await page.evaluate(() => {
  const cands = [...document.querySelectorAll('div,ul')]
    .filter(el => el.querySelectorAll('li').length > 0 && (el.innerText || '').includes('대전'))
    .map(el => ({
      cls: (el.className || '').toString().slice(0, 80),
      vis: !!(el.offsetWidth || el.offsetHeight),
      text: (el.innerText || '').slice(0, 300).replace(/\n/g, ' | '),
      lis: [...el.querySelectorAll('li')].slice(0, 8).map(li => ({
        cls: (li.className || '').toString().slice(0, 60),
        vis: !!(li.offsetWidth || li.offsetHeight),
        text: (li.innerText || '').slice(0, 80).replace(/\n/g, ' | '),
      })),
    }));
  return cands.slice(-6);
});
console.log(JSON.stringify(struct, null, 1));

await ctx.close();
