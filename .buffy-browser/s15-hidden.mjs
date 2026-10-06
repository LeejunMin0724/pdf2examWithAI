import { launch, goto, dump, shot } from './lib.mjs';

const { ctx, page } = await launch();
await goto(page, 'https://kr.trip.com/trains/?departdate=2026-09-24');

async function visLIs() {
  return page.evaluate(() =>
    [...document.querySelectorAll('li')]
      .map(li => { const r = li.getBoundingClientRect(); return { t: (li.innerText || '').trim().replace(/\n/g, ' ').slice(0, 60), x: r.x + r.width / 2, y: r.y + r.height / 2, vis: r.width > 0 && r.height > 0 }; })
      .filter(x => x.vis && x.t)
  );
}
async function pickCity(ph, query) {
  await page.locator(`input[placeholder="${ph}"]:visible`).first().click({ force: true, timeout: 8000 });
  await page.waitForTimeout(1500);
  const editable = page.locator(`input[placeholder="${ph}"]:visible:not([readonly])`).first();
  await editable.fill('');
  await editable.pressSequentially(query, { delay: 150 });
  await page.waitForTimeout(2500);
  const lis = await visLIs();
  const hit = lis.find(x => x.t.includes(`${query}, 대한민국`));
  if (hit) { await page.mouse.click(hit.x, hit.y); await page.waitForTimeout(1200); }
  await page.keyboard.press('Escape');
  await page.waitForTimeout(400);
  await page.mouse.click(700, 780);
  await page.waitForTimeout(600);
}

await pickCity('출발역', '대전');
await pickCity('도착역', '서울');

const hidden = await page.evaluate(() => {
  const box = [...document.querySelectorAll('div.search-box')].find(d => (d.innerText || '').includes('검색'));
  // 박스 내부의 모든 input(숨은 것 포함) + data 속성
  const all = [...box.querySelectorAll('input')].map(i => ({
    ph: i.placeholder || '', name: i.name || '', id: i.id || '', val: i.value, ro: i.readOnly,
    type: i.type, vis: i.offsetWidth > 0,
  }));
  const dataAttrs = [...box.querySelectorAll('[data-city-id],[data-value],[data-code]')].slice(0, 10).map(e => ({
    tag: e.tagName, attrs: [...e.attributes].map(a => `${a.name}=${a.value.slice(0, 40)}`).join(' '),
  }));
  return { all, dataAttrs, boxCls: box.className };
});
console.log(JSON.stringify(hidden, null, 1));

await ctx.close();
