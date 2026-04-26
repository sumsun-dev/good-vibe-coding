# 고급 커맨드 — v1 → v2 마이그레이션 노트

> **이 문서의 위치**: v1의 9개 고급 슬래시 커맨드는 v2 릴리즈 시 일괄 제거되었습니다. 본 문서는 v1 사용자가 동일한 동작을 v2에서 어떻게 수행하는지 매핑을 제공합니다.

v2 표준 진입점은 `/gv` 자연어입니다. 모든 동작은 가능한 한 자연어로 통합되며, 직접적인 슬래시가 없는 동작은 CLI 직접 호출 또는 표준 도구로 대체됩니다.

---

## 1. `good-vibe:new-project` — 수동 프로젝트 생성

**v2 대체**: `/gv` 자연어 + 추천 수정.

```
/gv "마이크로서비스 SaaS 플랫폼 만들고 싶어 — plan-only 모드로"
```

`/gv`가 입력에서 모드 힌트("plan-only")를 인식하면 추천을 그대로 따릅니다. 추천이 마음에 들지 않으면 자연어로 변경 요청 (예: `/gv "팀을 5명으로 늘리고 plan-execute로"`).

---

## 2. `good-vibe:projects` — 전체 프로젝트 목록

**v2 대체**: `list-projects` CLI 직접 호출.

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/cli.js" list-projects
```

`/gv:status`는 활성 프로젝트 1개를 보여주고, 전체 목록이 필요하면 위 CLI를 직접 사용합니다. 후속 마이너에서 `/gv "프로젝트 목록"` 자연어 안내 추가 검토 중.

---

## 3. `good-vibe:my-config` — 현재 설정 확인

**v2 대체**: Claude Code 표준 `/doctor` + 직접 파일 점검.

| 점검 대상                    | v2 방식                                                |
| ---------------------------- | ------------------------------------------------------ |
| 환경 (Node, git, gh, Gemini) | Claude Code `/doctor`                                  |
| CLAUDE.md 위치/내용          | 직접 `~/.claude/CLAUDE.md`, `<project>/CLAUDE.md` 확인 |
| 설치된 에이전트/스킬         | `/plugin` 메뉴                                         |
| 활성 프로젝트                | `/gv:status`                                           |
| 비용 임계                    | `/gv:cost`                                             |

---

## 4. `good-vibe:scaffold` — 프로젝트 템플릿 스캐폴딩

**v2 대체**: code 작업으로 통합 또는 CLI 직접 호출.

5개 내장 템플릿(`next-app`, `express-api`, `cli-app`, `telegram-bot`, `npm-library`)은 `presets/templates/` 디렉토리에 그대로 남아 있습니다.

```
/gv "next-app 템플릿으로 결제 페이지 스캐폴드"
```

또는 CLI로 직접 (JSON stdin):

```bash
echo '{"template": "next-app", "targetDir": "./my-app"}' \
  | node "${CLAUDE_PLUGIN_ROOT}/scripts/cli.js" scaffold
```

> 핸들러: `scripts/handlers/template.js#scaffold`. 필수 필드 `template`, `targetDir`, 선택 `variables`(객체). 사용 가능한 템플릿 목록은 `node "${CLAUDE_PLUGIN_ROOT}/scripts/cli.js" list-templates`로 확인.

---

## 5. `good-vibe:add-skill` / `good-vibe:add-agent` — 스킬/에이전트 추가

**v2 대체**: Claude Code 표준 plugin install.

```
/plugin marketplace add <repo>
/plugin install <plugin-name>@<marketplace>
```

내장 서포트 에이전트 8개(`code-reviewer-kr`, `tdd-coach-kr`, `doc-reviewer-kr`, `content-editor-kr`, `mentor-kr`, `data-analyst-kr`, `accessibility-checker`, `onboarding-guide`)는 Good Vibe 플러그인 설치 시 자동 등록됩니다.

---

## 6. `good-vibe:preset` — 프리셋 적용

**v2 대체**: `agent-overrides` 직접 편집 또는 자연어 요청.

| 프리셋      | v2 방식                                                            |
| ----------- | ------------------------------------------------------------------ |
| 역할 프리셋 | `~/.claude/good-vibe/agent-overrides/<roleId>.md` 직접 편집        |
| 스택 프리셋 | `/gv "Next.js + Supabase 스택으로 시작"` 같은 자연어로 진입        |
| 워크플로우  | `/gv "TDD로 진행해줘"`, `/gv "리뷰 강화해줘"` 같은 자연어 가이던스 |

크로스프로젝트 학습은 자동으로 동작합니다 (3회 이상 반복된 카테고리 → user-level 오버라이드에 자동 추가).

---

## 7. `good-vibe:reset` — 설정 초기화

**v2 대체**: 데이터 디렉토리 직접 삭제 (수동 백업 권장).

```bash
# 백업
cp -r ~/.claude/good-vibe ~/.claude/good-vibe.backup-$(date +%Y%m%d)

# 초기화 (전체)
rm -rf ~/.claude/good-vibe

# 선택적 초기화 — 프로젝트만
rm -rf ~/.claude/good-vibe/projects
```

자동 백업/내보내기 명령은 v2에서 제거되었으므로 수동으로 처리합니다.

---

## 8. `good-vibe:eval` — 접근법 A/B 비교

**v2 상태**: 별도 도구로 분리 예정. 현재 직접 매핑되는 슬래시 없음.

A/B 비교는 다음과 같이 수행할 수 있습니다:

1. 동일한 입력으로 `/gv` 두 번 실행 (다른 세션 또는 프로젝트로 분리)
2. `journal.jsonl`에서 토큰/비용/시간 추출 후 비교
3. 또는 멀티-모델 교차 리뷰 (`multi-review` 스킬)로 품질 비교

후속 마이너에서 별도 도구로 재도입 검토 중.

---

## 9. `good-vibe:feedback` — 에이전트 피드백

**v2 대체**: 자연어 진입 (`/gv "피드백 분석"`).

`completed` 상태 프로젝트에서 다음 자연어로 진입합니다:

```
/gv "이 프로젝트 피드백 분석해줘"
```

크로스프로젝트 학습은 자동으로 동작합니다. 승인한 제안은 `~/.claude/good-vibe/agent-overrides/`에 저장되어 다음 프로젝트부터 자동 적용됩니다.

---

## v1 vs v2 — 한 줄 정리

| v1 패턴               | v2 패턴                                  |
| --------------------- | ---------------------------------------- |
| 9개 고급 명령 학습    | `/gv` 자연어 + 일부 CLI / 표준 도구      |
| 명령 카탈로그 외우기  | 자연어로 의도 표현                       |
| 옵션 플래그 메모      | 자연어 보강 (`/gv "...빠르게"` 등)       |
| 프리셋·설정 명령 호출 | 자연어 가이던스 / `agent-overrides` 편집 |

> v2 철학: **사용자가 외울 슬래시를 6개로 제한하고, 나머지는 자연어 또는 표준 도구로 흡수**한다.

---

## 다음 문서

- [퀵스타트](00-quick-start.md)로 돌아가기
- [커맨드 레퍼런스](03-commands-reference.md) — v2 슬래시 6개 상세
- [커맨드와 스킬 개관](03-commands-and-skills.md) — 커맨드 vs 스킬 개념
