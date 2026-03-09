#!/usr/bin/env bash
# phase0-prepare.sh — UX 사전 준비 (git pull, npm ci, 관점 결정, 브랜치 생성)
# 오케스트레이터에서 source 해서 호출

run_phase0() {
  log_phase "Phase0" "=== UX 사전 준비 시작 ==="

  # ── git 최신화 ─────────────────────────────────────────
  log_phase "Phase0" "git checkout ${BASE_BRANCH} && git pull..."

  if [[ -n "$(git status --porcelain 2>/dev/null)" ]]; then
    log_phase "Phase0" "미커밋 변경사항 발견 — git stash"
    git stash --include-untracked >> "$LOG_FILE" 2>&1 || true
  fi

  git checkout "${BASE_BRANCH}" >> "$LOG_FILE" 2>&1 || {
    log_phase "Phase0" "ERROR: git checkout ${BASE_BRANCH} 실패"
    return "$EXIT_ERROR"
  }
  git pull --rebase origin "${BASE_BRANCH}" >> "$LOG_FILE" 2>&1 || {
    log_phase "Phase0" "ERROR: git pull 실패"
    git rebase --abort >> "$LOG_FILE" 2>&1 || true
    git stash drop >> "$LOG_FILE" 2>&1 || true
    return "$EXIT_ERROR"
  }

  # ── 의존성 설치 ────────────────────────────────────────
  log_phase "Phase0" "npm ci..."
  npm ci --ignore-scripts >> "$LOG_FILE" 2>&1 || {
    log_phase "Phase0" "ERROR: npm ci 실패"
    return "$EXIT_ERROR"
  }

  # ── RUN_DIR 생성 ───────────────────────────────────────
  local run_id
  run_id=$(date '+%Y-%m-%d-%H%M%S')
  RUN_DIR="/tmp/gv-ux-improve-${run_id}"
  mkdir -p "$RUN_DIR"
  export RUN_DIR

  local run_date
  run_date=$(date '+%Y-%m-%d')

  cat > "${RUN_DIR}/meta.env" <<EOF
RUN_ID=${run_id}
RUN_DATE=${run_date}
EOF

  log_phase "Phase0" "RUN_DIR: $RUN_DIR"

  # ── 관점 결정 (rotation) ───────────────────────────────
  log_phase "Phase0" "관점 결정..."

  local execution_count=0
  if [[ -f "$HISTORY_FILE" ]]; then
    execution_count=$(wc -l < "$HISTORY_FILE" 2>/dev/null | tr -d ' ')
  fi

  local perspective_json
  perspective_json=$(node "${SCRIPT_DIR}/lib/perspective-manager.js" current "$execution_count" 2>/dev/null || echo '{"id":"first-time-user","name":"첫 사용자","files":["commands/hello.md"]}')

  echo "$perspective_json" > "${RUN_DIR}/perspective.json"

  local perspective_id
  perspective_id=$(echo "$perspective_json" | jq -r '.id')
  local perspective_name
  perspective_name=$(echo "$perspective_json" | jq -r '.name')

  echo "PERSPECTIVE_ID=${perspective_id}" >> "${RUN_DIR}/meta.env"
  log_phase "Phase0" "관점: ${perspective_name} (${perspective_id}) [실행횟수: ${execution_count}]"

  # ── 분석 데이터 수집 ──────────────────────────────────
  log_phase "Phase0" "분석 데이터 수집..."

  gh issue list --label "automated,ux-improvement" --state open --json title,number,labels > "${RUN_DIR}/existing-issues.json" 2>/dev/null || echo "[]" > "${RUN_DIR}/existing-issues.json"

  # ── 히스토리 요약 생성 ────────────────────────────────
  log_phase "Phase0" "히스토리 요약 생성..."
  build_history_summary

  # ── 관점별 컨텍스트 생성 ─────────────────────────────
  node "${SCRIPT_DIR}/lib/perspective-manager.js" context "$perspective_id" "$HISTORY_FILE" \
    > "${RUN_DIR}/perspective-context.txt" 2>/dev/null || echo "" > "${RUN_DIR}/perspective-context.txt"

  # 히스토리 요약에 관점 컨텍스트 추가
  if [[ -s "${RUN_DIR}/perspective-context.txt" ]]; then
    echo "" >> "${RUN_DIR}/history-summary.txt"
    cat "${RUN_DIR}/perspective-context.txt" >> "${RUN_DIR}/history-summary.txt"
  fi

  # ── GitHub 라벨 확인/생성 ─────────────────────────────
  log_phase "Phase0" "GitHub 라벨 확인..."
  local label_defs=(
    "automated:0075ca:자동 생성"
    "ux-improvement:c5def5:UX 개선"
    "first-time-user:bfdadc:첫 사용자"
    "command-flow:d4c5f9:커맨드 플로우"
    "error-recovery:f9d0c4:에러 복구"
    "guide-coverage:b4e197:가이드 완성도"
    "sdk-dx:fbca04:SDK DX"
    "mode-confusion:e4e669:모드 혼동 방지"
    "onboarding-quality:f9a825:온보딩 품질"
    "intermediate-user:a2eeef:중급 사용자"
    "merge-ready:0e8a16:머지 준비 완료"
  )
  for def in "${label_defs[@]}"; do
    IFS=':' read -r name color desc <<< "$def"
    gh label create "$name" --color "$color" --description "$desc" --force 2>/dev/null || true
  done

  # ── 브랜치 생성 ──────────────────────────────────────
  local branch_name="${BRANCH_PREFIX}/${perspective_id}-${run_date}"
  local branch_created=false

  if git checkout -b "$branch_name" >> "$LOG_FILE" 2>&1; then
    branch_created=true
  else
    local suffix=2
    while [[ "$suffix" -le 10 ]]; do
      if git checkout -b "${branch_name}-${suffix}" >> "$LOG_FILE" 2>&1; then
        branch_name="${branch_name}-${suffix}"
        branch_created=true
        break
      fi
      suffix=$((suffix + 1))
    done
  fi

  if [[ "$branch_created" != "true" ]]; then
    log_phase "Phase0" "ERROR: 브랜치 생성 실패"
    return "$EXIT_ERROR"
  fi

  log_phase "Phase0" "브랜치 생성: ${branch_name}"
  echo "BRANCH_NAME=${branch_name}" >> "${RUN_DIR}/meta.env"
  export BRANCH_NAME="$branch_name"

  log_phase "Phase0" "=== UX 사전 준비 완료 ==="
}
