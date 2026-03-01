/**
 * handlers/recommendation — 스킬/에이전트 추천 및 설치 커맨드
 */
import { readStdin, output, outputOk } from '../cli-utils.js';
import { requireFields, requireArray } from '../lib/validators.js';
import {
  recommendSetup, formatRecommendations, getCatalog,
} from '../lib/recommendation-engine.js';
import {
  listInstalled, installItems, formatInstallResults,
} from '../lib/setup-installer.js';

export const commands = {
  /** 프로젝트 컨텍스트 기반 추천 */
  'recommend-setup': async () => {
    const data = await readStdin();
    requireFields(data, ['projectType', 'complexity', 'description']);

    const installed = await listInstalled();
    const installedItems = new Set([...installed.skills, ...installed.agents]);
    const teamRoles = data.teamRoles || [];

    const recommendations = await recommendSetup({
      projectType: data.projectType,
      complexity: data.complexity,
      description: data.description,
      teamRoles,
      installedItems,
    });

    output({
      ...recommendations,
      formatted: formatRecommendations(recommendations),
    });
  },

  /** 선택 항목 설치 */
  'install-setup': async () => {
    const data = await readStdin();
    requireFields(data, ['items']);
    requireArray(data.items, 'items');

    const catalog = await getCatalog();
    const allItems = [...catalog.skills, ...catalog.agents];
    const itemIds = new Set(data.items);
    const toInstall = allItems.filter(item => itemIds.has(item.id));

    const results = await installItems(toInstall);
    outputOk({ results, formatted: formatInstallResults(results) });
  },

  /** 설치 현황 조회 */
  'list-installed': async () => {
    const installed = await listInstalled();
    output(installed);
  },

  /** 카탈로그 조회 */
  'recommendation-catalog': async () => {
    const catalog = await getCatalog();
    output(catalog);
  },
};
