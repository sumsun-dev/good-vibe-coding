# TDD 워크플로우 실전 가이드

## TDD란?

TDD(Test-Driven Development)는 테스트를 먼저 작성하고, 그 테스트를 통과시키는 코드를 구현하는 개발 방법론입니다.

```
RED → GREEN → REFACTOR
실패하는    통과시키는    코드를
테스트 작성  코드 구현     정리
```

## RED-GREEN-REFACTOR 실전

### 1단계: RED (실패하는 테스트 작성)

**핵심 원칙**: 아직 존재하지 않는 기능의 테스트를 먼저 작성합니다.

```javascript
// tests/calculator.test.js
import { describe, it, expect } from 'vitest';
import { add } from '../src/calculator.js';

describe('add', () => {
  it('두 숫자를 더한다', () => {
    expect(add(2, 3)).toBe(5);
  });

  it('음수를 더할 수 있다', () => {
    expect(add(-1, 1)).toBe(0);
  });

  it('0을 더하면 원래 숫자를 반환한다', () => {
    expect(add(5, 0)).toBe(5);
  });
});
```

이 시점에서 테스트를 실행하면 실패합니다 (파일이 없으니까):
```bash
npm test  # FAIL
```

### 2단계: GREEN (최소한의 코드로 통과)

**핵심 원칙**: 테스트를 통과시키는 가장 간단한 코드를 작성합니다.

```javascript
// src/calculator.js
export function add(a, b) {
  return a + b;
}
```

```bash
npm test  # PASS
```

### 3단계: REFACTOR (코드 정리)

**핵심 원칙**: 테스트가 통과하는 상태를 유지하면서 코드를 개선합니다.

- 중복 제거
- 네이밍 개선
- 함수 분리
- 타입 추가

---

## AAA 패턴

모든 테스트는 AAA(Arrange-Act-Assert) 패턴을 따릅니다:

```javascript
it('사용자를 생성한다', async () => {
  // Arrange (준비)
  const userData = { name: '홍길동', email: 'hong@test.com' };

  // Act (실행)
  const user = await createUser(userData);

  // Assert (검증)
  expect(user.name).toBe('홍길동');
  expect(user.id).toBeDefined();
});
```

### 좋은 테스트의 특징
- **독립적**: 다른 테스트에 의존하지 않음
- **반복 가능**: 몇 번을 실행해도 같은 결과
- **빠름**: 외부 API 호출 없이 실행 (mock 사용)
- **명확**: 테스트 이름만 읽어도 무엇을 검증하는지 알 수 있음

---

## Vitest 실전 예시

### 기본 테스트
```javascript
import { describe, it, expect } from 'vitest';

describe('formatDate', () => {
  it('날짜를 YYYY-MM-DD 형식으로 변환한다', () => {
    const date = new Date('2024-03-15');
    expect(formatDate(date)).toBe('2024-03-15');
  });
});
```

### Mock 사용
```javascript
import { describe, it, expect, vi } from 'vitest';

describe('fetchUser', () => {
  it('API에서 사용자를 조회한다', async () => {
    // Mock 설정
    const mockFetch = vi.fn().mockResolvedValue({
      json: () => Promise.resolve({ id: 1, name: '홍길동' }),
    });
    global.fetch = mockFetch;

    // 실행
    const user = await fetchUser(1);

    // 검증
    expect(mockFetch).toHaveBeenCalledWith('/api/users/1');
    expect(user.name).toBe('홍길동');
  });
});
```

### beforeEach/afterEach
```javascript
describe('UserService', () => {
  let db;

  beforeEach(() => {
    db = createTestDB();  // 매 테스트 전 초기화
  });

  afterEach(() => {
    db.cleanup();  // 매 테스트 후 정리
  });

  it('사용자를 저장한다', async () => {
    await db.save({ name: '홍길동' });
    expect(await db.count()).toBe(1);
  });
});
```

---

## Claude Code에서 TDD 활용

### tdd-coach-kr 에이전트 활용
```
> @tdd-coach-kr 로그인 기능을 TDD로 구현하고 싶어
```

에이전트가 다음을 안내합니다:
1. 먼저 작성할 테스트 케이스 제안
2. RED 상태 확인
3. GREEN을 위한 최소 구현 가이드
4. REFACTOR 포인트 제시

### 개발자 워크플로우에서의 위치
```
[1.기획] → [2.Side Impact] → [3.TDD] → [4.구현] → [5.검증] → [6.리뷰]
                                ^^^여기
```

TDD는 워크플로우의 3단계에서 수행됩니다. Side Impact 분석이 끝난 후, 테스트를 먼저 작성합니다.

## 관련 가이드
- [코드 리뷰](./code-review.md) → TDD 이후 리뷰 단계
