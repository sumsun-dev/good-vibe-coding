#!/usr/bin/env bash
# prompts.sh — Improver/Reviewer/Fixer 프롬프트 생성 함수
# source 해서 사용. common.sh, history.sh가 먼저 로드되어야 함.
# 핵심 로직은 Node.js (prompt-builder.js)에 위임.

# ── Improver 프롬프트 (Phase 1) ──────────────────────────
build_improver_prompt() {
  local run_dir="$1"
  node "${SCRIPT_DIR}/lib/improvement/prompt-builder.js" improver "$run_dir" 2>/dev/null || {
    # fallback: 최소 프롬프트
    echo "먼저 CLAUDE.md 파일을 읽고 프로젝트 컨벤션을 반드시 준수하세요. 코드 품질, 보안, 성능을 분석하고 critical/important 이슈만 수정하세요."
  }
}

# ── Reviewer 프롬프트 (Phase 2) ──────────────────────────
build_reviewer_prompt() {
  local pr_number="$1"
  node "${SCRIPT_DIR}/lib/improvement/prompt-builder.js" reviewer \
    "{\"prNumber\":${pr_number}}" 2>/dev/null || {
    echo "PR #${pr_number}을 깊이 있게 리뷰하세요. CLAUDE.md를 읽고, gh pr diff ${pr_number}으로 변경사항을 확인한 후 MUST/SHOULD 기준으로 판정하세요."
  }
}

# ── Fixer 프롬프트 (Phase 3 — 수정 세션) ────────────────
build_fixer_prompt() {
  local pr_number="$1"
  local cycle="$2"
  local review_body="$3"

  # JSON으로 인코딩하여 전달 (review_body에 특수문자 가능)
  local json_args
  json_args=$(jq -nc \
    --argjson prNumber "$pr_number" \
    --argjson cycle "$cycle" \
    --argjson maxCycles "${MAX_FIX_CYCLES:-5}" \
    --arg reviewBody "$review_body" \
    '{prNumber: $prNumber, cycle: $cycle, maxCycles: $maxCycles, reviewBody: $reviewBody}')

  node "${SCRIPT_DIR}/lib/improvement/prompt-builder.js" fixer "$json_args" 2>/dev/null || {
    echo "PR #${pr_number}의 [MUST] 이슈를 수정하세요 (cycle ${cycle}/${MAX_FIX_CYCLES}). 리뷰: ${review_body}"
  }
}

# ── Re-reviewer 프롬프트 (Phase 3 — 재리뷰 세션) ────────
build_rereviewer_prompt() {
  local pr_number="$1"
  local cycle="$2"
  local previous_must_issues="$3"

  local json_args
  json_args=$(jq -nc \
    --argjson prNumber "$pr_number" \
    --argjson cycle "$cycle" \
    --argjson maxCycles "${MAX_FIX_CYCLES:-5}" \
    --arg previousMust "$previous_must_issues" \
    '{prNumber: $prNumber, cycle: $cycle, maxCycles: $maxCycles, previousMust: $previousMust}')

  node "${SCRIPT_DIR}/lib/improvement/prompt-builder.js" rereviewer "$json_args" 2>/dev/null || {
    echo "PR #${pr_number}을 재리뷰하세요 (cycle ${cycle}/${MAX_FIX_CYCLES}). 이전 이슈: ${previous_must_issues}"
  }
}

# ── Evaluator 프롬프트 (Phase Eval) ────────────────
build_evaluator_prompt() {
  local round="$1"
  local run_dir="$2"

  local json_args
  json_args=$(jq -nc \
    --argjson round "$round" \
    --arg runDir "$run_dir" \
    '{round: $round, runDir: $runDir}')

  node "${SCRIPT_DIR}/lib/improvement/prompt-builder.js" evaluator "$json_args" 2>/dev/null || {
    echo "코드베이스를 평가하세요. JSON 형식으로 7영역 점수를 출력하세요. 코드를 수정하지 마세요."
  }
}

# ── Round Improver 프롬프트 (Round 2+) ─────────────
build_round_improver_prompt() {
  local run_dir="$1"
  local round="$2"

  local json_args
  json_args=$(jq -nc \
    --argjson round "$round" \
    --arg runDir "$run_dir" \
    '{round: $round, runDir: $runDir}')

  node "${SCRIPT_DIR}/lib/improvement/prompt-builder.js" round-improver "$json_args" 2>/dev/null || {
    build_improver_prompt "$run_dir"
  }
}
