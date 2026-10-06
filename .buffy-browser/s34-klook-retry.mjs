import { launch, goto, dump, shot } from './lib.mjs';

const { ctx, page } = await launch();
await goto(page, 'https://www.klook.com/en-US/korea-rail/');
// 링크 렌더링 대기 (최대 30초)
try {
  await page.waitForSelector('a[href*="rails-6"]', { timeout: 30000 });
  console.log('rails links appeared');
} catch { console.log('rails links NOT found'); }
await page.waitForTimeout(3000);
const t = await dump(page, 'klook-hub2', 8000);
console.log('HEAD:', t.slice(0, 1500));
const links = await page.evaluate(() =>
  [...document.querySelectorAll('a[href*="rails-6"]')].slice(0, 10).map(a => ({ href: a.href.slice(0, 120), text: (a.innerText || '').trim().slice(0, 60).replace(/\n/g, ' ') }))
);
console.log('LINKS:', JSON.stringify(links, null, 1));
await shot(page, 'klook-hub2');

// 서울→대전 링크 클릭
const target = page.locator('a[href*="origin_position_name=Seoul"][href*="Daejeon"]').first();
if (await target.count()) {
  await target.click({ timeout: 15000 });
  await page.waitForTimeout(12000);
  console.log('URL AFTER CLICK:', page.url());
  const t2 = await dump(page, 'klook-search3', 15000);
  console.log('SEARCH PAGE HEAD:', t2.slice(0, 3000));
  await shot(page, 'klook-search3');
}
await ctx.close();
