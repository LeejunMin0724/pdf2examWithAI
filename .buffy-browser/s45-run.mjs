import { launch, dump, shot } from './lib.mjs';
import { korailSetup, korailSearch, korailResults } from './lib2.mjs';

const { ctx, page } = await launch();

// 9/24
await korailSetup(page, { dep: '대전', arr: '서울', day: 24 });
const url = await korailSearch(page);
console.log('URL:', url);
const r24 = await korailResults(page, 'k-924-v2');
console.log('9/24 EMPTY?:', r24.empty);

// 다음날(9/25) 클릭
const next = page.locator('button, a').filter({ hasText: '26년09월25일' }).first();
console.log('NEXT BTN:', await next.count());
if (await next.count()) {
  await next.click({ timeout: 8000 });
  await page.waitForTimeout(12000);
  const r25 = await korailResults(page, 'k-925-v2');
  console.log('9/25 EMPTY?:', r25.empty);
  const i = r25.t.indexOf('KTX');
  console.log('--- 9/25 ---');
  console.log(r25.t.slice(Math.max(0, i - 300), i + 9000));
  await shot(page, 'k-925-v2');
}
await ctx.close();
