# 실전 예제

Good Vibe Coding의 3가지 모드를 실제 프로젝트 흐름으로 보여드립니다.

---

## 예제 1: 텔레그램 봇 (quick-build, 약 5분)

간단한 봇이나 스크립트를 빠르게 만들고 싶을 때.

### 입력

```
/new
→ "날씨를 알려주는 텔레그램 봇을 만들어줘"
```

### 진행 과정

```
1. 복잡도 분석: simple → quick-build 자동 선택
2. 팀 구성: CTO(민준), Backend(도윤), QA(지민) — 3명
3. CTO 아키텍처 분석:
   - Node.js + node-telegram-bot-api
   - OpenWeatherMap API 연동
   - 주요 파일: bot.js, weather-service.js
4. CEO 확인: "이대로 진행"
5. 작업 분배: 3개 태스크
   - 봇 기본 구조 (Backend)
   - 날씨 API 연동 (Backend)
   - 에러 처리 + 테스트 (QA)
6. 병렬 실행 → QA 리뷰 → 품질 게이트 통과
7. 완료!
```

### 출력

```
프로젝트가 완료되었습니다!
- /report — 보고서 확인
- /feedback — 팀원 성과 분석
```

---

## 예제 2: REST API 서버 (plan-execute, 약 15분)

중간 규모 웹앱이나 API 서버를 만들 때.

### 입력

```
/new
→ "팀 프로젝트 관리를 위한 REST API 서버를 만들어줘.
   사용자 인증, 프로젝트 CRUD, 태스크 관리 기능이 필요해."
```

### 진행 과정

```
1. 명확도 분석: 82% → 통과
2. 복잡도 분석: medium → plan-execute 선택
3. 팀 구성: CTO, PO, Fullstack, Backend, QA — 5명

4. /discuss (1라운드)
   Tier 1: CTO(아키텍처), PO(요구사항) 병렬 분석
   Tier 2: Fullstack, Backend 구현 관점 분석
   Tier 3: QA(테스트 전략), Security(인증 보안) 분석
   → 종합 → 리뷰 → 승인율 85% → 수렴!

5. 자동 승인 → 작업 분배 (Phase 3개, 태스크 8개)
   Phase 1: DB 스키마 + 인증 시스템
   Phase 2: 프로젝트/태스크 CRUD API
   Phase 3: 미들웨어 + 통합 테스트

6. /execute (각 Phase: 실행 → 구체화 → 리뷰 → 품질 게이트)
   Phase 1: 실행 → 리뷰 → PASS
   Phase 2: 실행 → 리뷰 → FAIL (critical 1건) → 수정 → PASS
   Phase 3: 실행 → 리뷰 → PASS

7. 완료!
```

---

## 예제 3: SaaS 웹앱 (plan-only, 약 40분)

대규모 시스템이나 복잡한 아키텍처가 필요할 때.

### 입력

```
/new
→ "마이크로서비스 기반 SaaS 프로젝트 관리 플랫폼을 만들어줘.
   멀티테넌시, 실시간 협업, 결제 연동이 필요해."
```

### 진행 과정

```
1. 명확도 분석: 65% → 추가 질문
   Q: 결제 시스템은? → "Stripe"
   Q: 실시간 기술은? → "WebSocket"
   재분석: 85% → 통과

2. 복잡도 분석: complex → plan-only 선택
3. 팀 구성: CTO, PO, Fullstack, Frontend, Backend, QA, Security, DevOps — 8명

4. /discuss (3라운드)
   Round 1: 승인율 55% → 미수렴
     미합의: 마이크로서비스 경계, 인증 전략
   Round 2: 승인율 75% → 미수렴
     해결: 인증은 Auth 서비스 분리
     미합의: 실시간 이벤트 버스 선택
   Round 3: 승인율 90% → 수렴!

5. /approve → CEO 승인

6. /execute (Phase 5개)
   Phase 1: 공통 인프라 + Auth 서비스
   Phase 2: 프로젝트 서비스 + 태스크 서비스
   Phase 3: 실시간 협업 (WebSocket)
   Phase 4: 결제 연동 (Stripe)
   Phase 5: 통합 테스트 + API 게이트웨이

7. 완료!
```

---

## 팁

- 모드 선택이 어렵다면: `/new`가 복잡도를 자동 분석해서 추천해줍니다
- 중간에 멈추고 싶다면: `/execute`에서 인터랙티브 모드를 선택하세요
- 기획만 필요하다면: `/discuss` → `/approve` → `/report`로 기획 보고서만 받을 수 있습니다
- 실행 중 문제가 반복된다면: 에스컬레이션 시 "직접 지시"로 수정 방향을 제시하세요
