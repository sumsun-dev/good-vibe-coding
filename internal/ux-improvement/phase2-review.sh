#!/usr/bin/env bash
# phase2-review.sh — UX Reviewer (독립 리뷰)
# 오케스트레이터에서 source 해서 호출

run_phase2() {
  log_phase "Phase2" "=== UX 리뷰 시작 ==="

  local pr_number
  pr_number=$(read_file_or_default "${RUN_DIR}/pr-number" "")

  if [[ -z "$pr_number" ]]; then
    log_phase "Phase2" "ERROR: PR 번호 없음"
    return "$EXIT_ERROR"
  fi

  # ── UX Reviewer 프롬프트 생성 ───────────────────────────
  local prompt
  prompt=$(build_ux_reviewer_prompt "$pr_number")

  # ── Claude UX Reviewer 세션 실행 ────────────────────────
  log_phase "Phase2" "Claude UX Reviewer 세션 시작 (PR #${pr_number}, timeout: ${PHASE2_TIMEOUT}s)..."

  local review_output="${RUN_DIR}/review-output.txt"
  local claude_exit=0
  run_claude_safe "$prompt" "Phase2" "$review_output" "$PHASE2_TIMEOUT" "no" || claude_exit=$?

  local exit_reason
  exit_reason=$(interpret_claude_exit "$claude_exit")
  log_phase "Phase2" "UX Reviewer 세션 종료: ${exit_reason}"

  # ── 세션 오류 분류 ──────────────────────────────────────
  local error_class
  error_class=$(classify_claude_error "$claude_exit" "$(tail -20 "$LOG_FILE" 2>/dev/null || echo "")")
  if [[ "$error_class" == "weekly_limit" || "$error_class" == "auth_error" ]]; then
    save_checkpoint "${CURRENT_ROUND:-1}" "phase2" "session_error:${error_class}"
    return "$EXIT_ERROR"
  fi

  # ── 리뷰 결과 확인 ─────────────────────────────────────
  local review_state
  review_state=$(parse_review_status "$pr_number")

  log_phase "Phase2" "UX 리뷰 결과: ${review_state}"
  write_run_file "review-status" "$review_state"

  # 리뷰 본문 저장
  gh pr view "$pr_number" --json reviews \
    --jq '.reviews | if length == 0 then "" else (last | .body // "") end' \
    > "${RUN_DIR}/review-body.txt" 2>/dev/null || true

  log_phase "Phase2" "=== UX 리뷰 완료 ==="
  return 0
}
