#!/usr/bin/env bash
# phase3-fix-loop.sh — fix-review 사이클 루프 (최대 MAX_FIX_CYCLES회)
# 오케스트레이터에서 source 해서 호출

run_phase3() {
  log_phase "Phase3" "=== 수정 루프 시작 ==="

  local review_status
  review_status=$(read_file_or_default "${RUN_DIR}/review-status" "UNKNOWN")

  # APPROVED면 건너뜀
  if [[ "$review_status" == "APPROVED" ]]; then
    log_phase "Phase3" "이미 APPROVED — 건너뜀"
    write_run_file "fix-cycle-count" "0"
    return 0
  fi

  local pr_number
  pr_number=$(read_file_or_default "${RUN_DIR}/pr-number" "")

  if [[ -z "$pr_number" ]]; then
    log_phase "Phase3" "ERROR: PR 번호 없음"
    return "$EXIT_ERROR"
  fi

  assert_not_on_master

  local cycle=0

  while [[ "$cycle" -lt "$MAX_FIX_CYCLES" ]]; do
    cycle=$((cycle + 1))
    write_run_file "fix-cycle-count" "$cycle"
    log_phase "Phase3" "--- 수정 사이클 ${cycle}/${MAX_FIX_CYCLES} ---"

    # ── 리뷰 피드백 읽기 ─────────────────────────────────
    local review_body
    review_body=$(cat "${RUN_DIR}/review-body.txt" 2>/dev/null || echo "리뷰 피드백을 gh pr reviews에서 직접 확인하세요.")

    # ── Fixer 세션 ───────────────────────────────────────
    local fixer_prompt
    fixer_prompt=$(build_fixer_prompt "$pr_number" "$cycle" "$review_body")

    log_phase "Phase3" "Fixer 세션 시작 (cycle ${cycle}, timeout: ${PHASE3_FIX_TIMEOUT}s)..."

    local claude_exit=0
    timeout "$PHASE3_FIX_TIMEOUT" claude -p "$fixer_prompt" --dangerously-skip-permissions >> "$LOG_FILE" 2>&1 || claude_exit=$?

    local exit_reason
    exit_reason=$(interpret_claude_exit "$claude_exit")
    log_phase "Phase3" "Fixer 세션 종료: ${exit_reason}"

    if [[ "$exit_reason" == "timeout" || "$exit_reason" == "killed" ]]; then
      send_telegram "⚠️" "Phase 3 Fixer ${exit_reason} (cycle ${cycle})"
      continue
    fi

    # ── 미커밋 변경사항 처리 ─────────────────────────────
    if git diff --name-only HEAD 2>/dev/null | grep -q .; then
      log_phase "Phase3" "미커밋 변경사항 발견, lint/test 확인..."

      local lint_ok=true
      local test_ok=true

      npm run lint >> "$LOG_FILE" 2>&1 || lint_ok=false
      npm test >> "$LOG_FILE" 2>&1 || test_ok=false

      if [[ "$lint_ok" == "true" && "$test_ok" == "true" ]]; then
        git add -A >> "$LOG_FILE" 2>&1
        git commit -m "fix(review): [MUST] 이슈 수정 — cycle ${cycle}" >> "$LOG_FILE" 2>&1 || true
        git push >> "$LOG_FILE" 2>&1 || true
      else
        log_phase "Phase3" "lint/test 실패 — 변경 백업 후 롤백"
        git diff > "${RUN_DIR}/rollback-fix-cycle${cycle}.patch" 2>/dev/null || true
        git checkout -- . 2>/dev/null || true
        git clean -fd 2>/dev/null || true
      fi
    fi

    # Push 확인 (Claude가 이미 push했을 수 있음)
    git push >> "$LOG_FILE" 2>&1 || true

    # ── Re-reviewer 세션 ─────────────────────────────────
    # 이전 [MUST] 이슈 추출
    local previous_must
    previous_must=$(grep -o '\[MUST\][^"]*' "${RUN_DIR}/review-body.txt" 2>/dev/null || echo "이전 리뷰에서 [MUST] 이슈를 gh pr reviews로 확인하세요.")

    local rereviewer_prompt
    rereviewer_prompt=$(build_rereviewer_prompt "$pr_number" "$cycle" "$previous_must")

    log_phase "Phase3" "Re-reviewer 세션 시작 (cycle ${cycle}, timeout: ${PHASE3_REVIEW_TIMEOUT}s)..."

    claude_exit=0
    timeout "$PHASE3_REVIEW_TIMEOUT" claude -p "$rereviewer_prompt" --dangerously-skip-permissions >> "$LOG_FILE" 2>&1 || claude_exit=$?

    exit_reason=$(interpret_claude_exit "$claude_exit")
    log_phase "Phase3" "Re-reviewer 세션 종료: ${exit_reason}"

    # ── 리뷰 결과 확인 ───────────────────────────────────
    local review_state
    review_state=$(gh pr reviews "$pr_number" --json state --jq 'last | .state' 2>/dev/null || echo "UNKNOWN")

    log_phase "Phase3" "재리뷰 결과: ${review_state} (cycle ${cycle})"

    if [[ "$review_state" == "APPROVED" ]]; then
      write_run_file "review-status" "APPROVED"
      log_phase "Phase3" "APPROVED — 루프 종료"
      log_phase "Phase3" "=== 수정 루프 완료 (${cycle} 사이클) ==="
      return 0
    fi

    # 다음 사이클을 위해 리뷰 바디 업데이트
    gh pr reviews "$pr_number" --json body --jq 'last | .body' > "${RUN_DIR}/review-body.txt" 2>/dev/null || true
  done

  # ── MAX_FIX_CYCLES 초과 ────────────────────────────────
  log_phase "Phase3" "최대 수정 사이클 (${MAX_FIX_CYCLES}) 도달 — CEO에게 넘김"
  write_run_file "review-status" "CHANGES_REQUESTED"
  write_run_file "fix-cycle-count" "$cycle"

  log_phase "Phase3" "=== 수정 루프 완료 (미승인) ==="
  return "$EXIT_REVIEW_GIVEUP"
}
