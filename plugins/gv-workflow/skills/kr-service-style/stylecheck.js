/* global document, window, getComputedStyle, NodeFilter */
// kr-service-style 검사기 — 페이지 안에서 실행 (DevTools 콘솔, Playwright page.evaluate, 브라우저 자동화 도구의 JS 실행).
// 프로필: 실행 전에 window.KR_STYLE_PROFILE = 'toss' | 'karrot' 로 정한다. 없으면 'common'(공통 규칙만).
// 결과: 문구 규칙 위반, 첫 화면 주 버튼 개수, 탭 개수, 최소 글자 크기, 남의 브랜드 색 사용.
// ponytail: 문구는 정규식 근사. "취소"가 정말 작업 취소인지 같은 맥락은 사람이 판단한다 — 결과는 후보 목록이다.
((profile) => {
  const HANGUL = /[가-힣]/;
  const SKIP = 'script,style,code,pre,kbd,samp,textarea,[aria-hidden="true"]';
  const on = (ps) => ps.includes(profile) || ps.includes('common');

  const visible = (el) => {
    const r = el.getBoundingClientRect();
    const s = getComputedStyle(el);
    return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.opacity !== '0';
  };
  const clean = (s) => (s || '').replace(/\s+/g, ' ').trim();
  const where = (el) =>
    el.id
      ? `#${el.id}`
      : `${el.tagName.toLowerCase()}${typeof el.className === 'string' && el.className.trim() ? '.' + el.className.trim().split(/\s+/)[0] : ''}`;
  const rgb = (c) => (c.match(/\d+(\.\d+)?/g) || []).map(Number);

  const issues = [];
  const add = (rule, text, el, fix) =>
    issues.push({ rule, text: text.slice(0, 60), at: where(el), fix });

  // ── 문구: 화면에 보이는 한글 문장
  const SENTENCE_RULES = [
    {
      rule: '과한 경어',
      re: /(시겠어요|시겠습니까|하십시오|주십시오|께서|계시|계신)/,
      profiles: ['toss', 'karrot'],
      fix: '"~할까요?", "~하고 있나요?" 처럼 낮춘다',
    },
    { rule: '되어요', re: /되어요|되었어요/, profiles: ['common'], fix: '"돼요", "됐어요"' },
    {
      rule: '불가 표현',
      re: /(불가능|불가합니다|할 수 없습니다)/,
      profiles: ['toss', 'karrot'],
      fix: '"할 수 없어요", 가능하면 "~하면 할 수 있어요"',
    },
    {
      rule: '합니다체',
      re: /(습니다|입니다|합니다|됩니다|십시오)[.!?]?$/,
      profiles: ['toss', 'karrot'],
      fix: '해요체로 (karrot 은 자동 경고만 "~니다" 허용)',
    },
  ];
  const texts = new Map();
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
    acceptNode: (n) => {
      const el = n.parentElement;
      if (!el || !HANGUL.test(n.data) || el.closest(SKIP) || !visible(el)) {
        return NodeFilter.FILTER_REJECT;
      }
      return NodeFilter.FILTER_ACCEPT;
    },
  });
  for (let n; (n = walker.nextNode()); ) {
    const t = clean(n.data);
    if (t && !texts.has(t)) texts.set(t, n.parentElement);
  }
  for (const [t, el] of texts) {
    for (const s of t.split(/(?<=[.!?])\s+/)) {
      for (const r of SENTENCE_RULES) if (on(r.profiles) && r.re.test(s)) add(r.rule, s, el, r.fix);
    }
  }
  if (profile === 'karrot') {
    const bangs = [...texts.keys()].join(' ').split('!').length - 1;
    if (bangs > 1) {
      issues.push({
        rule: '느낌표 남용',
        text: `느낌표 ${bangs}개`,
        at: 'body',
        fix: '꼭 필요한 한 곳만',
      });
    }
  }

  // ── 버튼
  const buttons = [
    ...document.querySelectorAll(
      'button, [role="button"], input[type="submit"], input[type="button"], a[class*="btn"], a[class*="button"]',
    ),
  ].filter(visible);
  for (const b of buttons) {
    const t = clean(b.innerText || b.value || b.getAttribute('aria-label'));
    if (!t) continue;
    if (profile === 'toss' && t === '취소') add('취소 버튼', t, b, '창을 닫는 버튼이면 "닫기"');
    if (profile === 'karrot' && /[.。]$/.test(t)) add('버튼 마침표', t, b, '마침표를 뺀다');
    if (profile === 'karrot' && HANGUL.test(t) && t.replace(/\s/g, '').length > 12) {
      add('CTA 12자 초과', t, b, '동사로 시작하는 12자 이내');
    }
  }

  // ── 첫 화면 주 버튼: 채도 있는 채움 버튼이 첫 화면(스크롤 전)에 2개 이상
  // 소셜 로그인 버튼은 각 회사 가이드 색이라 주 버튼 개수에서 뺀다
  const SOCIAL = /(카카오|네이버|kakao|naver|apple|google|애플|구글).*(로그인|시작|login|sign)/i;
  const filled = buttons.filter((b) => {
    if (SOCIAL.test(clean(b.innerText || b.value))) return false;
    const [r, g, bl, a = 1] = rgb(getComputedStyle(b).backgroundColor);
    if (a < 0.5 || r === undefined) return false;
    const max = Math.max(r, g, bl) / 255;
    const min = Math.min(r, g, bl) / 255;
    const l = (max + min) / 2;
    const s = max === min ? 0 : (max - min) / (1 - Math.abs(2 * l - 1));
    const top = b.getBoundingClientRect().top;
    return s > 0.35 && l > 0.2 && l < 0.85 && top >= 0 && top < window.innerHeight;
  });
  if ((profile === 'toss' || profile === 'karrot') && filled.length > 1) {
    issues.push({
      rule: '주 버튼 여러 개',
      text: filled
        .map((b) => clean(b.innerText || b.value))
        .join(' / ')
        .slice(0, 60),
      at: 'first-screen',
      fix: '주 행동 하나만 채움, 나머지는 연한 바탕·글자 버튼',
    });
  }

  // ── 탭 개수 (toss: 2~5)
  if (profile === 'toss') {
    for (const list of document.querySelectorAll('[role="tablist"]')) {
      const n = list.querySelectorAll('[role="tab"]').length;
      if (n && (n < 2 || n > 5)) add('탭 개수', `탭 ${n}개`, list, '2~5개');
    }
  }

  // ── 최소 글자 크기 11px
  const tiny = [...texts.values()].filter((el) => parseFloat(getComputedStyle(el).fontSize) < 11);
  for (const el of tiny.slice(0, 5)) {
    add('11px 미만 글자', clean(el.innerText), el, '11px 이상, 가능하면 13px 이상');
  }

  // ── 남의 브랜드 색: 배경·버튼 글자색이 아래 색과 거의 같으면 경고 (각 회사 로그인 버튼 안은 제외)
  const BRANDS = [
    { name: '토스 파랑', hex: '#3182F6', login: null },
    { name: '카카오 노랑', hex: '#FEE500', login: /카카오/ },
    { name: '카카오뱅크 노랑', hex: '#FFE300', login: /카카오/ },
    { name: '네이버 그린', hex: '#03C75A', login: /네이버|naver/i },
    { name: '네이버 로그인 그린', hex: '#03A94D', login: /네이버|naver/i },
    { name: '당근 주황', hex: '#FF6600', login: null },
    { name: '당근 주황(웹)', hex: '#FF6F0F', login: null },
  ].map((b) => ({ ...b, rgb: b.hex.match(/\w\w/g).map((h) => parseInt(h, 16)) }));
  const near = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]) < 24;
  const seen = new Set();
  for (const el of document.querySelectorAll('body *')) {
    if (!visible(el)) continue;
    const s = getComputedStyle(el);
    const bg = rgb(s.backgroundColor);
    const candidates = [
      bg.length >= 3 && (bg[3] ?? 1) > 0.5 ? bg : null,
      buttons.includes(el) ? rgb(s.color) : null,
    ];
    for (const c of candidates.filter(Boolean)) {
      for (const b of BRANDS) {
        if (!near(c, b.rgb)) continue;
        const label = clean(el.closest('a,button,[role="button"]')?.innerText || el.innerText);
        if (b.login && b.login.test(label)) continue;
        const key = `${b.name}|${where(el)}`;
        if (seen.has(key)) continue;
        seen.add(key);
        add('남의 브랜드 색', `${b.name} ${b.hex}`, el, '사용자 브랜드 색 토큰으로 바꾼다');
        break; // 한 색이 비슷한 브랜드 색 둘에 걸려도 한 번만
      }
    }
  }

  const count = {};
  for (const i of issues) count[i.rule] = (count[i.rule] || 0) + 1;
  return {
    profile,
    width: window.innerWidth,
    total: issues.length,
    count,
    issues: issues.slice(0, 40),
  };
})(window.KR_STYLE_PROFILE || 'common');
