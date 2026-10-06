import { launch, goto, dump, shot } from './lib.mjs';

const { ctx, page } = await launch();
await goto(page, 'https://kr.trip.com/trains/?departdate=2026-09-24');

async function pickCity(placeholder, query) {
  const input = page.locator(`input[placeholder="${placeholder}"]`).first();
  await input.click();
  await page.waitForTimeout(800);
  await input.fill('');
  await input.pressSequentially(query, { delay: 120 });
  await page.waitForTimeout(2500);
  // 드롭다운 옵션 나열 후 첫 항목 클릭
  const opts = await page.evaluate(() =>
    [...document.querySelectorAll('li, [role="option"], [class*="dropdown"] li, [class*="option"]')]
      .map(el => (el.innerText || '').trim())
      .filter(t => t && t.length < 60 && t.length > 1)
  );
  console.log('OPTIONS for', placeholder, ':', JSON.stringify(opts.slice(0, 12)));
  const cand = page.locator('li, [role="option"]').filter({ hasText: query }).first();
  if (await cand.count()) {
    await cand.click();
  } else {
    await page.keyboard.press('Enter');
  }
  await page.waitForTimeout(1500);
}

await pickCity('출발역', '대전');
await pickCity('도착역', '서울');

// 날짜 확인 및 검색 버튼 클릭
await dump(page, 'trip-pre-search', 1500);
const btn = page.locator('button', { hasText: '검색' }).first();
if (await btn.count()) { await btn.click(); } else { await page.keyboard.press('Enter'); }
await page.waitForTimeout(12000);

console.log('FINAL URL:', page.url());
await dump(page, 'trip-results', 15000);
await shot(page, 'trip-results', 12000);
await ctx.close();
