import { launch, goto } from './lib.mjs';

const { ctx, page } = await launch();
await goto(page, 'https://kr.trip.com/trains/?departdate=2026-09-24');

async function getVals() {
  return {
    dep: await page.locator('input[placeholder="출발역"][readonly]').first().inputValue().catch(() => '?'),
    arr: await page.locator('input[placeholder="도착역"][readonly]').first().inputValue().catch(() => '?'),
  };
}

// [검증1] 위젯 input에 '부산' 입력 → 실제 폼 값 변하는지
const dep = page.locator('input[placeholder="출발역"]:visible').first();
await dep.click({ force: true });
await page.waitForTimeout(1500);
const editable = page.locator('input[placeholder="출발역"]:visible:not([readonly])').first();
await editable.fill('');
await editable.pressSequentially('부산', { delay: 150 });
await page.waitForTimeout(2500);
const liBusan = page.locator('li', { hasText: '부산, 대한민국' }).first();
if (await liBusan.count()) {
  await liBusan.click({ timeout: 5000 }).catch(() => {});
  await page.waitForTimeout(1200);
}
console.log('검증1 (부산 선택 후 실제 폼 값):', JSON.stringify(await getVals()));

// 패널 닫기
await page.keyboard.press('Escape');
await page.mouse.click(700, 780);
await page.waitForTimeout(800);

// [검증2] 실제 폼 readonly input 직접 클릭 → 값 유지 확인
const depRo = page.locator('input[placeholder="출발역"][readonly]').first();
await depRo.click({ force: true, timeout: 5000 }).catch(e => console.log('readonly 직접클릭 실패:', e.message.split('\n')[0]));
await page.waitForTimeout(1500);
console.log('검증2 (readonly 직접 클릭 후 값):', JSON.stringify(await getVals()));
// 열렸다면 ESC로 닫기
await page.keyboard.press('Escape');
await page.waitForTimeout(500);

// [검증3] 스크린샷 (현재 상태 육안 확인용)
await page.screenshot({ path: '.pptr/shots/s18-final.png' });
console.log('검증3: 스크린샷 저장 완료');

await ctx.close();
