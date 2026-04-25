/**
 * model-selector — 작업/역할에 따른 모델 선택 정책
 *
 * 추상화된 라우터 계층. 정책(default/cost-optimized/quality-first/custom)을 교체 가능.
 * Phase 3에서 비용 메터링 + 폴백 라우팅의 기반이 된다.
 *
 * 외부 의존성: complexity-analyzer.getDefaultsForComplexity (modelTiers 정의).
 */

import { getDefaultsForComplexity } from '../agent/complexity-analyzer.js';

/** 폴백 시 다운그레이드 순서 (가장 강력 → 약함). */
export const DEFAULT_FALLBACK_CHAIN = ['opus', 'sonnet', 'haiku'];

const STRATEGY_VALIDATORS = new Set(['default', 'cost-optimized', 'quality-first', 'custom']);

/**
 * 모델 선택기를 생성한다.
 *
 * @param {'default'|'cost-optimized'|'quality-first'|'custom'} [strategy='default']
 * @param {object} [options]
 * @param {(ctx: { role: object, complexity?: string, taskType?: string }) => string} [options.selectFn]
 *   - strategy='custom'일 때 사용할 선택 함수
 * @returns {{
 *   selectModel: (ctx: { role: object, complexity?: string, taskType?: string }) => string,
 *   selectFallback: (currentModel: string) => string | null,
 *   strategy: string,
 * }}
 */
export function createModelSelector(strategy = 'default', options = {}) {
  const validStrategy = STRATEGY_VALIDATORS.has(strategy) ? strategy : 'default';

  function defaultSelect(ctx) {
    const { role, complexity, taskType } = ctx;
    if (!complexity) return role.model;

    const defaults = getDefaultsForComplexity(complexity);
    const modelTiers = defaults.modelTiers;
    if (!modelTiers) return role.model;

    const category = role.category || 'engineering';
    let model = modelTiers[category] || role.model;

    if (taskType === 'architecture-review' && complexity === 'complex') {
      model = 'opus';
    }
    return model;
  }

  function downgrade(model) {
    if (model === 'opus') return 'sonnet';
    if (model === 'sonnet') return 'haiku';
    return model;
  }

  function selectModel(ctx) {
    if (validStrategy === 'custom') {
      if (typeof options.selectFn === 'function') return options.selectFn(ctx);
      return defaultSelect(ctx);
    }

    const baseModel = defaultSelect(ctx);

    if (validStrategy === 'cost-optimized') {
      // architecture-review는 다운그레이드 금지 (품질 보존)
      if (ctx.taskType === 'architecture-review') return baseModel;
      return downgrade(baseModel);
    }

    if (validStrategy === 'quality-first') {
      return 'opus';
    }

    return baseModel;
  }

  function selectFallback(currentModel) {
    const idx = DEFAULT_FALLBACK_CHAIN.indexOf(currentModel);
    if (idx < 0) return null;
    if (idx === DEFAULT_FALLBACK_CHAIN.length - 1) return null;
    return DEFAULT_FALLBACK_CHAIN[idx + 1];
  }

  return {
    selectModel,
    selectFallback,
    strategy: validStrategy,
  };
}
