#!/usr/bin/env bash
# Daily Improvement — 멀티 Phase 자율 파이프라인
# 분석 → 이슈 → 브랜치 → 수정 → PR → 리뷰 → 보고서 → 머지 요청
#
# 사용법:
#   bash scripts/daily-improvement.sh          # 수동 실행
#   crontab: 0 15 * * * /path/to/scripts/daily-improvement.sh  # KST 00:00
#
# 사전 조건:
#   - claude login (Max Plan OAuth)
#   - gh auth login (GitHub CLI)
#   - npm ci (의존성 설치)
#
# Phase 구조:
#   Phase 0: 사전 준비 (git pull, npm ci, 데이터 수집, 브랜치 생성)
#   Phase 1: 분석 + 수정 + PR (Claude Improver)
#   Phase 2: 독립 리뷰 (Claude Reviewer)
#   Phase 3: 수정 루프 (Fixer + Re-reviewer, 최대 3사이클)
#   Phase 4: 보고서 + 머지 요청 (텔레그램 알림)

set -euo pipefail

# ── 경로 설정 ──────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
IMPROVEMENT_DIR="$SCRIPT_DIR/improvement"
LOG_DIR="$PROJECT_ROOT/logs/daily-improvement"
LOG_FILE="$LOG_DIR/$(date +%Y-%m-%d).log"
LOCK_FILE="/tmp/gv-daily-improvement.lock"

mkdir -p "$LOG_DIR"

export SCRIPT_DIR PROJECT_ROOT IMPROVEMENT_DIR LOG_DIR LOG_FILE

# ── 설정 로드 ──────────────────────────────────────────────
source "$IMPROVEMENT_DIR/config.env"

# ── 라이브러리 로드 ────────────────────────────────────────
source "$IMPROVEMENT_DIR/lib/common.sh"
source "$IMPROVEMENT_DIR/lib/history.sh"
source "$IMPROVEMENT_DIR/lib/prompts.sh"

# ── Phase 스크립트 로드 ────────────────────────────────────
source "$IMPROVEMENT_DIR/phase0-prepare.sh"
source "$IMPROVEMENT_DIR/phase1-improve.sh"
source "$IMPROVEMENT_DIR/phase2-review.sh"
source "$IMPROVEMENT_DIR/phase3-fix-loop.sh"
source "$IMPROVEMENT_DIR/phase4-report.sh"

# ── 동시 실행 방지 (flock) ─────────────────────────────────
exec 200>"$LOCK_FILE"
if ! flock -n 200; then
  echo "이미 실행 중 — 종료" >&2
  exit "$EXIT_ALREADY_RUNNING"
fi
LOCK_FD=200

# ── 정리 핸들러 등록 ──────────────────────────────────────
trap cleanup EXIT

# ── 메인 오케스트레이터 ───────────────────────────────────
log "=========================================="
log "=== Daily Improvement 파이프라인 시작 ==="
log "=========================================="

cd "$PROJECT_ROOT"

# Watchdog 시작
start_watchdog "$TOTAL_TIMEOUT"

# ── Phase 0: 사전 준비 ────────────────────────────────────
run_phase0
# RUN_DIR, BRANCH_NAME이 export됨

# ── Phase 1: 분석 + 수정 + PR ────────────────────────────
phase1_exit=0
run_phase1 || phase1_exit=$?

case "$phase1_exit" in
  "$EXIT_NO_FINDINGS")
    log "발견 없음 — 조용히 종료"
    run_phase4_no_findings
    exit 0
    ;;
  "$EXIT_LINT_FAIL"|"$EXIT_TEST_FAIL"|"$EXIT_TIMEOUT")
    log "Phase 1 실패 (code: ${phase1_exit})"
    run_phase4_error "Phase 1 실패 (code: ${phase1_exit})"
    exit "$phase1_exit"
    ;;
  "$EXIT_ERROR")
    log "Phase 1 에러"
    run_phase4_error "Phase 1 에러"
    exit "$EXIT_ERROR"
    ;;
  0)
    log "Phase 1 성공 — PR 생성됨"
    ;;
esac

# ── Phase 2: 독립 리뷰 ──────────────────────────────────
phase2_exit=0
run_phase2 || phase2_exit=$?

if [[ "$phase2_exit" -ne 0 ]]; then
  log "Phase 2 실패 (code: ${phase2_exit}) — Phase 4로 건너뜀"
fi

# ── Phase 3: 수정 루프 ──────────────────────────────────
phase3_exit=0
run_phase3 || phase3_exit=$?

# Phase 3 결과는 리뷰 미승인이어도 계속 진행 (Phase 4에서 CEO에게 알림)

# ── Phase 4: 보고서 + 알림 ───────────────────────────────
run_phase4

log "=========================================="
log "=== Daily Improvement 파이프라인 완료 ==="
log "=========================================="
