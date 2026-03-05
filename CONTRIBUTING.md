# 기여 가이드

Good Vibe Coding에 기여해주셔서 감사합니다.

## 시작하기

처음 기여한다면 `good first issue` 라벨이 붙은 이슈를 살펴보세요.

기여 방법:

1. 버그 리포트 — 재현 단계와 기대 동작을 이슈로 등록
2. 기능 제안 — 유즈케이스와 함께 이슈로 등록
3. 코드 기여 — fork 후 feature branch에서 작업, PR 제출
4. 문서 개선 — 오타, 누락된 설명, 예제 보강

## 개발 환경 설정

```bash
git clone https://github.com/sumsun-dev/good-vibe-coding.git
cd good-vibe-coding
npm install
npm test
```

- Node.js 18 이상 필수
- ESM (`"type": "module"`) 프로젝트입니다
- import 경로에 `.js` 확장자 필수 (Windows ESM 호환)

## 코드 스타일

| 대상        | 규칙                 | 예시                     |
| ----------- | -------------------- | ------------------------ |
| 파일명      | kebab-case           | `project-manager.js`     |
| 변수/함수   | camelCase            | `buildTeam`, `maxRounds` |
| 클래스/타입 | PascalCase           | `AppError`, `GoodVibe`   |
| 상수        | SCREAMING_SNAKE_CASE | `MAX_FIX_ATTEMPTS`       |

- 함수: 최대 50줄, early return 우선 (중첩 최대 4단계)
- 파일: 최대 800줄, 초과 시 분리
- `console.log`는 커밋 전 제거
- 매직 넘버 금지 -- 상수 또는 환경 변수로 추출

## 에러 처리

`validators.js`의 에러 팩토리를 사용합니다. 직접 `throw new Error()`를 사용하지 마세요.

```javascript
import { inputError, notFoundError } from '../lib/core/validators.js';

// Good
throw inputError('필수 필드 누락');
throw notFoundError('프로젝트 없음');

// Bad
throw new Error('필수 필드 누락');
```

## 테스트

TDD 방식으로 진행합니다: RED -> GREEN -> REFACTOR

```bash
npm test              # 전체 테스트 (Vitest)
npm run test:watch    # 감시 모드
npm run test:coverage # 커버리지 리포트
```

- 커버리지 목표: 80% 이상, 핵심 로직은 100%
- AAA 패턴: Arrange, Act, Assert
- 테스트 간 의존성 금지, 실제 API 호출 금지 (mock 사용)
- 코어 모듈: `tests/{module-name}.test.js`
- 핸들러: `tests/handlers/{handler-name}.test.js`

## 브랜치 전략

| 브랜치        | 용도                  |
| ------------- | --------------------- |
| `main`        | 배포 가능한 안정 버전 |
| `develop`     | 개발 통합 브랜치      |
| `feature/xxx` | 새 기능 개발          |
| `fix/xxx`     | 버그 수정             |

## 커밋 컨벤션

[Conventional Commits](https://www.conventionalcommits.org/) 형식을 따릅니다.

```
feat(engine): 실행 루프에 재개 기능 추가
fix(review): 리뷰어 선정 시 도메인 매칭 오류 수정
refactor(core): validators 모듈 분리
docs(readme): 설치 가이드 업데이트
test(handler): execution 핸들러 E2E 테스트 추가
chore(ci): Node 22 매트릭스 추가
```

타입: `feat` | `fix` | `refactor` | `docs` | `test` | `chore`

## PR 프로세스

1. `feature/xxx` 또는 `fix/xxx` 브랜치 생성
2. 변경 사항 구현 + 테스트 작성
3. `npm test`, lint, typecheck 통과 확인
4. PR 생성 (PR 템플릿 작성)
5. CI 통과 + 코드 리뷰 후 merge

### PR 체크리스트

- [ ] import에 `.js` 확장자 포함
- [ ] `requireFields`로 필수 입력 검증
- [ ] 에러 시 `inputError` / `notFoundError` 사용
- [ ] 테스트 추가 또는 수정
- [ ] `npm test` 통과

## 새 커맨드 추가 시

1. `commands/new-command.md` 작성
2. `scripts/lib/{category}/new-module.js` 코어 로직 구현
3. `scripts/handlers/{handler}.js`에 커맨드 등록
4. `scripts/cli.js`의 `COMMAND_MAP`에 추가
5. 테스트 작성 (unit + E2E)

자세한 개발 워크플로우는 [CLAUDE.md](CLAUDE.md)의 "개발 워크플로우" 섹션을 참고하세요.
