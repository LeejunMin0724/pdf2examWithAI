import { launch, goto, dump, shot } from './lib.mjs';

const { ctx, page } = await launch();
await goto(page, 'https://www.korail.com/intro', 'load');
await page.waitForTimeout(5000);

// 1) 출발역 클릭 → 팝업 덤프
await page.locator('div.station_item.n1 span.input').first().click();
await page.waitForTimeout(2000);
await shot(page, 's38-dep-popup');
const popupText = await page.evaluate(() => {
  // 활성화된 팝업/모달의 텍스트 수집
  const dialogs = [...document.querySelectorAll('div,ul')].filter(e => {
    const cls = (e.className || '').toString();
    return (cls.includes('popup') || cls.includes('layer') || cls.includes('station')) && e.offsetWidth > 300 && e.offsetHeight > 200;
  });
  return dialogs.slice(-3).map(e => ({ cls: (e.className || '').toString().slice(0, 60), text: (e.innerText || '').slice(0, 800).replace(/\n{2,}/g, '\n') }));
});
console.log('POPUP:', JSON.stringify(popupText, null, 1));

// '대전' 항목 클릭 시도
const daejeon = page.locator('li, button, a, span').filter({ hasText: /^대전$/ }).first();
console.log('DAEJEON COUNT:', await daejeon.count());
if (await daejeon.count()) {
  await daejeon.click({ timeout: 5000 });
  await page.waitForTimeout(1500);
}
await shot(page, 's38-after-dep');

// 출발역 값 확인
const depVal = await page.evaluate(() => {
  const el = document.querySelector('div.station_item.n1 span.input');
  return el ? el.innerText.trim() : '?';
});
console.log('DEP NOW:', depVal);

await ctx.close();
