# internal/ — 내부 개발 도구

이 디렉토리는 Good Vibe Coding 코드베이스 자체를 자동 개선하는 파이프라인입니다.
**사용자용 기능이 아닙니다.**

## 구성

- `daily-improvement.sh` — 오케스트레이터 (VPS cron)
- `improvement/` — Phase 스크립트 + 설정
- `lib/` — Node.js 모듈 (프롬프트 생성, SLA 평가 등)

## 실행

```bash
bash internal/daily-improvement.sh
```

자세한 내용은 프로젝트 루트 CLAUDE.md의 "Daily Improvement" 섹션 참조.
