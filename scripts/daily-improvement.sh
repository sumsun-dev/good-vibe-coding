#!/usr/bin/env bash
# Daily Improvement — VPS cron 스크립트
# 코드베이스를 분석하고, 이슈 생성 + 코드 수정 + PR 생성
#
# 사용법:
#   bash scripts/daily-improvement.sh          # 수동 실행
#   crontab: 0 15 * * * /path/to/scripts/daily-improvement.sh  # KST 00:00
#
# 사전 조건:
#   - claude login (Max Plan OAuth)
#   - gh auth login (GitHub CLI)
#   - npm ci (의존성 설치)

set -euo pipefail

# ── 경로 설정 ──────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
LOG_DIR="$PROJECT_ROOT/logs/daily-improvement"
LOG_FILE="$LOG_DIR/$(date +%Y-%m-%d).log"

mkdir -p "$LOG_DIR"

log() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" | tee -a "$LOG_FILE"
}

log "=== Daily Improvement 시작 ==="

# ── 최신 코드 동기화 ──────────────────────────────────────
cd "$PROJECT_ROOT"
log "git pull..."
git pull --rebase origin master >> "$LOG_FILE" 2>&1

log "npm ci..."
npm ci --ignore-scripts >> "$LOG_FILE" 2>&1

# ── 분석 데이터 수집 ──────────────────────────────────────
TMP_DIR=$(mktemp -d)
log "분석 데이터 수집 → $TMP_DIR"

npx eslint . --format json > "$TMP_DIR/eslint-report.json" 2>/dev/null || true
npx vitest run --coverage --reporter=json > "$TMP_DIR/test-report.json" 2>/dev/null || true
git log --since="7 days ago" --name-only --pretty=format: | sort -u | head -50 > "$TMP_DIR/recent-changes.txt"
gh issue list --label "automated,improvement" --state open --json title,number > "$TMP_DIR/existing-issues.json" 2>/dev/null || echo "[]" > "$TMP_DIR/existing-issues.json"

# ── 라벨 확인 (없으면 생성) ───────────────────────────────
log "GitHub 라벨 확인..."
gh label create "automated" --color "0075ca" --description "자동 생성" --force 2>/dev/null || true
gh label create "improvement" --color "a2eeef" --description "개선 사항" --force 2>/dev/null || true
gh label create "quality" --color "d4c5f9" --description "코드 품질" --force 2>/dev/null || true
gh label create "security" --color "e11d48" --description "보안" --force 2>/dev/null || true
gh label create "performance" --color "f9a825" --description "성능" --force 2>/dev/null || true

# ── Claude Code CLI 실행 ──────────────────────────────────
PROMPT=$(cat <<'PROMPT_EOF'
먼저 CLAUDE.md 파일을 읽고 프로젝트 컨벤션을 반드시 준수하세요.
다음 파일을 참조하세요:
- {{TMP_DIR}}/eslint-report.json (ESLint 결과)
- {{TMP_DIR}}/test-report.json (테스트 커버리지)
- {{TMP_DIR}}/recent-changes.txt (최근 7일 변경 파일)
- {{TMP_DIR}}/existing-issues.json (기존 improvement 이슈)

## 분석 범위

### 1. 코드 품질
- 50줄 초과 함수, 4단계 초과 중첩, 800줄 초과 파일
- console.log 잔존, 미사용 import/변수
- magic number, 3회 이상 반복 패턴

### 2. 보안
- 하드코딩 시크릿/토큰/API키
- path traversal (assertWithinRoot 누락)
- exec/execSync에 사용자 입력 직접 전달
- requireFields 등 입력 검증 누락

### 3. 성능
- 핫패스의 동기 I/O
- 루프 내 반복 I/O (N+1)
- 캐시 가능한 중복 연산

## 실행 규칙

1. existing-issues.json 확인 → 동일 주제 이슈 열려있으면 SKIP
2. critical/important만 처리, minor는 무시
3. 각 발견 사항:
   a. `gh issue create`로 이슈 생성
      - 제목: "[Daily Improvement] {quality|security|performance}: {요약}"
      - 라벨: automated,improvement,{category}
      - 본문: 파일 경로, 라인, 현재 코드, 개선안
   b. 코드 직접 수정
4. 수정 후 `npm run lint && npm test` 실행, 통과 확인
5. 실패 시 수정 롤백, 이슈만 생성
6. 변경사항 없으면 아무것도 하지 말 것 (빈 PR 금지)
7. 커밋: conventional commit (fix|refactor|chore(scope): 설명)
8. PR 본문에 분석 결과 + `closes #이슈번호` 포함
PROMPT_EOF
)

# TMP_DIR 경로를 프롬프트에 주입
PROMPT="${PROMPT//\{\{TMP_DIR\}\}/$TMP_DIR}"

log "Claude Code 실행 (--max-turns 25)..."
claude -p "$PROMPT" --max-turns 25 --dangerously-skip-permissions >> "$LOG_FILE" 2>&1 || true

log "Claude Code 완료"

# ── 정리 ──────────────────────────────────────────────────
rm -rf "$TMP_DIR"

# 30일 이전 로그 자동 정리
find "$LOG_DIR" -name "*.log" -mtime +30 -delete 2>/dev/null || true

log "=== Daily Improvement 완료 ==="
