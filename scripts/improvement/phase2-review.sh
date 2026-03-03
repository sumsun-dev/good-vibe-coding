#!/usr/bin/env bash
# phase2-review.sh — CI 대기 + Claude Reviewer 독립 리뷰
# 오케스트레이터에서 source 해서 호출

run_phase2() {
  log_phase "Phase2" "=== 독립 리뷰 시작 ==="

  local pr_number
  pr_number=$(read_file_or_default "${RUN_DIR}/pr-number" "")

  if [[ -z "$pr_number" ]]; then
    log_phase "Phase2" "ERROR: PR 번호 없음 — 건너뜀"
    write_run_file "review-status" "SKIPPED"
    return "$EXIT_ERROR"
  fi

  # ── CI 완료 대기 ──────────────────────────────────────
  log_phase "Phase2" "CI 완료 대기 (최대 ${CI_WAIT_TIMEOUT}s)..."

  local ci_waited=0
  local ci_status="pending"

  while [[ "$ci_waited" -lt "$CI_WAIT_TIMEOUT" ]]; do
    ci_status=$(gh pr checks "$pr_number" --json state --jq 'map(.state) | if all(. == "SUCCESS") then "success" elif any(. == "FAILURE") then "failure" elif any(. == "PENDING" or . == "QUEUED" or . == "IN_PROGRESS") then "pending" else "none" end' 2>/dev/null || echo "none")

    case "$ci_status" in
      success)
        log_phase "Phase2" "CI 통과"
        break
        ;;
      failure)
        log_phase "Phase2" "CI 실패 — 리뷰는 계속 진행"
        break
        ;;
      none)
        log_phase "Phase2" "CI 없음 — 리뷰 진행"
        break
        ;;
      pending)
        sleep "$CI_POLL_INTERVAL"
        ci_waited=$((ci_waited + CI_POLL_INTERVAL))
        ;;
    esac
  done

  if [[ "$ci_waited" -ge "$CI_WAIT_TIMEOUT" ]]; then
    log_phase "Phase2" "CI 대기 타임아웃 — 리뷰는 계속 진행"
  fi

  # ── Reviewer 프롬프트 생성 ─────────────────────────────
  local prompt
  prompt=$(build_reviewer_prompt "$pr_number")

  # ── Claude Reviewer 세션 실행 ──────────────────────────
  log_phase "Phase2" "Claude Reviewer 세션 시작 (timeout: ${PHASE2_TIMEOUT}s)..."

  local claude_exit=0
  timeout "$PHASE2_TIMEOUT" claude -p "$prompt" --dangerously-skip-permissions >> "$LOG_FILE" 2>&1 || claude_exit=$?

  local exit_reason
  exit_reason=$(interpret_claude_exit "$claude_exit")
  log_phase "Phase2" "Claude Reviewer 종료: ${exit_reason}"

  if [[ "$exit_reason" == "timeout" || "$exit_reason" == "killed" ]]; then
    send_telegram "⚠️" "Phase 2 ${exit_reason} — Reviewer 세션이 시간 초과되었습니다"
    write_run_file "review-status" "TIMEOUT"
    return "$EXIT_TIMEOUT"
  fi

  # ── 리뷰 결과 확인 ────────────────────────────────────
  local review_state
  review_state=$(gh pr reviews "$pr_number" --json state --jq 'last | .state' 2>/dev/null || echo "UNKNOWN")

  log_phase "Phase2" "리뷰 결과: ${review_state}"

  case "$review_state" in
    APPROVED)
      write_run_file "review-status" "APPROVED"
      ;;
    CHANGES_REQUESTED)
      write_run_file "review-status" "CHANGES_REQUESTED"
      # 리뷰 코멘트 저장 (Phase 3에서 사용)
      gh pr reviews "$pr_number" --json body --jq 'last | .body' > "${RUN_DIR}/review-body.txt" 2>/dev/null || true
      ;;
    *)
      # 리뷰가 제대로 실행되지 않은 경우 — CHANGES_REQUESTED로 간주
      log_phase "Phase2" "리뷰 상태 불명확 (${review_state}) — CHANGES_REQUESTED 처리"
      write_run_file "review-status" "CHANGES_REQUESTED"
      ;;
  esac

  log_phase "Phase2" "=== 독립 리뷰 완료 ==="
  return 0
}
