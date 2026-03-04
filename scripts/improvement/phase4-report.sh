#!/usr/bin/env bash
# phase4-report.sh — 보고서 + 텔레그램 알림 + 히스토리 기록 + 정리
# 오케스트레이터에서 source 해서 호출

run_phase4() {
  log_phase "Phase4" "=== 보고서 + 알림 시작 ==="

  local pr_number
  pr_number=$(read_file_or_default "${RUN_DIR}/pr-number" "")
  local pr_url
  pr_url=$(read_file_or_default "${RUN_DIR}/pr-url" "")
  local review_status
  review_status=$(read_file_or_default "${RUN_DIR}/review-status" "UNKNOWN")
  local fix_cycles
  fix_cycles=$(read_file_or_default "${RUN_DIR}/fix-cycle-count" "0")
  local run_date
  run_date=$(grep RUN_DATE "${RUN_DIR}/meta.env" 2>/dev/null | cut -d= -f2 || date '+%Y-%m-%d')

  # ── 메트릭 수집 ───────────────────────────────────────
  local issue_count=0
  if [[ -f "${RUN_DIR}/issues-created.txt" ]]; then
    issue_count=$(wc -l < "${RUN_DIR}/issues-created.txt" | tr -d ' ')
  fi

  local commit_count=0
  commit_count=$(git log "${BASE_BRANCH}..HEAD" --oneline 2>/dev/null | wc -l | tr -d ' ')

  local file_count=0
  file_count=$(git diff --name-only "${BASE_BRANCH}..HEAD" 2>/dev/null | wc -l | tr -d ' ')

  # 카테고리 수집
  local categories="[]"
  if [[ -f "${RUN_DIR}/issues-created.txt" ]]; then
    local cats
    cats=$(while read -r num; do
      gh issue view "$num" --json labels --jq '.labels[].name' 2>/dev/null
    done < "${RUN_DIR}/issues-created.txt" | grep -E '^(quality|security|performance)$' | sort -u || echo "")

    if [[ -n "$cats" ]]; then
      categories=$(echo "$cats" | jq -Rnc '[inputs | select(length > 0)]')
    fi
  fi

  # metrics.json 생성
  jq -nc \
    --arg date "$run_date" \
    --argjson prNumber "${pr_number:-null}" \
    --arg prUrl "${pr_url:-}" \
    --argjson issues "${issue_count:-0}" \
    --argjson commits "${commit_count:-0}" \
    --argjson files "${file_count:-0}" \
    --arg reviewStatus "$review_status" \
    --argjson fixCycles "${fix_cycles:-0}" \
    --argjson categories "${categories}" \
    '{date: $date, prNumber: $prNumber, prUrl: $prUrl, issues: $issues, commits: $commits, files: $files, reviewStatus: $reviewStatus, fixCycles: $fixCycles, categories: $categories}' \
    > "${RUN_DIR}/metrics.json"

  log_phase "Phase4" "메트릭: issues=${issue_count}, commits=${commit_count}, files=${file_count}, review=${review_status}"

  # ── 히스토리 기록 ─────────────────────────────────────
  local approved_val="null"
  case "$review_status" in
    APPROVED) approved_val="true" ;;
    CHANGES_REQUESTED) approved_val="false" ;;
  esac

  # ── Round 메트릭 수집 ─────────────────────────────────
  local total_rounds
  total_rounds=$(read_file_or_default "${RUN_DIR}/total-rounds" "1")
  local round_stop_reason
  round_stop_reason=$(read_file_or_default "${RUN_DIR}/round-stop-reason" "")
  local last_sla_score=""
  # 마지막 라운드의 SLA 점수 읽기
  local i
  for i in $(seq "$total_rounds" -1 1); do
    last_sla_score=$(read_file_or_default "${RUN_DIR}/sla-score-round${i}" "")
    if [[ -n "$last_sla_score" ]]; then break; fi
  done

  local hist_stop_reason
  hist_stop_reason=$(read_file_or_default "${RUN_DIR}/stop-reason" "${round_stop_reason}")
  append_history "$run_date" "$issue_count" "$categories" "$approved_val" "$fix_cycles" "$pr_url" "$hist_stop_reason" "$total_rounds" "${last_sla_score:-null}"
  log_phase "Phase4" "히스토리 기록 완료 (rounds=${total_rounds}, sla=${last_sla_score:-N/A})"

  # ── PR body 업데이트 ──────────────────────────────────
  if [[ -n "$pr_number" ]]; then
    # 생성된 이슈 목록
    local issues_section=""
    if [[ -f "${RUN_DIR}/issues-created.txt" ]] && [[ -s "${RUN_DIR}/issues-created.txt" ]]; then
      issues_section=$'\n## 발견 및 수정한 문제\n\n'
      while read -r num; do
        local issue_title issue_labels
        issue_title=$(gh issue view "$num" --json title --jq '.title' 2>/dev/null || echo "제목 조회 실패")
        issue_labels=$(gh issue view "$num" --json labels --jq '[.labels[].name] | join(", ")' 2>/dev/null || echo "")
        if [[ -n "$issue_labels" ]]; then
          issues_section+="- #${num} [${issue_labels}] ${issue_title}"$'\n'
        else
          issues_section+="- #${num} ${issue_title}"$'\n'
        fi
      done < "${RUN_DIR}/issues-created.txt"
    fi

    # 변경 파일 목록
    local diff_stat_section=""
    local diff_stat
    diff_stat=$(git diff --stat "${BASE_BRANCH}..HEAD" 2>/dev/null || echo "")
    if [[ -n "$diff_stat" ]]; then
      diff_stat_section=$'\n## 수정된 파일 상세\n\n```\n'"${diff_stat}"$'\n```\n'
    fi

    # 리뷰 요약 ([MUST]/[SHOULD] 추출)
    local review_summary_section=""
    if [[ -f "${RUN_DIR}/review-body.txt" ]]; then
      local must_items should_items
      must_items=$(grep -E '\[MUST\]' "${RUN_DIR}/review-body.txt" 2>/dev/null | sed 's/^[[:space:]]*//' || echo "")
      should_items=$(grep -E '\[SHOULD\]' "${RUN_DIR}/review-body.txt" 2>/dev/null | sed 's/^[[:space:]]*//' || echo "")

      if [[ -n "$must_items" || -n "$should_items" ]]; then
        review_summary_section=$'\n## 검토 의견\n\n'
        if [[ -n "$must_items" ]]; then
          review_summary_section+="**필수 수정:**"$'\n'
          while IFS= read -r line; do
            review_summary_section+="- ${line}"$'\n'
          done <<< "$must_items"
        fi
        if [[ -n "$should_items" ]]; then
          review_summary_section+=$'\n'"**권장 개선:**"$'\n'
          while IFS= read -r line; do
            review_summary_section+="- ${line}"$'\n'
          done <<< "$should_items"
        fi
      fi
    fi

    # review_status 한글 매핑
    local review_status_display
    case "$review_status" in
      APPROVED) review_status_display="✅ 승인됨" ;;
      CHANGES_REQUESTED) review_status_display="❌ 수정 필요" ;;
      UNKNOWN) review_status_display="⏳ 확인 중" ;;
      *) review_status_display="$review_status" ;;
    esac

    # SLA 대시보드 섹션
    local sla_dashboard_section=""
    if [[ -f "${RUN_DIR}/round-metrics.jsonl" ]]; then
      local dashboard
      dashboard=$(node "${SCRIPT_DIR}/lib/improvement/sla-evaluator.js" dashboard \
        "${RUN_DIR}/round-metrics.jsonl" 2>/dev/null || echo "")
      if [[ -n "$dashboard" ]]; then
        sla_dashboard_section=$'\n'"${dashboard}"$'\n'
      fi
    fi

    # 라운드 정보
    local round_display=""
    if [[ "$total_rounds" -gt 1 ]]; then
      local round_stop_display
      case "$round_stop_reason" in
        sla_met) round_stop_display="SLA 달성" ;;
        stagnant) round_stop_display="개선 정체" ;;
        time_limit) round_stop_display="시간 제한" ;;
        max_rounds) round_stop_display="최대 라운드" ;;
        weekly_limit) round_stop_display="주간 한도" ;;
        session_limit) round_stop_display="세션 한도" ;;
        no_findings) round_stop_display="추가 발견 없음" ;;
        *) round_stop_display="${round_stop_reason:-완료}" ;;
      esac
      round_display=" (${total_rounds} rounds, ${round_stop_display})"
    fi

    # 종료 사유 표시
    local stop_display=""
    local stop_reason
    stop_reason=$(read_file_or_default "${RUN_DIR}/stop-reason" "")
    case "$stop_reason" in
      no_progress) stop_display=" (진행 없음 → 조기 중단)" ;;
      max_cycles)  stop_display=" (안전장치 도달)" ;;
      time_limit)  stop_display=" (시간 제한)" ;;
    esac

    local pr_body
    pr_body=$(cat <<BODY_EOF
## 오늘의 자동 코드 개선 결과

| 항목 | 값 |
|------|-----|
| 실행일 | ${run_date} |
| 발견한 문제 | ${issue_count}건 |
| 수정 횟수 | ${commit_count}회 |
| 수정된 파일 | ${file_count}개 |
| 검토 결과 | ${review_status_display} |
| 피드백 반영 | ${fix_cycles}회${stop_display} |
| 라운드 | ${total_rounds}회${round_display} |
| SLA 점수 | ${last_sla_score:-N/A}/10 |
${sla_dashboard_section}${issues_section}${diff_stat_section}${review_summary_section}
## 확인 체크리스트

- [ ] 수정 내용이 적절한지 확인
- [ ] 발견된 문제와 수정이 일치하는지 검토
- [ ] 테스트가 정상 통과하는지 확인
- [ ] 머지 승인

---
🤖 Generated by Daily Improvement Pipeline
BODY_EOF
)

    gh pr edit "$pr_number" --body "$pr_body" >> "$LOG_FILE" 2>&1 || true

    # ── 라벨 추가 + 자동 머지 ─────────────────────────────
    if [[ "$review_status" == "APPROVED" ]]; then
      gh pr edit "$pr_number" --add-label "merge-ready" >> "$LOG_FILE" 2>&1 || true
      log_phase "Phase4" "merge-ready 라벨 추가"

      # 자동 머지 (옵션)
      if [[ "${AUTO_MERGE:-false}" == "true" ]]; then
        log_phase "Phase4" "자동 머지 시도 (squash)..."
        if gh pr merge "$pr_number" --squash --delete-branch >> "$LOG_FILE" 2>&1; then
          log_phase "Phase4" "자동 머지 완료"
          send_telegram "🎉" "자동 머지 완료 (PR #${pr_number})"
        else
          log_phase "Phase4" "자동 머지 실패 — 수동 확인 필요"
          send_telegram "⚠️" "자동 머지 실패 — 수동 확인 필요 (PR #${pr_number})"
        fi
      fi
    fi
  fi

  # ── 텔레그램 알림 ─────────────────────────────────────
  case "$review_status" in
    APPROVED)
      send_telegram "✅" "검토 통과 — 확인 후 머지해주세요
발견: ${issue_count}건 | 파일: ${file_count}개 | 라운드: ${total_rounds}회 | SLA: ${last_sla_score:-N/A}/10
PR: ${pr_url}"
      ;;
    CHANGES_REQUESTED)
      local tg_round_info=""
      if [[ "$total_rounds" -gt 1 ]]; then
        tg_round_info="라운드: ${total_rounds}회 | SLA: ${last_sla_score:-N/A}/10
"
      fi
      case "${hist_stop_reason:-unknown}" in
        no_progress)
          send_telegram "⚠️" "수정 진행 없음 — ${fix_cycles}회 시도 후 중단
${tg_round_info}[MUST] 이슈가 줄지 않아 조기 종료했습니다
PR: ${pr_url}"
          ;;
        max_cycles)
          send_telegram "⚠️" "안전장치 — ${fix_cycles}회 수정 후 중단
${tg_round_info}PR: ${pr_url}"
          ;;
        time_limit)
          send_telegram "⏰" "시간 제한 — ${fix_cycles}회 수정 후 중단
${tg_round_info}PR: ${pr_url}"
          ;;
        *)
          send_telegram "⚠️" "검토 미통과 — 확인이 필요합니다
${tg_round_info}PR: ${pr_url}"
          ;;
      esac
      ;;
    *)
      send_telegram "ℹ️" "완료 (검토 결과: ${review_status})
발견: ${issue_count}건 | 라운드: ${total_rounds}회 | PR: ${pr_url}"
      ;;
  esac

  log_phase "Phase4" "=== 보고서 + 알림 완료 ==="
  return 0
}

# ── 발견 없음 시 정리 함수 ───────────────────────────────
run_phase4_no_findings() {
  log_phase "Phase4" "=== 발견 없음 정리 ==="

  local run_date
  run_date=$(grep RUN_DATE "${RUN_DIR}/meta.env" 2>/dev/null | cut -d= -f2 || date '+%Y-%m-%d')

  # 히스토리에 빈 실행 기록
  append_history "$run_date" "0" "[]" "null" "0" "null" ""

  # 브랜치 삭제
  if [[ -n "${BRANCH_NAME:-}" ]]; then
    log_phase "Phase4" "발견 없음 — 브랜치 삭제: ${BRANCH_NAME}"
    delete_branch "$BRANCH_NAME" 2>/dev/null || true
  fi

  log_phase "Phase4" "=== 발견 없음 정리 완료 ==="
}

# ── 에러 시 정리 함수 ────────────────────────────────────
run_phase4_error() {
  local error_msg="${1:-알 수 없는 에러}"
  log_phase "Phase4" "=== 에러 정리: ${error_msg} ==="

  local run_date
  run_date=$(grep RUN_DATE "${RUN_DIR}/meta.env" 2>/dev/null | cut -d= -f2 || date '+%Y-%m-%d')

  local pr_url
  pr_url=$(read_file_or_default "${RUN_DIR}/pr-url" "없음")

  # 히스토리 기록
  append_history "$run_date" "0" "[]" "null" "0" "null" ""

  # 텔레그램 알림
  send_telegram "🚨" "실행 중 오류 발생: ${error_msg}
PR: ${pr_url}
로그: ${LOG_FILE}"

  log_phase "Phase4" "=== 에러 정리 완료 ==="
}
