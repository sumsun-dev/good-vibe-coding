# /growth — 팀원 성장 현황 조회

팀원들의 피드백 기반 성장 현황을 확인합니다.

## 사용법

### 전체 팀 성장 현황

```
/growth
```

### 특정 역할 성장 분석

```
/growth backend
```

## 동작

### Step 1: 성장 데이터 조회

CLI를 통해 성장 프로필을 조회합니다:

```bash
# 전체 팀 성장 현황
node scripts/cli.js growth

# 특정 역할 성장 분석
node scripts/cli.js growth --role backend
```

### Step 2: 결과 표시

사용자에게 성장 현황 테이블을 표시합니다:

- **레벨**: Lv.1 Beginner ~ Lv.5 Expert
- **평균 평점**: 누적 피드백 기반
- **강점/개선점**: 코멘트 키워드 분석
- **성장 목표**: 다음 레벨 달성을 위한 목표

### Step 3: 팁 제공

- 피드백이 없는 팀원에게는 `/feedback`으로 피드백을 남기도록 안내
- 성장 데이터는 `/new-project`에서 `withGrowth` 옵션으로 활용 가능

## 레벨 기준

| 레벨 | 이름 | 조건 |
|------|------|------|
| Lv.1 | Beginner | 프로젝트 ≤1 또는 평균 <2.0 |
| Lv.2 | Growing | 프로젝트 ≥2, 평균 2.0-2.9 |
| Lv.3 | Competent | 프로젝트 ≥3, 평균 3.0-3.9 |
| Lv.4 | Advanced | 프로젝트 ≥4, 평균 4.0-4.4 |
| Lv.5 | Expert | 프로젝트 ≥5, 평균 ≥4.5 |
