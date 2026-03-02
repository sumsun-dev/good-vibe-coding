import { describe, it, expect } from 'vitest';
import { buildSectioned, toMarkdownList, jsonOutputSection } from '../scripts/lib/llm/prompt-builder.js';

describe('buildSectioned', () => {
  it('intro와 섹션들을 조합한다', () => {
    const result = buildSectioned('시작', [
      { title: '배경', content: '프로젝트 설명' },
      { title: '목표', content: '기능 구현' },
    ]);
    expect(result).toContain('시작');
    expect(result).toContain('## 배경');
    expect(result).toContain('프로젝트 설명');
    expect(result).toContain('## 목표');
    expect(result).toContain('기능 구현');
  });

  it('falsy content 섹션은 건너뛴다', () => {
    const result = buildSectioned('시작', [
      { title: '유효', content: '있음' },
      { title: '무효', content: null },
      { title: '빈값', content: '' },
    ]);
    expect(result).toContain('## 유효');
    expect(result).not.toContain('## 무효');
    expect(result).not.toContain('## 빈값');
  });

  it('섹션이 없으면 intro만 반환한다', () => {
    expect(buildSectioned('intro', [])).toBe('intro');
    expect(buildSectioned('intro')).toBe('intro');
  });
});

describe('toMarkdownList', () => {
  it('항목을 마크다운 목록으로 변환한다', () => {
    const result = toMarkdownList(['A', 'B', 'C']);
    expect(result).toBe('- A\n- B\n- C');
  });

  it('빈 배열이면 (없음)을 반환한다', () => {
    expect(toMarkdownList([])).toBe('- (없음)');
    expect(toMarkdownList(null)).toBe('- (없음)');
  });

  it('커스텀 포맷터를 적용한다', () => {
    const result = toMarkdownList([1, 2], n => `항목 ${n}`);
    expect(result).toBe('- 항목 1\n- 항목 2');
  });
});

describe('jsonOutputSection', () => {
  it('JSON 형식 안내를 생성한다', () => {
    const result = jsonOutputSection({ key: 'value' });
    expect(result).toContain('JSON 형식');
    expect(result).toContain('```json');
    expect(result).toContain('"key": "value"');
    expect(result).toContain('```');
  });
});
