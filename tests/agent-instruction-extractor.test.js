import { describe, it, expect } from 'vitest';
import { extractInstructions, extractAllInstructions } from '../scripts/lib/agent-instruction-extractor.js';

describe('agent-instruction-extractor', () => {
  describe('extractInstructions', () => {
    it('## 지시사항 헤더 이하의 내용을 추출한다', () => {
      const md = `# Agent Title

## 설정
- **모델**: sonnet

## 지시사항

당신은 코드 리뷰어입니다.

### 체크리스트
1. 보안 검사
2. 성능 검사`;

      const result = extractInstructions(md);
      expect(result).toContain('당신은 코드 리뷰어입니다.');
      expect(result).toContain('### 체크리스트');
      expect(result).toContain('1. 보안 검사');
      expect(result).toContain('2. 성능 검사');
    });

    it('## 지시사항 헤더 앞의 내용은 포함하지 않는다', () => {
      const md = `# Agent Title

## 설정
- **모델**: sonnet

## 지시사항

실제 지시사항 내용`;

      const result = extractInstructions(md);
      expect(result).not.toContain('# Agent Title');
      expect(result).not.toContain('## 설정');
      expect(result).not.toContain('모델');
    });

    it('## 지시사항 헤더가 없으면 빈 문자열을 반환한다', () => {
      const md = `# Agent Title

## 설정
- **모델**: sonnet

그냥 설명 텍스트`;

      const result = extractInstructions(md);
      expect(result).toBe('');
    });

    it('빈 문자열 입력에 빈 문자열을 반환한다', () => {
      expect(extractInstructions('')).toBe('');
    });

    it('## 지시사항 바로 뒤에 다른 ## 헤더가 있으면 그 사이만 추출한다', () => {
      const md = `## 지시사항

중요한 내용

## 기타

여기는 포함되지 않음`;

      const result = extractInstructions(md);
      expect(result).toContain('중요한 내용');
      expect(result).not.toContain('여기는 포함되지 않음');
      expect(result).not.toContain('## 기타');
    });

    it('### 하위 헤더는 지시사항에 포함한다', () => {
      const md = `## 지시사항

당신은 전문가입니다.

### 세부 지침
- 항목 1
- 항목 2

### 피드백 형식
- 표 형식으로 제공`;

      const result = extractInstructions(md);
      expect(result).toContain('### 세부 지침');
      expect(result).toContain('### 피드백 형식');
      expect(result).toContain('- 항목 1');
    });

    it('앞뒤 공백을 trim한다', () => {
      const md = `## 지시사항

  내용

`;

      const result = extractInstructions(md);
      expect(result).not.toMatch(/^\s/);
      expect(result).not.toMatch(/\s$/);
    });
  });

  describe('extractAllInstructions', () => {
    it('여러 에이전트의 지시사항을 일괄 추출한다', async () => {
      const agents = [
        { template: 'code-reviewer-kr' },
        { template: 'tdd-coach-kr' },
      ];

      const result = await extractAllInstructions(agents);

      expect(result['code-reviewer-kr']).toContain('리뷰 체크리스트');
      expect(result['tdd-coach-kr']).toContain('TDD 사이클');
    });

    it('존재하지 않는 에이전트는 빈 문자열을 반환한다', async () => {
      const agents = [
        { template: 'nonexistent-agent' },
      ];

      const result = await extractAllInstructions(agents);
      expect(result['nonexistent-agent']).toBe('');
    });

    it('빈 에이전트 배열이면 빈 객체를 반환한다', async () => {
      const result = await extractAllInstructions([]);
      expect(result).toEqual({});
    });
  });
});
