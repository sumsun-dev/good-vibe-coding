# Good Vibe Coding v4.0

**Virtual AI Team Management Platform** — AI 팀을 구성하고 프로젝트를 관리하세요

사용자가 **CEO**가 되어 프로젝트를 정의하면, AI 팀원들이 토론하고 기획하고 실행합니다.

## 핵심 특징

- **가상 AI 팀**: 15개 역할 (CTO, Backend, QA, Frontend, Researcher...) 각각 2개 페르소나 변형 + 커스텀 확장
- **멀티에이전트 오케스트레이션**: 역할별 병렬 분석 → 종합 → 수렴까지 자동 반복 (최대 3라운드)
- **크로스 리뷰 시스템**: 작업 실행 후 다른 역할 에이전트가 결과물 리뷰, 품질 게이트 체크
- **복잡도 기반 자동 모드 선택**: 프로젝트 복잡도 분석 → 적합한 모드 자동 추천
- **세 가지 모드**: quick-build / plan-execute / plan-only
- **에이전트 피드백**: 프로젝트 결과 분석 → 에이전트 .md 수정안 자동 제안 → 오버라이드 저장
- **한국어 완전 지원**: 모든 가이드, 프롬프트, 에이전트가 한국어
- **v2 호환**: 기존 온보딩 마법사 (`/onboarding`) 그대로 사용 가능

## 설치

```bash
git clone https://github.com/your-repo/good-vibe-coding.git
cd good-vibe-coding
npm install
```

## 3분 퀵스타트 (처음 사용자)

6개 커맨드로 프로젝트를 완성하세요:

```
/hello → /new → /discuss → /approve → /execute → /report
```

| 단계 | 커맨드 | 하는 일 | 소요시간 |
|------|--------|---------|----------|
| 1 | `/hello` | 프로젝트 폴더 + GitHub 저장소 생성 | 2-3분 |
| 2 | `/new` | 아이디어 입력 + 팀 자동 구성 | 1-2분 |
| 3 | `/discuss` | 팀 토론 → 기획서 작성 | 3-10분 |
| 4 | `/approve` | 기획서 확인 + 승인 | 1-2분 |
| 5 | `/execute` | 작업 실행 + 리뷰 | 5-15분 |
| 6 | `/report` | 보고서 생성 | 1분 |

**처음이라면 `/hello`부터 입력하세요.** 나머지는 단계별로 안내해드립니다.

> 자세한 가이드: [3분 퀵스타트](guides/common/00-quick-start.md)

## 사용법: CEO 시나리오

### 0. 프로젝트 인프라 셋업

```
/hello
```

프로젝트 폴더, CLAUDE.md, README.md를 만들고 GitHub 저장소를 생성합니다:
1. 프로젝트 이름, 설명, 기술 스택 입력
2. GitHub 연동 여부 선택 (gh CLI 자동 감지)
3. 프로젝트 폴더 + 초기 파일 생성

### 1. 프로젝트 시작

```
/new
```

복잡도를 자동 분석하고 적합한 모드를 추천합니다:
1. 프로젝트 설명 입력 ("텔레그램 봇을 만들고 싶어")
2. 복잡도 분석 → 모드 자동 추천 (quick-build / plan-execute / plan-only)
3. 추천 팀 확인 및 수정
4. 팀원 페르소나 선택

> `/new-project`로 수동 설정도 가능합니다.

### 2. 팀 토론

```
/discuss
```

팀원들이 Tier별로 병렬 분석합니다:
- Tier 1: CTO, PO, Researcher (전략적 분석)
- Tier 2-4: Frontend, Backend, QA 등 (실행 관점 분석)
- 전체 결과 종합 → 80% 이상 승인 시 수렴 (최대 3라운드)

### 3. 기획서 승인

```
/approve
```

CEO가 기획서를 검토하고 승인합니다. 승인 후 작업이 역할별로 분배됩니다.

### 4. 작업 실행 (plan-execute 모드)

```
/execute
```

분배된 작업을 팀원들이 실행합니다:
- 팀원별 병렬 실행
- 크로스 리뷰 (최소 2명이 결과물 검토)
- Quality Gate: critical 이슈 0개 시 통과
- 실패 시 수정 루프 (최대 2회) → 해결 불가 시 CEO 에스컬레이션

### 5. 보고서 & 피드백

```
/report     # 최종 보고서 생성
/feedback   # 프로젝트 결과 분석 → 에이전트 개선 제안
```

## 전체 커맨드

### 필수 커맨드 (프로젝트 완성 플로우)

| 커맨드 | 설명 | 언제 사용? |
|--------|------|-----------|
| `/hello` | 프로젝트 인프라 셋업 (폴더, GitHub) | 맨 처음 |
| `/new` | 스마트 프로젝트 시작 (복잡도 분석 → 모드 추천) | /hello 후 |
| `/discuss` | 멀티에이전트 팀 토론 → 기획서 작성 | /new 후 |
| `/approve` | 기획서 승인 + 작업 분배 | /discuss 후 |
| `/execute` | 작업 실행 + 크로스 리뷰 | /approve 후 |
| `/report` | 최종 보고서 생성 | /execute 후 |

### 보조 커맨드 (프로젝트 관리)

| 커맨드 | 설명 |
|--------|------|
| `/status` | 프로젝트 상태 대시보드 |
| `/feedback` | 에이전트 피드백 (결과 분석 → .md 개선) |
| `/my-team` | 팀 현황 + 역할 카탈로그 |
| `/learn` | 역할별 학습 가이드 |

### 고급 커맨드 (커스터마이징)

| 커맨드 | 설명 |
|--------|------|
| `/new-project` | 수동 프로젝트 생성 (타입/모드 직접 선택) |
| `/projects` | 프로젝트 목록 |
| `/onboarding` | 역할 기반 온보딩 마법사 |
| `/my-config` | 현재 설정 대시보드 |
| `/persona` | 커스텀 페르소나 관리 |
| `/edit-persona` | 페르소나 빠른 수정/오버라이드 |
| `/scaffold` | 프로젝트 템플릿 스캐폴딩 |
| `/add-skill` | 스킬 추가 |
| `/add-agent` | 에이전트 추가 |
| `/preset` | 프리셋 관리 |
| `/reset` | 설정 초기화 |

## 역할 카탈로그 (15개)

| 역할 | 이모지 | 카테고리 | 설명 |
|------|--------|----------|------|
| CTO | 🏗️ | Leadership | 기술 아키텍처 설계, 기술 의사결정 |
| Product Owner | 📋 | Leadership | 요구사항 정의, 우선순위 결정 |
| Full-stack Developer | ⚡ | Engineering | 프론트엔드 + 백엔드 전체 구현 |
| Frontend Developer | 🎨 | Engineering | UI 구현, 컴포넌트 설계 |
| Backend Developer | 🔧 | Engineering | API 설계, 비즈니스 로직 |
| QA Engineer | 🧪 | Engineering | 테스트 전략, 품질 보증 |
| UI/UX Designer | 🖌️ | Design | 사용자 경험 설계 |
| DevOps Engineer | 🚀 | Engineering | CI/CD, 배포, 인프라 |
| Data Engineer | 📊 | Engineering | 데이터 파이프라인, 분석 |
| Security Engineer | 🛡️ | Engineering | 보안 검토, 취약점 분석 |
| Technical Writer | 📝 | Support | 기술 문서 작성 |
| Market Researcher | 🔍 | Research | 시장 규모, 경쟁사, 트렌드 분석 |
| Business Researcher | 📈 | Research | 비즈니스 모델, 수익화, 성장 전략 |
| Tech Researcher | 🧬 | Research | 기술 스택 비교, 벤치마크, 오픈소스 |
| Design Researcher | 🔬 | Research | 사용자 리서치, UX 벤치마크, 접근성 |

## 프로젝트 타입 (9개)

| 타입 | 추천 팀 |
|------|---------|
| 웹 애플리케이션 | CTO + Full-stack + QA |
| API 서버 | CTO + Backend + QA |
| 텔레그램 봇 | CTO + Backend + QA |
| CLI 도구 | CTO + Backend + QA |
| 모바일 앱 | CTO + Full-stack + UI/UX + QA |
| Chrome 확장 | CTO + Frontend + QA |
| 데이터 파이프라인 | CTO + Data + QA |
| 라이브러리/패키지 | CTO + Backend + QA + Tech Writer |
| 커스텀 | CTO + 자유 선택 |

## 프로젝트 구조

```
good-vibe-coding/
├── .claude-plugin/plugin.json    # 플러그인 매니페스트 (v4.0.0)
├── agents/                       # 에이전트 (23개: 15 팀 + 8 서포트)
│   ├── team-cto.md              #   CTO 에이전트
│   ├── team-backend.md          #   Backend 에이전트
│   ├── team-*.md                #   (15개 팀 역할 에이전트)
│   └── *.md                     #   (8개 서포트 에이전트)
├── commands/                     # 커맨드 (21개)
│   ├── hello.md                 #   프로젝트 인프라 셋업
│   ├── new.md                   #   스마트 프로젝트 시작 (v4.0)
│   ├── new-project.md           #   수동 프로젝트 생성
│   ├── discuss.md               #   멀티에이전트 토론
│   ├── approve.md               #   기획서 승인
│   ├── execute.md               #   작업 실행 + 크로스 리뷰
│   └── *.md                     #   ...
├── presets/
│   ├── team-roles/catalog.json  #   15개 역할 카탈로그
│   ├── project-types.json       #   9개 프로젝트 타입
│   ├── templates/               #   5개 프로젝트 템플릿 (JSON)
│   ├── team-personalities.json  #   30개 페르소나 (15역할 x 2변형)
│   ├── personalities.json       #   기존 16개 페르소나
│   ├── roles/                   #   6개 역할 프리셋
│   └── stacks/                  #   2개 스택 프리셋
├── scripts/
│   ├── cli.js                   #   CLI 브릿지 (79개 커맨드)
│   └── lib/                     #   핵심 라이브러리 (28개 모듈)
│       ├── project-scaffolder.js #     프로젝트 인프라 생성
│       ├── github-manager.js   #     gh CLI 래퍼
│       ├── project-manager.js   #     프로젝트 CRUD + 상태 관리
│       ├── team-builder.js      #     팀 추천/구성
│       ├── discussion-engine.js #     토론 프롬프트 생성
│       ├── orchestrator.js      #     멀티에이전트 오케스트레이션 (v4.0)
│       ├── review-engine.js     #     크로스 리뷰 시스템 (v4.0)
│       ├── complexity-analyzer.js #   복잡도 분석 (v4.0)
│       ├── task-distributor.js  #     작업 분배
│       ├── agent-feedback.js    #     에이전트 피드백 (오버라이드 관리)
│       ├── persona-manager.js   #     커스텀 페르소나 CRUD/Merge
│       ├── template-scaffolder.js #   프로젝트 템플릿 스캐폴딩
│       └── *.js                 #     (기타 모듈)
├── templates/                    # Handlebars 템플릿
├── hooks/                        # 훅 정의
├── guides/                       # 학습 가이드
├── skills/                       # 스킬 (5개)
└── tests/                        # Vitest 테스트 (624개)
```

## 기술 스택

- **Node.js 18+** (ESM)
- **Handlebars** (템플릿 엔진)
- **Vitest** (테스트 프레임워크, 624개 테스트)

## 개발

```bash
npm install          # 의존성 설치
npm test             # 전체 테스트 실행
npm run test:watch   # 테스트 감시 모드
npm run test:coverage # 커버리지 리포트
```

## 데이터 저장 위치

| 데이터 | 경로 |
|--------|------|
| 프로젝트 | `~/.claude/good-vibe/projects/{id}/project.json` |
| 에이전트 오버라이드 | `~/.claude/good-vibe/agent-overrides/{roleId}.md` |
| 커스텀 페르소나 | `~/.claude/good-vibe/custom-personas/` |
| 커스텀 템플릿 | `~/.claude/good-vibe/custom-templates/` |

## 로드맵

### Phase 1 - MVP (v1.0)
- [x] 프로젝트 초기화 + 핵심 라이브러리
- [x] `/onboarding` 커맨드 + 온보딩 스킬

### Phase 2 - 확장 (v2.0)
- [x] 6개 직군 프리셋, 에이전트 페르소나
- [x] 에이전트 오케스트레이션
- [x] 설정 초기화/내보내기

### Phase 3 - AI 팀 관리 (v3.0)
- [x] 프로젝트 CRUD + 상태 관리
- [x] 15개 역할 카탈로그 + 30개 페르소나
- [x] 팀 추천/구성 시스템
- [x] 팀 토론 시뮬레이션
- [x] 작업 분배 + 에이전트 실행
- [x] 보고서 생성 + 피드백 시스템
- [x] CLI 브릿지 + 통합 테스트

### Phase 4 - 멀티에이전트 (v4.0) — 현재
- [x] 멀티에이전트 오케스트레이션 (tier별 병렬 디스패치)
- [x] 크로스 리뷰 시스템 (품질 게이트)
- [x] 복잡도 기반 자동 모드 선택
- [x] 에이전트 피드백 재설계 (결과 분석 → 오버라이드)
- [x] 커스텀 페르소나 시스템
- [x] 프로젝트 템플릿 스캐폴딩

### Phase 5 (계획)
- [ ] 마켓플레이스 등록
- [ ] 국제화 (일본어, 영어)

## 라이선스

MIT
