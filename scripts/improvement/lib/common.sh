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
    send_telegram "🚨" "전체 타임아웃 (${timeout_sec}s) 초과 — 파이프라인 강제 종료"
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
    eval "exec ${LOCK_FD}>&-" 2>/dev/null || true
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

# Claude 세션 exit code 해석
interpret_claude_exit() {
  local code="$1"
  case "$code" in
    0)   echo "success" ;;
    124) echo "timeout" ;;
    137) echo "killed" ;;
    *)   echo "error:${code}" ;;
  esac
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

# 브랜치 삭제 (로컬 + 리모트)
delete_branch() {
  local branch="$1"
  git checkout "${BASE_BRANCH:-master}" 2>/dev/null || true
  git branch -D "$branch" 2>/dev/null || true
  git push origin --delete "$branch" 2>/dev/null || true
}
