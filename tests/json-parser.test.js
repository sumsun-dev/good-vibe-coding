import { describe, it, expect } from 'vitest';
import { parseJsonObject, parseJsonArray } from '../scripts/lib/core/json-parser.js';

// --- parseJsonObject ---

describe('parseJsonObject', () => {
  it('직접 JSON 객체를 파싱한다', () => {
    const result = parseJsonObject('{"key": "value"}');
    expect(result).toEqual({ key: 'value' });
  });

  it('```json 펜스 블록에서 객체를 추출한다', () => {
    const input = '일부 텍스트\n```json\n{"approved": true}\n```\n나머지 텍스트';
    const result = parseJsonObject(input);
    expect(result).toEqual({ approved: true });
  });

  it('``` 펜스(json 없이)에서 객체를 추출한다', () => {
    const input = '응답:\n```\n{"verdict": "approve"}\n```';
    const result = parseJsonObject(input);
    expect(result).toEqual({ verdict: 'approve' });
  });

  it('bare {} 패턴에서 객체를 추출한다', () => {
    const input = '분석 결과: {"level": "complex", "reasoning": "많은 외부 API"} 입니다.';
    const result = parseJsonObject(input);
    expect(result).toEqual({ level: 'complex', reasoning: '많은 외부 API' });
  });

  it('null/빈 입력에 null을 반환한다', () => {
    expect(parseJsonObject(null)).toBeNull();
    expect(parseJsonObject(undefined)).toBeNull();
    expect(parseJsonObject('')).toBeNull();
    expect(parseJsonObject('   ')).toBeNull();
  });

  it('파싱 불가능한 텍스트에 null을 반환한다', () => {
    expect(parseJsonObject('이것은 일반 텍스트입니다')).toBeNull();
    expect(parseJsonObject('{ 불완전한 JSON')).toBeNull();
  });

  it('배열이 아닌 객체만 반환한다', () => {
    const result = parseJsonObject('[1, 2, 3]');
    expect(result).toBeNull();
  });

  it('중첩 객체를 올바르게 파싱한다', () => {
    const input = '```json\n{"issues": [{"severity": "critical", "description": "보안 취약점"}]}\n```';
    const result = parseJsonObject(input);
    expect(result.issues).toHaveLength(1);
    expect(result.issues[0].severity).toBe('critical');
  });

  it('Tier 1에서 성공하면 Tier 2/3를 건너뛴다', () => {
    const input = '{"direct": true}';
    const result = parseJsonObject(input);
    expect(result).toEqual({ direct: true });
  });

  it('Tier 1 실패 시 Tier 2로 fallback한다', () => {
    const input = 'prefix ```json\n{"tier2": true}\n``` suffix';
    const result = parseJsonObject(input);
    expect(result).toEqual({ tier2: true });
  });

  it('Tier 1, 2 실패 시 Tier 3으로 fallback한다', () => {
    const input = 'prefix {"tier3": true} suffix';
    const result = parseJsonObject(input);
    expect(result).toEqual({ tier3: true });
  });

  it('whitespace가 포함된 JSON을 처리한다', () => {
    const input = '  \n  {"spaced": true}  \n  ';
    const result = parseJsonObject(input);
    expect(result).toEqual({ spaced: true });
  });
});

// --- parseJsonArray ---

describe('parseJsonArray', () => {
  it('직접 JSON 배열을 파싱한다', () => {
    const result = parseJsonArray('[{"id": 1}, {"id": 2}]');
    expect(result).toEqual([{ id: 1 }, { id: 2 }]);
  });

  it('```json 펜스 블록에서 배열을 추출한다', () => {
    const input = '작업 목록:\n```json\n[{"id": "task-1", "title": "API 설계"}]\n```';
    const result = parseJsonArray(input);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('task-1');
  });

  it('bare [] 패턴에서 배열을 추출한다', () => {
    const input = '제안 목록: [{"section": "스킬", "suggested": "보안 강화"}] 끝.';
    const result = parseJsonArray(input);
    expect(result).toHaveLength(1);
    expect(result[0].section).toBe('스킬');
  });

  it('null/빈 입력에 빈 배열을 반환한다', () => {
    expect(parseJsonArray(null)).toEqual([]);
    expect(parseJsonArray(undefined)).toEqual([]);
    expect(parseJsonArray('')).toEqual([]);
    expect(parseJsonArray('   ')).toEqual([]);
  });

  it('파싱 불가능한 텍스트에 빈 배열을 반환한다', () => {
    expect(parseJsonArray('이것은 일반 텍스트입니다')).toEqual([]);
    expect(parseJsonArray('[ 불완전한 배열')).toEqual([]);
  });

  it('객체가 아닌 배열만 반환한다', () => {
    const result = parseJsonArray('{"not": "array"}');
    expect(result).toEqual([]);
  });

  it('빈 배열을 올바르게 파싱한다', () => {
    const result = parseJsonArray('[]');
    expect(result).toEqual([]);
  });

  it('Tier 1에서 성공하면 Tier 2/3를 건너뛴다', () => {
    const result = parseJsonArray('[1, 2, 3]');
    expect(result).toEqual([1, 2, 3]);
  });

  it('Tier 1 실패 시 Tier 2로 fallback한다', () => {
    const input = 'prefix ```json\n[{"tier2": true}]\n``` suffix';
    const result = parseJsonArray(input);
    expect(result).toEqual([{ tier2: true }]);
  });

  it('Tier 1, 2 실패 시 Tier 3으로 fallback한다', () => {
    const input = 'prefix [{"tier3": true}] suffix';
    const result = parseJsonArray(input);
    expect(result).toEqual([{ tier3: true }]);
  });

  it('다중 객체 배열을 올바르게 파싱한다', () => {
    const input = '```json\n[{"id": "t1"}, {"id": "t2"}, {"id": "t3"}]\n```';
    const result = parseJsonArray(input);
    expect(result).toHaveLength(3);
  });
});
