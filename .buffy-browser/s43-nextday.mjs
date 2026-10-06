import { launch, goto, dump, shot } from './lib.mjs';

const { ctx, page } = await launch();
// 결과 페이지에서 시작
await goto(page, 'https://www.korail.com/ticket/search/list', 'load');
await page.waitForTimeout(8000);
const t0 = await dump(page, 'korail-r0', 3000);
console.log('PAGE0:', t0.slice(0, 500));

// '다음날 (26년09월25일) 조회' 버튼 클릭
const next = page.locator('button, a').filter({ hasText: '26년09월25일' }).first();
console.log('NEXT DAY BTN:', await next.count());
if (await next.count()) {
  await next.click({ timeout: 8000 });
  await page.waitForTimeout(12000);
  const t1 = await dump(page, 'korail-r1', 20000);
  const i = t1.indexOf('KTX');
  console.log('--- 9/25 RESULTS (KTX idx ' + i + ') ---');
  console.log(t1.slice(Math.max(0, i - 500), i + 7000));
  await shot(page, 'korail-925');
}
await ctx.close();
