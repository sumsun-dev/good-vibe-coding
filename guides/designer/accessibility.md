# 접근성 가이드

## 웹 접근성이란?

웹 접근성은 장애가 있는 사용자를 포함한 모든 사용자가 웹 콘텐츠를 이용할 수 있도록 만드는 것입니다. WCAG 2.1 AA 기준을 따르면 대부분의 사용자에게 접근 가능한 웹사이트를 만들 수 있습니다.

---

## WCAG 2.1 실전 체크리스트

### 인식 가능 (Perceivable)

**이미지와 대체 텍스트:**

```html
<!-- 의미 있는 이미지: 설명적 alt -->
<img src="chart.png" alt="2024년 매출 추이: 1분기 1억, 4분기 3억으로 성장" />

<!-- 장식 이미지: 빈 alt -->
<img src="decoration.png" alt="" />

<!-- alt 속성 누락 -->
<img src="chart.png" />
```

**색상 대비:**

```css
/* 대비율 4.5:1 이상 */
.text {
  color: #333333;
  background: #ffffff;
} /* 대비율 12.6:1 */

/* 대비율 미달 */
.text {
  color: #999999;
  background: #ffffff;
} /* 대비율 2.8:1 */
```

### 운용 가능 (Operable)

**키보드 접근:**

```html
<!-- 키보드로 접근 가능한 버튼 -->
<button onclick="handleClick()">제출</button>

<!-- div를 버튼으로 사용 (키보드 접근 불가) -->
<div onclick="handleClick()">제출</div>

<!-- div를 버튼으로 써야 한다면 -->
<div
  role="button"
  tabindex="0"
  onclick="handleClick()"
  onkeydown="if(event.key==='Enter') handleClick()"
>
  제출
</div>
```

**포커스 관리:**

```css
/* 포커스 표시 스타일 */
:focus-visible {
  outline: 2px solid #0066cc;
  outline-offset: 2px;
}

/* 포커스 표시 제거 */
:focus {
  outline: none;
}
```

### 이해 가능 (Understandable)

**폼 레이블:**

```html
<!-- label과 input 연결 -->
<label for="email">이메일</label>
<input id="email" type="email" required />

<!-- 에러 메시지 연결 -->
<input id="email" aria-describedby="email-error" />
<p id="email-error" role="alert">올바른 이메일 형식이 아닙니다</p>
```

### 견고함 (Robust)

**ARIA 속성:**

```html
<!-- 모달 다이얼로그 -->
<div role="dialog" aria-labelledby="modal-title" aria-modal="true">
  <h2 id="modal-title">확인</h2>
  <p>정말 삭제하시겠습니까?</p>
</div>

<!-- 실시간 업데이트 영역 -->
<div aria-live="polite" aria-atomic="true">3개의 새 알림이 있습니다</div>
```

---

## accessibility-checker 에이전트 활용

### 기본 사용

```
> 이 HTML 파일의 접근성을 검사해줘
> @accessibility-checker src/components/LoginForm.jsx를 검사해줘
> CSS 색상 대비를 확인해줘
```

### 검사 결과 예시

에이전트가 다음과 같은 표 형식으로 결과를 제공합니다:

| 상태 | 항목       | 위치             | WCAG  |
| ---- | ---------- | ---------------- | ----- |
| 합격 | 제목 구조  | 전체             | 1.3.1 |
| 경고 | 색상 대비  | `.btn-secondary` | 1.4.3 |
| 실패 | ALT 텍스트 | `img.hero`       | 1.1.1 |

---

## 자주 하는 실수와 해결법

| 실수                                    | 해결                                        |
| --------------------------------------- | ------------------------------------------- |
| `outline: none`으로 포커스 제거         | `:focus-visible`로 대체                     |
| `div`/`span`을 버튼으로 사용            | `<button>` 사용 또는 role+tabindex+keyboard |
| 색상만으로 정보 전달                    | 아이콘, 텍스트, 패턴 함께 사용              |
| `alt="image"` 같은 무의미한 대체 텍스트 | 이미지의 목적/내용을 설명                   |
| 제목 레벨 건너뛰기 (h1→h3)              | 순서대로 사용 (h1→h2→h3)                    |

## 디자이너 워크플로우에서의 위치

```
[1.분석] → [2.구조설계] → [3.구현] → [4.검증] → [5.QA]
                                       ^^^여기
```

## 관련 가이드

- [디자인 시스템](./design-system.md) → 접근성을 고려한 컴포넌트 설계
