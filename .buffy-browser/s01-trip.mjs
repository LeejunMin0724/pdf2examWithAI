import { launch, goto, fullText, dump, shot } from './lib.mjs';

const { ctx, page } = await launch();

// URL로 직접 도전: 대전 -> 서울, 날짜 2026-09-24
const url = 'https://kr.trip.com/trains/list?departurecity=Daejeon&arrivalcity=Seoul&departdate=2026-09-24';
await goto(page, url);
console.log('URL:', page.url());
await dump(page, 'trip-1', 3000);
await shot(page, 'trip-1');

// 국문 로컬라이즈 URL 변형 시도
const url2 = 'https://kr.trip.com/trains/list?departurecity=%EB%8C%80%EC%A0%84&arrivalcity=%EC%84%9C%EC%9A%B8&departdate=2026-09-24';
await goto(page, url2);
console.log('URL:', page.url());
await dump(page, 'trip-2', 3000);
await shot(page, 'trip-2');

// 국문 경로 페이지에서 검색 폼 시도
const url3 = 'https://kr.trip.com/trains/route/daejeon-to-seoul/';
await goto(page, url3);
console.log('URL:', page.url());
await dump(page, 'trip-3', 5000);
await shot(page, 'trip-3');

await ctx.close();
