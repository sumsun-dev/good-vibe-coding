/**
 * onboarding-generator — 온보딩 데이터 변환 + 템플릿 렌더링
 * CLAUDE.md + rules/core.md 생성용 데이터 주도 로직.
 */

import { renderTemplate } from '../project/template-engine.js';

/** 공통 coreRules 키 (역할 고유가 아닌 항목) */
const COMMON_RULE_KEYS = ['security', 'codeStyle', 'extensibility', 'git', 'testing'];

/**
 * coreRules에서 역할 고유 규칙을 customRules 배열로 변환한다.
 * security/codeStyle/extensibility/git/testing은 공통, 나머지는 역할 고유.
 * @param {object} [coreRules] - 프리셋의 coreRules
 * @returns {Array<{ title: string, rules: string[] }>}
 */
export function extractCustomRules(coreRules) {
  if (!coreRules) return [];
  return Object.entries(coreRules)
    .filter(([key]) => !COMMON_RULE_KEYS.includes(key))
    .map(([key, rules]) => ({ title: key, rules }));
}

/**
 * 병합된 프리셋 데이터를 템플릿 렌더링용 데이터로 변환한다.
 * @param {object} mergedPreset - mergePresets() 결과
 * @param {object} [options] - { roleNames, stackName, personalities }
 * @returns {object} 렌더링용 데이터
 */
export function buildOnboardingData(mergedPreset, options = {}) {
  const { roleNames, stackName, personalities } = options;
  const coreRules = mergedPreset.coreRules || {};

  const roleName =
    roleNames && roleNames.length > 1
      ? roleNames.join(' + ')
      : roleNames?.[0] || mergedPreset.displayName || '';

  return {
    roleName,
    roleDescription: mergedPreset.roleDescription || mergedPreset.description || '',
    workflow: mergedPreset.workflowSteps || [],
    coreRules: Object.fromEntries(
      Object.entries(coreRules).filter(([key]) => COMMON_RULE_KEYS.includes(key)),
    ),
    customRules: extractCustomRules(coreRules),
    skills: mergedPreset.skills || [],
    commands: mergedPreset.commands || [],
    agents: mergedPreset.agents || [],
    orchestration: mergedPreset.orchestration || {},
    team: mergedPreset.team || null,
    stackName,
    stackRules: mergedPreset.stackRules || [],
    personalities,
  };
}

/**
 * CLAUDE.md + rules/core.md 렌더링 결과를 반환한다. (파일 쓰기는 하지 않음)
 * @param {object} data - buildOnboardingData() 결과
 * @returns {Promise<{ claudeMd: string, coreRules: string }>}
 */
export async function renderOnboardingFiles(data) {
  const [claudeMd, coreRules] = await Promise.all([
    renderTemplate('claude-md.hbs', data),
    renderTemplate('rules/core.md.hbs', data),
  ]);
  return { claudeMd, coreRules };
}
