# Good Vibe Coding

**모든 직군을 위한 한국어 Claude Code 온보딩 플러그인**

`/onboarding`을 실행하면 대화형으로 역할/업무/도구를 선택하고, 각자에게 맞는 Claude Code 설정을 자동 생성합니다.

## 핵심 특징

- **한국어 완전 지원**: 모든 가이드, 프롬프트, 에이전트가 한국어
- **모든 직군 지원**: 개발자, PM, 디자이너, 리서처, 마케터, 학생
- **인터랙티브 온보딩**: 5단계 대화형 설정 마법사
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

5단계 대화형 마법사가 시작됩니다:
1. 환경 감지
2. 역할 선택 (개발/기획/디자인/리서치/콘텐츠/학습)
3. 업무/도구 세부 선택
4. 워크플로우 스타일 선택
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

## 지원 역할

| 역할 | 설명 | 에이전트 | 스킬 |
|------|------|---------|------|
| 개발자 | 풀스택/프론트/백엔드 | 코드리뷰어, TDD코치 | side-impact, tdd-workflow, verify, code-review |
| PM/기획자 | PM/PO/프로젝트 매니저 | 문서검토기 | prd-writer, meeting-notes, issue-tracker |
| 디자이너 | UI/UX/퍼블리셔 | 접근성체커 | design-system, css-helper |
| 리서처 | UX리서치/데이터분석 | 데이터분석도우미 | data-collector, report-writer |
| 콘텐츠 | 블로거/마케터/카피라이터 | 글편집기 | blog-writer, seo-checker |
| 학생 | 입문자/직무전환자 | 학습멘토 | beginner-guide |

## 프로젝트 구조

```
good-vibe-coding/
├── .claude-plugin/plugin.json    # 플러그인 매니페스트
├── agents/                       # 직군별 에이전트 (8개)
├── commands/                     # 커맨드 (7개)
├── skills/                       # 스킬 (4개)
├── presets/roles/                 # 역할 프리셋 (6개)
├── templates/                    # Handlebars 템플릿
├── guides/common/                # 한국어 학습 가이드
├── scripts/lib/                  # 핵심 라이브러리
│   ├── config-generator.js       #   설정 생성 엔진
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

### Phase 1 (현재) - MVP
- [x] 프로젝트 초기화 + 핵심 라이브러리
- [x] 템플릿 엔진 + 프리셋 로더
- [x] `/onboarding` 커맨드 + 온보딩 스킬
- [x] 개발자/PM 프리셋
- [x] `/learn`, `/my-config` 커맨드
- [x] 한국어 기초 가이드 2개

### Phase 2 - 확장
- [ ] 나머지 4개 직군 프리셋 완성
- [ ] 직군별 에이전트 활성화
- [ ] 직군별 심화 가이드
- [ ] `/add-skill`, `/add-agent`, `/preset` 구현
- [ ] 스택 프리셋 (nextjs-supabase, react-node)

### Phase 3 - 고도화
- [ ] `/reset` + 설정 내보내기/가져오기
- [ ] 마켓플레이스 등록
- [ ] 커뮤니티 프리셋 공유
- [ ] 국제화 (일본어, 영어)

## 라이선스

MIT
