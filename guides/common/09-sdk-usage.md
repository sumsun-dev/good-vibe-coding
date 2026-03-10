# SDK 사용 가이드

Good Vibe Coding은 슬래시 커맨드 외에 Node.js SDK도 제공합니다.
자체 앱이나 서비스에 Good Vibe를 통합할 때 사용하세요.

---

## 설치

```bash
npm install good-vibe
```

---

## 기본 사용법

```javascript
import { GoodVibe } from 'good-vibe';

const gv = new GoodVibe({ provider: 'claude' });

// 1. 팀 구성 (로컬 계산, LLM 호출 없음)
const team = await gv.buildTeam('날씨 알림 텔레그램 봇');

// 2. 토론 (LLM 호출: 팀원별 분석 → 기획서)
const plan = await gv.discuss(team);

// 3. 실행 (LLM 호출: 태스크 → 리뷰 → 품질 게이트)
const result = await gv.execute(plan);

// 4. 보고서 (로컬 포맷팅, LLM 호출 없음)
const report = gv.report(result);
console.log(report);
```

이 4단계가 슬래시 커맨드 `new` → `discuss` → `execute` → `report`에 대응됩니다.

---

## 생성자 옵션

```javascript
const gv = new GoodVibe({
  provider: 'claude', // 'claude' | 'openai' | 'gemini'
  model: 'claude-sonnet-4-6', // 프로바이더별 기본 모델 사용 시 생략 가능
  storage: 'memory', // 'memory' | 파일 경로 | 커스텀 스토리지 객체
});
```

| 옵션       | 기본값              | 설명                                              |
| ---------- | ------------------- | ------------------------------------------------- |
| `provider` | `'claude'`          | LLM 프로바이더                                    |
| `model`    | 프로바이더별 기본값 | `claude-sonnet-4-6`, `gpt-4o`, `gemini-2.0-flash` |
| `storage`  | `'memory'`          | 프로젝트 데이터 저장 방식                         |

---

## 메서드 레퍼런스

### `buildTeam(idea, options?)`

프로젝트 아이디어를 분석하여 팀을 구성합니다. LLM을 호출하지 않습니다.

```javascript
const team = await gv.buildTeam('실시간 채팅 웹앱', {
  projectType: 'web-app', // 선택: 'web-app', 'api', 'bot', 'cli', 'custom'
  complexity: 'medium', // 선택: 'simple', 'medium', 'complex'
  personalityChoices: {}, // 선택: 에이전트별 성격 오버라이드
});
```

**반환값:**

```javascript
{
  mode: 'plan-execute',          // 추천 모드
  agents: [                      // 팀원 배열
    { roleId: 'cto', role: 'CTO', emoji: '...', priority: 1 },
    { roleId: 'frontend', role: 'Frontend Engineer', ... },
    // ...
  ],
  optional: ['tech-writer'],     // 선택적 역할
  complexity: { level: 'medium', discussionRounds: 1, ... },
  idea: '실시간 채팅 웹앱',
  type: 'web-app',
}
```

### `discuss(team, hooks?)`

팀원들이 역할별로 분석하고 기획서를 작성합니다. LLM을 호출합니다.

```javascript
const plan = await gv.discuss(team, {
  onRoundComplete: (round, convergence) => {
    console.log(`라운드 ${round}: 승인율 ${convergence.approvalRate}%`);
  },
  onAgentCall: (roleId, response) => {
    console.log(`${roleId} 응답 완료 (${response.tokenCount} 토큰)`);
  },
});
```

**반환값:**

```javascript
{
  document: '# 기획서\n...',        // 마크다운 기획서
  rounds: 2,                        // 실제 토론 라운드 수
  convergence: {
    converged: true,
    approvalRate: 0.85,
    reason: 'threshold-met',         // 'threshold-met' | 'max-rounds'
  },
}
```

### `execute(plan, hooks?)`

기획서를 기반으로 Phase별 작업을 실행합니다. LLM을 호출합니다.

```javascript
const result = await gv.execute(plan, {
  onEscalation: (context) => {
    // 수정 2회 실패 시 호출됨. 반환값: 'continue' | 'skip' | 'abort'
    console.log(`에스컬레이션: ${context.reason}`);
    return 'skip';
  },
  onPhaseComplete: (phase, context) => {
    console.log(`Phase ${phase} 완료`);
  },
  onAgentCall: (roleId, response) => {
    // 태스크 실행/리뷰 등 모든 LLM 호출 후 실행
  },
  onCommit: (step) => {
    // Phase 커밋 시점
  },
  onConfirmPhase: (step) => {
    // interactive 모드에서 다음 Phase 진행 확인
    // false 반환 시 중단, { phaseGuidance: '...' } 반환 시 지침 주입
    return true;
  },
});
```

**반환값:**

```javascript
{
  status: 'completed',    // 'completed' | 'paused' | 'stuck' | 'max-steps-exceeded'
  projectId: 'sdk-1709...',
  journal: [              // 실행 이력
    { action: 'execute-tasks', phase: 1, result: { ... } },
    { action: 'review', phase: 1, result: { ... } },
    // ...
  ],
}
```

### `executeSteps(plan)`

수동 모드로 한 스텝씩 실행합니다. 각 스텝에서 진행/중단을 직접 결정할 수 있습니다.

```javascript
for await (const step of gv.executeSteps(plan)) {
  console.log(`다음 액션: ${step.action} (Phase ${step.phase})`);

  if (step.action === 'escalate') {
    await step.decide('skip'); // 'continue' | 'skip' | 'abort'
  } else {
    await step.proceed(); // 다음 스텝으로 진행
  }
}
```

### `report(result)`

실행 결과를 마크다운 보고서로 포맷합니다. LLM을 호출하지 않습니다.

```javascript
const markdown = gv.report(result);
// 또는 프로젝트 객체를 직접 전달
const markdown2 = gv.report({ name: 'My Project', status: 'completed', ... });
```

---

## 스토리지

### MemoryStorage (기본값)

프로세스 메모리에 저장합니다. 프로세스 종료 시 사라집니다. 테스트/프로토타이핑에 적합합니다.

```javascript
const gv = new GoodVibe(); // storage: 'memory' 기본값
```

### FileStorage

파일시스템에 저장합니다. `{baseDir}/{projectId}/project.json` 경로를 사용합니다.

```javascript
const gv = new GoodVibe({ storage: '/path/to/projects' });
```

### 커스텀 스토리지

`read`, `write`, `list` 메서드를 구현한 객체를 전달합니다.

```javascript
const gv = new GoodVibe({
  storage: {
    async read(id) {
      /* 프로젝트 JSON 반환, 없으면 null */
    },
    async write(id, data) {
      /* 프로젝트 JSON 저장 */
    },
    async list() {
      /* 전체 프로젝트 배열 반환 */
    },
  },
});
```

DB 연동 예시:

```javascript
const dbStorage = {
  async read(id) {
    const row = await db.query('SELECT data FROM projects WHERE id = ?', [id]);
    return row ? JSON.parse(row.data) : null;
  },
  async write(id, data) {
    await db.query(
      'INSERT INTO projects (id, data) VALUES (?, ?) ON CONFLICT (id) DO UPDATE SET data = ?',
      [id, JSON.stringify(data), JSON.stringify(data)],
    );
  },
  async list() {
    const rows = await db.query('SELECT data FROM projects');
    return rows.map((r) => JSON.parse(r.data));
  },
};
```

---

## 에러 처리

SDK 메서드는 `AppError`를 던집니다. `code` 필드로 에러 유형을 구분할 수 있습니다.

```javascript
try {
  const team = await gv.buildTeam('');
} catch (err) {
  if (err.code === 'INPUT_ERROR') {
    console.error('입력 오류:', err.message);
  } else if (err.code === 'NOT_FOUND') {
    console.error('찾을 수 없음:', err.message);
  } else if (err.code === 'SYSTEM_ERROR') {
    console.error('시스템 오류:', err.message);
  }
}
```

### 에러 코드 요약

| 에러 코드      | 발생 조건                       | 대처 방법                        |
| -------------- | ------------------------------- | -------------------------------- |
| `INPUT_ERROR`  | 필수 파라미터 누락, 잘못된 타입 | 입력값 확인                      |
| `NOT_FOUND`    | 프로젝트를 찾을 수 없음         | ID 확인, `storage.list()` 실행   |
| `SYSTEM_ERROR` | 내부 오류, LLM 호출 실패        | 재시도 또는 프로바이더 설정 확인 |

### 메서드별 에러 시나리오

| 메서드           | 에러 코드      | 발생 상황                                    | 복구 방법                              |
| ---------------- | -------------- | -------------------------------------------- | -------------------------------------- |
| `buildTeam()`    | `INPUT_ERROR`  | `idea`가 빈 문자열 또는 미전달               | 프로젝트 설명 문자열 전달              |
| `discuss()`      | `SYSTEM_ERROR` | LLM 호출 타임아웃, 네트워크 오류             | 재시도 — 중간 결과는 storage에 보존됨  |
| `discuss()`      | `INPUT_ERROR`  | team 객체 형식 오류 (agents 누락 등)         | `buildTeam()` 반환값을 그대로 전달     |
| `execute()`      | `SYSTEM_ERROR` | LLM 호출 실패, Phase 실행 오류               | 재시도 — 중단된 Phase부터 자동 재개    |
| `execute()`      | `INPUT_ERROR`  | plan 객체 형식 오류 (document/tasks 누락 등) | `discuss()` 반환값을 그대로 전달       |
| `executeSteps()` | `SYSTEM_ERROR` | 개별 스텝 실행 실패                          | `step.proceed()` 재호출 또는 다음 스텝 |
| `report()`       | `INPUT_ERROR`  | result 객체가 null/undefined                 | `execute()` 반환값을 그대로 전달       |

### Hook 에러 처리

Hook 함수에서 에러가 발생하면 실행이 중단됩니다. 안전한 패턴:

```javascript
const result = await gv.execute(plan, {
  onEscalation: async (context) => {
    try {
      // 외부 시스템 알림 등
      await notifyTeam(context);
      return 'continue';
    } catch {
      // Hook 실패 시 안전한 기본값 반환
      return 'skip';
    }
  },
  onPhaseComplete: (phase) => {
    // 로깅 실패가 실행을 중단하지 않도록
    try {
      logger.info(`Phase ${phase} 완료`);
    } catch {
      /* 무시 */
    }
  },
});
```

### 에스컬레이션 결정 가이드

`onEscalation` Hook에서 반환할 값을 선택하는 기준:

| 결정       | 의미                        | 적합한 상황                              |
| ---------- | --------------------------- | ---------------------------------------- |
| `continue` | 수정 재시도 (CEO 지침 가능) | 핵심 기능이라 반드시 성공해야 할 때      |
| `skip`     | 해당 Phase를 건너뛰고 계속  | 부가 기능이라 나중에 수동 추가 가능할 때 |
| `abort`    | 실행 전체 중단              | 기획 자체를 재검토해야 할 때             |

```javascript
onEscalation: async (context) => {
  const { phase, failureContext } = context;
  const { attempt, issues } = failureContext;

  // 보안 이슈는 중단
  if (issues.some(i => i.category === 'security')) return 'abort';

  // 빌드 실패는 재시도
  if (issues.some(i => i.category === 'build')) return 'continue';

  // 2회째 실패면 건너뛰기
  if (attempt >= 2) return 'skip';

  return 'continue';
},
```

### 실행 실패 복구 패턴

LLM 호출 실패 시 재시도하는 패턴:

```javascript
async function executeWithRetry(gv, plan, maxRetries = 2) {
  for (let i = 0; i <= maxRetries; i++) {
    try {
      return await gv.execute(plan, hooks);
    } catch (err) {
      if (err.code !== 'SYSTEM_ERROR' || i === maxRetries) throw err;
      console.log(`실행 실패, ${i + 1}/${maxRetries} 재시도...`);
      // FileStorage 사용 시 중단 지점부터 자동 재개됨
    }
  }
}
```

`executeSteps()`로 스텝별 복구:

```javascript
for await (const step of gv.executeSteps(plan)) {
  try {
    if (step.action === 'escalate') {
      await step.decide('skip');
    } else {
      await step.proceed();
    }
  } catch (err) {
    if (err.code === 'SYSTEM_ERROR') {
      // 상태 전이 중 오류 — 계속 진행하면 데이터 손상 위험
      console.error(`치명적 오류, 실행 중단: ${err.message}`);
      break;
    }
    // INPUT_ERROR, NOT_FOUND 등은 해당 스텝만 실패
    console.error(`스텝 실패: ${step.action} (Phase ${step.phase})`);
  }
}
```

> **주의:** `SYSTEM_ERROR`는 내부 상태가 불완전하게 변경되었을 수 있으므로 루프를 중단하세요. `FileStorage` 사용 시 다음 `execute()` 호출에서 자동 재개됩니다.

### AppError 타입 확인

`AppError`는 내부 모듈에서 import할 수 있습니다:

```javascript
import { AppError } from 'good-vibe/lib/core/validators.js';

try {
  await gv.execute(plan);
} catch (err) {
  if (err instanceof AppError) {
    // code: 'INPUT_ERROR' | 'NOT_FOUND' | 'SYSTEM_ERROR'
    handleAppError(err.code, err.message);
  } else {
    // 예상치 못한 에러
    throw err;
  }
}
```

> `err.code` 필드 확인만으로도 충분합니다. `instanceof` 체크는 선택사항입니다.

---

## 슬래시 커맨드와 SDK 비교

| 슬래시 커맨드       | SDK 메서드           | LLM 호출 |
| ------------------- | -------------------- | -------- |
| `good-vibe:new`     | `gv.buildTeam(idea)` | X        |
| `good-vibe:discuss` | `gv.discuss(team)`   | O        |
| `good-vibe:approve` | (코드에서 직접 판단) | -        |
| `good-vibe:execute` | `gv.execute(plan)`   | O        |
| `good-vibe:report`  | `gv.report(result)`  | X        |

SDK에서는 `approve` 단계가 별도로 없습니다. `discuss()` 결과를 검토한 뒤 `execute()`를 호출하면 됩니다.

---

## 서브클래스 직접 사용

`Discusser`와 `Executor`를 직접 사용할 수도 있습니다.

```javascript
import { Discusser, Executor, MemoryStorage } from 'good-vibe';

const storage = new MemoryStorage();

// 토론만 실행
const discusser = new Discusser({
  provider: 'claude',
  model: 'claude-sonnet-4-6',
  storage,
  hooks: { onRoundComplete: (r, c) => console.log(`Round ${r}`) },
});
const plan = await discusser.run(team);

// 실행만 실행
const executor = new Executor({
  provider: 'openai',
  model: 'gpt-4o',
  storage,
  hooks: { onEscalation: () => 'skip' },
});
const result = await executor.run(plan);
```

---

## 내부 모듈 사용

`good-vibe/lib/*` 경로로 개별 코어 모듈에 접근할 수 있습니다.

```javascript
// 팀 빌더 직접 사용
import { buildTeam } from 'good-vibe/lib/agent/team-builder.js';

// LLM 프로바이더 직접 호출
import { callLLM } from 'good-vibe/lib/llm/llm-provider.js';

// 복잡도 분석
import { getDefaultsForComplexity } from 'good-vibe/lib/agent/complexity-analyzer.js';
```

> 내부 모듈의 API는 버전 간 변경될 수 있습니다. 안정적인 사용을 원하면 `GoodVibe` 클래스를 사용하세요.

---

## Claude Code 플러그인 어댑터

Claude Code 환경에서 SDK를 사용할 때는 플러그인 어댑터를 사용하세요.

```javascript
import { createFromClaude } from 'good-vibe/plugin';

// ~/.claude/good-vibe 경로로 자동 설정된 GoodVibe 인스턴스
const gv = createFromClaude();
```

---

다른 가이드:

- [퀵스타트](00-quick-start.md) — 슬래시 커맨드로 시작하기
- [커맨드 레퍼런스](03-commands-reference.md) — 전체 커맨드 목록
- [실행 모드 가이드](10-execution-modes.md) — 모드 선택 기준
