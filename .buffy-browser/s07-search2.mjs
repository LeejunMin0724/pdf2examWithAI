import { launch, goto, dump, shot } from './lib.mjs';

const { ctx, page } = await launch();
await goto(page, 'https://kr.trip.com/trains/?departdate=2026-09-24');

const depRo = page.locator('input[placeholder="출발역"][readonly]');
const arrRo = page.locator('input[placeholder="도착역"][readonly]');

// 1) 출발역 선택
await depRo.click();
await page.waitForTimeout(2000);
await shot(page, 'step-dep-panel');
await page.locator('li', { hasText: /^대전$/ }).first().click({ timeout: 8000 });
await page.waitForTimeout(1200);
console.log('DEP VALUE:', await depRo.inputValue().catch(() => 'N/A'));

// 2) 도착역 선택
await arrRo.click();
await page.waitForTimeout(2000);
await shot(page, 'step-arr-panel');
await page.locator('li', { hasText: /^서울$/ }).first().click({ timeout: 8000 });
await page.waitForTimeout(1200);
console.log('ARR VALUE:', await arrRo.inputValue().catch(() => 'N/A'));

// 3) 패널 닫기 (바깥 클릭)
await page.mouse.click(700, 650);
await page.waitForTimeout(800);
await shot(page, 'step-before-search');

// 4) 검색 클릭
const btn = page.locator('button:has-text("검색")').first();
console.log('BTN COUNT:', await btn.count());
await btn.click({ timeout: 8000 });
await page.waitForTimeout(15000);
console.log('FINAL URL:', page.url());
const t = await dump(page, 'trip-results2', 20000);
// 결과 섹션만 발췌
const i = t.indexOf('출발시간');
console.log('--- RESULTS EXCERPT ---');
console.log(t.slice(Math.max(0, i - 200), i + 5000) || t.slice(0, 5000));
await shot(page, 'trip-results2');
await ctx.close();
