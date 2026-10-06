import { launch, goto, dump, shot } from './lib.mjs';

const { ctx, page } = await launch();
const url = 'https://www.klook.com/en-US/rails-6/1010-south-korea/search/?origin_position=b59daef7-438a-4a93-b696-bad4af61f4a3&origin_position_name=Daejeon%20Station&destination_position=4cd15dd2-2308-4dc4-8f94-01bd9c765c52&destination_position_name=Seoul%20Station';
await goto(page, url);
await page.waitForTimeout(8000);
console.log('URL:', page.url());
const t = await dump(page, 'klook-results', 20000);
console.log(t.slice(0, 6000));
await shot(page, 'klook-results');
await ctx.close();
