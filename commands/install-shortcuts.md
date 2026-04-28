---
description: 'Good Vibe 단축어(`/gv`, `/gv-status` 등) 설치 — 사용자 스코프 래퍼를 한 번에 작성'
argument-hint: '[--force | --uninstall]'
---

# /gv:install-shortcuts — 단축어 한 번에 설치

플러그인은 `/good-vibe:gv` 처럼 네임스페이스가 강제됩니다. 이 명령은 `~/.claude/commands/` 에 7개 thin 래퍼를 작성해 `/gv`, `/gv-status` 등 짧은 형태로 호출 가능하게 만듭니다.

- **소요시간:** 즉시 (1초 이내)
- **결과물:** 7개 래퍼 파일 + 설치/충돌/skip 보고
- **멱등성:** 두 번 실행해도 안전 (이미 설치된 항목은 skip)

## 인자

- 없음: 기본 설치 (멱등)
- `--force`: 기존 동명 파일을 덮어씀 (사용자 파일 포함 — 주의)
- `--uninstall`: 우리가 설치한 파일만 제거 (서명 없는 사용자 파일은 보존)

## 실행 흐름

### Step 1: 사용자 의도 파악

`$ARGUMENTS` 를 검사하여 다음 분기:

- `--uninstall` 포함 → uninstall 경로
- `--force` 포함 → install with force
- 그 외 → 기본 install

### Step 2: 단순 CLI 1회 호출 (Thin Controller)

**Install:**

```bash
echo '{"force": <bool>}' | node "${CLAUDE_PLUGIN_ROOT}/scripts/cli.js" install-shortcuts
```

**Uninstall:**

```bash
echo '{}' | node "${CLAUDE_PLUGIN_ROOT}/scripts/cli.js" uninstall-shortcuts
```

### Step 3: 결과 표시

핸들러 응답 (`installed`, `skipped`, 또는 `removed`, `preserved`)을 그대로 표시:

- `installed` 항목 → "✅ 설치됨" 목록
- `skipped` 중 `reason: "already-installed"` → "⏭ 이미 설치됨"
- `skipped` 중 `reason: "conflict"` → "⚠️ 충돌 (사용자 파일 보존, `--force` 로 덮어쓰기 가능)"
- `removed` → "🗑 제거됨"
- `preserved` → "🔒 보존됨 (사용자 파일)"

이후 사용자에게 `/gv`, `/gv-status` 등을 바로 사용 가능함을 안내.

## 사용 예시

```
/good-vibe:install-shortcuts
/good-vibe:install-shortcuts --force
/good-vibe:install-shortcuts --uninstall
```

설치 후:

```
/gv 트위터 봇 만들고 싶어
/gv-status
/gv-execute auto
```
