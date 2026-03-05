import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import {
  createEvalSession,
  recordApproachResult,
  scoreCompleteness,
  scoreTechnicalDepth,
  calculateCostEfficiency,
  compareApproaches,
  generateEvalReport,
  saveEvalSession,
  loadEvalSession,
  listEvalSessions,
  setEvalDir,
  buildSinglePromptBaseline,
} from '../scripts/lib/engine/eval-engine.js';

let tmpDir;

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), 'eval-test-'));
  setEvalDir(tmpDir);
});

afterEach(() => {
  rmSync(tmpDir, { recursive: true, force: true });
});

// --- 샘플 데이터 ---

const SAMPLE_OUTPUT_FULL = `
# 시스템 아키텍처 설계

## Architecture
마이크로서비스 아키텍처를 채택하여 각 서비스를 독립적으로 배포합니다.

## Task Breakdown (작업 분해)
- Phase 1: 인프라 설정 (Week 1-2)
- Phase 2: 핵심 기능 구현 (Week 3-6)
- Step 3: 테스트 및 배포

## 기술 스택
- Framework: Next.js + Express
- Database: PostgreSQL + Redis
- Deployment: Docker + Kubernetes

## 위험 분석
주요 리스크:
- API 응답 지연 시 Circuit Breaker 적용
- 데이터 정합성 constraint 관리

## 타임라인
- Sprint 1 (Week 1-2): 인프라
- Sprint 2 (Week 3-4): 핵심 기능
- 마일스톤: MVP 출시

## API 설계
\`\`\`
GET /api/users
POST /api/users
DELETE /api/users/:id
\`\`\`

## 데이터베이스 스키마
\`\`\`sql
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255),
  email VARCHAR(255) UNIQUE
);
\`\`\`

## 에러 처리 전략
- try/catch 블록으로 에러 포착
- Graceful degradation 패턴
- Retry 메커니즘 적용

## 코드 예시
\`\`\`javascript
function createUser(data) {
  return db.users.create(data);
}
\`\`\`
`;

const SAMPLE_OUTPUT_PARTIAL = `
# 프로젝트 개요

## 아키텍처
기본 모놀리식 구조를 사용합니다.

## 기술 스택
React와 Node.js를 사용합니다.
`;

const SAMPLE_OUTPUT_EMPTY = '';

const SAMPLE_RESULT = {
  output: SAMPLE_OUTPUT_FULL,
  tokenCount: 5000,
  apiCalls: 3,
  durationMs: 12000,
  agentCount: 1,
};

const SAMPLE_RESULT_MULTI = {
  output: SAMPLE_OUTPUT_FULL,
  tokenCount: 15000,
  apiCalls: 10,
  durationMs: 30000,
  agentCount: 5,
};

// --- createEvalSession ---

describe('createEvalSession', () => {
  it('유효한 세션을 생성한다', () => {
    const session = createEvalSession('테스트 프로젝트', ['single-prompt', 'multi-agent']);
    expect(session.sessionId).toBeTruthy();
    expect(session.sessionId).toMatch(/^[0-9a-f]{8}-/);
    expect(session.projectDescription).toBe('테스트 프로젝트');
    expect(session.approaches).toEqual(['single-prompt', 'multi-agent']);
    expect(session.results).toEqual({});
    expect(session.createdAt).toBeTruthy();
    expect(new Date(session.createdAt).getTime()).not.toBeNaN();
  });

  it('고유한 sessionId를 생성한다', () => {
    const session1 = createEvalSession('프로젝트 A', ['a']);
    const session2 = createEvalSession('프로젝트 B', ['b']);
    expect(session1.sessionId).not.toBe(session2.sessionId);
  });

  it('approaches 배열을 복사한다 (원본 불변)', () => {
    const approaches = ['single-prompt', 'multi-agent'];
    const session = createEvalSession('프로젝트', approaches);
    approaches.push('cross-model');
    expect(session.approaches).toHaveLength(2);
  });
});

// --- recordApproachResult ---

describe('recordApproachResult', () => {
  it('결과를 추가하고 새 세션을 반환한다', () => {
    const session = createEvalSession('프로젝트', ['single-prompt']);
    const updated = recordApproachResult(session, 'single-prompt', SAMPLE_RESULT);

    expect(updated.results['single-prompt']).toBeDefined();
    expect(updated.results['single-prompt'].tokenCount).toBe(5000);
    expect(updated.results['single-prompt'].apiCalls).toBe(3);
  });

  it('원본 세션을 변경하지 않는다', () => {
    const session = createEvalSession('프로젝트', ['single-prompt', 'multi-agent']);
    const updated = recordApproachResult(session, 'single-prompt', SAMPLE_RESULT);

    expect(session.results).toEqual({});
    expect(updated.results['single-prompt']).toBeDefined();
    expect(session).not.toBe(updated);
  });

  it('기존 결과를 보존하면서 추가한다', () => {
    const session = createEvalSession('프로젝트', ['single-prompt', 'multi-agent']);
    const step1 = recordApproachResult(session, 'single-prompt', SAMPLE_RESULT);
    const step2 = recordApproachResult(step1, 'multi-agent', SAMPLE_RESULT_MULTI);

    expect(step2.results['single-prompt']).toBeDefined();
    expect(step2.results['multi-agent']).toBeDefined();
    // step1은 변경되지 않아야 함
    expect(step1.results['multi-agent']).toBeUndefined();
  });
});

// --- scoreCompleteness ---

describe('scoreCompleteness', () => {
  it('모든 섹션을 감지한다 (완전한 출력)', () => {
    const result = scoreCompleteness(SAMPLE_OUTPUT_FULL, '테스트 프로젝트');
    expect(result.score).toBe(100);
    expect(result.breakdown.architecture).toBe(true);
    expect(result.breakdown.taskBreakdown).toBe(true);
    expect(result.breakdown.techStack).toBe(true);
    expect(result.breakdown.riskAnalysis).toBe(true);
    expect(result.breakdown.timeline).toBe(true);
  });

  it('빈 출력을 처리한다', () => {
    const result = scoreCompleteness(SAMPLE_OUTPUT_EMPTY, '프로젝트');
    expect(result.score).toBe(0);
    expect(Object.values(result.breakdown).every((v) => v === false)).toBe(true);
  });

  it('부분 출력의 점수를 계산한다', () => {
    const result = scoreCompleteness(SAMPLE_OUTPUT_PARTIAL, '프로젝트');
    expect(result.score).toBeGreaterThan(0);
    expect(result.score).toBeLessThan(100);
    expect(result.breakdown.architecture).toBe(true);
    expect(result.breakdown.techStack).toBe(true);
  });

  it('null/undefined 출력을 안전하게 처리한다', () => {
    const result = scoreCompleteness(null, '프로젝트');
    expect(result.score).toBe(0);

    const result2 = scoreCompleteness(undefined, '프로젝트');
    expect(result2.score).toBe(0);
  });

  it('영어 키워드를 감지한다', () => {
    const output =
      'System Design architecture. Task breakdown with steps. Tech stack includes tools. Risk analysis section. Timeline and milestones.';
    const result = scoreCompleteness(output, '프로젝트');
    expect(result.score).toBe(100);
  });

  it('한국어 키워드를 감지한다', () => {
    const output = '아키텍처 설계. 작업 분해 계획. 기술 스택 선택. 위험 분석. 타임라인 수립.';
    const result = scoreCompleteness(output, '프로젝트');
    expect(result.score).toBe(100);
  });
});

// --- scoreTechnicalDepth ---

describe('scoreTechnicalDepth', () => {
  it('모든 기술 항목을 감지한다 (완전한 출력)', () => {
    const result = scoreTechnicalDepth(SAMPLE_OUTPUT_FULL);
    expect(result.score).toBe(100);
    expect(result.breakdown.specificLibraries).toBe(true);
    expect(result.breakdown.codeExamples).toBe(true);
    expect(result.breakdown.apiDesign).toBe(true);
    expect(result.breakdown.databaseSchema).toBe(true);
    expect(result.breakdown.errorHandling).toBe(true);
  });

  it('빈 출력을 처리한다', () => {
    const result = scoreTechnicalDepth(SAMPLE_OUTPUT_EMPTY);
    expect(result.score).toBe(0);
    expect(Object.values(result.breakdown).every((v) => v === false)).toBe(true);
  });

  it('특정 라이브러리를 감지한다 (일반 단어 제외)', () => {
    const withSpecific = scoreTechnicalDepth('React와 PostgreSQL을 사용합니다.');
    expect(withSpecific.breakdown.specificLibraries).toBe(true);

    const withoutSpecific = scoreTechnicalDepth('좋은 도구를 사용합니다.');
    expect(withoutSpecific.breakdown.specificLibraries).toBe(false);
  });

  it('코드 예시를 감지한다', () => {
    const withCode = scoreTechnicalDepth('```javascript\nconst x = 1;\n```');
    expect(withCode.breakdown.codeExamples).toBe(true);

    const withInline = scoreTechnicalDepth('function hello() { return 1; }');
    expect(withInline.breakdown.codeExamples).toBe(true);

    const noCode = scoreTechnicalDepth('코드 없는 일반 텍스트입니다.');
    expect(noCode.breakdown.codeExamples).toBe(false);
  });

  it('API 설계를 감지한다', () => {
    const withApi = scoreTechnicalDepth('GET /api/users endpoint');
    expect(withApi.breakdown.apiDesign).toBe(true);
  });

  it('데이터베이스 스키마를 감지한다', () => {
    const withSchema = scoreTechnicalDepth('CREATE TABLE users with primary key');
    expect(withSchema.breakdown.databaseSchema).toBe(true);
  });

  it('에러 처리 전략을 감지한다', () => {
    const withError = scoreTechnicalDepth('Error handling with try-catch and retry mechanism');
    expect(withError.breakdown.errorHandling).toBe(true);
  });

  it('null/undefined 출력을 안전하게 처리한다', () => {
    const result = scoreTechnicalDepth(null);
    expect(result.score).toBe(0);

    const result2 = scoreTechnicalDepth(undefined);
    expect(result2.score).toBe(0);
  });
});

// --- calculateCostEfficiency ---

describe('calculateCostEfficiency', () => {
  it('claude 모델 비용을 계산한다', () => {
    const result = calculateCostEfficiency({ tokenCount: 10000 }, 'claude');
    expect(result.estimatedCost).toBeCloseTo(0.03, 5);
    expect(result.tokensUsed).toBe(10000);
  });

  it('openai 모델 비용을 계산한다', () => {
    const result = calculateCostEfficiency({ tokenCount: 10000 }, 'openai');
    expect(result.estimatedCost).toBeCloseTo(0.05, 5);
  });

  it('gemini 모델 비용을 계산한다', () => {
    const result = calculateCostEfficiency({ tokenCount: 10000 }, 'gemini');
    expect(result.estimatedCost).toBeCloseTo(0.01, 5);
  });

  it('기본 모델은 claude이다', () => {
    const result = calculateCostEfficiency({ tokenCount: 10000 });
    expect(result.estimatedCost).toBeCloseTo(0.03, 5);
  });

  it('토큰이 0인 경우를 처리한다', () => {
    const result = calculateCostEfficiency({ tokenCount: 0 });
    expect(result.estimatedCost).toBe(0);
    expect(result.tokensUsed).toBe(0);
  });

  it('tokenCount가 없는 경우를 처리한다', () => {
    const result = calculateCostEfficiency({});
    expect(result.estimatedCost).toBe(0);
    expect(result.tokensUsed).toBe(0);
  });

  it('알 수 없는 모델은 claude 비용을 사용한다', () => {
    const result = calculateCostEfficiency({ tokenCount: 10000 }, 'unknown-model');
    expect(result.estimatedCost).toBeCloseTo(0.03, 5);
  });
});

// --- compareApproaches ---

describe('compareApproaches', () => {
  it('정확한 순위와 승자를 반환한다', () => {
    let session = createEvalSession('프로젝트', ['single-prompt', 'multi-agent']);
    session = recordApproachResult(session, 'single-prompt', {
      output: SAMPLE_OUTPUT_PARTIAL,
      tokenCount: 2000,
      apiCalls: 1,
      durationMs: 5000,
      agentCount: 1,
    });
    session = recordApproachResult(session, 'multi-agent', {
      output: SAMPLE_OUTPUT_FULL,
      tokenCount: 15000,
      apiCalls: 10,
      durationMs: 30000,
      agentCount: 5,
    });

    const comparison = compareApproaches(session);
    expect(comparison.winner).toBeTruthy();
    expect(comparison.rankings).toHaveLength(2);
    expect(comparison.rankings[0].approach).toBe(comparison.winner);

    // multi-agent는 완성도/기술 깊이가 더 높아야 함
    const multiRank = comparison.rankings.find((r) => r.approach === 'multi-agent');
    const singleRank = comparison.rankings.find((r) => r.approach === 'single-prompt');
    expect(multiRank.completeness).toBeGreaterThan(singleRank.completeness);
    expect(multiRank.technicalDepth).toBeGreaterThan(singleRank.technicalDepth);
  });

  it('종합 점수 공식을 검증한다 (40/40/20 가중치)', () => {
    let session = createEvalSession('프로젝트', ['approach-a']);
    session = recordApproachResult(session, 'approach-a', {
      output: SAMPLE_OUTPUT_FULL,
      tokenCount: 5000,
      apiCalls: 3,
      durationMs: 10000,
      agentCount: 1,
    });

    const comparison = compareApproaches(session);
    const ranking = comparison.rankings[0];

    // 단일 접근법이면 비용 효율 50 (cost === maxCost 보정)
    expect(ranking.costEfficiency).toBe(50);
    const expectedOverall = Math.round(
      ranking.completeness * 0.4 + ranking.technicalDepth * 0.4 + ranking.costEfficiency * 0.2,
    );
    expect(ranking.overall).toBe(expectedOverall);
  });

  it('결과가 없으면 빈 비교를 반환한다', () => {
    const session = createEvalSession('프로젝트', ['a', 'b']);
    const comparison = compareApproaches(session);
    expect(comparison.winner).toBe('');
    expect(comparison.rankings).toHaveLength(0);
  });

  it('단일 접근법도 처리한다', () => {
    let session = createEvalSession('프로젝트', ['single-only']);
    session = recordApproachResult(session, 'single-only', SAMPLE_RESULT);

    const comparison = compareApproaches(session);
    expect(comparison.winner).toBe('single-only');
    expect(comparison.rankings).toHaveLength(1);
  });

  it('동일 점수일 때 첫 번째를 승자로 선정한다', () => {
    let session = createEvalSession('프로젝트', ['a', 'b']);
    const sameResult = {
      output: SAMPLE_OUTPUT_FULL,
      tokenCount: 5000,
      apiCalls: 3,
      durationMs: 10000,
      agentCount: 1,
    };
    session = recordApproachResult(session, 'a', sameResult);
    session = recordApproachResult(session, 'b', sameResult);

    const comparison = compareApproaches(session);
    expect(comparison.rankings).toHaveLength(2);
    // 동일 점수면 정렬 안정성에 의해 첫 번째가 유지됨
    expect(comparison.rankings[0].overall).toBe(comparison.rankings[1].overall);
  });

  it('summary에 승자 정보가 포함된다', () => {
    let session = createEvalSession('프로젝트', ['a']);
    session = recordApproachResult(session, 'a', SAMPLE_RESULT);

    const comparison = compareApproaches(session);
    expect(comparison.summary).toContain('a');
  });
});

// --- generateEvalReport ---

describe('generateEvalReport', () => {
  it('올바른 마크다운 보고서를 생성한다', () => {
    let session = createEvalSession('채팅 앱 개발', ['single-prompt', 'multi-agent']);
    session = recordApproachResult(session, 'single-prompt', {
      output: SAMPLE_OUTPUT_PARTIAL,
      tokenCount: 2000,
      apiCalls: 1,
      durationMs: 5000,
      agentCount: 1,
    });
    session = recordApproachResult(session, 'multi-agent', {
      output: SAMPLE_OUTPUT_FULL,
      tokenCount: 15000,
      apiCalls: 10,
      durationMs: 30000,
      agentCount: 5,
    });

    const comparison = compareApproaches(session);
    const report = generateEvalReport(session, comparison);

    // 필수 섹션 확인
    expect(report).toContain('# 평가 보고서');
    expect(report).toContain('## 프로젝트');
    expect(report).toContain('채팅 앱 개발');
    expect(report).toContain('## 접근법 비교');
    expect(report).toContain('## 상세 분석');
    expect(report).toContain('## 권장사항');

    // 테이블 구조 확인
    expect(report).toContain('| 접근법 |');
    expect(report).toContain('| single-prompt |');
    expect(report).toContain('| multi-agent |');
  });

  it('상세 분석에 각 접근법의 메트릭이 포함된다', () => {
    let session = createEvalSession('프로젝트', ['a']);
    session = recordApproachResult(session, 'a', {
      output: SAMPLE_OUTPUT_FULL,
      tokenCount: 5000,
      apiCalls: 3,
      durationMs: 12000,
      agentCount: 2,
    });

    const comparison = compareApproaches(session);
    const report = generateEvalReport(session, comparison);

    expect(report).toContain('토큰 사용량: 5000');
    expect(report).toContain('API 호출 수: 3');
    expect(report).toContain('소요 시간: 12000ms');
    expect(report).toContain('에이전트 수: 2');
  });

  it('단일 접근법일 때 적절한 권장사항을 제공한다', () => {
    let session = createEvalSession('프로젝트', ['only-one']);
    session = recordApproachResult(session, 'only-one', SAMPLE_RESULT);

    const comparison = compareApproaches(session);
    const report = generateEvalReport(session, comparison);

    expect(report).toContain('단일 접근법');
    expect(report).toContain('추가 접근법');
  });

  it('완성도 breakdown을 O/X로 표시한다', () => {
    let session = createEvalSession('프로젝트', ['a']);
    session = recordApproachResult(session, 'a', {
      output: SAMPLE_OUTPUT_FULL,
      tokenCount: 1000,
      apiCalls: 1,
      durationMs: 5000,
      agentCount: 1,
    });

    const comparison = compareApproaches(session);
    const report = generateEvalReport(session, comparison);

    expect(report).toContain('architecture: O');
    expect(report).toContain('taskBreakdown: O');
  });
});

// --- saveEvalSession / loadEvalSession ---

describe('saveEvalSession / loadEvalSession', () => {
  it('세션을 저장하고 로드한다 (라운드트립)', async () => {
    let session = createEvalSession('라운드트립 테스트', ['a', 'b']);
    session = recordApproachResult(session, 'a', SAMPLE_RESULT);

    await saveEvalSession(session);
    const loaded = await loadEvalSession(session.sessionId);

    expect(loaded.sessionId).toBe(session.sessionId);
    expect(loaded.projectDescription).toBe('라운드트립 테스트');
    expect(loaded.approaches).toEqual(['a', 'b']);
    expect(loaded.results.a.tokenCount).toBe(5000);
    expect(loaded.createdAt).toBe(session.createdAt);
  });

  it('존재하지 않는 세션 로드 시 에러를 던진다', async () => {
    await expect(loadEvalSession('nonexistent-id')).rejects.toThrow();
  });

  it('여러 세션을 독립적으로 저장/로드한다', async () => {
    const session1 = createEvalSession('프로젝트 1', ['a']);
    const session2 = createEvalSession('프로젝트 2', ['b']);

    await saveEvalSession(session1);
    await saveEvalSession(session2);

    const loaded1 = await loadEvalSession(session1.sessionId);
    const loaded2 = await loadEvalSession(session2.sessionId);

    expect(loaded1.projectDescription).toBe('프로젝트 1');
    expect(loaded2.projectDescription).toBe('프로젝트 2');
  });
});

// --- listEvalSessions ---

describe('listEvalSessions', () => {
  it('저장된 세션 목록을 반환한다', async () => {
    const session1 = createEvalSession('프로젝트 A', ['a', 'b']);
    const session2 = createEvalSession('프로젝트 B', ['x']);

    await saveEvalSession(session1);
    await saveEvalSession(session2);

    const list = await listEvalSessions();
    expect(list).toHaveLength(2);

    const ids = list.map((s) => s.sessionId);
    expect(ids).toContain(session1.sessionId);
    expect(ids).toContain(session2.sessionId);
  });

  it('올바른 메타데이터를 반환한다', async () => {
    const session = createEvalSession('메타 테스트', ['a', 'b', 'c']);
    await saveEvalSession(session);

    const list = await listEvalSessions();
    const item = list.find((s) => s.sessionId === session.sessionId);

    expect(item.projectDescription).toBe('메타 테스트');
    expect(item.createdAt).toBe(session.createdAt);
    expect(item.approachCount).toBe(3);
  });

  it('세션이 없으면 빈 배열을 반환한다', async () => {
    const list = await listEvalSessions();
    expect(list).toEqual([]);
  });

  it('디렉토리가 존재하지 않아도 빈 배열을 반환한다', async () => {
    setEvalDir('/tmp/nonexistent-eval-dir-' + Date.now());
    const list = await listEvalSessions();
    expect(list).toEqual([]);
  });
});

// --- buildSinglePromptBaseline ---

describe('buildSinglePromptBaseline', () => {
  it('프로젝트 설명을 포함한다', () => {
    const prompt = buildSinglePromptBaseline('날씨 알림 텔레그램 봇');
    expect(prompt).toContain('날씨 알림 텔레그램 봇');
  });

  it('멀티에이전트 팀이 다루는 모든 분석 영역을 포함한다', () => {
    const prompt = buildSinglePromptBaseline('테스트 프로젝트');
    expect(prompt).toContain('아키텍처');
    expect(prompt).toContain('기술 스택');
    expect(prompt).toContain('작업 분해');
    expect(prompt).toContain('API 설계');
    expect(prompt).toContain('데이터베이스 스키마');
    expect(prompt).toContain('에러 처리');
    expect(prompt).toContain('위험 분석');
    expect(prompt).toContain('타임라인');
    expect(prompt).toContain('보안');
    expect(prompt).toContain('테스트 전략');
  });

  it('마크다운 출력을 요청한다', () => {
    const prompt = buildSinglePromptBaseline('프로젝트');
    expect(prompt).toContain('마크다운');
  });

  it('코드 예시를 요청한다', () => {
    const prompt = buildSinglePromptBaseline('프로젝트');
    expect(prompt).toContain('코드 예시');
  });
});

// --- Edge cases ---

describe('Edge cases', () => {
  it('세 개 이상의 접근법을 비교한다', () => {
    let session = createEvalSession('프로젝트', ['a', 'b', 'c']);
    session = recordApproachResult(session, 'a', {
      output: SAMPLE_OUTPUT_FULL,
      tokenCount: 5000,
      apiCalls: 3,
      durationMs: 10000,
      agentCount: 1,
    });
    session = recordApproachResult(session, 'b', {
      output: SAMPLE_OUTPUT_PARTIAL,
      tokenCount: 2000,
      apiCalls: 1,
      durationMs: 3000,
      agentCount: 1,
    });
    session = recordApproachResult(session, 'c', {
      output: SAMPLE_OUTPUT_EMPTY,
      tokenCount: 500,
      apiCalls: 1,
      durationMs: 1000,
      agentCount: 1,
    });

    const comparison = compareApproaches(session);
    expect(comparison.rankings).toHaveLength(3);
    // 완전한 출력이 가장 높아야 함
    expect(comparison.rankings[0].approach).toBe('a');
  });

  it('매우 큰 토큰 수를 처리한다', () => {
    const result = calculateCostEfficiency({ tokenCount: 1000000 }, 'claude');
    expect(result.estimatedCost).toBeCloseTo(3.0, 1);
  });

  it('전체 워크플로우 통합 테스트', async () => {
    // 1. 세션 생성
    const session = createEvalSession('통합 테스트 프로젝트', ['single-prompt', 'multi-agent']);

    // 2. 결과 기록
    const step1 = recordApproachResult(session, 'single-prompt', {
      output: SAMPLE_OUTPUT_PARTIAL,
      tokenCount: 3000,
      apiCalls: 1,
      durationMs: 8000,
      agentCount: 1,
    });
    const step2 = recordApproachResult(step1, 'multi-agent', {
      output: SAMPLE_OUTPUT_FULL,
      tokenCount: 12000,
      apiCalls: 8,
      durationMs: 25000,
      agentCount: 4,
    });

    // 3. 비교
    const comparison = compareApproaches(step2);
    expect(comparison.winner).toBeTruthy();
    expect(comparison.rankings).toHaveLength(2);

    // 4. 보고서 생성
    const report = generateEvalReport(step2, comparison);
    expect(report).toContain('통합 테스트 프로젝트');

    // 5. 저장/로드
    await saveEvalSession(step2);
    const loaded = await loadEvalSession(step2.sessionId);
    expect(loaded.projectDescription).toBe('통합 테스트 프로젝트');

    // 6. 목록 확인
    const list = await listEvalSessions();
    expect(list.length).toBeGreaterThanOrEqual(1);
    expect(list.find((s) => s.sessionId === step2.sessionId)).toBeDefined();
  });
});
