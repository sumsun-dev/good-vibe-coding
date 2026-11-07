#!/usr/bin/env node
/* global document, getComputedStyle */
// 데모 무대를 폭별·시간별로 찍고 잰다. Stageshow 의 film.mjs 를 쓸 수 없을 때의 대체.
// 대상 저장소(또는 상위 폴더)의 playwright / playwright-core 와 설치된 Chrome 을 쓴다.
//
// 사용: node film-lite.mjs <url> --select <루트 선택자> [--widths 1280,390]
//         [--times 0,1500,3000,6000,10000] [--track .a,.b] [--out ./shots] [--reduced]
// 출력: <out>/w<폭>-t<ms>.png, <out>/sheet-<폭>.png, 폭마다 JSON 한 줄
import { createRequire } from 'node:module';
import { mkdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const argv = process.argv.slice(2);
const url = argv[0];
const USAGE =
  '사용: node film-lite.mjs <url> --select <선택자> [--widths 1280,390] [--times ...] [--track ...] [--out ...] [--reduced]\n';
const fail = (msg) => {
  process.stderr.write(`${msg}\n${USAGE}`);
  process.exit(2);
};
const opt = (name, fallback) => {
  const i = argv.indexOf(`--${name}`);
  if (i < 0) return fallback;
  const v = argv[i + 1];
  if (!v || v.startsWith('--')) fail(`--${name} 에 값이 없습니다.`);
  return v;
};
const numbers = (name, fallback) => {
  const list = opt(name, fallback).split(',').map(Number);
  if (list.some((n) => !Number.isFinite(n) || n < 0)) {
    fail(`--${name} 은 쉼표로 나눈 숫자여야 합니다.`);
  }
  return list;
};
if (!url || url.startsWith('--')) fail('url 이 없습니다.');
const select = opt('select', '.ss-stage');
const widths = numbers('widths', '1280,390');
// 시각은 페이지 로드(networkidle) 뒤부터 잰다. 화면 위쪽 데모는 그 전에 재생을 시작하므로 실제보다 수백 ms 늦게 찍힐 수 있다
const times = numbers('times', '0,1500,3000,4500,6000,8000,10500');
const track = opt('track', '').split(',').filter(Boolean);
const out = resolve(opt('out', './shots'));
const reduced = argv.includes('--reduced');
mkdirSync(out, { recursive: true });

const req = createRequire(join(process.cwd(), 'noop.js'));
let chromium;
for (const name of ['playwright', 'playwright-core']) {
  try {
    ({ chromium } = req(name));
    break;
  } catch {
    // 다음 후보
  }
}
if (!chromium) {
  process.stderr.write(
    'playwright 또는 playwright-core 를 찾지 못했습니다. 대상 저장소 폴더에서 실행하세요.\n',
  );
  process.exit(2);
}

// 설치된 Chrome 을 먼저 쓰고, 없으면 Playwright 가 받아 둔 Chromium 으로
const browser = await chromium.launch({ channel: 'chrome' }).catch(() => chromium.launch());
try {
  for (const w of widths) {
    const mobile = w < 500;
    const ctx = await browser.newContext({
      viewport: { width: w, height: 900 },
      deviceScaleFactor: 2,
      isMobile: mobile,
      hasTouch: mobile,
      reducedMotion: reduced ? 'reduce' : 'no-preference',
    });
    const page = await ctx.newPage();
    const logs = [];
    page.on('console', (m) => {
      if (m.type() === 'error' || m.type() === 'warning') {
        logs.push(`${m.type()}: ${m.text().slice(0, 160)}`);
      }
    });
    page.on('pageerror', (e) => logs.push(`pageerror: ${e.message.slice(0, 160)}`));
    await page.goto(url, { waitUntil: 'networkidle' });
    const root = page.locator(select).first();
    await root.scrollIntoViewIfNeeded();

    const measure = (sels) =>
      page.evaluate(
        ({ rootSel, sels }) => {
          const rootEl = document.querySelector(rootSel);
          const st = rootEl?.matches('.ss-stage')
            ? rootEl
            : (rootEl?.querySelector('.ss-stage') ?? rootEl);
          const r = st.getBoundingClientRect();
          const k = st.offsetWidth ? st.offsetWidth / r.width : 1;
          const pos = {};
          for (const s of sels) {
            const e = st.querySelector(s);
            if (!e) {
              pos[s] = null;
              continue;
            }
            const q = e.getBoundingClientRect();
            pos[s] = [Math.round((q.top - r.top) * k), Math.round((q.bottom - r.top) * k)];
          }
          return { stageH: st.offsetHeight, pos };
        },
        { rootSel: select, sels },
      );

    const frames = [];
    const t0 = Date.now();
    for (const t of times) {
      const wait = t - (Date.now() - t0);
      if (wait > 0) await page.waitForTimeout(wait);
      const file = join(out, `w${w}-t${String(t).padStart(5, '0')}.png`);
      await root.screenshot({ path: file });
      frames.push({ t, file, ...(track.length ? await measure(track) : {}) });
    }

    const stats = await page.evaluate((rootSel) => {
      const rootEl = document.querySelector(rootSel);
      const st = rootEl.matches('.ss-stage')
        ? rootEl
        : (rootEl.querySelector('.ss-stage') ?? rootEl);
      const r = st.getBoundingClientRect();
      const scale = st.offsetWidth ? r.width / st.offsetWidth : 1;
      const texts = [...st.querySelectorAll('*')]
        .filter((n) => [...n.childNodes].some((c) => c.nodeType === 3 && c.textContent.trim()))
        .filter((n) => n.getBoundingClientRect().width > 0)
        .map((n) => ({
          text: n.textContent.trim().slice(0, 24),
          px: +(parseFloat(getComputedStyle(n).fontSize) * scale).toFixed(1),
        }))
        .sort((a, b) => a.px - b.px);
      return {
        stage: [Math.round(r.width), Math.round(r.height)],
        scale: +scale.toFixed(3),
        hscroll: document.documentElement.scrollWidth > document.documentElement.clientWidth,
        smallest: texts.slice(0, 4),
        under10px: texts.filter((x) => x.px < 10).length,
      };
    }, select);

    const html = `<body style="margin:0;background:#777;display:flex;flex-wrap:wrap;gap:8px;padding:8px;font:12px sans-serif">${frames
      .map(
        (f) =>
          `<div><img style="width:220px;display:block" src="data:image/png;base64,${readFileSync(f.file).toString('base64')}"><div style="color:#fff">${f.t}ms</div></div>`,
      )
      .join('')}</body>`;
    const sheet = await browser.newPage({ viewport: { width: 1180, height: 400 } });
    await sheet.setContent(html);
    await sheet.screenshot({ path: join(out, `sheet-${w}.png`), fullPage: true });
    await sheet.close();

    process.stdout.write(
      `${JSON.stringify({ width: w, ...stats, frames: frames.map(({ t, stageH, pos }) => ({ t, ...(pos ? { stageH, pos } : {}) })), logs })}\n`,
    );
    await ctx.close();
  }
} finally {
  await browser.close();
}
