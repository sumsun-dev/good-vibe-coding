import { describe, it, expect } from 'vitest';
import {
  parseReviewResponse,
  parseComplexityResponse,
  parseTaskListResponse,
  parseSuggestionsResponse,
} from '../scripts/lib/domain-parsers.js';

describe('parseReviewResponse', () => {
  it('유효한 리뷰를 파싱한다', () => {
    const raw = JSON.stringify({ approved: true, feedback: '좋습니다', issues: [] });
    const result = parseReviewResponse(raw);
    expect(result.approved).toBe(true);
    expect(result.feedback).toBe('좋습니다');
    expect(result.issues).toEqual([]);
  });

  it('이슈를 정규화한다', () => {
    const raw = JSON.stringify({
      approved: false,
      feedback: '수정 필요',
      issues: [{ severity: 'critical', description: 'SQL injection' }],
    });
    const result = parseReviewResponse(raw);
    expect(result.issues.length).toBe(1);
    expect(result.issues[0].severity).toBe('critical');
    expect(result.issues[0].file).toBeNull();
  });

  it('파싱 불가능한 텍스트는 기본값을 반환한다', () => {
    const result = parseReviewResponse('not json');
    expect(result.approved).toBe(false);
    expect(result.parseError).toBe(true);
  });

  it('null 입력을 처리한다', () => {
    const result = parseReviewResponse(null);
    expect(result.parseError).toBe(true);
  });
});

describe('parseComplexityResponse', () => {
  it('유효한 분석을 파싱한다', () => {
    const raw = JSON.stringify({ level: 'complex', reasoning: '대규모', recommendations: ['팀 확대'] });
    const result = parseComplexityResponse(raw);
    expect(result.level).toBe('complex');
    expect(result.reasoning).toBe('대규모');
  });

  it('유효하지 않은 레벨은 medium으로 대체한다', () => {
    const raw = JSON.stringify({ level: 'invalid', reasoning: 'test' });
    const result = parseComplexityResponse(raw);
    expect(result.level).toBe('medium');
  });

  it('파싱 불가능한 텍스트는 기본값을 반환한다', () => {
    const result = parseComplexityResponse('bad');
    expect(result.level).toBe('medium');
    expect(result.parseError).toBe(true);
  });
});

describe('parseTaskListResponse', () => {
  it('태스크 배열을 파싱한다', () => {
    const raw = JSON.stringify([
      { title: 'API 구현', assignee: 'backend' },
      { title: 'UI 설계', assignee: 'frontend' },
    ]);
    const result = parseTaskListResponse(raw);
    expect(result.length).toBe(2);
    expect(result[0].title).toBe('API 구현');
    expect(result[0].id).toBe('task-1');
    expect(result[0].phase).toBe(1);
  });

  it('title이 없는 항목은 필터링한다', () => {
    const raw = JSON.stringify([{ title: 'A' }, { assignee: 'b' }]);
    const result = parseTaskListResponse(raw);
    expect(result.length).toBe(1);
  });

  it('빈 입력은 빈 배열을 반환한다', () => {
    expect(parseTaskListResponse('')).toEqual([]);
    expect(parseTaskListResponse(null)).toEqual([]);
  });
});

describe('parseReviewResponse — 엣지케이스', () => {
  it('issues가 배열이 아니면 빈 배열을 반환한다', () => {
    const raw = JSON.stringify({ approved: true, feedback: 'OK', issues: '없음' });
    const result = parseReviewResponse(raw);
    expect(result.issues).toEqual([]);
  });

  it('issues가 null이면 빈 배열을 반환한다', () => {
    const raw = JSON.stringify({ approved: true, feedback: 'OK', issues: null });
    const result = parseReviewResponse(raw);
    expect(result.issues).toEqual([]);
  });

  it('severity가 없는 이슈는 minor로 기본 설정된다', () => {
    const raw = JSON.stringify({
      approved: false,
      feedback: '수정 필요',
      issues: [{ description: 'severity 없음' }],
    });
    const result = parseReviewResponse(raw);
    expect(result.issues[0].severity).toBe('minor');
  });

  it('description이 없는 이슈는 빈 문자열로 기본 설정된다', () => {
    const raw = JSON.stringify({
      approved: false,
      feedback: 'issues',
      issues: [{ severity: 'important' }],
    });
    const result = parseReviewResponse(raw);
    expect(result.issues[0].description).toBe('');
  });

  it('feedback이 없으면 빈 문자열을 반환한다', () => {
    const raw = JSON.stringify({ approved: true, issues: [] });
    const result = parseReviewResponse(raw);
    expect(result.feedback).toBe('');
  });

  it('feedback이 null이면 빈 문자열을 반환한다', () => {
    const raw = JSON.stringify({ approved: false, feedback: null, issues: [] });
    const result = parseReviewResponse(raw);
    expect(result.feedback).toBe('');
  });
});

describe('parseSuggestionsResponse', () => {
  it('제안을 파싱한다', () => {
    const raw = JSON.stringify([
      { section: 'A', suggested: '개선', reason: '이유' },
    ]);
    const result = parseSuggestionsResponse(raw);
    expect(result.length).toBe(1);
    expect(result[0].suggested).toBe('개선');
  });

  it('suggested가 없는 항목은 필터링한다', () => {
    const raw = JSON.stringify([
      { section: 'A', suggested: '있음', reason: '이유' },
      { section: 'B', reason: '이유만' },
    ]);
    const result = parseSuggestionsResponse(raw);
    expect(result.length).toBe(1);
  });
});
