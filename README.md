# Good Vibe Coding v3.0

**Virtual AI Team Management Platform** — AI 팀을 구성하고 프로젝트를 관리하세요

사용자가 **CEO**가 되어 프로젝트를 정의하면, AI 팀원들이 토론하고 기획하고 실행합니다.

## 핵심 특징

- **가상 AI 팀**: 11개 역할 (CTO, Backend, QA, Frontend...) 각각 2개 페르소나 변형
- **팀 토론 시뮬레이션**: 팀원들이 자신의 역할과 성격으로 프로젝트를 토론
- **기획서 자동 생성**: 토론 결과를 정형화된 기획서로 산출
- **두 가지 모드**: "기획만" (plan-only) / "기획+실행" (plan-execute)
- **피드백 시스템**: 팀원 평가 및 누적 성과 관리
- **성장 시스템**: 피드백 기반 팀원 성장 추적 (Lv.1~5) + 프롬프트 자동 주입
- **한국어 완전 지원**: 모든 가이드, 프롬프트, 에이전트가 한국어
- **v2 호환**: 기존 온보딩 마법사 (`/onboarding`) 그대로 사용 가능

## 설치

```bash
git clone https://github.com/your-repo/good-vibe-coding.git
cd good-vibe-coding
npm install
```

## 사용법: CEO 시나리오

### 1. 새 프로젝트 시작

```
/new-project
```

대화형 마법사가 시작됩니다:
1. 프로젝트 설명 입력 ("텔레그램 봇을 만들고 싶어")
2. 프로젝트 타입 선택 (9개 중)
3. 모드 선택 (기획만 / 기획+실행)
4. 추천 팀 확인 및 수정
5. 팀원 페르소나 선택

### 2. 팀 토론

```
/discuss
```

팀원들이 각자의 역할과 성격으로 프로젝트를 토론합니다:
- CTO가 아키텍처 방향 제시
- Backend 개발자가 기술 세부사항 논의
- QA가 테스트 전략 제안
- 기획서 도출

### 3. 기획서 승인

```
/approve
```

CEO가 기획서를 검토하고 승인합니다. 승인 후 작업이 역할별로 분배됩니다.

### 4. 작업 실행 (plan-execute 모드)

```
/execute
```

분배된 작업을 팀원(에이전트)들이 실행합니다.

### 5. 보고서 & 피드백

```
/report     # 최종 보고서 생성
/feedback   # 팀원별 피드백
```

## 전체 커맨드

### v3 커맨드 (프로젝트 관리)

| 커맨드 | 설명 |
|--------|------|
| `/new-project` | 새 프로젝트 생성 (메인 진입점) |
| `/discuss` | 팀 토론 실행 |
| `/approve` | 기획서 승인 + 작업 분배 |
| `/execute` | 작업 실행 (plan-execute 모드) |
| `/status` | 프로젝트 상태 대시보드 |
| `/report` | 최종 보고서 생성 |
| `/feedback` | 팀원 피드백 |
| `/growth` | 팀원 성장 현황 조회 |
| `/my-team` | 팀 현황 + 역할 카탈로그 |
| `/projects` | 프로젝트 목록 |

### v2 커맨드 (온보딩/설정)

| 커맨드 | 설명 |
|--------|------|
| `/onboarding` | 역할 기반 온보딩 마법사 |
| `/my-config` | 현재 설정 대시보드 |
| `/learn` | 역할별 학습 가이드 |
| `/add-skill` | 스킬 추가 |
| `/add-agent` | 에이전트 추가 |
| `/preset` | 프리셋 관리 |
| `/reset` | 설정 초기화 |

## 역할 카탈로그 (11개)

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
├── .claude-plugin/plugin.json    # 플러그인 매니페스트 (v3.0.0)
├── agents/                       # 에이전트 (19개: 11 팀 + 8 온보딩)
│   ├── team-cto.md              #   CTO 에이전트
│   ├── team-backend.md          #   Backend 에이전트
│   ├── team-*.md                #   (11개 팀 역할 에이전트)
│   └── *.md                     #   (8개 기존 온보딩 에이전트)
├── commands/                     # 커맨드 (17개: 10 프로젝트 + 7 온보딩)
│   ├── new-project.md           #   프로젝트 생성
│   ├── discuss.md               #   팀 토론
│   ├── approve.md               #   기획서 승인
│   └── *.md                     #   ...
├── presets/
│   ├── team-roles/catalog.json  #   11개 역할 카탈로그
│   ├── project-types.json       #   9개 프로젝트 타입
│   ├── team-personalities.json  #   22개 페르소나 (11역할 x 2변형)
│   ├── personalities.json       #   기존 16개 페르소나
│   ├── roles/                   #   6개 역할 프리셋
│   └── stacks/                  #   2개 스택 프리셋
├── scripts/
│   ├── cli.js                   #   CLI 브릿지 (v3)
│   └── lib/                     #   핵심 라이브러리 (14개)
│       ├── project-manager.js   #     프로젝트 CRUD
│       ├── team-builder.js      #     팀 추천/구성
│       ├── discussion-engine.js #     토론 프롬프트 생성
│       ├── task-distributor.js  #     작업 분배
│       ├── report-generator.js  #     보고서 생성
│       ├── feedback-manager.js  #     피드백/성과
│       ├── growth-manager.js   #     성장 시스템
│       ├── config-generator.js  #     설정 생성 (v2)
│       └── *.js                 #     (기존 8개 라이브러리)
├── templates/                    # Handlebars 템플릿
├── hooks/                        # 훅 정의
├── guides/                       # 학습 가이드
├── skills/                       # 스킬 (4개)
└── tests/                        # Vitest 테스트 (258개)
    ├── project-manager.test.js  #   23개 테스트
    ├── team-builder.test.js     #   19개 테스트
    ├── discussion-engine.test.js#   13개 테스트
    ├── task-distributor.test.js #   23개 테스트
    ├── report-generator.test.js #   13개 테스트
    ├── feedback-manager.test.js #   10개 테스트
    ├── growth-manager.test.js   #   27개 테스트
    ├── integration.test.js      #   9개 테스트
    └── *.test.js                #   (기존 121개 테스트)
```

## 기술 스택

- **Node.js 18+** (ESM)
- **Handlebars** (템플릿 엔진)
- **Vitest** (테스트 프레임워크, 258개 테스트)

## 개발

```bash
npm install          # 의존성 설치
npm test             # 전체 테스트 실행 (258개)
npm run test:watch   # 테스트 감시 모드
npm run test:coverage # 커버리지 리포트
```

## CLI 직접 사용

커맨드에서 내부적으로 호출하는 CLI를 직접 사용할 수도 있습니다:

```bash
# 프로젝트 타입 조회
node scripts/cli.js project-types

# 팀 추천
node scripts/cli.js recommend-team --type telegram-bot

# 역할 카탈로그
node scripts/cli.js role-catalog

# 팀 통계
node scripts/cli.js team-stats
```

## 로드맵

### Phase 1 - MVP (v1.0)
- [x] 프로젝트 초기화 + 핵심 라이브러리
- [x] `/onboarding` 커맨드 + 온보딩 스킬

### Phase 2 - 확장 (v2.0)
- [x] 6개 직군 프리셋, 에이전트 페르소나
- [x] 에이전트 오케스트레이션
- [x] 설정 초기화/내보내기

### Phase 3 - AI 팀 관리 (v3.0) ← 현재
- [x] 프로젝트 CRUD + 상태 관리
- [x] 11개 역할 카탈로그 + 22개 페르소나
- [x] 팀 추천/구성 시스템
- [x] 팀 토론 시뮬레이션
- [x] 작업 분배 + 에이전트 실행
- [x] 보고서 생성 + 피드백 시스템
- [x] 9개 프로젝트 관리 커맨드
- [x] 11개 팀 에이전트
- [x] CLI 브릿지 + 통합 테스트

### Phase 4 - 성장 시스템 (v3.1)
- [x] 팀원 성장 시스템 (피드백 → 성장 레벨 → 프롬프트 자동 주입)
- [x] `/growth` 커맨드 (성장 현황 조회)
- [x] 토론/실행/보고서에 성장 컨텍스트 반영

### Phase 5 (계획)
- [ ] 마켓플레이스 등록
- [ ] 프로젝트 템플릿 (boilerplate 연동)
- [ ] 국제화 (일본어, 영어)

## 라이선스

MIT
