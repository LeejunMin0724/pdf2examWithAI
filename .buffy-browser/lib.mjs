import { chromium } from 'playwright';
import fs from 'fs';

export const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36';

export async function launch() {
  fs.mkdirSync('.pptr', { recursive: true });
  const ctx = await chromium.launchPersistentContext('.pptr', {
    headless: true,
    locale: 'ko-KR',
    timezoneId: 'Asia/Seoul',
    viewport: { width: 1400, height: 900 },
    userAgent: UA,
    args: ['--disable-blink-features=AutomationControlled'],
  });
  const page = await ctx.newPage();
  return { ctx, page };
}

export async function goto(page, url, wait = 'domcontentloaded') {
  try {
    await page.goto(url, { waitUntil: wait, timeout: 45000 });
  } catch (e) {
    console.log('goto warn:', e.message.split('\n')[0]);
  }
  await page.waitForTimeout(3000);
}

export async function textOf(page, sel) {
  return (await page.locator(sel).first().innerText().catch(() => '')).slice(0, 600);
}

export async function fullText(page, limit = 12000) {
  return (await page.evaluate(() => document.body?.innerText || '')).slice(0, limit);
}

export async function shot(page, name) {
  await page.screenshot({ path: `.pptr/shots/${name}.png`, fullPage: false }).catch(() => {});
}

export async function dump(page, name, limit = 12000) {
  const t = await fullText(page, limit);
  fs.writeFileSync(`.pptr/dumps/${name}.txt`, t);
  return t;
}

fs.mkdirSync('.pptr/shots', { recursive: true });
fs.mkdirSync('.pptr/dumps', { recursive: true });
