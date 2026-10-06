import { launch, goto, dump, shot } from './lib.mjs';

const { ctx, page } = await launch();
await goto(page, 'https://www.klook.com/en-US/korea-rail/');
await page.waitForTimeout(3000);

// 서울→대전 링크 클릭
const link = page.locator('a[href*="Seoul%20Station"][href*="Daejeon%20Station"]').first();
console.log('LINK COUNT:', await link.count());
await link.click({ timeout: 10000 });
await page.waitForTimeout(12000);
console.log('URL AFTER CLICK:', page.url());
const t = await dump(page, 'klook-search2', 15000);
console.log('--- TEXT HEAD ---');
console.log(t.slice(0, 4000));
await shot(page, 'klook-search2');
await ctx.close();
