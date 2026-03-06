#!/usr/bin/env bash
# common.sh — Daily Improvement 공통 함수 라이브러리
# source 해서 사용. 단독 실행 불가.

# ── Exit 코드 ────────────────────────────────────────────
export EXIT_OK=0
export EXIT_ERROR=1
export EXIT_NO_FINDINGS=10
export EXIT_LINT_FAIL=11
export EXIT_TEST_FAIL=12
export EXIT_REVIEW_GIVEUP=13
export EXIT_TIMEOUT=14
export EXIT_ALREADY_RUNNING=15

# ── 로깅 ─────────────────────────────────────────────────
log() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" | tee -a "${LOG_FILE:-/dev/stderr}"
}

log_phase() {
  local phase="$1"; shift
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] [$phase] $*" | tee -a "${LOG_FILE:-/dev/stderr}"
}

# ── 텔레그램 알림 ────────────────────────────────────────
send_telegram() {
  local emoji="$1"
  local message="$2"

  if [[ -z "${TELEGRAM_BOT_TOKEN:-}" || -z "${TELEGRAM_CHAT_ID:-}" ]]; then
    log "TELEGRAM_BOT_TOKEN/CHAT_ID 미설정 — 알림 건너뜀"
    return 0
  fi

  local text="${emoji} *Daily Improvement*
${message}"

  curl -s -X POST \
    "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage" \
    --data-urlencode "chat_id=${TELEGRAM_CHAT_ID}" \
    --data-urlencode "parse_mode=Markdown" \
    --data-urlencode "text=${text}" \
    > /dev/null 2>&1 || true
}

# ── 안전장치 ─────────────────────────────────────────────
assert_not_on_master() {
  local current_branch
  current_branch=$(git branch --show-current)
  if [[ "$current_branch" == "master" || "$current_branch" == "main" ]]; then
    log "ERROR: master/main 브랜치에서 직접 커밋 불가"
    exit "$EXIT_ERROR"
  fi
}

# ── timeout 호환 (macOS/Linux) ────────────────────────────
# macOS에는 GNU timeout이 없음 → gtimeout (brew install coreutils) 또는 perl fallback
if ! command -v timeout &>/dev/null; then
  if command -v gtimeout &>/dev/null; then
    timeout() { gtimeout "$@"; }
  else
    # perl fallback: 첫 인자가 숫자면 타임아웃 초, 나머지는 명령
    timeout() {
      local secs="$1"; shift
      perl -e "alarm $secs; exec @ARGV" -- "$@"
    }
  fi
fi

# ── Watchdog (전체 타임아웃) ──────────────────────────────
# 사용법: start_watchdog $TOTAL_TIMEOUT
# 반환: watchdog PID (글로벌 WATCHDOG_PID에 저장)
WATCHDOG_PID=""
MAIN_PID=$$

start_watchdog() {
  local timeout_sec="$1"
  local parent_pid="$MAIN_PID"
  (
    sleep "$timeout_sec"
    log "WATCHDOG: 전체 타임아웃 (${timeout_sec}s) 초과"
    log_phase "Watchdog" "전체 제한 시간 초과 — 자동 종료"
    # 부모 프로세스 그룹 전체 종료
    kill -TERM -- "-$(ps -o pgid= -p "$parent_pid" 2>/dev/null | tr -d ' ')" 2>/dev/null \
      || kill -TERM "$parent_pid" 2>/dev/null || true
  ) &
  WATCHDOG_PID=$!
}

stop_watchdog() {
  if [[ -n "$WATCHDOG_PID" ]]; then
    kill "$WATCHDOG_PID" 2>/dev/null || true
    wait "$WATCHDOG_PID" 2>/dev/null || true
    WATCHDOG_PID=""
  fi
}

# ── 정리 ─────────────────────────────────────────────────
cleanup() {
  stop_watchdog

  # RUN_DIR 정리 (디버깅용으로 보존할 수도 있음)
  if [[ -n "${RUN_DIR:-}" && -d "${RUN_DIR:-}" ]]; then
    log "RUN_DIR 보존: $RUN_DIR"
  fi

  # 30일 이전 로그 정리
  if [[ -n "${LOG_DIR:-}" && -d "${LOG_DIR:-}" ]]; then
    find "$LOG_DIR" -name "*.log" -mtime +30 -delete 2>/dev/null || true
  fi

  # flock 해제 + 파일 삭제
  if [[ -n "${LOCK_FD:-}" ]]; then
    exec 200>&- 2>/dev/null || true
  fi
  rm -f "${LOCK_FILE:-}" 2>/dev/null || true
}

# ── 유틸리티 ─────────────────────────────────────────────

# 파일에서 값 읽기 (없으면 기본값)
read_file_or_default() {
  local file="$1"
  local default="${2:-}"
  if [[ -f "$file" ]]; then
    cat "$file"
  else
    echo "$default"
  fi
}

# RUN_DIR 내 파일에 값 쓰기
write_run_file() {
  local name="$1"
  local value="$2"
  echo "$value" > "${RUN_DIR}/${name}"
}

# Claude 세션 exit code 해석 (Node.js 모듈 위임)
interpret_claude_exit() {
  local code="$1"
  node "${SCRIPT_DIR}/lib/review-parser.js" interpret-exit "$code" 2>/dev/null \
    || echo "error:${code}"
}

# git diff로 변경사항 있는지 확인
has_changes() {
  local count
  count=$(git diff --name-only HEAD 2>/dev/null | wc -l)
  [[ "$count" -gt 0 ]]
}

# 브랜치 존재 확인 (로컬)
branch_exists() {
  git rev-parse --verify "$1" > /dev/null 2>&1
}

# PR 리뷰 상태를 본문 태그 기반으로 판정
# GitHub API state → 본문 [APPROVED]/[CHANGES_REQUESTED] 태그 fallback
# 본인 PR에서는 --approve가 COMMENTED로 강제되므로 본문 태그를 파싱
parse_review_status() {
  local pr_number="$1"

  # 1차: GitHub API review state (본인 PR 아닌 경우 정상 동작)
  local api_state
  api_state=$(gh pr view "$pr_number" --json reviews \
    --jq '.reviews | map(select(.state == "APPROVED" or .state == "CHANGES_REQUESTED")) | last | .state' \
    2>/dev/null || echo "")

  if [[ "$api_state" == "APPROVED" || "$api_state" == "CHANGES_REQUESTED" ]]; then
    echo "$api_state"
    return 0
  fi

  # 2차: 본문 태그 파싱 (본인 PR — COMMENTED 상태인 경우)
  local last_body
  last_body=$(gh pr view "$pr_number" --json reviews \
    --jq '.reviews | if length == 0 then "" else (last | .body // "") end' \
    2>/dev/null || echo "")

  if echo "$last_body" | grep -q '\[APPROVED\]'; then
    echo "APPROVED"
  elif echo "$last_body" | grep -q '\[CHANGES_REQUESTED\]'; then
    echo "CHANGES_REQUESTED"
  elif echo "$last_body" | grep -q '\[MUST\]'; then
    echo "CHANGES_REQUESTED"
  else
    echo "UNKNOWN"
  fi
}

# review-body 파일에서 [MUST] 이슈 개수 카운트 (Node.js 모듈 위임)
count_must_issues() {
  local file="$1"
  [[ -f "$file" ]] || { echo "0"; return; }
  node "${SCRIPT_DIR}/lib/review-parser.js" count-must "$file" 2>/dev/null \
    || echo "0"
}

# ── 긴급 정지 체크 ──────────────────────────────────────
EMERGENCY_STOP_FILE="/tmp/gv-daily-improvement.stop"

check_emergency_stop() {
  if [[ -f "$EMERGENCY_STOP_FILE" ]]; then
    log "긴급 정지 파일 감지 — 파이프라인 중단"
    log_phase "Emergency" "긴급 정지 파일 감지 — 파이프라인 중단"
    rm -f "$EMERGENCY_STOP_FILE" 2>/dev/null || true
    exit "$EXIT_ERROR"
  fi
}

# ── gh CLI 재시도 래퍼 ──────────────────────────────────
retry_gh() {
  local max_retries=3
  local delay=5
  local attempt=0
  while [[ "$attempt" -lt "$max_retries" ]]; do
    if "$@" 2>>"${LOG_FILE:-/dev/stderr}"; then
      return 0
    fi
    attempt=$((attempt + 1))
    if [[ "$attempt" -lt "$max_retries" ]]; then
      log "gh 명령 실패 (시도 ${attempt}/${max_retries}) — ${delay}초 후 재시도"
      sleep "$delay"
      delay=$((delay * 2))
    fi
  done
  log "gh 명령 최종 실패: $*"
  return 1
}

# 브랜치 삭제 (로컬 + 리모트)
delete_branch() {
  local branch="$1"
  git checkout "${BASE_BRANCH:-master}" 2>/dev/null || true
  git branch -D "$branch" 2>/dev/null || true
  git push origin --delete "$branch" 2>/dev/null || true
}

# ── Claude 세션 오류 분류 ───────────────────────────
# 반환: "session_limit" | "weekly_limit" | "auth_error" | "network" | "timeout" | "killed" | "success" | "error"
#
# 감지 패턴 (Claude Code CLI 출력 기반, 버전 변경 시 업데이트 필요):
#   session_limit: "session limit", "session exhausted", "turn limit"
#   weekly_limit:  "weekly limit", "rate limit", "quota exceeded", "usage limit"
#   auth_error:    "auth", "unauthorized", "401", "login required"
#   network:       "network", "ETIMEDOUT", "ECONNRESET", "connection"
#   timeout:       exit code 124 (GNU timeout)
#   killed:        exit code 137 (SIGKILL)
classify_claude_error() {
  local exit_code="$1"
  local log_tail="${2:-}"

  case "$exit_code" in
    0) echo "success"; return ;;
    124) echo "timeout"; return ;;
    137) echo "killed"; return ;;
  esac

  if [[ -n "$log_tail" ]]; then
    if echo "$log_tail" | grep -qi "session limit\|session.*exhaust\|turn limit"; then
      echo "session_limit"; return
    fi
    if echo "$log_tail" | grep -qi "weekly.*limit\|rate.*limit\|quota.*exceed\|usage.*limit"; then
      echo "weekly_limit"; return
    fi
    if echo "$log_tail" | grep -qi "auth\|unauthorized\|401\|login.*required"; then
      echo "auth_error"; return
    fi
    if echo "$log_tail" | grep -qi "network\|ETIMEDOUT\|ECONNRESET\|connection"; then
      echo "network"; return
    fi
  fi

  echo "error"
}

# ── Checkpoint 시스템 ───────────────────────────────
CHECKPOINT_FILE=""

init_checkpoint() {
  CHECKPOINT_FILE="${RUN_DIR}/checkpoint.json"
  if [[ -f "$CHECKPOINT_FILE" ]]; then
    log "기존 체크포인트 발견 — 재개 모드"
    return 0
  fi
  echo '{}' > "$CHECKPOINT_FILE"
}

save_checkpoint() {
  local round="$1"
  local phase="$2"
  local status="$3"
  local extra="${4:-}"

  jq -nc \
    --argjson round "$round" \
    --arg phase "$phase" \
    --arg status "$status" \
    --arg timestamp "$(date -Iseconds 2>/dev/null || date '+%Y-%m-%dT%H:%M:%S')" \
    --arg extra "$extra" \
    --arg prNumber "$(read_file_or_default "${RUN_DIR}/pr-number" "")" \
    --arg branchName "${BRANCH_NAME:-}" \
    '{round: $round, phase: $phase, status: $status, timestamp: $timestamp,
      extra: $extra, prNumber: $prNumber, branchName: $branchName}' \
    > "$CHECKPOINT_FILE"
}

read_checkpoint() {
  local key="$1"
  local default="${2:-}"
  if [[ -f "$CHECKPOINT_FILE" ]]; then
    jq -r ".${key} // \"${default}\"" "$CHECKPOINT_FILE" 2>/dev/null || echo "$default"
  else
    echo "$default"
  fi
}

# ── Claude 세션 안전 실행 래퍼 ──────────────────────
# run_claude_safe <prompt> <phase_name> [output_file] [timeout_sec] [use_permissions]
# 반환: Claude exit code
run_claude_safe() {
  local prompt="$1"
  local phase_name="$2"
  local output_file="${3:-/dev/null}"
  local timeout_sec="${4:-$PHASE1_TIMEOUT}"
  local use_permissions="${5:-yes}"

  local perm_flag=""
  if [[ "$use_permissions" == "yes" ]]; then
    perm_flag="--dangerously-skip-permissions"
  fi

  local attempt=0
  local claude_exit=0
  local error_class=""

  while [[ "$attempt" -lt "$SESSION_MAX_RETRIES" ]]; do
    attempt=$((attempt + 1))
    claude_exit=0

    if [[ "$output_file" != "/dev/null" ]]; then
      timeout "$timeout_sec" claude -p "$prompt" $perm_flag > "$output_file" 2>>"$LOG_FILE" || claude_exit=$?
    else
      timeout "$timeout_sec" claude -p "$prompt" $perm_flag >> "$LOG_FILE" 2>&1 || claude_exit=$?
    fi

    local log_tail
    log_tail=$(tail -20 "$LOG_FILE" 2>/dev/null || echo "")

    error_class=$(classify_claude_error "$claude_exit" "$log_tail")

    case "$error_class" in
      success|timeout|killed)
        return "$claude_exit"
        ;;
      session_limit)
        log_phase "$phase_name" "세션 한도 도달 (시도 ${attempt}/${SESSION_MAX_RETRIES})"
        if [[ "$attempt" -lt "$SESSION_MAX_RETRIES" ]]; then
          local delay=$((SESSION_RETRY_DELAY * attempt))
          log_phase "$phase_name" "${delay}초 대기 후 새 세션으로 재시도 (exponential backoff)..."
          log_phase "$phase_name" "세션 한도 도달 — ${delay}초 후 재시도 (${attempt}/${SESSION_MAX_RETRIES})"
          sleep "$delay"
        fi
        ;;
      weekly_limit)
        log_phase "$phase_name" "주간 한도 도달 — 재시도 불가"
        log_phase "$phase_name" "주간 한도 소진 — 파이프라인 일시 중단"
        save_checkpoint "${CURRENT_ROUND:-1}" "$phase_name" "weekly_limit_reached"
        return "$claude_exit"
        ;;
      auth_error)
        log_phase "$phase_name" "인증 오류 — 재시도 불가"
        log_phase "$phase_name" "인증 오류 — claude login 필요"
        return "$claude_exit"
        ;;
      network)
        log_phase "$phase_name" "네트워크 오류 (시도 ${attempt}/${SESSION_MAX_RETRIES})"
        if [[ "$attempt" -lt "$SESSION_MAX_RETRIES" ]]; then
          local delay=$((SESSION_RETRY_DELAY * attempt))
          log_phase "$phase_name" "${delay}초 대기 후 재시도 (exponential backoff)..."
          sleep "$delay"
        fi
        ;;
      *)
        return "$claude_exit"
        ;;
    esac
  done

  log_phase "$phase_name" "최대 재시도 초과 (${SESSION_MAX_RETRIES}회)"
  return "$claude_exit"
}
