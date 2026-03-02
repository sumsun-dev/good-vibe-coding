/**
 * handlers/metrics — 관측성 + 비용/성능 추적 커맨드
 */
import { readStdin, output, outputOk, parseArgs } from '../cli-utils.js';
import { getProject, recordMetrics } from '../lib/project/project-manager.js';
import { inputError, notFoundError } from '../lib/core/validators.js';
import { getCostSummary, buildMetricsDashboard } from '../lib/project/project-metrics.js';

const [,, , ...args] = process.argv;

export const commands = {
  'record-metrics': async () => {
    const data = await readStdin();
    if (!data.id) throw inputError('--id가 필요합니다');
    const updated = await recordMetrics(data.id, data);
    outputOk({ metrics: updated.metrics });
  },

  'project-metrics': async () => {
    const parsed = parseArgs(args);
    if (!parsed.id) throw inputError('--id가 필요합니다');
    const project = await getProject(parsed.id);
    if (!project) throw notFoundError(`프로젝트를 찾을 수 없습니다: ${parsed.id}`);
    const dashboard = buildMetricsDashboard(project);
    output({ dashboard, metrics: project.metrics || null });
  },

  'cost-summary': async () => {
    const parsed = parseArgs(args);
    if (!parsed.id) throw inputError('--id가 필요합니다');
    const project = await getProject(parsed.id);
    if (!project) throw notFoundError(`프로젝트를 찾을 수 없습니다: ${parsed.id}`);
    const summary = getCostSummary(project.metrics);
    output(summary);
  },
};
