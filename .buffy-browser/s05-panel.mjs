import { launch, goto, shot, dump } from './lib.mjs';

const { ctx, page } = await launch();
await goto(page, 'https://kr.trip.com/trains/?departdate=2026-09-24');

const dep = page.locator('input[class*="CityPicker_input"]').nth(0);
await dep.click(); // readonly지만 클릭하면 패널이 열림
await page.waitForTimeout(2000);
await shot(page, 'trip-panel');

// 패널 내부 구조 파악
const struct = await page.evaluate(() => {
  const vis = el => !!(el.offsetWidth || el.offsetHeight);
  // 열린 패널로 추정되는 요소들: 검색 input 포함
  const panelInputs = [...document.querySelectorAll('input')]
    .filter(vis)
    .map(i => ({ ph: i.placeholder, ro: i.readOnly, val: i.value, cls: (i.className || '').toString().slice(0, 60) }));
  // 대전 관련 클릭 가능 항목
  const items = [...document.querySelectorAll('li,div,span,p')]
    .filter(el => vis(el) && /^대전/.test((el.innerText || '').trim()) && (el.innerText || '').trim().length < 40)
    .slice(0, 10)
    .map(el => ({ tag: el.tagName, cls: (el.className || '').toString().slice(0, 70), text: (el.innerText || '').trim().slice(0, 50).replace(/\n/g, ' | ') }));
  return { panelInputs, items };
});
console.log(JSON.stringify(struct, null, 1));

await ctx.close();
