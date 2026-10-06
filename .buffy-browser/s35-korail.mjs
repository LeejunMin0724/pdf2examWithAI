import { launch, goto, dump, shot } from './lib.mjs';

const { ctx, page } = await launch();

for (const url of ['https://www.letskorail.com/', 'https://www.korail.com/ticket/main']) {
  console.log('=== ', url);
  await goto(page, url, 'load');
  await page.waitForTimeout(6000);
  console.log('FINAL URL:', page.url());
  const t = await dump(page, 'korail-' + url.replace(/[^a-z]/gi, '-').slice(0, 30), 8000);
  console.log('HEAD:', t.slice(0, 2000));
  await shot(page, 'korail-' + url.replace(/[^a-z]/gi, '-').slice(0, 30));
}

await ctx.close();
