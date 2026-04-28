---
description: '신규 프로젝트 셋업 — 폴더 + (선택) GitHub repo + Good Vibe 프로젝트 엔트리'
argument-hint: '[프로젝트 이름]'
---

# /gv-init — 신규 프로젝트 셋업

폴더 scaffold + (선택) GitHub repo 생성 + Good Vibe 프로젝트 엔트리를 한 번에 만듭니다. `/gv-execute` 진입 전에 한 번 실행하세요.

- **소요시간:** 5–20초 (GitHub repo 만들면 +5초)
- **결과물:** `~/projects/{slug}/` 폴더 + 초기 scaffold + (선택) GitHub repo + Good Vibe 프로젝트 엔트리
- **다음 단계:** `/gv-execute auto` 로 task-graph 진입

## 실행 흐름

### Step 1: 사용자 입력 수집 (AskUserQuestion)

**1-1. 프로젝트 이름**

`$ARGUMENTS` 가 비어 있으면 AskUserQuestion 으로 묻고, 있으면 그 값을 기본값으로 사용.

**1-2. 폴더 위치**

기본값: `~/projects/{slug}` (slug 는 이름에서 자동 변환)

```bash
echo '{"name": "<입력 이름>"}' | node "${CLAUDE_PLUGIN_ROOT}/scripts/cli.js" slugify-name
```

응답: `{"slug": "..."}`. 그걸로 기본 경로 제시. 사용자 수정 허용.

**1-3. GitHub repo 옵션 — gh 인증 상태에 따라 분기**

먼저 인증 상태 확인:

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/cli.js" check-gh-status
```

응답: `{"installed": bool, "authenticated": bool, "username": "..."}`.

- `authenticated: true` → AskUserQuestion 선택지: `["비공개 (private)", "공개 (public)", "건너뛰기 (로컬만)"]`
- `installed: false` → AskUserQuestion: `["건너뛰기 (gh CLI 미설치)", "취소 (먼저 gh 설치 후 재실행)"]`
- `installed: true && authenticated: false` → AskUserQuestion: `["건너뛰기 (gh 미인증)", "취소 (먼저 gh auth login 후 재실행)"]`

매핑:

- "비공개" → `github: "private"`
- "공개" → `github: "public"`
- "건너뛰기" → `github: "none"`
- "취소" → 흐름 중단, 사용자 안내

**1-4. (선택) 프로젝트 유형**

기본값 `cli-tool`. AskUserQuestion 생략 가능 (모르면 `cli-tool` 기본값으로 진행).

### Step 2: init-project CLI 호출 (Thin Controller)

```bash
echo '{
  "name": "<이름>",
  "type": "<유형>",
  "description": "<설명>",
  "targetDir": "<절대 경로>",
  "github": "private | public | none",
  "techStack": "<선택>",
  "mode": "<plan-only | plan-execute | quick-build, 선택>"
}' | node "${CLAUDE_PLUGIN_ROOT}/scripts/cli.js" init-project
```

응답:

```json
{
  "success": true,
  "projectId": "...",
  "project": { "id": "...", "name": "...", "status": "planning" },
  "infraPath": "/path/to/folder",
  "githubUrl": "https://github.com/me/slug" | null,
  "files": [...],
  "ci": null | {...},
  "warnings": []
}
```

### Step 3: 결과 표시

CEO에게:

1. ✅ **셋업 완료** + `infraPath`, `githubUrl` (있으면), 생성된 파일 수
2. ⚠️ **`warnings` 배열이 비어있지 않으면** 각 항목 표시 (예: GitHub repo 이미 존재, push 실패 등). 그래도 로컬 프로젝트는 정상 생성됨을 안내
3. **다음 액션:** `/gv-execute auto` 로 task-graph 시작 (또는 `/gv-execute interactive` 로 단계별 확인)

## 메인 세션 원칙

- AskUserQuestion 으로 사용자 입력 수집만
- check-gh-status, slugify-name, init-project — 단순 CLI 호출만 (LLM 없음)
- 데이터 가공/추가 분석 금지
