#!/usr/bin/env bash
# phase0-prepare.sh — 사전 준비 (git pull, npm ci, 데이터 수집, 브랜치 생성)
# 오케스트레이터에서 source 해서 호출

run_phase0() {
  log_phase "Phase0" "=== 사전 준비 시작 ==="

  # ── git 최신화 ─────────────────────────────────────────
  log_phase "Phase0" "git checkout ${BASE_BRANCH} && git pull..."

  # 이전 실행에서 남은 unstaged changes 정리
  if [[ -n "$(git status --porcelain 2>/dev/null)" ]]; then
    log_phase "Phase0" "이전 실행의 미커밋 변경사항 발견 — git stash"
    git stash --include-untracked >> "$LOG_FILE" 2>&1 || true
  fi

  git checkout "${BASE_BRANCH}" >> "$LOG_FILE" 2>&1 || {
    log_phase "Phase0" "ERROR: git checkout ${BASE_BRANCH} 실패"
    return "$EXIT_ERROR"
  }
  git pull --rebase origin "${BASE_BRANCH}" >> "$LOG_FILE" 2>&1 || {
    log_phase "Phase0" "ERROR: git pull 실패 — rebase abort 시도"
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
  RUN_DIR="/tmp/gv-improve-${run_id}"
  mkdir -p "$RUN_DIR"
  export RUN_DIR

  local run_date
  run_date=$(date '+%Y-%m-%d')

  # meta.env 기록
  cat > "${RUN_DIR}/meta.env" <<EOF
RUN_ID=${run_id}
RUN_DATE=${run_date}
EOF

  log_phase "Phase0" "RUN_DIR: $RUN_DIR"

  # ── 분석 데이터 수집 ──────────────────────────────────
  log_phase "Phase0" "분석 데이터 수집..."

  npx eslint . --format json > "${RUN_DIR}/eslint-report.json" 2>/dev/null || echo "[]" > "${RUN_DIR}/eslint-report.json"
  npx vitest run --reporter=json > "${RUN_DIR}/test-report.json" 2>/dev/null || echo "{}" > "${RUN_DIR}/test-report.json"
  git log --since="7 days ago" --name-only --pretty=format: | sort -u | head -50 > "${RUN_DIR}/recent-changes.txt" 2>/dev/null || true
  gh issue list --label "automated,improvement" --state open --json title,number,labels > "${RUN_DIR}/existing-issues.json" 2>/dev/null || echo "[]" > "${RUN_DIR}/existing-issues.json"

  # ── 히스토리 요약 생성 ────────────────────────────────
  log_phase "Phase0" "히스토리 요약 생성..."
  build_history_summary

  # ── 이전 PR 머지 상태 업데이트 ────────────────────────
  log_phase "Phase0" "이전 PR 머지 상태 확인..."
  update_merged_status || true

  # ── GitHub 라벨 확인/생성 ─────────────────────────────
  log_phase "Phase0" "GitHub 라벨 확인..."
  local label_defs=(
    "automated:0075ca:자동 생성"
    "improvement:a2eeef:개선 사항"
    "quality:d4c5f9:코드 품질"
    "security:e11d48:보안"
    "performance:f9a825:성능"
    "merge-ready:0e8a16:머지 준비 완료"
  )
  for def in "${label_defs[@]}"; do
    IFS=':' read -r name color desc <<< "$def"
    gh label create "$name" --color "$color" --description "$desc" --force 2>/dev/null || true
  done

  # ── 브랜치 생성 (atomic: 실패 시 suffix 증가) ──────────
  local branch_name="${BRANCH_PREFIX}/${run_date}"
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

  # meta.env에 브랜치명 추가
  echo "BRANCH_NAME=${branch_name}" >> "${RUN_DIR}/meta.env"
  export BRANCH_NAME="$branch_name"

  log_phase "Phase0" "=== 사전 준비 완료 ==="
}
