---
description: 'opt-in 예산 임계 조회/설정 (USD 또는 토큰) — v2 보조 슬래시'
---

# /gv:cost — 예산 임계 조회/설정

opt-in 비용 임계를 조회하거나 설정합니다. 기본값은 없으며, 사용자가 명시적으로 설정한 경우만 위험 평가가 동작합니다 (PRD §8.2).

- **소요시간:** 즉시
- **결과물:** 현재 예산 설정 + 액션 안내

## 실행 흐름

### Step 1: 인자 파싱

`$ARGUMENTS`가 비어있다면 **조회 모드**, 아니면 **설정 모드**입니다.

설정 인자 예시:

- `--cost 10` → 비용 임계 $10 USD 설정
- `--tokens 100000` → 토큰 임계 100,000 설정
- `--cost 10 --tokens 100000` → 둘 다
- `--clear` → 모든 임계 해제

### Step 2: CLI 호출 (Thin Controller)

**조회**:

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/cli.js" gv-budget-get
```

**설정**:

```bash
echo '{"maxCostUsd": 10, "maxTokens": 100000}' \
  | node "${CLAUDE_PLUGIN_ROOT}/scripts/cli.js" gv-budget-set
```

**해제**:

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/cli.js" gv-budget-clear
```

### Step 3: 결과 표시

CEO에게:

1. **현재 임계** (USD / 토큰, 미설정 시 "없음")
2. **마지막 갱신 시각**
3. **임계 동작 안내**: 80% 도달 → 패널 경고, 100% 도달 → CEO 호출 (escalate)
4. (Phase B-4 머지 후) 현재 누적 비용/사용률 함께 표시 — 현재는 설정만
