/**
 * handlers/cost — v2 보조 슬래시 /gv:cost.
 * opt-in 예산 임계 설정/조회 (PRD §8.2).
 */

import { readStdin, output, outputOk } from '../cli-utils.js';
import { getBudget, setBudget, clearBudget } from '../lib/llm/budget-store.js';

export const commands = {
  'gv-budget-get': async () => {
    output(getBudget());
  },

  'gv-budget-set': async () => {
    const data = (await readStdin()) || {};
    const next = setBudget(data);
    outputOk({ current: next });
  },

  'gv-budget-clear': async () => {
    const next = clearBudget();
    outputOk({ current: next });
  },
};
