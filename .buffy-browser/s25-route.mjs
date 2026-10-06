import { launch, goto, dump, shot } from './lib.mjs';

const { ctx, page } = await launch();

for (const url of [
  'https://www.trip.com/trains/korail/route/daejeon-to-seoul/',
  'https://kr.trip.com/trains/korail/route/daejeon-to-seoul',
]) {
  console.log('=== TRY:', url);
  await goto(page, url);
  console.log('FINAL:', page.url());
  const t = await dump(page, 'route-page', 20000);
  const i = t.indexOf('KTX');
  console.log(t.slice(Math.max(0, i - 1500), i + 3000));
  // 예약/시간표 링크 수집
  const links = await page.evaluate(() =>
    [...document.querySelectorAll('a[href*="trains/list"], a[href*="reserve"], a[href*="list"]')]
      .map(a => a.href).filter(h => h.includes('train')).slice(0, 10)
  );
  console.log('LINKS:', JSON.stringify(links, null, 1));
  await shot(page, 'route-page');
}

await ctx.close();
