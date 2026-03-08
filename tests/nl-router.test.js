import { describe, it, expect } from 'vitest';
import { resolveNaturalLanguage } from '../scripts/lib/core/nl-router.js';

describe('resolveNaturalLanguage', () => {
  // --- 한국어 매칭 ---

  it('"팀 만들어줘" → new', () => {
    expect(resolveNaturalLanguage('팀 만들어줘')).toBe('new');
  });

  it('"새 프로젝트 시작" → new', () => {
    expect(resolveNaturalLanguage('새 프로젝트 시작')).toBe('new');
  });

  it('"프로젝트 시작하자" → new', () => {
    expect(resolveNaturalLanguage('프로젝트 시작하자')).toBe('new');
  });

  it('"토론하자" → discuss', () => {
    expect(resolveNaturalLanguage('토론하자')).toBe('discuss');
  });

  it('"기획 논의해보자" → discuss', () => {
    expect(resolveNaturalLanguage('기획 논의해보자')).toBe('discuss');
  });

  it('"승인" → approve', () => {
    expect(resolveNaturalLanguage('승인')).toBe('approve');
  });

  it('"확정해줘" → approve', () => {
    expect(resolveNaturalLanguage('확정해줘')).toBe('approve');
  });

  it('"실행해줘" → execute', () => {
    expect(resolveNaturalLanguage('실행해줘')).toBe('execute');
  });

  it('"구현해줘" → execute', () => {
    expect(resolveNaturalLanguage('구현해줘')).toBe('execute');
  });

  it('"상태 알려줘" → status', () => {
    expect(resolveNaturalLanguage('상태 알려줘')).toBe('status');
  });

  it('"어디까지 했어?" → status', () => {
    expect(resolveNaturalLanguage('어디까지 했어?')).toBe('status');
  });

  it('"보고서 보여줘" → report', () => {
    expect(resolveNaturalLanguage('보고서 보여줘')).toBe('report');
  });

  it('"결과 보고해줘" → report', () => {
    expect(resolveNaturalLanguage('결과 보고해줘')).toBe('report');
  });

  // --- modify 매칭 ---

  it('"수정해줘" → modify', () => {
    expect(resolveNaturalLanguage('수정해줘')).toBe('modify');
  });

  it('"기능 추가해줘" → modify', () => {
    expect(resolveNaturalLanguage('기능 추가해줘')).toBe('modify');
  });

  it('"UI 변경해줘" → modify', () => {
    expect(resolveNaturalLanguage('UI 변경해줘')).toBe('modify');
  });

  it('"고쳐줘" → modify', () => {
    expect(resolveNaturalLanguage('고쳐줘')).toBe('modify');
  });

  it('"modify project" → modify', () => {
    expect(resolveNaturalLanguage('modify project')).toBe('modify');
  });

  // --- 영어 매칭 ---

  it('"create a team" → new', () => {
    expect(resolveNaturalLanguage('create a team')).toBe('new');
  });

  it('"new project" → new', () => {
    expect(resolveNaturalLanguage('new project')).toBe('new');
  });

  it('"discuss" → discuss', () => {
    expect(resolveNaturalLanguage('discuss')).toBe('discuss');
  });

  it('"approve" → approve', () => {
    expect(resolveNaturalLanguage('approve')).toBe('approve');
  });

  it('"execute" → execute', () => {
    expect(resolveNaturalLanguage('execute')).toBe('execute');
  });

  it('"run it" → execute', () => {
    expect(resolveNaturalLanguage('run it')).toBe('execute');
  });

  it('"status" → status', () => {
    expect(resolveNaturalLanguage('status')).toBe('status');
  });

  it('"report" → report', () => {
    expect(resolveNaturalLanguage('report')).toBe('report');
  });

  // --- 재개 매칭 (new로 라우팅) ---

  it('"이어서 해줘" → new', () => {
    expect(resolveNaturalLanguage('이어서 해줘')).toBe('new');
  });

  it('"계속하자" → new', () => {
    expect(resolveNaturalLanguage('계속하자')).toBe('new');
  });

  it('"작업 재개" → new', () => {
    expect(resolveNaturalLanguage('작업 재개')).toBe('new');
  });

  it('"이전 프로젝트 이어서" → new', () => {
    expect(resolveNaturalLanguage('이전 프로젝트 이어서')).toBe('new');
  });

  it('"하던 프로젝트 계속해줘" → new', () => {
    expect(resolveNaturalLanguage('하던 프로젝트 계속해줘')).toBe('new');
  });

  it('"resume" → new', () => {
    expect(resolveNaturalLanguage('resume')).toBe('new');
  });

  it('"continue project" → new', () => {
    expect(resolveNaturalLanguage('continue project')).toBe('new');
  });

  // --- 재개 vs 다른 커맨드 충돌 확인 ---

  it('"계속 만들어줘" → execute (재개가 아닌 생성 의도)', () => {
    expect(resolveNaturalLanguage('계속 만들어줘')).toBe('execute');
  });

  it('"RESUME" (대문자) → new', () => {
    expect(resolveNaturalLanguage('RESUME')).toBe('new');
  });

  // --- 매칭 실패 ---

  it('"asdfasdf" → null', () => {
    expect(resolveNaturalLanguage('asdfasdf')).toBeNull();
  });

  it('빈 입력 → null', () => {
    expect(resolveNaturalLanguage('')).toBeNull();
    expect(resolveNaturalLanguage(null)).toBeNull();
  });

  // --- 우선순위 ---

  it('"만들어줘" → execute ("만들" 매칭이 execute에 있음)', () => {
    // "만들어줘"는 execute의 /만들어.*줘/에 매칭
    expect(resolveNaturalLanguage('만들어줘')).toBe('execute');
  });
});
