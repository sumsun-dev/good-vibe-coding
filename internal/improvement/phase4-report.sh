#!/usr/bin/env bash
# phase4-report.sh — 보고서 + 텔레그램 알림 + 히스토리 기록 + 정리
# 오케스트레이터에서 source 해서 호출

# ── 카테고리 요약 생성 ────────────────────────────────────
# 이슈 라벨에서 카테고리 추출 → 한글 매핑 → 요약 문장 반환
build_category_summary() {
  local categories_json="$1"
  local issue_count="$2"

  local parts=()
  if echo "$categories_json" | jq -e 'map(select(. == "security")) | length > 0' > /dev/null 2>&1; then
    parts+=("보안 취약점")
  fi
  if echo "$categories_json" | jq -e 'map(select(. == "performance")) | length > 0' > /dev/null 2>&1; then
    parts+=("성능 개선")
  fi
  if echo "$categories_json" | jq -e 'map(select(. == "quality")) | length > 0' > /dev/null 2>&1; then
    parts+=("코드 품질")
  fi
  if echo "$categories_json" | jq -e 'map(select(. == "bug" or . == "logic")) | length > 0' > /dev/null 2>&1; then
    parts+=("버그 수정")
  fi

  local summary
  if [[ ${#parts[@]} -gt 0 ]]; then
    local joined
    joined=$(IFS=', '; echo "${parts[*]}")
    summary="${joined} 등 ${issue_count}건을 발견하고 수정했어요."
  else
    summary="${issue_count}건의 개선점을 발견하고 수정했어요."
  fi
  echo "$summary"
}

# ── 카테고리 요약 (마크다운) ──────────────────────────────
build_category_summary_markdown() {
  local categories_json="$1"
  local issue_count="$2"

  local lines=()
  if echo "$categories_json" | jq -e 'map(select(. == "security")) | length > 0' > /dev/null 2>&1; then
    local cnt
    cnt=$(echo "$categories_json" | jq '[.[] | select(. == "security")] | length')
    lines+=("- 보안 취약점 ${cnt}건")
  fi
  if echo "$categories_json" | jq -e 'map(select(. == "performance")) | length > 0' > /dev/null 2>&1; then
    local cnt
    cnt=$(echo "$categories_json" | jq '[.[] | select(. == "performance")] | length')
    lines+=("- 성능 개선 ${cnt}건")
  fi
  if echo "$categories_json" | jq -e 'map(select(. == "quality")) | length > 0' > /dev/null 2>&1; then
    local cnt
    cnt=$(echo "$categories_json" | jq '[.[] | select(. == "quality")] | length')
    lines+=("- 코드 품질 ${cnt}건")
  fi
  if echo "$categories_json" | jq -e 'map(select(. == "bug" or . == "logic")) | length > 0' > /dev/null 2>&1; then
    local cnt
    cnt=$(echo "$categories_json" | jq '[.[] | select(. == "bug" or . == "logic")] | length')
    lines+=("- 버그 수정 ${cnt}건")
  fi

  # 매칭 안 된 카테고리 수 계산
  local known_count
  known_count=$(echo "$categories_json" | jq '[.[] | select(. == "security" or . == "performance" or . == "quality" or . == "bug" or . == "logic")] | length')
  local total
  total=$(echo "$categories_json" | jq 'length')
  local other_count=$((total - known_count))
  if [[ "$other_count" -gt 0 ]]; then
    lines+=("- 기타 개선 ${other_count}건")
  fi

  if [[ ${#lines[@]} -gt 0 ]]; then
    printf '%s\n' "${lines[@]}"
  else
    echo "- 코드 개선 ${issue_count}건"
  fi
}

# ── 검토 결과 친화적 변환 ────────────────────────────────
build_review_result_friendly() {
  local review_status="$1"
  local review_body_file="$2"

  case "$review_status" in
    APPROVED)
      echo "자동 검토를 통과했습니다. 확인 후 머지해주세요."
      ;;
    CHANGES_REQUESTED)
      local result="자동 검토에서 추가 확인이 필요한 부분이 있습니다."$'\n'

      if [[ -f "$review_body_file" ]]; then
        local must_items should_items
        must_items=$(grep -E '\[MUST\]' "$review_body_file" 2>/dev/null | sed 's/^[[:space:]]*//' | sed 's/\[MUST\][[:space:]]*//' || echo "")
        should_items=$(grep -E '\[SHOULD\]' "$review_body_file" 2>/dev/null | sed 's/^[[:space:]]*//' | sed 's/\[SHOULD\][[:space:]]*//' || echo "")

        if [[ -n "$must_items" ]]; then
          result+=$'\n'"**필수 확인 사항:**"$'\n'
          while IFS= read -r line; do
            [[ -n "$line" ]] && result+="- ${line}"$'\n'
          done <<< "$must_items"
        fi
        if [[ -n "$should_items" ]]; then
          result+=$'\n'"**추가 개선 제안:**"$'\n'
          while IFS= read -r line; do
            [[ -n "$line" ]] && result+="- ${line}"$'\n'
          done <<< "$should_items"
        fi
      fi

      echo "$result"
      ;;
    *)
      echo "검토 결과를 확인할 수 없습니다. 직접 확인해주세요."
      ;;
  esac
}

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

  # 카테고리 수집 (이슈별 라벨 → 중복 포함 배열)
  local categories="[]"
  if [[ -f "${RUN_DIR}/issues-created.txt" ]]; then
    local cats
    cats=$(while read -r num; do
      gh issue view "$num" --json labels --jq '.labels[].name' 2>/dev/null
    done < "${RUN_DIR}/issues-created.txt" | grep -E '^(quality|security|performance|bug|logic)$' || echo "")

    if [[ -n "$cats" ]]; then
      categories=$(echo "$cats" | jq -Rnc '[inputs | select(length > 0)]')
    fi
  fi

  # 카테고리 요약 생성
  local category_summary
  category_summary=$(build_category_summary "$categories" "$issue_count")

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
      issues_section=$'\n### 발견한 문제 목록\n\n'
      while read -r num; do
        local issue_title issue_labels
        issue_title=$(gh issue view "$num" --json title --jq '.title' 2>/dev/null || echo "제목 조회 실패")
        issue_labels=$(gh issue view "$num" --json labels --jq '[.labels[].name] | join(", ")' 2>/dev/null || echo "")
        if [[ -n "$issue_labels" ]]; then
          issues_section+="- closes #${num} [${issue_labels}] ${issue_title}"$'\n'
        else
          issues_section+="- closes #${num} ${issue_title}"$'\n'
        fi
      done < "${RUN_DIR}/issues-created.txt"
    fi

    # 변경 파일 목록
    local diff_stat_section=""
    local diff_stat
    diff_stat=$(git diff --stat "${BASE_BRANCH}..HEAD" 2>/dev/null || echo "")
    if [[ -n "$diff_stat" ]]; then
      diff_stat_section=$'\n### 수정된 파일\n\n```\n'"${diff_stat}"$'\n```\n'
    fi

    # 카테고리 요약 (마크다운)
    local category_summary_md
    category_summary_md=$(build_category_summary_markdown "$categories" "$issue_count")

    # 검토 결과 (친화적)
    local review_result_friendly
    review_result_friendly=$(build_review_result_friendly "$review_status" "${RUN_DIR}/review-body.txt")

    # 검토 결과 섹션
    local review_section=""
    if [[ -n "$review_result_friendly" ]]; then
      review_section=$'\n### 검토 결과\n\n'"${review_result_friendly}"
    fi

    local pr_body
    pr_body=$(cat <<BODY_EOF
## 오늘의 코드 개선 요약

${run_date}에 자동으로 코드를 점검하고 개선했습니다.

### 무엇을 개선했나요?

${category_summary_md}

> 총 ${issue_count}건의 개선점을 발견하고, ${file_count}개 파일을 수정했습니다.
${issues_section}${diff_stat_section}${review_section}
---

- [ ] 수정 내용 확인
- [ ] 머지 승인

Generated by Daily Improvement Pipeline
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
        else
          log_phase "Phase4" "자동 머지 실패 — 수동 확인 필요"
        fi
      fi
    fi
  fi

  # ── 텔레그램 알림 ─────────────────────────────────────
  case "$review_status" in
    APPROVED)
      send_telegram "" "오늘의 코드 개선이 완료되었습니다!

${category_summary}
수정한 파일: ${file_count}개

확인 후 승인해주세요:
${pr_url}"
      ;;
    CHANGES_REQUESTED)
      send_telegram "" "오늘의 코드 개선 결과를 알려드려요.

${category_summary}
일부 수정이 완벽하지 않아 확인이 필요합니다.

직접 확인해주세요:
${pr_url}"
      ;;
    *)
      send_telegram "" "오늘의 코드 개선 결과를 알려드려요.

${category_summary}
수정한 파일: ${file_count}개

확인해주세요:
${pr_url}"
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

  # 텔레그램 알림
  send_telegram "" "오늘은 추가로 개선할 점을 찾지 못했어요.
코드가 깨끗한 상태입니다!"

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
  send_telegram "" "코드 점검 중 문제가 생겼어요.
다음 점검 때 자동으로 다시 시도합니다."

  log_phase "Phase4" "=== 에러 정리 완료 ==="
}
