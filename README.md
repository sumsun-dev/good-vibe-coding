# Good Vibe Coding

**모든 직군을 위한 한국어 Claude Code 온보딩 플러그인**

`/onboarding`을 실행하면 대화형으로 역할/업무/도구를 선택하고, 각자에게 맞는 Claude Code 설정을 자동 생성합니다.

## 핵심 특징

- **한국어 완전 지원**: 모든 가이드, 프롬프트, 에이전트가 한국어
- **모든 직군 지원**: 개발자, PM, 디자이너, 리서처, 마케터, 학생
- **롤 플레잉 팀 빌딩**: 에이전트가 이름/성격/말투를 가진 팀원으로 변신
- **인터랙티브 온보딩**: 대화형 설정 마법사 + 팀원 스타일 선택
- **입문자 중심**: `/learn`으로 역할별 맞춤 학습 가이드

## 설치

```bash
# 플러그인 설치 (마켓플레이스 등록 후)
/plugin install good-vibe-coding@marketplace

# 또는 로컬 설치
git clone https://github.com/your-repo/good-vibe-coding.git
cd good-vibe-coding
npm install
```

## 사용법

### 온보딩 시작
```
/onboarding
```

대화형 마법사가 시작됩니다:
1. 환경 감지
2. 역할 선택 (개발/기획/디자인/리서치/콘텐츠/학습)
3. 업무/도구 세부 선택
4. 워크플로우 스타일 선택
4A. **팀원 스타일 선택** — 각 에이전트의 성격 변형을 고릅니다
5. 설정 파일 자동 생성

### 학습
```
/learn          # 역할별 가이드 목차
/learn 기초      # Claude Code 기초
/learn 사용법    # 기본 사용법
```

### 설정 확인
```
/my-config       # 현재 설정 대시보드
```

## 팀 빌딩

온보딩 중 각 에이전트의 성격 변형을 선택할 수 있습니다. 에이전트당 2개 변형이 제공되며, 각 팀원은 이름, 성격, 인사말을 가집니다.

예시 (개발자 역할):
```
🎉 당신의 팀이 구성되었습니다!

  준영 (꼼꼼한 검토자) 🔍 — 코드 리뷰어
  "안녕하세요. 코드를 면밀히 검토하겠습니다."

  하윤 (엄격한 코치) 🎯 — TDD 코치
  "테스트부터 작성합시다."
```

생성된 `CLAUDE.md`에는 "Your Team" 섹션으로 팀원의 성격과 행동 지침이 포함됩니다.

## 에이전트 오케스트레이션

온보딩 시 `~/.claude/agents/` 디렉토리에 실제 Claude Code 에이전트 `.md` 파일이 생성됩니다. 각 파일에는 YAML frontmatter(name, tools, model)와 페르소나 정보, 기술 지시사항이 포함되어 Task 도구로 서브에이전트를 호출할 수 있습니다.

`CLAUDE.md`에 자동 추가되는 "Team Orchestration" 섹션은 작업 단계별로 어떤 에이전트에게 위임할지를 정의합니다:

```
## Team Orchestration

| 단계 | 담당 | 트리거 | 호출 |
|------|------|--------|------|
| 테스트 설계 | 하윤 (TDD 코치) 🎯 | 기능 구현 요청 시 | Task: subagent_type="tdd-coach-kr" |
| 코드 리뷰 | 준영 (코드 리뷰어) 🔍 | 구현 완료 후 | Task: subagent_type="code-reviewer-kr" |
```

생성되는 에이전트 파일 예시 (`~/.claude/agents/code-reviewer-kr.md`):
```yaml
---
name: code-reviewer-kr
description: 코드 리뷰어 - 준영 🔍. 분석적이고 체계적인 스타일.
tools: Read, Grep, Glob, Bash
model: sonnet
---
```

## 지원 역할

| 역할 | 설명 | 에이전트 | 스킬 | 가이드 |
|------|------|---------|------|--------|
| 개발자 | 풀스택/프론트/백엔드 | 코드리뷰어, TDD코치 | side-impact, tdd-workflow, verify, code-review | TDD 워크플로우, 코드 리뷰 |
| PM/기획자 | PM/PO/프로젝트 매니저 | 문서검토기 | prd-writer, meeting-notes, issue-tracker | PRD 작성법, 이슈 관리 |
| 디자이너 | UI/UX/퍼블리셔 | 접근성체커 | design-system, css-helper | 접근성, 디자인 시스템 |
| 리서처 | UX리서치/데이터분석 | 데이터분석도우미 | data-collector, report-writer | 공통 가이드 |
| 콘텐츠 | 블로거/마케터/카피라이터 | 글편집기 | blog-writer, seo-checker | 공통 가이드 |
| 학생 | 입문자/직무전환자 | 학습멘토 | beginner-guide | 공통 가이드 |

## 스택 프리셋

| 스택 | 설명 |
|------|------|
| Next.js + Supabase | 풀스택 웹 앱 개발 (App Router, RLS, Auth) |
| React + Node.js | 프론트엔드/백엔드 분리 (Vite, Express/Fastify) |

## 프로젝트 구조

```
good-vibe-coding/
├── .claude-plugin/plugin.json    # 플러그인 매니페스트
├── agents/                       # 직군별 에이전트 (8개)
├── commands/                     # 커맨드 (7개)
├── skills/                       # 스킬 (4개)
├── presets/
│   ├── roles/                    # 역할 프리셋 (6개)
│   └── stacks/                   # 스택 프리셋 (2개)
├── templates/                    # Handlebars 템플릿
├── hooks/                        # 훅 정의
├── guides/
│   ├── common/                   # 공통 가이드 (5개)
│   ├── developer/                # 개발자 심화 가이드
│   ├── pm/                       # PM 심화 가이드
│   └── designer/                 # 디자이너 심화 가이드
├── scripts/lib/                  # 핵심 라이브러리
│   ├── config-generator.js       #   설정 생성 엔진
│   ├── personality-builder.js    #   팀원 페르소나 빌더
│   ├── agent-instruction-extractor.js # 에이전트 지시사항 추출
│   ├── template-engine.js        #   Handlebars 렌더링
│   ├── preset-loader.js          #   프리셋 로딩/병합
│   └── file-writer.js            #   안전한 파일 쓰기
└── tests/                        # Vitest 테스트
```

## 기술 스택

- **Node.js 18+** (ESM)
- **Handlebars** (템플릿 엔진)
- **Vitest** (테스트 프레임워크)

## 개발

```bash
# 의존성 설치
npm install

# 테스트 실행
npm test

# 테스트 감시 모드
npm run test:watch
```

## 로드맵

### Phase 1 - MVP
- [x] 프로젝트 초기화 + 핵심 라이브러리
- [x] 템플릿 엔진 + 프리셋 로더
- [x] `/onboarding` 커맨드 + 온보딩 스킬
- [x] 개발자/PM 프리셋
- [x] `/learn`, `/my-config` 커맨드
- [x] 한국어 기초 가이드 2개

### Phase 2 - 확장
- [x] 나머지 4개 직군 프리셋 완성
- [x] 직군별 에이전트 활성화
- [x] 직군별 심화 가이드
- [x] `/add-skill`, `/add-agent`, `/preset` 구현
- [x] 스택 프리셋 (nextjs-supabase, react-node)
- [x] 롤 플레잉 팀 빌딩 (에이전트 페르소나 × 2 변형)

### Phase 2.7 - 에이전트 오케스트레이션
- [x] Role Preset에 orchestration + config.tools 추가
- [x] agent-instruction-extractor 모듈 (plugin agents/*.md → 지시사항 추출)
- [x] agent.md.hbs 템플릿 (YAML frontmatter + persona + 기술 지시사항)
- [x] 온보딩 시 실제 agent .md 파일 생성 (~/.claude/agents/)
- [x] CLAUDE.md에 Team Orchestration 섹션 (자동 위임 워크플로우)

### Phase 3 (현재) - 고도화
- [ ] `/reset` + 설정 내보내기/가져오기
- [ ] 마켓플레이스 등록
- [ ] 커뮤니티 프리셋 공유
- [ ] 국제화 (일본어, 영어)

## 라이선스

MIT
