#!/usr/bin/env bash
# phase3-fix-loop.sh — UX fix-review 사이클 루프 (최대 MAX_FIX_CYCLES회)
# 오케스트레이터에서 source 해서 호출

run_phase3() {
  log_phase "Phase3" "=== UX 수정 루프 시작 ==="

  local review_status
  review_status=$(read_file_or_default "${RUN_DIR}/review-status" "UNKNOWN")

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

  local prev_must_count
  prev_must_count=$(count_must_issues "${RUN_DIR}/review-body.txt")
  log_phase "Phase3" "초기 [MUST] 이슈: ${prev_must_count}건"
  local stop_reason="max_cycles"

  local cycle=0

  while [[ "$cycle" -lt "$MAX_FIX_CYCLES" ]]; do
    cycle=$((cycle + 1))
    write_run_file "fix-cycle-count" "$cycle"
    log_phase "Phase3" "--- UX 수정 사이클 ${cycle}/${MAX_FIX_CYCLES} ---"

    # ── 잔여 시간 체크 ─────────────────────────────────────
    if [[ -n "${PIPELINE_START:-}" ]]; then
      local elapsed=$(( $(date +%s) - PIPELINE_START ))
      local remaining=$(( TOTAL_TIMEOUT - elapsed ))
      local cycle_need=$(( PHASE3_FIX_TIMEOUT + PHASE3_REVIEW_TIMEOUT + 300 ))

      if [[ "$remaining" -lt "$cycle_need" ]]; then
        log_phase "Phase3" "잔여 시간 부족 — graceful 종료"
        stop_reason="time_limit"
        break
      fi
    fi

    # ── 리뷰 피드백 읽기 ─────────────────────────────────
    local review_body
    review_body=$(cat "${RUN_DIR}/review-body.txt" 2>/dev/null || echo "리뷰 피드백을 gh pr reviews에서 직접 확인하세요.")

    # ── Fixer 세션 ───────────────────────────────────────
    local fixer_prompt
    fixer_prompt=$(build_ux_fixer_prompt "$pr_number" "$cycle" "$review_body")

    log_phase "Phase3" "UX Fixer 세션 시작 (cycle ${cycle}, timeout: ${PHASE3_FIX_TIMEOUT}s)..."

    local claude_exit=0
    timeout "$PHASE3_FIX_TIMEOUT" claude -p "$fixer_prompt" --dangerously-skip-permissions >> "$LOG_FILE" 2>&1 || claude_exit=$?

    local exit_reason
    exit_reason=$(interpret_claude_exit "$claude_exit")
    log_phase "Phase3" "UX Fixer 세션 종료: ${exit_reason}"

    if [[ "$exit_reason" == "timeout" || "$exit_reason" == "killed" ]]; then
      log_phase "Phase3" "UX 수정 작업 시간 초과 (${cycle}회차)"
      if has_changes; then
        git diff > "${RUN_DIR}/rollback-fix-cycle${cycle}-timeout.patch" 2>/dev/null || true
        git reset HEAD >> "$LOG_FILE" 2>&1 || true
        git checkout -- . 2>/dev/null || true
        git clean -fd 2>/dev/null || true
      fi
      continue
    fi

    # ── 미커밋 변경사항 처리 ─────────────────────────────
    if git diff --name-only HEAD 2>/dev/null | grep -q .; then
      log_phase "Phase3" "미커밋 변경사항 발견, lint/test 확인..."

      local lint_ok=true test_ok=true

      npm run format >> "$LOG_FILE" 2>&1 || true
      npm run lint >> "$LOG_FILE" 2>&1 || lint_ok=false
      npm test >> "$LOG_FILE" 2>&1 || test_ok=false

      if [[ "$lint_ok" == "true" && "$test_ok" == "true" ]]; then
        git add -u >> "$LOG_FILE" 2>&1
        git commit -m "fix(ux-review): [MUST] UX 이슈 수정 — cycle ${cycle}" >> "$LOG_FILE" 2>&1 || true
        git push >> "$LOG_FILE" 2>&1 || true
      else
        log_phase "Phase3" "lint/test 실패 — 변경 백업 후 롤백"
        git diff > "${RUN_DIR}/rollback-fix-cycle${cycle}.patch" 2>/dev/null || true
        git reset HEAD >> "$LOG_FILE" 2>&1 || true
        git checkout -- . 2>/dev/null || true
        git clean -fd 2>/dev/null || true
      fi
    fi

    git push >> "$LOG_FILE" 2>&1 || true

    # ── Re-reviewer 세션 ─────────────────────────────────
    local previous_must
    previous_must=$(grep -E '\[MUST\]' "${RUN_DIR}/review-body.txt" 2>/dev/null \
      | sed 's/^[[:space:]]*//' || echo "(이전 [MUST] 이슈 없음)")

    local rereviewer_prompt
    rereviewer_prompt=$(build_ux_rereviewer_prompt "$pr_number" "$cycle" "$previous_must")

    log_phase "Phase3" "UX Re-reviewer 세션 시작 (cycle ${cycle}, timeout: ${PHASE3_REVIEW_TIMEOUT}s)..."

    claude_exit=0
    timeout "$PHASE3_REVIEW_TIMEOUT" claude -p "$rereviewer_prompt" >> "$LOG_FILE" 2>&1 || claude_exit=$?

    exit_reason=$(interpret_claude_exit "$claude_exit")
    log_phase "Phase3" "UX Re-reviewer 세션 종료: ${exit_reason}"

    # ── 리뷰 결과 확인 ───────────────────────────────────
    local review_state
    review_state=$(parse_review_status "$pr_number")

    log_phase "Phase3" "재리뷰 결과: ${review_state} (cycle ${cycle})"

    if [[ "$review_state" == "APPROVED" ]]; then
      write_run_file "review-status" "APPROVED"
      stop_reason="approved"
      log_phase "Phase3" "APPROVED — 루프 종료"
      write_run_file "stop-reason" "$stop_reason"
      log_phase "Phase3" "=== UX 수정 루프 완료 (${cycle} 사이클) ==="
      return 0
    fi

    gh pr view "$pr_number" --json reviews --jq '.reviews | last | .body' > "${RUN_DIR}/review-body.txt" 2>/dev/null || true

    # ── 진행도 평가 ──────────────────────────────────────
    local current_must_count
    current_must_count=$(count_must_issues "${RUN_DIR}/review-body.txt")
    log_phase "Phase3" "진행도: [MUST] ${prev_must_count}→${current_must_count}"

    if [[ "$current_must_count" -ge "$prev_must_count" ]]; then
      log_phase "Phase3" "[MUST] 감소 없음 — 추가 사이클 무의미, 중단"
      stop_reason="no_progress"
      break
    fi

    prev_must_count=$current_must_count
  done

  write_run_file "stop-reason" "$stop_reason"
  write_run_file "review-status" "CHANGES_REQUESTED"
  write_run_file "fix-cycle-count" "$cycle"

  log_phase "Phase3" "=== UX 수정 루프 완료 (미승인, 사유: ${stop_reason}) ==="
  return "$EXIT_REVIEW_GIVEUP"
}
