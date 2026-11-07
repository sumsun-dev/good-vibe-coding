/* global document, window, getComputedStyle */
// ui-patterns 검사기 — 페이지 안에서 실행 (DevTools 콘솔, Playwright page.evaluate, 브라우저 자동화 도구의 JS 실행).
// 띄운 창·토스트는 열린 상태에서 다시 실행해야 잡힌다. 결과는 후보 목록 — 고칠지는 patterns.md 기준으로 사람이 판단한다.
// ponytail: 클래스 이름(toast·modal·switch…)으로 추정한다. 이름이 전혀 다른 직접 만든 컴포넌트는 못 잡는다.
(() => {
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
  const all = (sel) => [...document.querySelectorAll(sel)].filter(visible);
  const name = (el) =>
    clean(
      el.getAttribute('aria-label') ||
        el
          .getAttribute('aria-labelledby')
          ?.split(/\s+/)
          .map((id) => document.getElementById(id)?.innerText)
          .join(' ') ||
        (el.id && document.querySelector(`label[for="${el.id}"]`)?.innerText) ||
        el.closest('label')?.innerText ||
        el.getAttribute('title') ||
        (el.tagName === 'DIALOG' || el.getAttribute('role')?.includes('dialog')
          ? el.querySelector('h1,h2,h3')?.innerText
          : ''),
    );

  // 같은 출처 CSS 글자 전부 (다른 출처 시트는 읽을 수 없어 건너뛴다)
  const css =
    [...document.styleSheets]
      .map((s) => {
        try {
          return [...s.cssRules].map((r) => r.cssText).join('\n');
        } catch {
          return '';
        }
      })
      .join('\n') +
    [...document.querySelectorAll('[style]')].map((e) => e.getAttribute('style')).join('\n');

  const issues = [];
  const add = (group, rule, el, fix) =>
    issues.push({ group, rule, at: where(el), text: clean(el.innerText).slice(0, 40), fix });

  // 1. 고르기·입력
  const SWITCH =
    '[role="switch"], input[switch], .toggle, .switch, [class*="toggle-switch"], [class*="switch-toggle"]';
  const SAVE = /^(저장|적용|확인|변경|save|apply)/i;
  for (const sw of all(SWITCH)) {
    const box = sw.closest('form, section, fieldset, [role="dialog"], dialog') || sw.parentElement;
    const save = [...box.querySelectorAll('button, input[type="submit"]')].find(
      (b) =>
        b !== sw && visible(b) && (b.type === 'submit' || SAVE.test(clean(b.innerText || b.value))),
    );
    if (save) {
      add(
        '고르기·입력',
        '토글+저장 버튼',
        sw,
        '즉시 반영이면 저장 버튼을 빼고, 저장해야 반영이면 체크박스로',
      );
    }
    if (!name(sw) && !clean(sw.innerText)) {
      add('고르기·입력', '이름 없음', sw, '무엇을 켜는지 label 이나 aria-label');
    }
  }
  for (const f of all(
    'input[placeholder]:not([type="hidden"]):not([type="search"]), textarea[placeholder]',
  )) {
    if (!name(f)) {
      add('고르기·입력', '플레이스홀더만', f, '칸 위에 <label> — 플레이스홀더는 예시만');
    }
  }

  // 2. 띄우는 창
  const narrow = window.innerWidth < 600;
  const DIALOGISH = '.modal, .dialog, .popup, [class*="modal"], [class*="dialog"]';
  for (const el of all(DIALOGISH)) {
    if (
      el.matches('dialog, [role="dialog"], [role="alertdialog"]') ||
      el.closest('dialog, [role="dialog"], [role="alertdialog"]')
    ) {
      continue;
    }
    if (el.querySelector('dialog, [role="dialog"], [role="alertdialog"]')) continue; // 바깥 감싸개
    if (getComputedStyle(el).position !== 'fixed') continue;
    add('띄우는 창', '가짜 모달', el, '<dialog> + showModal() 로 (Esc·포커스·뒤 막기 기본)');
  }
  for (const d of all('dialog[open], [role="dialog"], [role="alertdialog"]')) {
    if (!name(d)) add('띄우는 창', '이름 없음', d, '창 제목 h2 를 aria-labelledby 로 연결');
    const r = d.getBoundingClientRect();
    const controls = d.querySelectorAll('input:not([type="hidden"]), select, textarea').length;
    if (narrow && controls >= 3 && window.innerHeight - r.bottom > 40) {
      add('띄우는 창', '모바일 가운데 모달', d, `입력칸 ${controls}개 — 바텀시트나 새 화면으로`);
    }
  }

  // 3. 알림·피드백
  const TOAST =
    '.toast, .snackbar, [class*="toast"], [class*="snackbar"], [class*="Toast"], [class*="Snackbar"]';
  const CLOSE = /^(닫기|×|✕|x|close)$/i;
  const live = (el) =>
    el.closest('[role="status"], [role="alert"], [aria-live]:not([aria-live="off"]), output');
  for (const t of all(TOAST)) {
    if (t.parentElement?.closest(TOAST)) continue; // 안쪽 조각은 한 번만
    const act = [...t.querySelectorAll('button, a')].find(
      (b) => !CLOSE.test(clean(b.innerText || b.getAttribute('aria-label'))),
    );
    if (act) {
      add(
        '알림·피드백',
        '토스트에 버튼',
        t,
        '스낵바로: 사라지는 시간을 늘리고 호버·포커스 때 멈춤',
      );
    }
    if (!live(t)) {
      add(
        '알림·피드백',
        '알림 영역 없음',
        t,
        '처음부터 있는 role="status" 영역 안에 글자를 넣는다',
      );
    }
  }

  // 4·5. 로딩·막대
  for (const p of all('progress, [role="progressbar"], meter, [role="meter"]')) {
    if (p.getAttribute('aria-hidden') === 'true' || p.closest('[class*="strength"]')) continue; // 강도 표시는 아래에서
    if (!name(p)) add('막대', '이름 없음', p, '무엇의 진행인지 aria-label');
  }
  const short = document.documentElement.scrollHeight < window.innerHeight * 2;
  for (const b of all(
    '[class*="scroll-progress"], [class*="reading-progress"], [class*="progress-scroll"]',
  )) {
    if (short) add('막대', '짧은 화면 스크롤 바', b, '두 화면이 안 되는 길이면 빼기');
  }
  if (document.querySelector('input[autocomplete="new-password"]')) {
    for (const m of all('meter, [role="meter"], [class*="strength"]')) {
      if (m.parentElement?.closest('[class*="strength"]')) continue; // 바깥 상자에서 한 번만
      const box = m.matches('[class*="strength"]') ? m : m.parentElement;
      if (
        !/[가-힣a-z]{2,}/i.test(clean(box.innerText) + (m.getAttribute('aria-valuetext') || ''))
      ) {
        add('막대', '강도 색만', m, '"약함/보통/강함" 글자를 함께');
      }
    }
  }
  const cover = /viewport-fit\s*=\s*cover/.test(
    document.querySelector('meta[name="viewport"]')?.content || '',
  );
  if (cover && !/safe-area-inset-bottom/.test(css)) {
    for (const el of all('body *')) {
      const s = getComputedStyle(el);
      if (
        (s.position === 'fixed' || s.position === 'sticky') &&
        el.getBoundingClientRect().bottom >= window.innerHeight - 1
      ) {
        add(
          '막대',
          '아래 고정 safe-area 없음',
          el,
          'padding-bottom: env(safe-area-inset-bottom) — 홈 인디케이터 자리 비우기',
        );
        break;
      }
    }
  }

  // 6. 이동 · 8. 제스처
  for (const a of all('a:not([href]), a[href="#"], a[href^="javascript:"]')) {
    if (a.getAttribute('role') === 'button') continue; // 이미 버튼으로 선언
    add('이동', '링크 모양 버튼', a, '실행이면 <button>, 이동이면 <a href="실제 주소">');
  }
  for (const b of all('button, [role="button"]')) {
    if (!clean(b.innerText) && !name(b)) add('이동', '이름 없음', b, '아이콘 버튼에 aria-label');
  }
  const vp = document.querySelector('meta[name="viewport"]')?.content || '';
  if (/user-scalable\s*=\s*(no|0)|maximum-scale\s*=\s*1(\.0)?\b/.test(vp)) {
    add('제스처', '확대 막음', document.head, 'viewport 에서 user-scalable·maximum-scale 빼기');
  }

  // 14. 버튼 위계
  const DANGER = /삭제|탈퇴|해지|지우기|delete|remove/i;
  for (const b of all('dialog button[autofocus], [role="alertdialog"] button[autofocus]')) {
    if (DANGER.test(clean(b.innerText))) {
      add('버튼 위계', '위험 버튼 자동 포커스', b, '포커스는 안전한 버튼(취소)에');
    }
  }
  for (const b of all(
    'form button[type="submit"][disabled], form input[type="submit"][disabled]',
  )) {
    add(
      '버튼 위계',
      '미리 막힌 제출',
      b,
      '누를 수 있게 두고 눌렀을 때 오류를 알린다 (열자마자 잰 결과일 때만)',
    );
  }
  // ponytail: WCAG 2.5.8 예외 근사 — 글자 링크는 빼고, 작아도 중심 24px 안에 다른 누를 곳이 없으면 통과
  const targets = all('button, a[href], [role="button"], input:not([type="hidden"]), select');
  const center = (el) => {
    const r = el.getBoundingClientRect();
    return [r.left + r.width / 2, r.top + r.height / 2, r.width, r.height];
  };
  const centers = targets.map(center);
  targets.forEach((b, i) => {
    const [x, y, w, h] = centers[i];
    if (w >= 24 && h >= 24) return;
    if (b.matches('input:not([type="checkbox"]):not([type="radio"]), select')) return; // 입력칸은 주변으로만 센다
    if (b.matches('a') && getComputedStyle(b).display.startsWith('inline')) return;
    if (b.matches('input[type="checkbox"], input[type="radio"]') && b.closest('label')) return; // 라벨이 누르는 칸
    const crowded = centers.some(([x2, y2], j) => j !== i && Math.hypot(x - x2, y - y2) < 24);
    if (crowded) {
      add(
        '버튼 위계',
        '작은 누르는 칸',
        b,
        `${Math.round(w)}×${Math.round(h)}, 옆 누를 곳과 가까움 — 24px 이상`,
      );
    }
  });

  // 15. 입력 컨트롤
  for (const s of all('input[type="range"]')) {
    const box = s.parentElement;
    if (
      !box.querySelector('output') &&
      !/\d/.test(clean(box.innerText)) &&
      !s.getAttribute('aria-valuetext')
    ) {
      add('입력 컨트롤', '슬라이더 값 안 보임', s, '옆에 <output> 으로 지금 값');
    }
  }
  const idOf = (el) => `${el.name} ${el.id} ${el.getAttribute('autocomplete') || ''}`;
  for (const n of all('input[type="number"]')) {
    if (/tel|phone|card|cc-|zip|postal|otp|code|전화|카드|우편/i.test(idOf(n))) {
      add('입력 컨트롤', '숫자 아닌 숫자칸', n, 'type="text" inputmode="numeric"');
    }
  }
  const otpBoxes = new Set(all('input[maxlength="1"]').map((i) => i.parentElement));
  for (const box of otpBoxes) {
    const n = box.querySelectorAll(':scope > input[maxlength="1"]').length;
    if (n >= 4 && n <= 8 && !document.querySelector('[autocomplete="one-time-code"]')) {
      add(
        '입력 컨트롤',
        '칸 나눈 OTP',
        box,
        '칸 하나 autocomplete="one-time-code", 나눈 모양은 CSS 로',
      );
    }
  }
  for (const d of all('input[type="date"]')) {
    if (/bday|birth|생년|생일/i.test(idOf(d))) {
      add('입력 컨트롤', '생일 달력', d, '년·월·일 칸 직접 입력');
    }
  }
  for (const c of all('[role="combobox"]')) {
    if (
      !c.hasAttribute('aria-expanded') ||
      (c.getAttribute('aria-expanded') === 'true' &&
        !(c.hasAttribute('aria-controls') || c.hasAttribute('aria-owns') || c.list))
    ) {
      add('입력 컨트롤', '콤보박스 상태 없음', c, 'aria-expanded + aria-controls');
    }
  }

  // 16. 폼 흐름
  for (const f of all('[aria-invalid="true"]')) {
    if (!f.hasAttribute('aria-describedby') && !f.hasAttribute('aria-errormessage')) {
      add('폼 흐름', '오류 연결 없음', f, '오류 글자에 id, 칸에 aria-describedby');
    }
  }
  for (const ol of all(
    'ol[class*="step"], ul[class*="step"], ol[class*="progress"], [class*="stepper"] > ol',
  )) {
    if (ol.children.length >= 2 && !ol.querySelector('[aria-current]')) {
      add('폼 흐름', '단계 현재 표시 없음', ol, '현재 단계에 aria-current="step"');
    }
  }

  // 17. 온보딩
  const SKIP_RE = /건너뛰기|나중에|닫기|그만|skip|close|done/i;
  for (const o of all(
    '[class*="onboard"], [class*="tour"], [class*="coach"], [class*="walkthrough"]',
  )) {
    if (
      o.parentElement?.closest(
        '[class*="onboard"], [class*="tour"], [class*="coach"], [class*="walkthrough"]',
      )
    ) {
      continue;
    }
    const btns = [...o.querySelectorAll('button, a')].map((b) =>
      clean(b.innerText || b.getAttribute('aria-label')),
    );
    if (!btns.some((t) => SKIP_RE.test(t) || CLOSE.test(t))) {
      add('온보딩', '건너뛰기 없음', o, '"건너뛰기" 나 닫기 버튼');
    }
  }
  const coach = all('[class*="coach"], [popover]:popover-open').filter(
    (e) => !e.parentElement?.closest('[class*="coach"]'),
  );
  if (coach.length >= 2) {
    add('온보딩', '연속 코치마크', coach[1], `동시에 ${coach.length}개 — 한 번에 하나`);
  }

  // 18. 오류·권한
  for (const d of all('dialog, [role="dialog"], [class*="permission"]')) {
    if (!/알림|위치|카메라|마이크|사진|notification|location|camera/i.test(clean(d.innerText))) {
      continue;
    }
    const allow = [...d.querySelectorAll('button')].find((b) =>
      /^(허용|allow)/i.test(clean(b.innerText)),
    );
    if (allow) {
      add('오류·권한', '사전 화면 허용 버튼', allow, '"계속" 하나만 — 진짜 허용은 시스템 창에서');
    }
  }
  const h1 = clean(document.querySelector('h1')?.innerText);
  if (/404|찾을 수 없|not found/i.test(`${document.title} ${h1}`)) {
    const links = document.querySelectorAll('main a[href], body a[href]').length;
    if (links <= 1 && !document.querySelector('input[type="search"]')) {
      add('오류·권한', '404 막다른 길', document.body, '홈·검색·주요 링크를 둔다');
    }
  }

  // 19. 표·데이터
  for (const t of all('table:not([role="presentation"]):not([role="none"])')) {
    if (
      !t.querySelector('caption') &&
      !t.hasAttribute('aria-label') &&
      !t.hasAttribute('aria-labelledby')
    ) {
      add('표·데이터', '표 이름 없음', t, '<caption> 이나 aria-label');
    }
    if (t.querySelectorAll('th[aria-sort]:not([aria-sort="none"])').length >= 2) {
      add('표·데이터', '정렬 표시 겹침', t, '정렬된 열 하나에만 aria-sort');
    }
    const sticky = [...t.querySelectorAll('th')].find(
      (th) => getComputedStyle(th).position === 'sticky',
    );
    if (sticky && /rgba\(.*,\s*0\)|transparent/.test(getComputedStyle(sticky).backgroundColor)) {
      add('표·데이터', '고정 머리 투명', sticky, '불투명 background');
    }
  }

  // 20. 모션 이름
  const allTrans = all('body *').find((el) => {
    const s = getComputedStyle(el);
    return /\ball\b/.test(s.transitionProperty) && parseFloat(s.transitionDuration) > 0;
  });
  if (allTrans) {
    add('모션 이름', '전부 움직임', allTrans, 'transition 을 transform·opacity 로 좁히기');
  }
  const vtn = {};
  for (const el of all('body *')) {
    const v = getComputedStyle(el).viewTransitionName;
    if (v && !['none', 'auto', 'match-element'].includes(v)) (vtn[v] ||= []).push(el);
  }
  for (const [v, els] of Object.entries(vtn)) {
    if (els.length > 1) {
      add('모션 이름', '전환 이름 겹침', els[1], `view-transition-name "${v}" 이 ${els.length}개`);
    }
  }

  // 21. 이동 보조
  for (const nav of all(
    'nav[aria-label*="breadcrumb" i], nav[aria-label*="위치"], [class*="breadcrumb"]',
  )) {
    if (nav.parentElement?.closest('[class*="breadcrumb"]')) continue;
    const last = [...nav.querySelectorAll('li')].pop();
    if (last?.querySelector('a[href]') && !last.querySelector('[aria-current]')) {
      add(
        '이동 보조',
        '브레드크럼 현재 링크',
        last,
        '마지막은 링크 아닌 글자 + aria-current="page"',
      );
    }
  }
  for (const tl of all('[role="tablist"]')) {
    const tabs = [...tl.querySelectorAll('[role="tab"]')];
    const sel = tabs.filter((t) => t.getAttribute('aria-selected') === 'true').length;
    const rows = new Set(tabs.filter(visible).map((t) => t.offsetTop)).size;
    if (sel !== 1) add('이동 보조', '탭 선택 오류', tl, `선택된 탭 ${sel}개 — 정확히 1개`);
    if (rows > 1) add('이동 보조', '탭 선택 오류', tl, '탭이 두 줄 — 이름을 줄이거나 가로 스크롤');
  }
  const header = all('body *').find((el) => {
    const s = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    return (
      (s.position === 'sticky' || s.position === 'fixed') &&
      r.top <= 0 &&
      r.height > 40 &&
      r.width > window.innerWidth / 2
    );
  });
  if (header && !/scroll-padding/.test(css)) {
    add(
      '이동 보조',
      '고정 헤더 scroll-padding 없음',
      header,
      'html { scroll-padding-top: 헤더 높이 } — Tab 포커스가 가려지지 않게',
    );
  }

  // 11. 완료 피드백
  // ponytail: 색 바뀜 같은 짧은 transition 은 빼고 @keyframes·실행 중 애니메이션만 본다
  const moving = /@keyframes/.test(css) || document.getAnimations().length > 0;
  if (moving && !/prefers-reduced-motion/.test(css)) {
    add(
      '완료 피드백',
      '움직임 줄이기 없음',
      document.body,
      '@media (prefers-reduced-motion: reduce) 에서 바로 끝 상태로',
    );
  }

  const count = {};
  for (const i of issues) count[`${i.group}:${i.rule}`] = (count[`${i.group}:${i.rule}`] || 0) + 1;
  return { width: window.innerWidth, total: issues.length, count, issues: issues.slice(0, 60) };
})();
