---
description: '에이전트 자가발전 학습 이력 + revert (v2 보조 슬래시)'
---

# /gv:agent-history — 에이전트 학습 이력 조회 + 되돌리기

특정 역할(CTO, QA 등)의 자가발전 학습 이력(provenance)과 활성 candidate 상태를 조회합니다. 잘못된 학습이 발견되면 entryId 단위로 revert하거나, 평가 중인 candidate를 폐기할 수 있습니다.

- **소요시간:** 즉시 (조회만 할 때) / 1초 (revert/discard)
- **결과물:** 마크다운 학습 이력 + 활성 candidate 진행률 + revert 가이드

## 사용 예시

```
/gv:agent-history --role=cto                    # 조회
/gv:agent-history --role=cto --revert=ent-abc123 # 특정 학습 되돌리기
/gv:agent-history --role=cto --discard-candidate # 평가 중인 candidate 폐기
/gv:agent-history --role=cto --reset             # provenance 전체 삭제 (위험)
```

## 실행 흐름

### Step 1: 인자 파싱

CEO가 입력한 옵션에서 `--role`(필수), `--revert`, `--discard-candidate`, `--reset` 추출.

### Step 2: 분기별 CLI 호출 (단순 조회/명령 1회)

#### 조회만 (옵션 없음)

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/cli.js" get-provenance --role={roleId}
```

응답: `{ provenance: { roleId, revision, lastUpdated, entries[] }, candidateState: { exists, projectCount, projectIds, entryCount } }`

이어서 마크다운 변환:

```bash
echo '<응답>' | node "${CLAUDE_PLUGIN_ROOT}/scripts/cli.js" format-provenance
```

#### `--revert={entryId}`

CEO 확인 (`AskUserQuestion`):

> 학습 ent-abc123을 되돌립니다. 진행할까요?
> (active override.md는 변경되지 않습니다 — provenance 메타만 정리됩니다)

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/cli.js" revert-provenance-entry \
  --role={roleId} --entry-id={entryId}
```

응답: `{ roleId, entryId, removed: bool, remaining: number }`

#### `--discard-candidate`

CEO 확인:

> 활성 candidate를 폐기합니다 (지금까지 누적된 평가 데이터 손실). 진행할까요?

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/cli.js" discard-shadow-candidate --role={roleId}
```

응답: `{ roleId, discarded: bool }`

#### `--reset`

**위험 명령** — CEO 명시 확인 필수:

> provenance 전체를 삭제합니다. 학습 추적성이 사라집니다. 진행할까요?
> (active override.md는 보존됩니다)

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/cli.js" reset-provenance --role={roleId}
```

응답: `{ roleId, deleted: bool }`

### Step 3: 결과 표시

조회 결과는 `format-provenance`의 마크다운을 그대로 출력. revert/discard/reset은 1줄 요약 + 다음 권장 액션:

- revert 후 → "다음 학습 결정은 다음 프로젝트 완료 시 자동 평가됩니다"
- discard 후 → "필요 시 자가발전이 새 학습안을 자동 제안할 때까지 기다리세요"

추가 작업/판단/LLM 호출 금지. 단순 CLI 결과를 그대로 가공 없이 표시.

## 보안/안전 메모

- 모든 revert/discard/reset은 CEO 명시 확인 후 실행 (`AskUserQuestion`)
- active override.md는 어떤 명령으로도 자동 삭제되지 않음 — 사람이 직접 편집/삭제 필요
- provenance 손실은 추적성 손실이지 학습 결과 자체 손실이 아님
- candidate 폐기는 누적된 평가 데이터 손실 (다시 시작) — 신중하게
