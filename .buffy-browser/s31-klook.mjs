import { launch, goto, dump, shot } from './lib.mjs';

const { ctx, page } = await launch();
await goto(page, 'https://www.klook.com/en-US/korea-rail/');
console.log('URL:', page.url());
await dump(page, 'klook-hub', 8000);
await shot(page, 'klook-hub');

// 대전 관련 링크 수집
const links = await page.evaluate(() =>
  [...document.querySelectorAll('a')]
    .filter(a => /daejeon|seoul/i.test(a.href + (a.innerText || '')))
    .slice(0, 20)
    .map(a => ({ href: a.href, text: (a.innerText || '').trim().slice(0, 50).replace(/\n/g, ' ') }))
);
console.log('LINKS:', JSON.stringify(links, null, 1));

await ctx.close();
