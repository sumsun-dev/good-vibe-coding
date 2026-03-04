#!/usr/bin/env bash
# Daily Improvement — 멀티 Phase 자율 파이프라인 (Round Loop)
# Phase 0 → [Round Loop: Phase 1 → 1.5 → 2 → 3 → Eval] → Phase 4
#
# 사용법:
#   bash internal/daily-improvement.sh          # 수동 실행
#   crontab: 0 15 * * * /path/to/internal/daily-improvement.sh  # KST 00:00
#
# 사전 조건:
#   - claude login (Max Plan OAuth)
#   - gh auth login (GitHub CLI)
#   - npm ci (의존성 설치)
#
# Phase 구조:
#   Phase 0: 사전 준비 (git pull, npm ci, 데이터 수집, 브랜치 생성)
#   ┌─── Round Loop (SLA 달성까지 반복) ───────────────┐
#   │ Phase 1: 분석 + 수정 + PR (Claude Improver)       │
#   │ Phase 1.5: 이슈 검증 (issue-manager)              │
#   │ Phase 2: 독립 리뷰 (Claude Reviewer)              │
#   │ Phase 3: 수정 루프 (Fixer + Re-reviewer)          │
#   │ Phase Eval: 7영역 SLA 평가 → 달성/정체/미달 판정  │
#   └──────────────────────────────────────────────────┘
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
source "$IMPROVEMENT_DIR/phase-eval.sh"

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

# 파이프라인 시작 시각 (잔여 시간 계산용)
export PIPELINE_START=$(date +%s)

# Watchdog 시작
start_watchdog "$TOTAL_TIMEOUT"

send_telegram "" "오늘의 자동 코드 개선을 시작합니다"

# ── Phase 0: 사전 준비 ────────────────────────────────────
phase0_exit=0
run_phase0 || phase0_exit=$?
if [[ "$phase0_exit" -ne 0 ]]; then
  # Phase 0 실패 시 RUN_DIR이 없을 수 있으므로 임시 생성
  if [[ -z "${RUN_DIR:-}" ]]; then
    RUN_DIR="/tmp/gv-improve-error-$(date '+%Y-%m-%d-%H%M%S')"
    mkdir -p "$RUN_DIR"
    echo "RUN_DATE=$(date '+%Y-%m-%d')" > "${RUN_DIR}/meta.env"
    export RUN_DIR
  fi
  run_phase4_error "Phase 0 실패 (code: ${phase0_exit})"
  exit "$phase0_exit"
fi
# RUN_DIR, BRANCH_NAME이 export됨

send_telegram "" "준비 완료 — 코드베이스 분석을 시작합니다"

check_emergency_stop

# ── 체크포인트 초기화 ──────────────────────────────────────
init_checkpoint

# ── Round Loop 상태 ────────────────────────────────────────
round=0
round_stop_reason=""
export CURRENT_ROUND=0

# 재개 모드: 이전 체크포인트에서 라운드 복원
resume_round=$(read_checkpoint "round" "0")
if [[ "$resume_round" -gt 0 ]]; then
  round=$((resume_round - 1))  # 실패한 라운드부터 재시작
  log "체크포인트에서 재개: Round ${resume_round}부터"
  send_telegram "" "이전 중단 지점에서 재개 (Round ${resume_round})"
fi

# ── 다음 라운드 가능 판정 ──────────────────────────────────
can_start_next_round() {
  # watchdog 잔여 시간 체크
  local elapsed=$(( $(date +%s) - PIPELINE_START ))
  local remaining=$(( TOTAL_TIMEOUT - elapsed ))
  local min_needed=$(( PHASE1_TIMEOUT + PHASE_EVAL_TIMEOUT + 600 ))
  if [[ "$remaining" -lt "$min_needed" ]]; then
    round_stop_reason="time_limit"; return 1
  fi
  # MAX_ROUNDS 체크 (0=무제한)
  if [[ "$MAX_ROUNDS" -gt 0 && "$round" -ge "$MAX_ROUNDS" ]]; then
    round_stop_reason="max_rounds"; return 1
  fi
  check_emergency_stop
  return 0
}

# ── Round Loop ─────────────────────────────────────────────
while can_start_next_round; do
  round=$((round + 1))
  export CURRENT_ROUND="$round"
  save_checkpoint "$round" "round_start" "in_progress"

  log "=========================================="
  log "=== Round ${round} 시작 ==="
  log "=========================================="

  if [[ "$round" -eq 1 ]]; then
    send_telegram "" "Round ${round}: 코드 분석 중"
  else
    send_telegram "" "Round ${round}: SLA 미달 영역 개선 중"
  fi

  # ── Phase 1: 분석 + 수정 ──────────────────────────────────
  phase1_exit=0
  run_phase1 || phase1_exit=$?

  # 세션 오류 분류
  error_class=$(classify_claude_error "$phase1_exit" "$(tail -20 "$LOG_FILE" 2>/dev/null || echo "")")
  if [[ "$error_class" == "weekly_limit" ]]; then
    save_checkpoint "$round" "phase1" "weekly_limit"
    round_stop_reason="weekly_limit"; break
  fi
  if [[ "$error_class" == "session_limit" ]]; then
    save_checkpoint "$round" "phase1" "session_limit_exhausted"
    round_stop_reason="session_limit"; break
  fi
  if [[ "$error_class" == "auth_error" ]]; then
    save_checkpoint "$round" "phase1" "auth_error"
    round_stop_reason="auth_error"; break
  fi

  # Phase 1 결과 처리
  case "$phase1_exit" in
    "$EXIT_NO_FINDINGS")
      if [[ "$round" -eq 1 ]]; then
        log "발견 없음 — 조용히 종료"
        run_phase4_no_findings
        exit 0
      else
        log "Round ${round}: 추가 발견 없음"
        round_stop_reason="no_findings"; break
      fi ;;
    "$EXIT_LINT_FAIL"|"$EXIT_TEST_FAIL"|"$EXIT_TIMEOUT")
      if [[ "$round" -eq 1 ]]; then
        log "Phase 1 실패 (code: ${phase1_exit})"
        run_phase4_error "Phase 1 실패 (code: ${phase1_exit})"
        exit "$phase1_exit"
      else
        log "Round ${round}: Phase 1 실패 — 이전 라운드 결과로 마무리"
        round_stop_reason="phase1_fail"; break
      fi ;;
    "$EXIT_ERROR")
      if [[ "$round" -eq 1 ]]; then
        log "Phase 1 에러"
        run_phase4_error "Phase 1 에러"
        exit "$EXIT_ERROR"
      else
        round_stop_reason="phase1_error"; break
      fi ;;
    0)
      log "Phase 1 성공 (Round ${round})"
      ;;
  esac

  save_checkpoint "$round" "phase1" "completed"

  # ── Phase 1.5: 이슈 검증 ──────────────────────────────────
  node "${SCRIPT_DIR}/lib/issue-manager.js" verify-all \
    "$RUN_DIR" "$round" >> "$LOG_FILE" 2>&1 || true

  check_emergency_stop

  # ── Phase 2: 독립 리뷰 ────────────────────────────────────
  local_pr_number=$(read_file_or_default "${RUN_DIR}/pr-number" "?")
  send_telegram "" "Round ${round}: 품질 검토 중 (PR #${local_pr_number})"

  phase2_exit=0
  run_phase2 || phase2_exit=$?
  save_checkpoint "$round" "phase2" "completed"

  if [[ "$phase2_exit" -ne 0 ]]; then
    log "Phase 2 실패 (code: ${phase2_exit}) — Phase 3 건너뜀"
  fi

  check_emergency_stop

  # ── Phase 3: 수정 루프 ────────────────────────────────────
  if [[ "$phase2_exit" -eq 0 ]]; then
    send_telegram "" "Round ${round}: 피드백 반영 중 (PR #${local_pr_number})"
    run_phase3 || true
  fi
  save_checkpoint "$round" "phase3" "completed"

  # ── Phase Eval: SLA 평가 ──────────────────────────────────
  eval_exit=0
  run_phase_eval "$round" || eval_exit=$?

  if [[ "$eval_exit" -eq 0 ]]; then
    sla_met=$(read_file_or_default "${RUN_DIR}/sla-met" "false")
    if [[ "$sla_met" == "true" ]]; then
      round_stop_reason="sla_met"
      log "SLA 달성 — Round Loop 종료"
      break
    fi
    # stagnant 또는 기타 → 루프 종료
    round_stop_reason=$(read_file_or_default "${RUN_DIR}/round-stop-reason" "stagnant")
    log "Round Loop 종료: ${round_stop_reason}"
    break
  fi

  # eval_exit=1 → SLA 미달, 다음 라운드로
  log "SLA 미달 — 다음 라운드 진행"
done

# ── 라운드 결과 기록 ───────────────────────────────────────
write_run_file "total-rounds" "$round"
write_run_file "round-stop-reason" "${round_stop_reason:-completed}"

log "=========================================="
log "=== Round Loop 종료: ${round}라운드, 사유: ${round_stop_reason:-completed} ==="
log "=========================================="

# ── Phase 4: 보고서 + 알림 ────────────────────────────────
run_phase4

log "=========================================="
log "=== Daily Improvement 파이프라인 완료 ==="
log "=========================================="
