#!/usr/bin/env bash
# history.sh — history.jsonl 읽기/쓰기/요약 유틸리티
# source 해서 사용. common.sh가 먼저 로드되어야 함.
# 핵심 로직은 Node.js (history-analyzer.js)에 위임.

HISTORY_FILE="${PROJECT_ROOT:-.}/logs/daily-improvement/history.jsonl"

# ── 히스토리 기록 추가 (Node.js 위임) ──────────────────────
# append_history date issues categories approved fixCycles prUrl stopReason totalRounds slaScore
append_history() {
  local date="$1"
  local issues="${2:-0}"
  local categories="${3:-[]}"
  local approved="${4:-null}"
  local fix_cycles="${5:-0}"
  local pr_url="${6:-null}"
  local stop_reason="${7:-}"
  local total_rounds="${8:-1}"
  local sla_score="${9:-null}"

  node "${SCRIPT_DIR}/lib/improvement/history-analyzer.js" append \
    "$HISTORY_FILE" "$date" "$issues" "$categories" "$approved" "$fix_cycles" "$pr_url" "$stop_reason" "$total_rounds" "$sla_score" \
    2>>"${LOG_FILE:-/dev/stderr}" || {
    log "WARNING: Node.js append_history 실패 — Shell fallback"
    mkdir -p "$(dirname "$HISTORY_FILE")"
    local approved_json
    case "$approved" in
      true|false|null) approved_json="$approved" ;;
      *) approved_json="null" ;;
    esac
    jq -nc \
      --arg date "$date" \
      --argjson issues "${issues:-0}" \
      --argjson categories "${categories:-[]}" \
      --argjson approved "$approved_json" \
      --argjson fixCycles "${fix_cycles:-0}" \
      --arg prUrl "${pr_url:-null}" \
      --arg stopReason "${stop_reason:-}" \
      --argjson totalRounds "${total_rounds:-1}" \
      --arg slaScore "${sla_score:-null}" \
      '{date: $date, issues: $issues, categories: $categories, approved: $approved, fixCycles: $fixCycles, mergedAt: null, prUrl: (if $prUrl == "null" then null else $prUrl end), stopReason: (if $stopReason == "" then null else $stopReason end), totalRounds: $totalRounds, slaScore: (if $slaScore == "null" then null else ($slaScore | tonumber) end)}' \
      >> "$HISTORY_FILE"
  }
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
    entry_date=$(echo "$line" | jq -r '.date')
    if [[ ! "$entry_date" < "$cutoff_date" ]]; then
      echo "$line"
    fi
  done < "$HISTORY_FILE"
}

# ── 히스토리 요약 생성 (Node.js 위임) ─────────────────────
# $RUN_DIR/history-summary.txt에 기록
build_history_summary() {
  local output_file="${RUN_DIR}/history-summary.txt"

  node "${SCRIPT_DIR}/lib/improvement/history-analyzer.js" summary \
    "$HISTORY_FILE" "${HISTORY_DAYS:-7}" > "$output_file" 2>>"${LOG_FILE:-/dev/stderr}" || {
    log "WARNING: Node.js build_history_summary 실패 — 기본값 사용"
    echo "실행 이력 없음 (첫 실행)" > "$output_file"
  }
}

# ── 이전 PR 머지 여부 업데이트 (Node.js 위임) ────────────
update_merged_status() {
  if [[ ! -f "$HISTORY_FILE" ]]; then
    return 0
  fi

  node "${SCRIPT_DIR}/lib/improvement/history-analyzer.js" update-merged \
    "$HISTORY_FILE" 2>>"${LOG_FILE:-/dev/stderr}" || {
    log "WARNING: Node.js update_merged_status 실패 — 건너뜀"
  }
}
