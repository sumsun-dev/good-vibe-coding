/**
 * handlers/build — 코드 구체화 + 빌드 검증 커맨드
 */
import { readStdin, output } from '../cli-utils.js';
import {
  materializeCode,
  materializeBatch,
  extractMaterializableBlocks,
} from '../lib/engine/code-materializer.js';
import { verifyAndMaterialize } from '../lib/engine/execution-verifier.js';
import { commitPhase, commitPhaseEnhanced } from '../lib/project/github-manager.js';

export const commands = {
  'materialize-code': async () => {
    const data = await readStdin();
    const result = await materializeCode(data.taskOutput, data.projectDir, data.options || {});
    output(result);
  },

  'materialize-batch': async () => {
    const data = await readStdin();
    const result = await materializeBatch(data.taskOutputs, data.projectDir, data.options || {});
    output(result);
  },

  'verify-and-materialize': async () => {
    const data = await readStdin();
    const result = await verifyAndMaterialize(
      data.taskOutput,
      data.task,
      data.projectDir,
      data.options || {},
    );
    output(result);
  },

  'extract-materializable-blocks': async () => {
    const data = await readStdin();
    const blocks = extractMaterializableBlocks(data.taskOutput);
    output({ blocks });
  },

  'commit-phase': async () => {
    const data = await readStdin();
    const result = commitPhase(data.projectDir, data.phase, data.message);
    output(result);
  },

  'commit-phase-enhanced': async () => {
    const data = await readStdin();
    const result = commitPhaseEnhanced(data.projectDir, {
      phase: data.phase,
      tasks: data.tasks,
      project: data.project,
      team: data.team,
      totalPhases: data.totalPhases,
      qualityGate: data.qualityGate,
    });
    output(result);
  },
};
