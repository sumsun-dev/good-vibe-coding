---
name: multi-review
description: '멀티 AI 리뷰 설정 및 결과 검증'
---

# Multi Review — 멀티 AI 리뷰

## 트리거

- `execute.md` Step 1.2.5에서 호출
- 사용자가 직접 `/multi-review` 실행

## 플로우

### 셋업 (1회만)

#### 1단계: 현재 상태 확인

Task tool로 providers 상태 조회:

```
node ${CLAUDE_PLUGIN_ROOT}/scripts/cli.js providers
반환: reviewStrategy, gemini 상태, meta
CLAUDE_PLUGIN_ROOT: {CLAUDE_PLUGIN_ROOT}
```

**판정:**

- `reviewStrategy === 'cross-model'` → "이미 활성화" 표시, 셋업 종료
- gemini `cliInstalled: false` → "Gemini CLI 미설치. `npm install -g @google/gemini-cli`로 설치하세요" 안내, 셋업 종료
- gemini `cliInstalled: true` + `meta.geminiOffered` 없음 → 2단계로
- `meta.geminiOffered === true` → 셋업 종료 (이전 거절)

#### 2단계: CEO에게 제안

AskUserQuestion:

```
질문: "코드 품질을 높이는 추가 옵션이 있습니다"
header: "리뷰 방식"
options:
  - label: "멀티 AI 리뷰 활성화 (Recommended)"
    description: "Claude가 만든 코드를 다른 AI가 따로 검토합니다. 서로 다른 AI가 리뷰하면 놓치는 버그가 줄어듭니다."
  - label: "기본 리뷰"
    description: "Claude만으로 리뷰합니다. 충분히 잘 작동합니다."
```

#### 3단계: 활성화 (Task tool)

"활성화" 선택 시:

```
다음 CLI를 순서대로 호출하세요 (1번 실패 시 즉시 중단, 2번 실행 안 함):
1. echo '{"provider":"gemini","authType":"cli"}' | node ${CLAUDE_PLUGIN_ROOT}/scripts/cli.js connect
   → 실패 시: CEO에게 에러 메시지 표시 후 기본 리뷰로 진행. 2번 실행하지 않음.
2. echo '{"provider":"gemini"}' | node ${CLAUDE_PLUGIN_ROOT}/scripts/cli.js verify-provider (1번 성공 시에만)

반환: { connected: true/false, model, error }
CLAUDE_PLUGIN_ROOT: {CLAUDE_PLUGIN_ROOT}
```

> **참고:** connect 커맨드가 내부적으로 `verifyConnection`을 호출하여 인증을 검증합니다. 인증 실패 시 자동으로 롤백(`removeAuth` + `setProviderEnabled(false)`)하고 에러를 반환하므로, connect 성공 = 인증 검증 완료입니다. verify-provider는 추가 확인용입니다.

#### 4단계: 검증 결과 처리

**verify 성공 (connected: true):**

```
Task tool 추가 호출:
echo '{"strategy":"cross-model"}' | node ${CLAUDE_PLUGIN_ROOT}/scripts/cli.js set-review-strategy
CLAUDE_PLUGIN_ROOT: {CLAUDE_PLUGIN_ROOT}
```

CEO에게: "멀티 AI 리뷰가 활성화되었습니다. (Gemini {model})"

**verify 실패 (connected: false):**

connect를 롤백하고 CEO에게 안내:

```
Task tool 호출:
echo '{"provider":"gemini"}' | node ${CLAUDE_PLUGIN_ROOT}/scripts/cli.js disconnect
CLAUDE_PLUGIN_ROOT: {CLAUDE_PLUGIN_ROOT}
```

CEO에게:

```
Gemini CLI에 로그인이 필요합니다.

터미널에서 다음을 실행하세요:
  gemini

브라우저가 열리면 Google 계정으로 로그인하세요.
로그인 후 다시 /gv:execute를 실행하면 멀티 AI 리뷰를 활성화할 수 있습니다.
```

기본 리뷰로 진행합니다.

#### "기본 리뷰" 선택 시

```
Task tool:
echo '{"meta":{"geminiOffered":true}}' | node ${CLAUDE_PLUGIN_ROOT}/scripts/cli.js update-provider-meta
CLAUDE_PLUGIN_ROOT: {CLAUDE_PLUGIN_ROOT}
```

### 실행 시 결과 표시

Phase 리뷰 완료 후, cross-model이 활성화된 경우 서브에이전트 반환 형식에 프로바이더별 결과를 포함:

```
Phase {N} 완료:
- 실행 태스크: {N}개
- 주요 결과물: {요약}
- 리뷰 결과:
  Claude 리뷰: approve (QA) — important 1개
  Gemini 리뷰: request-changes (CTO) — critical 1개, important 2개
- 품질 검증: {passed/failed}, critical {N}개, important {N}개
```
