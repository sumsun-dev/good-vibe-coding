# 디자인 시스템 가이드

## 디자인 시스템이란?

디자인 시스템은 일관된 UI를 만들기 위한 규칙, 컴포넌트, 토큰의 집합입니다. Claude Code를 활용하면 CSS 변수 관리, 컴포넌트 구조화, 토큰 정의를 체계적으로 할 수 있습니다.

---

## CSS 변수 (커스텀 프로퍼티)

### 디자인 토큰 정의

디자인 토큰은 색상, 크기, 간격 등의 디자인 결정값입니다. CSS 변수로 정의하면 일관성을 유지하고 테마 변경이 쉬워집니다.

```css
:root {
  /* 색상 토큰 */
  --color-primary: #0066cc;
  --color-primary-hover: #0052a3;
  --color-secondary: #6b7280;
  --color-success: #22c55e;
  --color-warning: #f59e0b;
  --color-error: #ef4444;

  /* 배경 */
  --bg-primary: #ffffff;
  --bg-secondary: #f9fafb;
  --bg-tertiary: #f3f4f6;

  /* 텍스트 */
  --text-primary: #111827;
  --text-secondary: #6b7280;
  --text-disabled: #9ca3af;

  /* 간격 */
  --spacing-xs: 0.25rem;   /* 4px */
  --spacing-sm: 0.5rem;    /* 8px */
  --spacing-md: 1rem;      /* 16px */
  --spacing-lg: 1.5rem;    /* 24px */
  --spacing-xl: 2rem;      /* 32px */

  /* 폰트 */
  --font-size-sm: 0.875rem;  /* 14px */
  --font-size-md: 1rem;      /* 16px */
  --font-size-lg: 1.25rem;   /* 20px */
  --font-size-xl: 1.5rem;    /* 24px */

  /* 둥근 모서리 */
  --radius-sm: 0.25rem;
  --radius-md: 0.5rem;
  --radius-lg: 1rem;
  --radius-full: 9999px;

  /* 그림자 */
  --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.05);
  --shadow-md: 0 4px 6px rgba(0, 0, 0, 0.1);
  --shadow-lg: 0 10px 15px rgba(0, 0, 0, 0.1);
}
```

### 다크 모드 지원

```css
@media (prefers-color-scheme: dark) {
  :root {
    --bg-primary: #111827;
    --bg-secondary: #1f2937;
    --text-primary: #f9fafb;
    --text-secondary: #9ca3af;
    --color-primary: #60a5fa;
  }
}
```

---

## 컴포넌트 구조화

### 버튼 컴포넌트

```css
.btn {
  display: inline-flex;
  align-items: center;
  gap: var(--spacing-xs);
  padding: var(--spacing-sm) var(--spacing-md);
  font-size: var(--font-size-md);
  border-radius: var(--radius-md);
  border: none;
  cursor: pointer;
  transition: background-color 0.2s;
}

.btn--primary {
  background: var(--color-primary);
  color: white;
}

.btn--primary:hover {
  background: var(--color-primary-hover);
}

.btn--secondary {
  background: transparent;
  color: var(--color-primary);
  border: 1px solid var(--color-primary);
}

.btn--sm { padding: var(--spacing-xs) var(--spacing-sm); font-size: var(--font-size-sm); }
.btn--lg { padding: var(--spacing-md) var(--spacing-lg); font-size: var(--font-size-lg); }
```

### 카드 컴포넌트

```css
.card {
  background: var(--bg-primary);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-md);
  padding: var(--spacing-lg);
}

.card__title {
  font-size: var(--font-size-lg);
  color: var(--text-primary);
  margin-bottom: var(--spacing-sm);
}

.card__body {
  color: var(--text-secondary);
  font-size: var(--font-size-md);
}
```

---

## Claude Code 활용법

### 디자인 토큰 관리
```
> 이 CSS에서 하드코딩된 색상값을 CSS 변수로 변환해줘
> 디자인 토큰 파일을 만들어줘
> 다크 모드 토큰을 추가해줘
```

### 컴포넌트 생성
```
> BEM 네이밍으로 Alert 컴포넌트를 만들어줘
> 이 컴포넌트에 반응형 스타일을 추가해줘
> 디자인 토큰을 사용하도록 리팩토링해줘
```

### css_format 훅 활용
`css_format` 훅이 활성화되어 있으면, CSS 파일 편집 시 하드코딩된 색상값을 자동으로 감지합니다:
```
🎨 하드코딩된 색상값이 있습니다. CSS 변수 사용을 권장합니다.
```

---

## 반응형 브레이크포인트

```css
/* 모바일 퍼스트 */
.container { padding: var(--spacing-md); }

/* 태블릿 */
@media (min-width: 768px) {
  .container { padding: var(--spacing-lg); max-width: 720px; }
}

/* 데스크톱 */
@media (min-width: 1024px) {
  .container { padding: var(--spacing-xl); max-width: 960px; }
}
```

## 디자이너 워크플로우에서의 위치
```
[1.분석] → [2.구조설계] → [3.구현] → [4.검증] → [5.QA]
              ^^^여기
```

## 관련 가이드
- [접근성 가이드](./accessibility.md) → 접근성을 고려한 컴포넌트 설계
