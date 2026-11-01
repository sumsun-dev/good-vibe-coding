/* global document, window, NodeFilter, getComputedStyle */
// hangul-wrap 검사기 — 페이지 안에서 실행 (DevTools 콘솔, Playwright page.evaluate, 브라우저 자동화 도구의 JS 실행).
// 결과: 어절 쪼개짐, 마지막 줄에 짧은 어절 하나만 남은 줄(고아), 화면 밖으로 넘친 요소.
// ponytail: 한 텍스트 노드 안의 어절만 본다. <b>한</b>글 처럼 태그를 걸친 어절은 못 잡는다.
(() => {
  const HANGUL = /[가-힣]/;
  const SKIP = 'script,style,code,pre,kbd,samp,textarea,[aria-hidden="true"]';
  const range = document.createRange();
  const tops = (node, start, end) => {
    range.setStart(node, start);
    range.setEnd(node, end);
    return [...range.getClientRects()].filter((r) => r.width > 0).map((r) => Math.round(r.top));
  };
  const where = (el) =>
    el.id
      ? `#${el.id}`
      : `${el.tagName.toLowerCase()}${el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\s+/)[0] : ''}`;

  const splits = [];
  const orphans = [];
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
    acceptNode: (n) => {
      const el = n.parentElement;
      if (!el || !HANGUL.test(n.data) || el.closest(SKIP)) return NodeFilter.FILTER_REJECT;
      return el.getClientRects().length ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
    },
  });

  for (let n; (n = walker.nextNode()); ) {
    const words = [...n.data.matchAll(/\S+/g)];
    for (const m of words) {
      if (!HANGUL.test(m[0])) continue;
      if (new Set(tops(n, m.index, m.index + m[0].length)).size > 1) {
        splits.push({ word: m[0], at: where(n.parentElement) });
      }
    }
    // 고아: 노드 마지막 어절이 2글자 이하이고 혼자 다음 줄로 떨어짐
    const last = words.at(-1);
    const prev = words.at(-2);
    if (last && prev && last[0].length <= 2 && HANGUL.test(last[0])) {
      const lastTop = tops(n, last.index, last.index + 1)[0];
      const prevTop = tops(n, prev.index, prev.index + 1).at(-1);
      if (lastTop !== undefined && prevTop !== undefined && lastTop > prevTop) {
        orphans.push({ line: `${prev[0]} / ${last[0]}`, at: where(n.parentElement) });
      }
    }
  }

  const vw = document.documentElement.clientWidth;
  const overflow = [...document.querySelectorAll('body *')]
    .filter((el) => {
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.right > vw + 1 && getComputedStyle(el).position !== 'fixed';
    })
    .slice(0, 10)
    .map((el) => ({ at: where(el), by: Math.round(el.getBoundingClientRect().right - vw) }));

  return {
    width: window.innerWidth,
    pageOverflow: document.documentElement.scrollWidth - vw,
    splits: splits.length,
    orphans: orphans.length,
    overflow: overflow.length,
    detail: { splits: splits.slice(0, 20), orphans: orphans.slice(0, 20), overflow },
  };
})();
