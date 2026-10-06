import { launch, goto } from './lib.mjs';

const { ctx, page } = await launch();
await goto(page, 'https://kr.trip.com/trains/korail/route/daejeon-to-seoul/');

const links = await page.evaluate(() =>
  [...document.querySelectorAll('a')]
    .filter(a => /train|list/i.test(a.href))
    .slice(0, 30)
    .map(a => ({ href: a.href, text: (a.innerText || '').trim().slice(0, 40).replace(/\n/g, ' ') }))
);
console.log(JSON.stringify(links, null, 1));

await ctx.close();
