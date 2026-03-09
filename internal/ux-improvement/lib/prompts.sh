#!/usr/bin/env bash
# prompts.sh — UX Improver/Reviewer/Fixer/Evaluator 프롬프트 생성 함수
# source 해서 사용. common.sh가 먼저 로드되어야 함.
# 핵심 로직은 Node.js (ux-prompt-builder.js)에 위임.

# ── UX Improver 프롬프트 (Phase 1) ────────────────────
build_ux_improver_prompt() {
  local run_dir="$1"
  node "${SCRIPT_DIR}/lib/ux-prompt-builder.js" improver "$run_dir" 2>/dev/null || {
    echo "먼저 CLAUDE.md 파일을 읽고 프로젝트 컨벤션을 준수하세요. 사용자 경험 관점에서 커맨드 플로우, 에러 메시지, 가이드 문서를 분석하고 개선하세요."
  }
}

# ── UX Reviewer 프롬프트 (Phase 2) ────────────────────
build_ux_reviewer_prompt() {
  local pr_number="$1"
  node "${SCRIPT_DIR}/lib/ux-prompt-builder.js" reviewer \
    "{\"prNumber\":${pr_number}}" 2>/dev/null || {
    echo "PR #${pr_number}을 UX 관점에서 리뷰하세요. 사용자 흐름이 개선되었는지 확인하세요."
  }
}

# ── UX Fixer 프롬프트 (Phase 3) ────────────────────────
build_ux_fixer_prompt() {
  local pr_number="$1"
  local cycle="$2"
  local review_body="$3"

  local json_args
  json_args=$(jq -nc \
    --argjson prNumber "$pr_number" \
    --argjson cycle "$cycle" \
    --argjson maxCycles "${MAX_FIX_CYCLES:-3}" \
    --arg reviewBody "$review_body" \
    '{prNumber: $prNumber, cycle: $cycle, maxCycles: $maxCycles, reviewBody: $reviewBody}')

  node "${SCRIPT_DIR}/lib/ux-prompt-builder.js" fixer "$json_args" 2>/dev/null || {
    echo "PR #${pr_number}의 [MUST] UX 이슈를 수정하세요 (cycle ${cycle}/${MAX_FIX_CYCLES})."
  }
}

# ── UX Re-reviewer 프롬프트 (Phase 3) ────────────────
build_ux_rereviewer_prompt() {
  local pr_number="$1"
  local cycle="$2"
  local previous_must_issues="$3"

  local json_args
  json_args=$(jq -nc \
    --argjson prNumber "$pr_number" \
    --argjson cycle "$cycle" \
    --argjson maxCycles "${MAX_FIX_CYCLES:-3}" \
    --arg previousMust "$previous_must_issues" \
    '{prNumber: $prNumber, cycle: $cycle, maxCycles: $maxCycles, previousMust: $previousMust}')

  # Re-reviewer는 일반 reviewer와 동일 로직 사용 (ux-prompt-builder에 별도 함수 불필요)
  node "${SCRIPT_DIR}/lib/ux-prompt-builder.js" reviewer \
    "{\"prNumber\":${pr_number}}" 2>/dev/null || {
    echo "PR #${pr_number}을 재리뷰하세요 (cycle ${cycle}/${MAX_FIX_CYCLES})."
  }
}

# ── UX Evaluator 프롬프트 (Phase Eval) ───────────────
build_ux_evaluator_prompt() {
  local round="$1"
  local run_dir="$2"

  local json_args
  json_args=$(jq -nc \
    --argjson round "$round" \
    --arg runDir "$run_dir" \
    '{round: $round, runDir: $runDir}')

  node "${SCRIPT_DIR}/lib/ux-prompt-builder.js" evaluator "$json_args" 2>/dev/null || {
    echo "코드베이스를 UX 관점에서 평가하세요. JSON 형식으로 5영역 점수를 출력하세요."
  }
}

# ── UX Round Improver 프롬프트 (Round 2+) ────────────
build_ux_round_improver_prompt() {
  local run_dir="$1"
  local round="$2"

  local json_args
  json_args=$(jq -nc \
    --argjson round "$round" \
    --arg runDir "$run_dir" \
    '{round: $round, runDir: $runDir}')

  node "${SCRIPT_DIR}/lib/ux-prompt-builder.js" round-improver "$json_args" 2>/dev/null || {
    build_ux_improver_prompt "$run_dir"
  }
}
