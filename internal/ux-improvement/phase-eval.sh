#!/usr/bin/env bash
# phase-eval.sh — UX 5영역 SLA 품질 평가
# 오케스트레이터에서 source 해서 호출

run_phase_eval() {
  local round="$1"
  log_phase "PhaseEval" "=== UX 품질 평가 시작 (Round ${round}) ==="

  # 1. UX Evaluator 프롬프트 생성
  local prompt
  prompt=$(build_ux_evaluator_prompt "$round" "$RUN_DIR")

  # 2. Claude UX Evaluator 실행 (read-only)
  local eval_output="${RUN_DIR}/eval-output-round${round}.txt"
  local claude_exit=0
  run_claude_safe "$prompt" "PhaseEval" "$eval_output" "$PHASE_EVAL_TIMEOUT" "no" || claude_exit=$?

  # 3. 세션 오류 분류
  local error_class
  error_class=$(classify_claude_error "$claude_exit" "$(tail -20 "$LOG_FILE" 2>/dev/null || echo "")")
  if [[ "$error_class" == "weekly_limit" || "$error_class" == "auth_error" ]]; then
    save_checkpoint "$round" "phase_eval" "session_error:${error_class}"
    return "$EXIT_ERROR"
  fi

  # 4. UX SLA 판정 (Node.js)
  local prev_scores_arg=""
  if [[ -f "${RUN_DIR}/prev-scores.json" ]]; then
    prev_scores_arg="${RUN_DIR}/prev-scores.json"
  fi

  local eval_result
  local node_exit=0
  eval_result=$(node "${SCRIPT_DIR}/lib/ux-sla-evaluator.js" evaluate \
    "$eval_output" "$UX_SLA_TARGET" "$MIN_SCORE_IMPROVEMENT" \
    $prev_scores_arg 2>>"$LOG_FILE") || node_exit=$?

  if [[ "$node_exit" -ne 0 || -z "$eval_result" ]]; then
    log_phase "PhaseEval" "WARNING: ux-sla-evaluator.js 실패 (exit: ${node_exit}) — SLA 미달로 처리"
    eval_result='{"met":false,"average":0,"stagnant":false}'
  fi

  # 5. 결과 파싱 + 저장
  local sla_met average stagnant
  sla_met=$(echo "$eval_result" | jq -r '.met')
  average=$(echo "$eval_result" | jq -r '.average')
  stagnant=$(echo "$eval_result" | jq -r '.stagnant')

  echo "$eval_result" | jq '.scores // {}' > "${RUN_DIR}/prev-scores.json"
  echo "$eval_result" | jq -c ".round = ${round}" >> "${RUN_DIR}/round-metrics.jsonl"
  echo "$eval_result" | jq -r '.feedback // empty' > "${RUN_DIR}/eval-feedback-round${round}.txt"

  write_run_file "sla-score-round${round}" "$average"
  write_run_file "sla-met" "$sla_met"
  save_checkpoint "$round" "phase_eval" "completed"

  log_phase "PhaseEval" "UX SLA: ${average}/10 (목표: ${UX_SLA_TARGET})"

  if [[ "$sla_met" == "true" ]]; then
    log_phase "PhaseEval" "UX SLA 달성 — 루프 종료"
    return 0
  fi
  if [[ "$stagnant" == "true" ]]; then
    write_run_file "round-stop-reason" "stagnant"
    log_phase "PhaseEval" "개선 정체 감지 — 루프 종료"
    return 0
  fi

  log_phase "PhaseEval" "UX SLA 미달 — 다음 라운드 진행"
  return 1
}
