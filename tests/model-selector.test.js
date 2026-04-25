import { describe, it, expect } from 'vitest';
import { createModelSelector, DEFAULT_FALLBACK_CHAIN } from '../scripts/lib/llm/model-selector.js';

describe('createModelSelector — default 정책', () => {
  it('complexity 미지정 시 role.model을 그대로 반환', () => {
    const selector = createModelSelector('default');
    const role = { model: 'sonnet', category: 'engineering' };
    expect(selector.selectModel({ role })).toBe('sonnet');
  });

  it('complexity 기반으로 카테고리별 modelTiers를 적용', () => {
    const selector = createModelSelector('default');
    const role = { model: 'sonnet', category: 'leadership' };
    expect(selector.selectModel({ role, complexity: 'complex' })).toBe('opus');
    expect(selector.selectModel({ role, complexity: 'simple' })).toBe('sonnet');
  });

  it('taskType=architecture-review + complex → opus 업그레이드', () => {
    const selector = createModelSelector('default');
    const role = { model: 'sonnet', category: 'engineering' };
    expect(
      selector.selectModel({ role, complexity: 'complex', taskType: 'architecture-review' }),
    ).toBe('opus');
  });

  it('카테고리 누락 시 engineering으로 폴백', () => {
    const selector = createModelSelector('default');
    const role = { model: 'haiku' }; // category 없음
    expect(selector.selectModel({ role, complexity: 'simple' })).toBe('sonnet');
  });
});

describe('createModelSelector — cost-optimized 정책', () => {
  it('가능한 한 더 저렴한 모델로 다운그레이드', () => {
    const selector = createModelSelector('cost-optimized');
    expect(selector.selectModel({ role: { model: 'opus', category: 'leadership' } })).toBe(
      'sonnet',
    );
    expect(selector.selectModel({ role: { model: 'sonnet', category: 'engineering' } })).toBe(
      'haiku',
    );
    expect(selector.selectModel({ role: { model: 'haiku', category: 'support' } })).toBe('haiku');
  });

  it('architecture-review는 다운그레이드 금지', () => {
    const selector = createModelSelector('cost-optimized');
    const role = { model: 'sonnet', category: 'leadership' };
    expect(
      selector.selectModel({ role, complexity: 'complex', taskType: 'architecture-review' }),
    ).toBe('opus');
  });
});

describe('createModelSelector — quality-first 정책', () => {
  it('카테고리에 관계없이 opus로 업그레이드', () => {
    const selector = createModelSelector('quality-first');
    expect(selector.selectModel({ role: { model: 'haiku', category: 'support' } })).toBe('opus');
    expect(selector.selectModel({ role: { model: 'sonnet', category: 'engineering' } })).toBe(
      'opus',
    );
  });
});

describe('createModelSelector — custom 정책', () => {
  it('사용자 정의 함수가 적용된다', () => {
    const customFn = ({ role }) => `custom-${role.category}`;
    const selector = createModelSelector('custom', { selectFn: customFn });
    expect(selector.selectModel({ role: { model: 'sonnet', category: 'engineering' } })).toBe(
      'custom-engineering',
    );
  });

  it('selectFn 누락 시 기본 정책으로 폴백', () => {
    const selector = createModelSelector('custom', {});
    const role = { model: 'sonnet', category: 'engineering' };
    expect(selector.selectModel({ role, complexity: 'simple' })).toBe('sonnet');
  });
});

describe('ModelSelector — fallback 체인', () => {
  it('selectFallback: opus → sonnet → haiku 순으로 다운그레이드', () => {
    const selector = createModelSelector('default');
    expect(selector.selectFallback('opus')).toBe('sonnet');
    expect(selector.selectFallback('sonnet')).toBe('haiku');
    expect(selector.selectFallback('haiku')).toBe(null);
  });

  it('알 수 없는 모델은 null을 반환', () => {
    const selector = createModelSelector('default');
    expect(selector.selectFallback('mystery-7b')).toBe(null);
  });

  it('DEFAULT_FALLBACK_CHAIN export', () => {
    expect(DEFAULT_FALLBACK_CHAIN).toEqual(['opus', 'sonnet', 'haiku']);
  });
});

describe('ModelSelector — strategy 검증', () => {
  it('알 수 없는 strategy는 default로 폴백', () => {
    const selector = createModelSelector('mystery-strategy');
    const role = { model: 'sonnet', category: 'engineering' };
    expect(selector.selectModel({ role, complexity: 'simple' })).toBe('sonnet');
  });
});
