#!/usr/bin/env bash
# phase1-improve.sh — Claude Improver 세션 + PR 생성
# 오케스트레이터에서 source 해서 호출

run_phase1() {
  log_phase "Phase1" "=== 분석 + 수정 시작 ==="

  assert_not_on_master

  # ── Improver 프롬프트 생성 (Round 2+는 round-improver) ──
  local prompt
  if [[ "${CURRENT_ROUND:-1}" -gt 1 ]]; then
    prompt=$(build_round_improver_prompt "$RUN_DIR" "$CURRENT_ROUND")
  else
    prompt=$(build_improver_prompt "$RUN_DIR")
  fi

  # ── Claude Improver 세션 실행 (run_claude_safe 래퍼) ───
  log_phase "Phase1" "Claude Improver 세션 시작 (Round ${CURRENT_ROUND:-1}, timeout: ${PHASE1_TIMEOUT}s)..."

  local claude_exit=0
  run_claude_safe "$prompt" "Phase1" "/dev/null" "$PHASE1_TIMEOUT" "yes" || claude_exit=$?

  local exit_reason
  exit_reason=$(interpret_claude_exit "$claude_exit")
  log_phase "Phase1" "Claude 세션 종료: ${exit_reason}"

  if [[ "$exit_reason" == "timeout" || "$exit_reason" == "killed" ]]; then
    send_telegram "" "코드 분석이 시간 초과되었습니다"
    # 미커밋 변경사항 백업 후 정리
    if has_changes; then
      git diff > "${RUN_DIR}/rollback-phase1-timeout.patch" 2>/dev/null || true
      git reset HEAD >> "$LOG_FILE" 2>&1 || true
      git checkout -- . 2>/dev/null || true
      git clean -fd 2>/dev/null || true
    fi
    write_run_file "phase1-exit-code" "$EXIT_TIMEOUT"
    return "$EXIT_TIMEOUT"
  fi

  # ── 변경사항 확인 ─────────────────────────────────────
  local changed_files
  changed_files=$(git diff --name-only HEAD 2>/dev/null | wc -l)
  local staged_files
  staged_files=$(git diff --cached --name-only 2>/dev/null | wc -l)
  local new_commits
  new_commits=$(git log "${BASE_BRANCH}..HEAD" --oneline 2>/dev/null | wc -l)

  log_phase "Phase1" "변경: unstaged=${changed_files}, staged=${staged_files}, commits=${new_commits}"

  # 변경사항이 전혀 없으면 → 발견 없음
  if [[ "$changed_files" -eq 0 && "$staged_files" -eq 0 && "$new_commits" -eq 0 ]]; then
    log_phase "Phase1" "발견 없음 — 조용히 종료"
    write_run_file "phase1-exit-code" "$EXIT_NO_FINDINGS"
    return "$EXIT_NO_FINDINGS"
  fi

  # ── 미커밋 변경사항이 있으면 안전 확인 후 커밋 ────────
  if [[ "$changed_files" -gt 0 || "$staged_files" -gt 0 ]]; then
    log_phase "Phase1" "미커밋 변경사항 발견, lint/test 확인..."

    local lint_ok=true
    local test_ok=true

    npm run lint >> "$LOG_FILE" 2>&1 || lint_ok=false
    npm test >> "$LOG_FILE" 2>&1 || test_ok=false

    if [[ "$lint_ok" == "false" || "$test_ok" == "false" ]]; then
      log_phase "Phase1" "lint/test 실패 — 변경사항 백업 후 롤백"
      git diff > "${RUN_DIR}/rollback-phase1.patch" 2>/dev/null || true
      git diff --cached > "${RUN_DIR}/rollback-phase1-staged.patch" 2>/dev/null || true
      git reset HEAD >> "$LOG_FILE" 2>&1 || true
      git checkout -- . 2>/dev/null || true
      git clean -fd 2>/dev/null || true

      if [[ "$lint_ok" == "false" ]]; then
        write_run_file "phase1-exit-code" "$EXIT_LINT_FAIL"
        send_telegram "" "코드 검사 실패 — 수정을 되돌렸습니다 (이슈는 유지)"
        return "$EXIT_LINT_FAIL"
      else
        write_run_file "phase1-exit-code" "$EXIT_TEST_FAIL"
        send_telegram "" "테스트 실패 — 수정을 되돌렸습니다 (이슈는 유지)"
        return "$EXIT_TEST_FAIL"
      fi
    fi

    # lint/test 통과 → 커밋
    log_phase "Phase1" "lint/test 통과 — 미커밋 변경사항 커밋"
    git add -A >> "$LOG_FILE" 2>&1
    git commit -m "fix(daily-improvement): 코드 품질 개선 $(date '+%Y-%m-%d')" >> "$LOG_FILE" 2>&1 || true
  fi

  # ── 커밋이 있는지 최종 확인 ───────────────────────────
  new_commits=$(git log "${BASE_BRANCH}..HEAD" --oneline 2>/dev/null | wc -l)
  if [[ "$new_commits" -eq 0 ]]; then
    log_phase "Phase1" "커밋 없음 — 발견 없음 처리"
    write_run_file "phase1-exit-code" "$EXIT_NO_FINDINGS"
    return "$EXIT_NO_FINDINGS"
  fi

  # ── Push + PR 생성 ────────────────────────────────────
  log_phase "Phase1" "Push..."
  git push -u origin "$BRANCH_NAME" >> "$LOG_FILE" 2>&1

  # Round 2+: PR은 이미 존재 → push만, PR 생성 스킵
  if [[ "${CURRENT_ROUND:-1}" -gt 1 ]]; then
    log_phase "Phase1" "Round ${CURRENT_ROUND}: 기존 PR에 추가 커밋 push"
    gh issue list --label "automated,improvement" --state open --json number \
      --jq '.[].number' > "${RUN_DIR}/issues-created.txt" 2>/dev/null || true
    write_run_file "phase1-exit-code" "0"
    log_phase "Phase1" "=== 분석 + 수정 완료 (Round ${CURRENT_ROUND}) ==="
    return 0
  fi

  # PR이 이미 생성되었는지 확인 (Claude가 생성했을 수 있음)
  local existing_pr
  existing_pr=$(gh pr list --head "$BRANCH_NAME" --json number --jq '.[0].number' 2>/dev/null || echo "")

  if [[ -n "$existing_pr" && "$existing_pr" != "null" ]]; then
    log_phase "Phase1" "PR이 이미 존재: #${existing_pr}"
    write_run_file "pr-number" "$existing_pr"
    local pr_url
    pr_url=$(gh pr view "$existing_pr" --json url --jq '.url' 2>/dev/null || echo "")
    write_run_file "pr-url" "$pr_url"
  else
    # Fallback: PR 직접 생성
    log_phase "Phase1" "PR fallback 생성..."

    local run_date
    run_date=$(cat "${RUN_DIR}/meta.env" | grep RUN_DATE | cut -d= -f2)

    local pr_url
    pr_url=$(gh pr create \
      --title "[Daily Improvement] ${run_date} 코드 개선" \
      --body "$(cat <<'BODY_EOF'
## Daily Improvement 자동 분석 결과

자동화 파이프라인에 의해 생성된 PR입니다.
리뷰 진행 중 — Phase 2에서 독립 리뷰가 수행됩니다.

---
Generated by Daily Improvement Pipeline
BODY_EOF
)" \
      --label "automated,improvement" \
      --base "${BASE_BRANCH}" 2>> "$LOG_FILE" || echo "")

    if [[ -n "$pr_url" ]]; then
      local pr_number
      pr_number=$(echo "$pr_url" | grep -o '[0-9]*$')
      write_run_file "pr-number" "$pr_number"
      write_run_file "pr-url" "$pr_url"
      log_phase "Phase1" "PR 생성: #${pr_number} (${pr_url})"
    else
      log_phase "Phase1" "ERROR: PR 생성 실패"
      write_run_file "phase1-exit-code" "$EXIT_ERROR"
      return "$EXIT_ERROR"
    fi
  fi

  # ── 생성된 이슈 목록 수집 ─────────────────────────────
  # 오늘 생성된 automated 이슈 목록
  gh issue list --label "automated,improvement" --state open --json number --jq '.[].number' > "${RUN_DIR}/issues-created.txt" 2>/dev/null || true

  write_run_file "phase1-exit-code" "0"
  log_phase "Phase1" "=== 분석 + 수정 완료 ==="
  return 0
}
