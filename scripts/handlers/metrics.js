/**
 * handlers/metrics — 관측성 + 비용/성능 추적 커맨드
 */
import { readStdin, output, outputOk, parseArgs } from '../cli-utils.js';
import { getProject, recordMetrics } from '../lib/project-manager.js';
import { getCostSummary, buildMetricsDashboard } from '../lib/project-metrics.js';

const [,, , ...args] = process.argv;

export const commands = {
  'record-metrics': async () => {
    const data = await readStdin();
    if (!data.id) throw new Error('--id가 필요합니다');
    const updated = await recordMetrics(data.id, data);
    outputOk({ metrics: updated.metrics });
  },

  'project-metrics': async () => {
    const parsed = parseArgs(args);
    if (!parsed.id) throw new Error('--id가 필요합니다');
    const project = await getProject(parsed.id);
    if (!project) throw new Error(`프로젝트를 찾을 수 없습니다: ${parsed.id}`);
    const dashboard = buildMetricsDashboard(project);
    output({ dashboard, metrics: project.metrics || null });
  },

  'cost-summary': async () => {
    const parsed = parseArgs(args);
    if (!parsed.id) throw new Error('--id가 필요합니다');
    const project = await getProject(parsed.id);
    if (!project) throw new Error(`프로젝트를 찾을 수 없습니다: ${parsed.id}`);
    const summary = getCostSummary(project.metrics);
    output(summary);
  },
};
