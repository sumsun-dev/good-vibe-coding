---
description: "팀 현황 + 역할 카탈로그 조회"
---

# /my-team — 팀 현황 + 역할 카탈로그

현재 프로젝트의 팀 구성과 전체 역할 카탈로그를 보여줍니다.

## Step 1: 현재 팀 표시

```bash
node ${CLAUDE_PLUGIN_ROOT}/scripts/cli.js list-projects
```

활성 프로젝트가 있으면 현재 팀을 보여주세요:

```
현재 팀: {프로젝트명}
━━━━━━━━━━━━━━━━━━━━━━
{이름} ({역할}) — {성격}
  "{인사말}"
```

## Step 2: 역할 카탈로그

```bash
node ${CLAUDE_PLUGIN_ROOT}/scripts/cli.js role-catalog
```

전체 역할을 카테고리별로 보여주세요:

```
역할 카탈로그 (15개)
━━━━━━━━━━━━━━━━━━━━━━

Leadership
  CTO — 기술 아키텍처 설계, 기술 의사결정
  Product Owner — 요구사항 정의, 우선순위 결정

Engineering
  Full-stack Developer — 프론트엔드 + 백엔드 전체 구현
  Frontend Developer — UI 구현, 컴포넌트 설계
  Backend Developer — API 설계, 비즈니스 로직
  QA Engineer — 테스트 전략, 품질 보증
  DevOps Engineer — CI/CD, 배포, 인프라
  Data Engineer — 데이터 파이프라인, 분석
  Security Engineer — 보안 검토, 취약점 분석

Design
  UI/UX Designer — 사용자 경험 설계

Support
  Technical Writer — 기술 문서 작성

Research
  Market Researcher — 시장 규모, 경쟁사, 트렌드 분석
  Business Researcher — 비즈니스 모델, 수익화, 성장 전략
  Tech Researcher — 기술 스택 비교, 벤치마크, 오픈소스
  Design Researcher — 사용자 리서치, UX 벤치마크, 접근성
```

## Step 3: 팀 성과 통계

```bash
echo '{"id":"{프로젝트ID}"}' | node ${CLAUDE_PLUGIN_ROOT}/scripts/cli.js team-summary
```

피드백 히스토리가 있으면 역할별 누적 성과를 보여주세요.
