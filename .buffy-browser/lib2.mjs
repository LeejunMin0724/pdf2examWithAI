import { launch, goto, dump, shot } from './lib.mjs';

export async function korailSetup(page, { dep = '대전', arr = '서울', day = 24 } = {}) {
  await goto(page, 'https://www.korail.com/intro', 'load');
  await page.waitForTimeout(5000);

  const getVal = (sel) => page.evaluate((s) => document.querySelector(s)?.innerText?.trim(), sel);
  const fieldDep = 'div.station_item.n1 span.input';
  const fieldArr = 'div.station_item.n2 span.input';
  const fieldDate = 'li.search_item.n2 span.input';

  async function pickStation(fieldSel, name) {
    const cur = await getVal(fieldSel);
    if (cur === name) { console.log(`${name}: 이미 설정됨`); return; }
    await page.locator(fieldSel).first().click();
    await page.waitForTimeout(1800);
    // 모달 내부로 스코프
    const item = page.locator('.type_tranin-station-pop span, .type_tranin-station-pop li, .type_tranin-station-pop button')
      .filter({ hasText: new RegExp(`^${name}$`) }).first();
    if (await item.count()) {
      await item.click({ timeout: 6000 });
    } else {
      // 스코프 실패 시 전체에서 마지막 일치(팝업이 뒤에 렌더링됨)
      await page.locator(`span, li, button`).filter({ hasText: new RegExp(`^${name}$`) }).last().click({ timeout: 6000 });
    }
    await page.waitForTimeout(1200);
    console.log(`${name} 선택 후:`, await getVal(fieldSel));
  }

  await pickStation(fieldDep, dep);
  await pickStation(fieldArr, arr);

  // 날짜
  const dateStr = await getVal(fieldDate);
  if (!dateStr?.includes(`2026-09-${String(day).padStart(2, '0')}`)) {
    await page.locator(fieldDate).first().click();
    await page.waitForTimeout(2000);
    // 현재 표시 월 확인
    const month = await page.evaluate(() => document.querySelector('.datepicker p.date')?.innerText?.trim());
    console.log('CAL MONTH:', month);
    if (month && !month.includes('2026. 09.')) {
      // 이전(<) 버튼으로 9월까지 이동
      for (let k = 0; k < 3; k++) {
        const m2 = await page.evaluate(() => document.querySelector('.datepicker p.date')?.innerText?.trim());
        if (m2?.includes('2026. 09.')) break;
        await page.locator('.datepicker p.date ~ *, .datepicker button, .datepicker a').filter({ hasText: '' }).first();
        // prev 버튼: 월 라벨 왼쪽 화살표 — 클래스 탐색
        const prevBtn = page.locator('.datepicker [class*="prev"], .datepicker [class*="cal-prev"], .datepicker .btn_prev').first();
        if (await prevBtn.count()) { await prevBtn.click({ timeout: 3000 }); await page.waitForTimeout(800); }
        else break;
      }
    }
    await page.locator('.datepicker a').filter({ hasText: new RegExp(`^${day}$`) }).first().click({ timeout: 6000 });
    await page.waitForTimeout(800);
    await page.locator('button, a').filter({ hasText: /^적용$/ }).last().click({ timeout: 6000 });
    await page.waitForTimeout(1200);
  }
  console.log('DATE:', await getVal(fieldDate));
}

export async function korailSearch(page) {
  await page.locator('button.search_btn').first().click({ timeout: 10000 });
  await page.waitForTimeout(12000);
  return page.url();
}

export async function korailResults(page, tag) {
  const t = await dump(page, tag, 20000);
  const empty = t.includes('해당 스케줄에 운행하는 열차가 없습니다.');
  return { t, empty };
}
