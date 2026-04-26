# SDK 사용 가이드

Good Vibe Coding은 슬래시 커맨드 외에 Node.js SDK도 제공합니다.
자체 앱이나 서비스에 Good Vibe를 통합할 때 사용하세요.

---

## 설치

```bash
npm install good-vibe
```

> **요구사항:** Node.js 18 이상

---

## 설치 확인 (LLM 불필요)

인증 설정 전에도 SDK가 제대로 설치되었는지 바로 확인할 수 있습니다:

```javascript
import { GoodVibe } from 'good-vibe';

const gv = new GoodVibe();
const team = await gv.buildTeam('테스트 프로젝트');
console.log(`모드: ${team.mode}, 팀원: ${team.agents.length}명`);
// → "모드: plan-execute, 팀원: 4명"
```

`buildTeam()`과 `report()`는 로컬 계산만 하므로 LLM 인증 없이 즉시 결과를 반환합니다.

---

## LLM 프로바이더 연결 (discuss/execute 사용 시)

`discuss()`와 `execute()`는 LLM을 호출합니다. 이 메서드를 사용하려면 프로바이더 인증을 설정하세요.

### 프로바이더별 연결

```bash
# Claude (Anthropic)
echo '{"provider":"claude","apiKey":"sk-ant-..."}' | node scripts/cli.js connect

# OpenAI
echo '{"provider":"openai","apiKey":"sk-..."}' | node scripts/cli.js connect

# Gemini (CLI 모드 — Gemini CLI가 설치되어 있어야 함)
echo '{"provider":"gemini","authType":"cli"}' | node scripts/cli.js connect
```

인증 정보는 `~/.claude/good-vibe/auth.json`에 저장됩니다 (파일 권한 `0o600`).

### 연결 확인

```bash
# 특정 프로바이더 확인
node scripts/cli.js verify-provider --provider claude

# 전체 프로바이더 상태 확인
node scripts/cli.js provider-status
```

---

## 기본 사용법

```javascript
import { GoodVibe } from 'good-vibe';

const gv = new GoodVibe({ provider: 'claude' });

// 1. 팀 구성 (로컬 계산, LLM 호출 없음)
const team = await gv.buildTeam('날씨 알림 텔레그램 봇');

// 2. 토론 (LLM 호출: 팀원별 분석 → 기획서)
const discussion = await gv.discuss(team);

// 3. 실행 (LLM 호출: 태스크 → 리뷰 → 품질 게이트)
//    discuss()는 기획서(document)만 반환하므로, 팀과 태스크를 함께 전달합니다.
const result = await gv.execute({
  document: discussion.document,
  team: team.agents,
  tasks: [
    { id: 'task-1', title: 'API 서버 구현', assignee: 'backend', phase: 1 },
    { id: 'task-2', title: '테스트 작성', assignee: 'qa', phase: 2 },
  ],
});

// 4. 보고서 (로컬 포맷팅, LLM 호출 없음)
const report = gv.report(result);
console.log(report);
```

이 4단계가 v2 진입 흐름(`/gv "...만들어줘"` → plan 그래프 다층 토론 → `/gv:execute` → `/gv "보고서 확인"`)에 대응됩니다.

> **참고:** `discuss()`는 기획서 마크다운(`document`)만 반환합니다. `execute()`에는 `team`(팀원 배열)과 `tasks`(태스크 목록)를 직접 구성하여 전달해야 합니다. v2 슬래시 진입에서는 이 과정이 dispatch + plan 그래프로 자동 처리됩니다.

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
    { roleId: 'cto', role: 'CTO', emoji: '🏛️', model: 'sonnet', description: '기술 아키텍처 설계...', skills: [...], ... },
    { roleId: 'frontend', role: 'Frontend Engineer', model: 'sonnet', ... },
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
    console.log(`라운드 ${round}: 승인율 ${(convergence.approvalRate * 100).toFixed(0)}%`);
  },
  onAgentCall: (roleId, response) => {
    console.log(`${roleId} 응답 완료 (${response.tokenCount} 토큰)`);
  },
  onError: (type, err) => {
    // 중간 결과 저장 실패 시 호출 (토론 자체는 중단되지 않음)
    if (type === 'persist-failed') {
      console.warn(`중간 결과 저장 실패: ${err.message}`);
    }
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
    reason: 'threshold-met',         // 'threshold-met' | 'max-rounds' | 'stagnation'
  },
}
```

### `execute(plan, hooks?)`

기획서를 기반으로 Phase별 작업을 실행합니다. LLM을 호출합니다.

`plan`에는 기획서(`document`), 팀원 배열(`team`), 태스크 목록(`tasks`)이 필요합니다.
`discuss()`의 기획서를 활용하거나, 전체를 직접 구성할 수 있습니다:

```javascript
// 방법 1: discuss() 기획서 + 팀 + 태스크를 조합하여 전달
const discussion = await gv.discuss(team);
const result = await gv.execute({
  document: discussion.document,
  team: team.agents,
  tasks: [
    { id: 'task-1', title: 'API 구현', assignee: 'backend', phase: 1 },
    { id: 'task-2', title: '테스트 작성', assignee: 'qa', phase: 2 },
  ],
});

// 방법 2: 직접 Plan 구성 (discuss() 생략)
const manualPlan = {
  document: '# 기획서\n프로젝트 설명...',
  team: [
    { roleId: 'backend', role: 'Backend Engineer', emoji: '⚙️', priority: 4 },
    { roleId: 'qa', role: 'QA Engineer', emoji: '🧪', priority: 6 },
  ],
  tasks: [
    { id: 'task-1', title: 'API 구현', assignee: 'backend', phase: 1 },
    { id: 'task-2', title: '테스트 작성', assignee: 'qa', phase: 2 },
  ],
};
const result2 = await gv.execute(manualPlan);
```

**hooks:**

```javascript
const result = await gv.execute(plan, {
  onEscalation: (context) => {
    // 수정 2회 실패 시 호출됨. 반환값: 'continue' | 'skip' | 'abort'
    console.log(`에스컬레이션: ${context.escalation.reason}`);
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
  onReviewIntervention: (step) => {
    // 리뷰 후 CEO 개입 (Executor에서 reviewIntervention 활성 시)
    // { decision: 'proceed' } 또는 { decision: 'revise', revisionGuidance: '...' }
    return { decision: 'proceed' };
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

**status별 의미와 복구:**

| status               | 의미                                         | 복구 방법                                                                                                              |
| -------------------- | -------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `completed`          | 모든 Phase가 성공적으로 완료됨               | `gv.report(result)`로 보고서 생성                                                                                      |
| `paused`             | 에스컬레이션 대기 또는 CEO 개입 필요         | `onEscalation` Hook 확인, 같은 plan으로 `execute()` 재호출                                                             |
| `stuck`              | 동일 스텝이 3회 이상 반복됨 (무한 루프 감지) | `journal`에서 반복 스텝 확인, plan 수정 후 재실행 또는 `executeSteps()`로 수동 제어                                    |
| `max-steps-exceeded` | 최대 스텝 수(기본 200) 초과                  | plan 단순화, 또는 `Executor`를 직접 생성하여 `maxSteps` 옵션 증가 ([서브클래스 직접 사용](#서브클래스-직접-사용) 참고) |
| `not-started`        | 실행 상태가 초기화되지 않음                  | plan에 tasks/document가 포함되어 있는지 확인                                                                           |

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

> **주의:** 커스텀 스토리지 객체는 반드시 `read` 메서드를 포함해야 합니다. `read` 메서드가 없는 객체(예: `{ get, set }` 또는 `{ save, load }`)를 전달하면 에러 없이 `MemoryStorage`로 폴백되어 프로세스 종료 시 데이터가 소실됩니다. 메서드 이름은 반드시 `read`, `write`, `list`를 사용하세요.

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
`AppError` 외에 `FileStorage`는 파일시스템 OS 에러(`EACCES`, `ENOENT` 등)도 발생할 수 있습니다.

```javascript
try {
  const team = await gv.buildTeam('');
} catch (err) {
  if (err.code === 'INPUT_ERROR') {
    console.error('입력 오류:', err.message);
    // action 필드에 복구 방법이 포함되어 있습니다
    if (err.action) console.error('해결 방법:', err.action);
  } else if (err.code === 'NOT_FOUND') {
    console.error('찾을 수 없음:', err.message);
  } else if (err.code === 'SYSTEM_ERROR') {
    console.error('시스템 오류:', err.message);
  }
}
```

> **`action` 필드**: SDK의 `AppError`는 `action` 필드에 사용자가 취해야 할 다음 행동을 포함합니다. 예: `"buildTeam('프로젝트 설명')처럼 프로젝트를 설명하는 문자열을 전달하세요"`. 에러 메시지(`message`)에 원인이, `action`에 해결 방법이 담겨 있으므로 둘 다 사용자에게 표시하면 빠른 복구가 가능합니다.

### 에러 코드 요약

| 에러 코드      | 발생 조건                                  | 대처 방법                            |
| -------------- | ------------------------------------------ | ------------------------------------ |
| `INPUT_ERROR`  | 필수 파라미터 누락, 잘못된 타입            | `err.action` 확인 (복구 가이드 포함) |
| `NOT_FOUND`    | 프로젝트를 찾을 수 없음                    | ID 확인, `storage.list()` 실행       |
| `SYSTEM_ERROR` | 내부 오류, LLM 호출 실패                   | 재시도 또는 프로바이더 설정 확인     |
| OS 에러        | `FileStorage` 쓰기 권한 없음 (`EACCES`) 등 | 디렉토리 권한 확인                   |

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
  const { reason, unresolvedIssues } = context.escalation;

  // 보안 이슈는 중단
  if (unresolvedIssues.some(i => i.category === 'security')) return 'abort';

  // 빌드 실패는 재시도
  if (unresolvedIssues.some(i => i.category === 'build')) return 'continue';

  // 그 외는 건너뛰기
  return 'skip';
},
```

### LLM 내부 재시도 동작

SDK가 사용하는 LLM 프로바이더(`llm-provider.js`)는 내부적으로 재시도 로직을 갖추고 있습니다:

| 설정                   | 기본값 | 설명               |
| ---------------------- | ------ | ------------------ |
| `llm.maxRetries`       | 3      | 최대 재시도 횟수   |
| `llm.defaultTimeout`   | 60s    | LLM 호출 타임아웃  |
| `llm.pingTimeout`      | 15s    | 연결 확인 타임아웃 |
| `llm.defaultMaxTokens` | 4096   | 기본 최대 토큰     |

재시도는 네트워크 오류, 타임아웃, 일시적 서버 오류(5xx)에 대해 자동으로 수행됩니다.
인증 오류(401/403), 입력 오류(400)는 즉시 실패합니다.

SDK 사용자가 직접 재시도 로직을 작성할 필요는 없지만, 내부 재시도 모두 실패하면 `SYSTEM_ERROR`가 throw됩니다.

### Discusser `onError` Hook

`Discusser`는 토론 중간 결과를 저장(`persist`)할 때 실패해도 토론을 중단하지 않습니다.
이 실패를 감지하려면 `onError` Hook을 사용하세요:

```javascript
const discusser = new Discusser({
  provider: 'claude',
  storage,
  hooks: {
    onError: (type, err) => {
      if (type === 'persist-failed') {
        console.warn(`중간 결과 저장 실패: ${err.message}`);
        // 토론은 계속 진행됨 — 최종 결과는 반환값으로 받을 수 있음
      }
    },
    onRoundComplete: (round, convergence) => {
      console.log(`Round ${round}: ${convergence.approvalRate}%`);
    },
  },
});
```

> `onError`는 비차단(non-blocking)입니다. 토론 자체는 중단되지 않으며, 최종 결과는 `run()` 반환값으로 받을 수 있습니다. 단, `MemoryStorage` 사용 시에는 persist 실패가 발생하지 않습니다.

### 스토리지 에러 복구

| 스토리지        | 에러 상황          | 동작                                          |
| --------------- | ------------------ | --------------------------------------------- |
| `MemoryStorage` | 깊은 복사 실패     | `JSON.parse(JSON.stringify())` 폴백 자동 적용 |
| `FileStorage`   | 파일 미존재 (read) | `null` 반환 (에러 아님)                       |
| `FileStorage`   | 쓰기 권한 없음     | OS 에러 throw (`EACCES` 등)                   |
| 커스텀 스토리지 | 구현에 따라 다름   | `read`/`write`에서 throw 시 실행 중단         |

`FileStorage` 사용 시 권한 문제 해결:

```javascript
import { FileStorage } from 'good-vibe';

const storage = new FileStorage('/path/to/projects');

// 디렉토리 권한 확인
import { access, constants } from 'fs/promises';
try {
  await access('/path/to/projects', constants.W_OK);
} catch {
  console.error('프로젝트 디렉토리에 쓰기 권한이 없습니다');
}
```

### Cross-model 리뷰 에러 처리

`execute()` 옵션에 `enableCrossModel: true`를 설정하면 Gemini CLI로 교차 리뷰를 수행합니다.
Gemini CLI가 설치되지 않았거나 인증이 만료되어도 실행은 중단되지 않습니다:

- Gemini CLI 미설치/인증 만료/네트워크 오류 → `verdict: 'request-changes'` + `severity: 'important'` 이슈로 변환
- 실행은 중단되지 않지만, 품질 게이트에서 important 이슈로 집계됨
- Claude 리뷰와 함께 품질 게이트를 통과해야 함

> Cross-model 리뷰 실패는 `SYSTEM_ERROR`를 발생시키지 않습니다. 실패한 리뷰는 `request-changes` 폴백으로 변환되어 품질 게이트에 반영됩니다.

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

`AppError`는 메인 패키지에서 바로 import할 수 있습니다:

```javascript
import { AppError } from 'good-vibe';

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

| 진입 (v2)                     | SDK 메서드           | LLM 호출 |
| ----------------------------- | -------------------- | -------- |
| `/gv "...만들어줘"` (자연어)  | `gv.buildTeam(idea)` | X        |
| plan 그래프 (다층 토론, 자동) | `gv.discuss(team)`   | O        |
| `/gv "기획 승인"`             | (코드에서 직접 판단) | -        |
| `/gv:execute`                 | `gv.execute(plan)`   | O        |
| `/gv "보고서 확인"`           | `gv.report(result)`  | X        |

SDK에서는 별도의 `approve` 단계가 없습니다. `discuss()` 결과를 검토한 뒤 `execute()`를 호출하면 됩니다. SDK 실행 모드는 `auto` 고정입니다.

---

## 서브클래스 직접 사용

`Discusser`와 `Executor`를 직접 사용하면 `GoodVibe` 클래스에서 노출하지 않는 고급 옵션을 제어할 수 있습니다.

> **참고:** `GoodVibe` 클래스는 기본 옵션(`provider`, `model`, `storage`, `hooks`)만 전달합니다.
> 아래 고급 옵션이 필요하면 `Discusser`/`Executor`를 직접 생성하세요.

### Discusser 옵션

```javascript
import { Discusser, MemoryStorage } from 'good-vibe';

const discusser = new Discusser({
  provider: 'claude',
  model: 'claude-sonnet-4-6',
  storage: new MemoryStorage(),
  hooks: { onRoundComplete: (r, c) => console.log(`Round ${r}`) },

  // 고급 옵션
  parallelTiers: true, // Tier 간 병렬 실행 (기본: true). false면 Tier 순차 실행
  reviewModel: 'haiku', // 리뷰에 사용할 경량 모델 (기본: 'haiku')
});
const plan = await discusser.run(team);
```

| 옵션            | 기본값                             | 설명                                                                 |
| --------------- | ---------------------------------- | -------------------------------------------------------------------- |
| `parallelTiers` | `true` (config.discussion 기준)    | 전체 에이전트 병렬 실행. `false`면 Tier별 순차 실행 (60-75% 더 느림) |
| `reviewModel`   | `'haiku'` (config.discussion 기준) | 토론 리뷰에 사용할 경량 모델. 리뷰 LLM 호출 시간 50-70% 단축         |

**수렴 결과 (convergence.reason):**

| reason          | 의미                                                 |
| --------------- | ---------------------------------------------------- |
| `threshold-met` | 승인율 80%+ 달성                                     |
| `stagnation`    | 라운드 2+에서 개선폭 < 5%이고 블로커 0개 (조기 수렴) |
| `max-rounds`    | 최대 라운드(기본 3) 도달, 수렴 실패                  |

### Executor 옵션

```javascript
import { Executor, MemoryStorage } from 'good-vibe';

const executor = new Executor({
  provider: 'openai',
  model: 'gpt-4o',
  storage: new MemoryStorage(),
  hooks: {
    onEscalation: () => 'skip',
    onReviewIntervention: (step) => {
      // 리뷰 후 수정 지시를 주입하려면:
      return { decision: 'revise', revisionGuidance: '보안 검증 추가 필요' };
      // 그냥 진행하려면:
      // return { decision: 'proceed' };
    },
  },

  // 고급 옵션
  maxSteps: 200, // 세션당 최대 스텝 수 (무한 루프 방지)
  enableCrossModel: true, // Gemini CLI로 교차 리뷰 활성화
  providerConfig: {
    // 교차 리뷰 프로바이더 설정 (providers.json 형식)
    defaultProvider: 'claude',
    reviewStrategy: 'cross-model', // 'single' | 'cross-model'
    providers: {
      gemini: { enabled: true, model: 'gemini-2.0-flash' },
    },
  },
  messageBus: null, // 에이전트 간 메시징 (리뷰 대화, 전문가 상담)
  worktreeIsolation: false, // Phase별 git worktree 격리
  projectDir: '/path/to/project', // 프로젝트 디렉토리 (worktree용)
});
const result = await executor.run(plan);
```

| 옵션                | 기본값  | 설명                                                                   |
| ------------------- | ------- | ---------------------------------------------------------------------- |
| `maxSteps`          | `200`   | 세션당 최대 스텝 수. 초과 시 `max-steps-exceeded` 반환                 |
| `enableCrossModel`  | `false` | Gemini CLI로 교차 리뷰 수행. Gemini 미설치 시 graceful 폴백            |
| `providerConfig`    | `null`  | 교차 리뷰 설정 (`{ defaultProvider, reviewStrategy, providers }` 형식) |
| `messageBus`        | `null`  | 에이전트 간 메시징 버스 (리뷰 질문/답변, 전문가 상담)                  |
| `worktreeIsolation` | `false` | Phase별 독립 git worktree 생성/정리                                    |
| `projectDir`        | `null`  | 프로젝트 디렉토리 경로 (`worktreeIsolation` 사용 시 필수)              |

---

## 내부 모듈 사용

`good-vibe/lib/*` 경로로 개별 코어 모듈에 접근할 수 있습니다.

사용 가능한 서브경로:

| 서브경로          | 영역      | 예시 모듈                                      |
| ----------------- | --------- | ---------------------------------------------- |
| `./lib/core/*`    | 기반 유틸 | `validators.js`, `config.js`, `json-parser.js` |
| `./lib/project/*` | 프로젝트  | `project-manager.js`, `branch-manager.js`      |
| `./lib/engine/*`  | 실행 엔진 | `review-engine.js`, `task-distributor.js`      |
| `./lib/agent/*`   | 에이전트  | `team-builder.js`, `complexity-analyzer.js`    |
| `./lib/llm/*`     | LLM 연동  | `llm-provider.js`, `gemini-bridge.js`          |
| `./lib/output/*`  | 보고/환경 | `report-generator.js`, `progress-formatter.js` |

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

## TypeScript 지원

SDK는 `types/index.d.ts`에 타입 정의를 포함하고 있어, TypeScript 프로젝트에서 별도 설치 없이 자동으로 타입을 인식합니다.

### 주요 타입

```typescript
import type {
  GoodVibeOptions, // 생성자 옵션
  Team, // buildTeam() 반환값
  BuildTeamOptions, // buildTeam() 옵션
  DiscussResult, // discuss() 반환값
  DiscussHooks, // discuss() 훅
  ExecuteResult, // execute() 반환값
  ExecuteHooks, // execute() 훅
  Plan, // execute() 입력
  StorageInterface, // 커스텀 스토리지 인터페이스
  AgentMember, // 팀원 정보
  ConvergenceResult, // 수렴 결과
  AppErrorCode, // 에러 코드 ('INPUT_ERROR' | 'NOT_FOUND' | 'SYSTEM_ERROR')
} from 'good-vibe';
```

### 커스텀 스토리지 구현

`StorageInterface`를 사용하면 커스텀 스토리지를 타입 안전하게 구현할 수 있습니다:

```typescript
import { GoodVibe } from 'good-vibe';
import type { StorageInterface } from 'good-vibe';

const redisStorage: StorageInterface = {
  async read(id) {
    const data = await redis.get(`project:${id}`);
    return data ? JSON.parse(data) : null;
  },
  async write(id, data) {
    await redis.set(`project:${id}`, JSON.stringify(data));
  },
  async list() {
    const keys = await redis.keys('project:*');
    const values = await Promise.all(keys.map((k) => redis.get(k)));
    return values.filter(Boolean).map((v) => JSON.parse(v!));
  },
};

const gv = new GoodVibe({ storage: redisStorage });
```

### Hook 타입 활용

```typescript
import type { ExecuteHooks, EscalationContext } from 'good-vibe';

const hooks: ExecuteHooks = {
  onEscalation: async (context: EscalationContext) => {
    const { reason, unresolvedIssues } = context.escalation;
    if (unresolvedIssues.some((i) => i.category === 'security')) return 'abort';
    return 'skip';
  },
  onPhaseComplete: (phase, context) => {
    console.log(`Phase ${phase} 완료`);
  },
};
```

> `good-vibe/plugin` 모듈의 타입도 포함되어 있어 `createFromClaude()` 호출 시 자동 완성이 동작합니다.

---

## 자주 사용하는 패턴

### discuss → execute 연결

`discuss()`는 기획서(`document`)만 반환합니다. `execute()`에는 팀과 태스크를 함께 전달해야 합니다.
이 연결 패턴을 헬퍼로 만들면 반복을 줄일 수 있습니다:

```javascript
/**
 * discuss() 결과를 execute()에 전달할 plan으로 조합합니다.
 * @param {object} team - buildTeam() 결과
 * @param {object} discussion - discuss() 결과
 * @param {Array} tasks - 태스크 목록
 * @returns {object} execute()에 전달할 plan
 */
function buildPlan(team, discussion, tasks) {
  return {
    document: discussion.document,
    team: team.agents,
    tasks,
  };
}

// 사용 예시
const team = await gv.buildTeam('날씨 알림 봇');
const discussion = await gv.discuss(team);
const plan = buildPlan(team, discussion, [
  { id: 'task-1', title: 'API 서버 구현', assignee: 'backend', phase: 1 },
  { id: 'task-2', title: '테스트 작성', assignee: 'qa', phase: 2 },
]);
const result = await gv.execute(plan);
```

### discuss() 없이 바로 실행

간단한 프로젝트라면 토론을 생략하고 직접 plan을 구성할 수 있습니다:

```javascript
const gv = new GoodVibe({ provider: 'claude' });
const team = await gv.buildTeam('CLI 유틸리티', { complexity: 'simple' });

const result = await gv.execute({
  document: '# CLI 유틸리티\n파일 검색 CLI 도구를 만듭니다.',
  team: team.agents,
  tasks: [
    { id: 'task-1', title: 'CLI 파서 구현', assignee: 'backend', phase: 1 },
    { id: 'task-2', title: '단위 테스트', assignee: 'qa', phase: 1 },
  ],
});
```

### 진행 상황 모니터링

hooks를 사용하여 실행 진행률을 실시간으로 추적합니다:

```javascript
const result = await gv.execute(plan, {
  onPhaseComplete: (phase) => {
    console.log(`✓ Phase ${phase} 완료`);
  },
  onAgentCall: (roleId, response) => {
    console.log(`  ${roleId}: ${response.tokenCount} 토큰 사용`);
  },
  onEscalation: async (context) => {
    console.warn(`⚠ 에스컬레이션: ${context.escalation.reason}`);
    return 'skip'; // 실패한 Phase 건너뛰기
  },
});

console.log(`최종 상태: ${result.status}, ${result.journal.length}개 스텝 실행`);
```

---

## 트러블슈팅

### 에러 메시지 읽는 법

SDK 에러는 `AppError` 형식으로 `code`, `message`, `action` 필드를 포함합니다:

```
AppError [INPUT_ERROR]: idea는 비어있지 않은 문자열이어야 합니다
         ^^^^^^^^^^^^   ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
         에러 코드       에러 메시지 (원인)

err.action → "buildTeam('프로젝트 설명')처럼 프로젝트를 설명하는 문자열을 전달하세요"
              ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
              복구 가이드 (다음에 취해야 할 행동)
```

`code`로 에러 유형을 구분하고, `message`에서 원인을, `action`에서 해결 방법을 확인하세요.

### `INPUT_ERROR`: idea는 비어있지 않은 문자열이어야 합니다

`buildTeam()`에 빈 문자열, `null`, `undefined`, 또는 문자열이 아닌 값을 전달했을 때 발생합니다:

```javascript
// 에러 발생 예시
await gv.buildTeam(''); // 빈 문자열
await gv.buildTeam(); // undefined
await gv.buildTeam(123); // 문자열이 아님
await gv.buildTeam('   '); // 공백만 있는 문자열

// 올바른 사용 — 프로젝트를 설명하는 문자열 전달
const team = await gv.buildTeam('실시간 채팅 웹앱');
```

### `INPUT_ERROR`: team 객체가 필요합니다

`discuss()`에 `null`, `undefined`, 또는 객체가 아닌 값을 전달했을 때 발생합니다:

```javascript
// 에러 발생 예시
await gv.discuss(null);
await gv.discuss('프로젝트'); // 문자열이 아닌 객체가 필요

// 올바른 사용 — buildTeam() 결과를 전달
const team = await gv.buildTeam('프로젝트');
await gv.discuss(team);
```

### `INPUT_ERROR`: team.agents 배열이 비어있습니다

`discuss()`에 `buildTeam()` 결과가 아닌 다른 객체를 전달했을 때 발생합니다:

```javascript
// 에러 발생 예시
await gv.discuss({ idea: '프로젝트' }); // agents 배열 없음
await gv.discuss({ agents: [] }); // agents가 비어있음

// 올바른 사용 — buildTeam()의 반환값을 그대로 전달
const team = await gv.buildTeam('프로젝트');
await gv.discuss(team); // team.agents가 자동으로 채워져 있음
```

### `INPUT_ERROR`: plan 객체가 필요합니다

`execute()`에 `null`, `undefined`, 또는 객체가 아닌 값을 전달했을 때 발생합니다:

```javascript
// 에러 발생 예시
await gv.execute(null);
await gv.execute('plan');

// 올바른 사용 — document, team, tasks를 포함한 객체 전달
await gv.execute({
  document: discussion.document,
  team: team.agents,
  tasks: [{ id: 'task-1', title: 'API 구현', assignee: 'backend', phase: 1 }],
});
```

### `discuss()` 결과로 바로 `execute()` 호출 시 동작하지 않음

`discuss()`는 기획서(`document`)만 반환합니다. `execute()`에는 팀원과 태스크도 함께 전달해야 합니다:

```javascript
const team = await gv.buildTeam('프로젝트');
const discussion = await gv.discuss(team);

// ✗ discuss() 결과만으로는 부족 — tasks와 team이 없음
// await gv.execute(discussion);

// ✓ team과 tasks를 조합하여 전달
await gv.execute({
  document: discussion.document,
  team: team.agents,
  tasks: [{ id: 'task-1', title: 'API 구현', assignee: 'backend', phase: 1 }],
});
```

> **왜 자동으로 연결되지 않나요?** `discuss()`는 기획서 생성만 담당하고, 태스크 분배는 사용자가 직접 결정합니다. 슬래시 커맨드 플로우에서는 이 과정이 자동이지만, SDK에서는 유연성을 위해 분리되어 있습니다. [자주 사용하는 패턴](#자주-사용하는-패턴) 섹션의 `buildPlan()` 헬퍼를 참고하세요.

### `INPUT_ERROR`: report에 전달할 결과 객체가 필요합니다

`report()`에 `null`, `undefined`, 또는 객체가 아닌 값을 전달했을 때 발생합니다:

```javascript
// 에러 발생 예시
gv.report(null);
gv.report(undefined);

// 올바른 사용 — execute() 결과를 전달
const result = await gv.execute(plan);
const markdown = gv.report(result);
```

### `NOT_FOUND`: 인증 정보가 없습니다

```
NOT_FOUND: claude 인증 정보가 없습니다. 먼저 connect 명령으로 인증하세요.
```

`discuss()` 또는 `execute()` 호출 시 발생합니다. [LLM 프로바이더 연결](#llm-프로바이더-연결-discussexecute-사용-시) 섹션을 참고하여 프로바이더를 연결하세요.

> **빠른 확인:** `buildTeam()`과 `report()`는 LLM 없이 동작합니다. 먼저 이 두 메서드로 SDK 설치를 확인한 뒤, 프로바이더를 연결하세요.

### `SYSTEM_ERROR`: LLM 호출 실패

네트워크 오류나 프로바이더 서버 오류 시 발생합니다. SDK는 내부적으로 최대 3회 재시도합니다.
모든 재시도가 실패하면 `SYSTEM_ERROR`가 throw됩니다.

**확인 순서:**

1. API 키가 유효한지 확인 (만료/비활성화 여부)
2. 네트워크 연결 확인
3. 프로바이더 서비스 상태 확인 (status page)
4. `FileStorage` 사용 시 동일 호출을 재시도하면 중단 지점부터 자동 재개됩니다

### `execute()` 결과가 `stuck` 또는 `max-steps-exceeded`

| status               | 원인                           | 해결 방법                                                        |
| -------------------- | ------------------------------ | ---------------------------------------------------------------- |
| `stuck`              | 동일 스텝이 3회 반복됨         | `journal`에서 반복된 action/phase 확인 → plan 수정 후 재실행     |
| `max-steps-exceeded` | 200스텝 초과 (복잡한 프로젝트) | plan 단순화, 또는 `Executor` 직접 생성하여 `maxSteps` 증가       |
| `not-started`        | 실행 상태 미초기화             | plan에 `tasks`와 `document`가 포함되어 있는지 확인               |
| `paused`             | 에스컬레이션 대기 중           | `onEscalation` Hook이 값을 반환하는지 확인, 같은 plan으로 재호출 |

```javascript
const result = await gv.execute(plan);
if (result.status !== 'completed') {
  // journal에서 마지막 스텝을 확인하여 원인 파악
  const lastStep = result.journal.at(-1);
  console.error(`실행 중단: ${result.status}`);
  console.error(`마지막 스텝: ${lastStep?.action} (Phase ${lastStep?.phase})`);
}
```

### 커스텀 스토리지 데이터가 저장되지 않음

커스텀 스토리지 객체의 메서드 이름이 정확해야 합니다. `read` 메서드가 없으면 에러 없이 `MemoryStorage`로 폴백됩니다:

```javascript
// ✗ 메서드 이름이 다르면 MemoryStorage로 폴백 — 데이터 소실!
const gv = new GoodVibe({
  storage: {
    async get(id) {
      /* ... */
    }, // read가 아닌 get
    async save(id, data) {
      /* ... */
    }, // write가 아닌 save
    async getAll() {
      /* ... */
    }, // list가 아닌 getAll
  },
});

// ✓ 반드시 read, write, list 이름을 사용
const gv = new GoodVibe({
  storage: {
    async read(id) {
      /* ... */
    },
    async write(id, data) {
      /* ... */
    },
    async list() {
      /* ... */
    },
  },
});
```

> 현재 SDK는 `read` 메서드 존재 여부로 커스텀 스토리지를 판별합니다. `read`가 없으면 에러를 던지지 않고 `MemoryStorage`로 대체합니다. 프로세스 종료 시 모든 데이터가 소실되므로, 커스텀 스토리지 사용 시 `read` 메서드가 반드시 있는지 확인하세요.

### 어떤 메서드가 LLM을 호출하나요?

| 메서드           | LLM 호출 | 인증 필요 | 비고                           |
| ---------------- | -------- | --------- | ------------------------------ |
| `buildTeam()`    | X        | X         | 로컬 계산, 즉시 반환           |
| `discuss()`      | O        | O         | 팀원별 분석 + 리뷰 + 수렴 체크 |
| `execute()`      | O        | O         | 태스크 실행 + 리뷰 + 수정 루프 |
| `executeSteps()` | O        | O         | 스텝별 수동 제어               |
| `report()`       | X        | X         | 마크다운 포맷팅, 즉시 반환     |

---

## 빠른 참조

### 전체 플로우 요약

```
buildTeam(idea)  →  discuss(team)  →  execute(plan)  →  report(result)
  로컬 계산          LLM 호출          LLM 호출          로컬 포맷팅
  팀 구성            기획서 생성        코드 실행         보고서 생성
```

### 메서드별 입출력 요약

| 메서드      | 입력                            | 출력                                 | 다음 단계                      |
| ----------- | ------------------------------- | ------------------------------------ | ------------------------------ |
| `buildTeam` | `idea` (문자열)                 | `{ mode, agents, complexity, idea }` | `discuss(team)`에 결과 전달    |
| `discuss`   | `team` (buildTeam 결과)         | `{ document, rounds, convergence }`  | plan 조합 후 `execute()` 호출  |
| `execute`   | `{ document, team, tasks }`     | `{ status, projectId, journal }`     | `report(result)`로 보고서 생성 |
| `report`    | execute 결과 또는 프로젝트 객체 | 마크다운 문자열                      | 완료                           |

### 에러 코드 빠른 참조

| 코드           | 의미                  | 일반적인 원인                       | 해결 방법                    |
| -------------- | --------------------- | ----------------------------------- | ---------------------------- |
| `INPUT_ERROR`  | 잘못된 입력           | 빈 문자열, 누락된 필드, 잘못된 타입 | 입력값과 타입 확인           |
| `NOT_FOUND`    | 리소스를 찾을 수 없음 | 인증 미설정, 잘못된 프로젝트 ID     | 인증 연결 또는 ID 확인       |
| `SYSTEM_ERROR` | 내부/외부 오류        | LLM 호출 실패, 네트워크 오류        | 재시도, 프로바이더 설정 확인 |

---

다른 가이드:

- [퀵스타트](00-quick-start.md) — 슬래시 커맨드로 시작하기
- [커맨드 레퍼런스](03-commands-reference.md) — 전체 커맨드 목록
- [실행 모드 가이드](10-execution-modes.md) — 모드 선택 기준
