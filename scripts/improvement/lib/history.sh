#!/usr/bin/env bash
# history.sh — history.jsonl 읽기/쓰기/요약 유틸리티
# source 해서 사용. common.sh가 먼저 로드되어야 함.

HISTORY_FILE="${PROJECT_ROOT:-.}/logs/daily-improvement/history.jsonl"

# ── 히스토리 기록 추가 ───────────────────────────────────
# append_history date issues categories approved fixCycles prUrl
append_history() {
  local date="$1"
  local issues="${2:-0}"
  local categories="${3:-[]}"
  local approved="${4:-null}"
  local fix_cycles="${5:-0}"
  local pr_url="${6:-null}"

  mkdir -p "$(dirname "$HISTORY_FILE")"

  # pr_url은 문자열이므로 따옴표 처리
  local pr_url_json
  if [[ "$pr_url" == "null" ]]; then
    pr_url_json="null"
  else
    pr_url_json="\"${pr_url}\""
  fi

  # approved는 boolean/null
  local approved_json
  case "$approved" in
    true|false|null) approved_json="$approved" ;;
    *) approved_json="null" ;;
  esac

  echo "{\"date\":\"${date}\",\"issues\":${issues},\"categories\":${categories},\"approved\":${approved_json},\"fixCycles\":${fix_cycles},\"mergedAt\":null,\"prUrl\":${pr_url_json}}" >> "$HISTORY_FILE"
}

# ── 최근 N일 히스토리 읽기 ───────────────────────────────
# 반환: jsonl 라인들 (최근 N일)
read_recent_history() {
  local days="${1:-$HISTORY_DAYS}"

  if [[ ! -f "$HISTORY_FILE" ]]; then
    return 0
  fi

  local cutoff_date
  cutoff_date=$(date -d "${days} days ago" '+%Y-%m-%d' 2>/dev/null || date -v-${days}d '+%Y-%m-%d' 2>/dev/null || echo "1970-01-01")

  while IFS= read -r line; do
    local entry_date
    entry_date=$(echo "$line" | grep -o '"date":"[^"]*"' | cut -d'"' -f4)
    if [[ ! "$entry_date" < "$cutoff_date" ]]; then
      echo "$line"
    fi
  done < "$HISTORY_FILE"
}

# ── 히스토리 요약 생성 (Improver 프롬프트용) ─────────────
# $RUN_DIR/history-summary.txt에 기록
build_history_summary() {
  local output_file="${RUN_DIR}/history-summary.txt"

  if [[ ! -f "$HISTORY_FILE" ]]; then
    echo "실행 이력 없음 (첫 실행)" > "$output_file"
    return 0
  fi

  {
    echo "## 최근 실행 이력"
    echo ""

    local has_entries=false
    local total_runs=0
    local total_issues=0
    local approved_count=0
    local no_finding_count=0
    local category_counts=""

    while IFS= read -r line; do
      has_entries=true
      total_runs=$((total_runs + 1))

      local date issues categories approved fix_cycles merged
      date=$(echo "$line" | grep -o '"date":"[^"]*"' | cut -d'"' -f4)
      issues=$(echo "$line" | grep -o '"issues":[0-9]*' | cut -d: -f2)
      categories=$(echo "$line" | grep -o '"categories":\[[^]]*\]' | sed 's/"categories"://')
      approved=$(echo "$line" | grep -o '"approved":[a-z]*' | cut -d: -f2)
      fix_cycles=$(echo "$line" | grep -o '"fixCycles":[0-9]*' | cut -d: -f2)
      merged=$(echo "$line" | grep -o '"mergedAt":[^,}]*' | cut -d: -f2-)

      total_issues=$((total_issues + issues))

      # 카테고리 집계
      if [[ "$categories" != "[]" ]]; then
        category_counts="${category_counts} ${categories}"
      fi

      if [[ "$approved" == "true" ]]; then
        approved_count=$((approved_count + 1))
      fi

      if [[ "$issues" == "0" ]]; then
        no_finding_count=$((no_finding_count + 1))
      fi

      # 줄별 요약
      local status_emoji
      if [[ "$issues" == "0" ]]; then
        status_emoji="발견 없음"
      elif [[ "$approved" == "true" ]]; then
        if [[ "$merged" != "null" && "$merged" != "" ]]; then
          status_emoji="승인, 머지됨"
        else
          status_emoji="승인"
        fi
      elif [[ "$approved" == "false" ]]; then
        status_emoji="${fix_cycles}회 수정 후 미승인"
      else
        status_emoji="진행 중"
      fi

      echo "- ${date}: ${issues}건 ${categories} → ${status_emoji}"
    done < <(read_recent_history)

    if [[ "$has_entries" == "false" ]]; then
      echo "실행 이력 없음"
      return 0
    fi

    echo ""
    echo "## 개선 방향 참고"
    echo ""

    # 통계 기반 방향 제시
    if [[ $total_runs -gt 0 ]]; then
      echo "- 최근 ${HISTORY_DAYS:-7}일간 ${total_runs}회 실행, 총 ${total_issues}건 발견"
      if [[ $approved_count -gt 0 ]]; then
        echo "- 승인율: ${approved_count}/${total_runs}"
      fi
      if [[ $no_finding_count -ge 3 ]]; then
        echo "- 최근 발견 없음 ${no_finding_count}회 — 분석 범위 확장 검토 필요"
      fi
    fi

    # 카테고리별 빈도
    if [[ -n "$category_counts" ]]; then
      echo ""
      echo "카테고리별 발견 빈도:"
      echo "$category_counts" | tr '[]",' '\n' | grep -v '^$' | sort | uniq -c | sort -rn | while read -r count cat; do
        echo "  - ${cat}: ${count}건"
      done
    fi
  } > "$output_file"
}

# ── 이전 PR 머지 여부 업데이트 ───────────────────────────
update_merged_status() {
  if [[ ! -f "$HISTORY_FILE" ]]; then
    return 0
  fi

  local tmp_file="${HISTORY_FILE}.tmp"
  local updated=false

  while IFS= read -r line; do
    local merged_at pr_url
    merged_at=$(echo "$line" | grep -o '"mergedAt":[^,}]*' | cut -d: -f2-)
    pr_url=$(echo "$line" | grep -o '"prUrl":"[^"]*"' | cut -d'"' -f4)

    if [[ "$merged_at" == "null" && -n "$pr_url" ]]; then
      # PR 번호 추출
      local pr_number
      pr_number=$(echo "$pr_url" | grep -o '[0-9]*$')
      if [[ -n "$pr_number" ]]; then
        local pr_state
        pr_state=$(gh pr view "$pr_number" --json state --jq '.state' 2>/dev/null || echo "UNKNOWN")
        if [[ "$pr_state" == "MERGED" ]]; then
          local now
          now=$(date '+%Y-%m-%dT%H:%M:%S')
          line=$(echo "$line" | sed "s|\"mergedAt\":null|\"mergedAt\":\"${now}\"|")
          updated=true
        fi
      fi
    fi
    echo "$line"
  done < "$HISTORY_FILE" > "$tmp_file"

  if [[ "$updated" == "true" ]]; then
    mv "$tmp_file" "$HISTORY_FILE"
    log "히스토리 머지 상태 업데이트 완료"
  else
    rm -f "$tmp_file"
  fi
}
