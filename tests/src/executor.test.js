import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../scripts/lib/llm/llm-provider.js', () => ({
  callLLM: vi.fn(),
}));

vi.mock('../../scripts/lib/llm/auth-manager.js', () => ({
  loadAuth: vi.fn().mockResolvedValue({ apiKey: 'test-key' }),
}));

import { Executor } from '../../src/executor.js';
import { MemoryStorage } from '../../src/storage.js';
import { callLLM } from '../../scripts/lib/llm/llm-provider.js';

function makeProject(overrides = {}) {
  return {
    id: 'test-proj',
    name: 'Test',
    type: 'custom',
    status: 'executing',
    team: [
      { roleId: 'cto', displayName: 'CTO', emoji: '🧑‍💻', role: 'CTO', skills: ['architecture'], reviewDomains: ['architecture'] },
      { roleId: 'qa', displayName: 'QA', emoji: '🧪', role: 'QA', skills: ['testing'], reviewDomains: ['testing'] },
    ],
    tasks: [
      { id: 'task-1', title: 'Build feature', assignee: 'cto', phase: 1, description: 'Build it' },
    ],
    discussion: { planDocument: 'plan', rounds: [] },
    executionState: {
      status: 'executing',
      currentPhase: 1,
      phaseStep: 'execute-tasks',
      fixAttempt: 0,
      mode: 'auto',
      lastCompletedStep: null,
      completedPhases: [],
      pendingEscalation: null,
      startedAt: new Date().toISOString(),
      completedAt: null,
      phaseResults: {},
      journal: [],
      failureContext: null,
      failureHistory: [],
    },
    ...overrides,
  };
}

describe('Executor', () => {
  let storage;

  beforeEach(() => {
    vi.clearAllMocks();
    storage = new MemoryStorage();

    callLLM.mockResolvedValue({
      text: 'Task executed successfully',
      provider: 'claude',
      model: 'claude-sonnet-4-6',
      tokenCount: 100,
    });
  });

  it('initProject: plan에서 프로젝트를 초기화한다', async () => {
    const executor = new Executor({
      provider: 'claude',
      model: 'claude-sonnet-4-6',
      storage,
      hooks: {},
    });

    // completed 상태 프로젝트를 storage에 직접 넣기
    const project = makeProject();
    project.executionState.status = 'completed';
    project.executionState.completedAt = new Date().toISOString();
    project.executionState.phaseStep = 'build-context';
    project.executionState.completedPhases = [1];

    const plan = {
      document: 'Test plan',
      team: project.team,
      tasks: project.tasks,
    };

    // _initProject가 storage.write를 호출하고, run()에서 read하면 completed 상태
    storage.write = vi.fn().mockResolvedValue(undefined);
    storage.read = vi.fn().mockResolvedValue(project);

    const result = await executor.run(plan);
    expect(result.status).toBe('completed');
    expect(storage.write).toHaveBeenCalled();
  });

  it('에스컬레이션 훅이 호출된다', async () => {
    const onEscalation = vi.fn().mockResolvedValue('skip');

    const project = makeProject();
    project.executionState.status = 'escalated';
    project.executionState.pendingEscalation = { reason: 'test failure' };

    // 에스컬레이션 후 → commit 상태, 그 다음 read에서 completed 반환
    const completedProject = makeProject();
    completedProject.executionState = {
      ...completedProject.executionState,
      status: 'completed',
      completedAt: new Date().toISOString(),
      phaseStep: 'build-context',
      completedPhases: [1],
    };

    storage.read = vi.fn()
      .mockResolvedValueOnce(project)
      .mockResolvedValue(completedProject);
    storage.write = vi.fn();

    const executor = new Executor({
      provider: 'claude',
      model: 'claude-sonnet-4-6',
      storage,
      hooks: { onEscalation },
    });

    const result = await executor.run({ projectId: 'test-proj' });
    expect(onEscalation).toHaveBeenCalled();
  });

  it('스텝 이터레이터가 동작한다', async () => {
    const project = makeProject();
    const completedProject = makeProject();
    completedProject.executionState = {
      ...completedProject.executionState,
      status: 'completed',
      completedAt: new Date().toISOString(),
    };

    storage.read = vi.fn()
      .mockResolvedValueOnce(project)       // yield에서 읽기
      .mockResolvedValueOnce(project)       // proceed 내부에서 읽기
      .mockResolvedValue(completedProject); // 다음 루프
    storage.write = vi.fn();

    const executor = new Executor({
      provider: 'claude',
      model: 'claude-sonnet-4-6',
      storage,
    });

    const steps = [];
    for await (const step of executor.steps({ projectId: 'test-proj' })) {
      steps.push(step.action);
      await step.proceed();
      break; // 한 스텝만 실행
    }

    expect(steps).toHaveLength(1);
    expect(steps[0]).toBe('execute-tasks');
  });

  it('최대 스텝 수를 초과하면 max-steps-exceeded를 반환한다', async () => {
    // 계속 같은 상태를 반환 → 무한루프 방지 테스트
    const project = makeProject();
    storage.read = vi.fn().mockResolvedValue(project);
    storage.write = vi.fn();

    const executor = new Executor({
      provider: 'claude',
      model: 'claude-sonnet-4-6',
      storage,
      hooks: {},
    });

    // maxExecutionSteps를 작게 설정해서 빠르게 테스트
    const { DEFAULTS } = await import('../../src/defaults.js');
    const original = DEFAULTS.maxExecutionSteps;
    DEFAULTS.maxExecutionSteps = 3;

    const result = await executor.run({ projectId: 'test-proj' });
    expect(result.status).toBe('max-steps-exceeded');

    DEFAULTS.maxExecutionSteps = original;
  });
});

describe('Executor._handleStep', () => {
  let executor;
  let storage;

  beforeEach(() => {
    vi.clearAllMocks();
    storage = new MemoryStorage();
    executor = new Executor({
      provider: 'claude',
      model: 'claude-sonnet-4-6',
      storage,
      hooks: {},
    });
  });

  it('materialize는 completedAction만 반환한다', async () => {
    const result = await executor._handleStep({ action: 'materialize' }, {});
    expect(result).toEqual({ completedAction: 'materialize' });
  });

  it('commit은 completedAction을 반환하고 훅을 호출한다', async () => {
    const onCommit = vi.fn();
    executor.hooks = { onCommit };
    const step = { action: 'commit', phase: 1 };
    const result = await executor._handleStep(step, {});
    expect(result).toEqual({ completedAction: 'commit' });
    expect(onCommit).toHaveBeenCalledWith(step);
  });

  it('build-context는 onPhaseComplete 훅을 호출한다', async () => {
    const onPhaseComplete = vi.fn();
    executor.hooks = { onPhaseComplete };
    const step = { action: 'build-context', phase: 1, context: {} };
    const result = await executor._handleStep(step, {});
    expect(result).toEqual({ completedAction: 'build-context' });
    expect(onPhaseComplete).toHaveBeenCalledWith(1, {});
  });

  it('confirm-next-phase: 훅 없으면 진행한다', async () => {
    const result = await executor._handleStep({ action: 'confirm-next-phase' }, {});
    expect(result).toEqual({ completedAction: 'build-context' });
  });

  it('confirm-next-phase: 훅이 false 반환하면 abort한다', async () => {
    executor.hooks = { onConfirmPhase: vi.fn().mockResolvedValue(false) };
    const result = await executor._handleStep({ action: 'confirm-next-phase' }, {});
    expect(result).toEqual({
      completedAction: 'escalation-response',
      escalationDecision: 'abort',
    });
  });

  it('escalate: 훅 없으면 skip 결정을 반환한다', async () => {
    const step = { action: 'escalate', context: { reason: 'test' } };
    const result = await executor._handleStep(step, {});
    expect(result).toEqual({
      completedAction: 'escalation-response',
      escalationDecision: 'skip',
    });
  });

  it('execute-tasks: LLM을 호출하고 결과를 반환한다', async () => {
    callLLM.mockResolvedValue({
      text: 'done',
      provider: 'claude',
      model: 'claude-sonnet-4-6',
      tokenCount: 50,
    });

    const step = {
      action: 'execute-tasks',
      phase: 1,
      tasks: [{ id: 'task-1', title: 'Test', assignee: 'cto', description: 'do it' }],
    };

    const result = await executor._handleStep(step, {});
    expect(result.completedAction).toBe('execute-tasks');
    expect(result.taskResults).toHaveLength(1);
    expect(result.taskResults[0].taskId).toBe('task-1');
    expect(result.taskResults[0].output).toBe('done');
    expect(callLLM).toHaveBeenCalledTimes(1);
  });

  it('review: LLM 응답을 파싱하여 verdict/issues를 추출한다', async () => {
    callLLM.mockResolvedValue({
      text: '```json\n{"verdict": "request-changes", "issues": [{"severity": "critical", "description": "보안 문제", "suggestion": "수정 필요"}]}\n```',
      provider: 'claude',
      model: 'claude-sonnet-4-6',
      tokenCount: 80,
    });

    const project = makeProject();
    project.executionState.phaseResults = {
      1: { taskResults: [{ taskId: 'task-1', output: 'some code' }], reviews: [] },
    };

    const step = {
      action: 'review',
      phase: 1,
      tasks: [{ id: 'task-1', title: 'Build feature', assignee: 'cto', description: 'Build it' }],
    };

    const result = await executor._handleStep(step, project);
    expect(result.completedAction).toBe('review');
    expect(result.reviews.length).toBeGreaterThan(0);
    // 파싱된 verdict가 실제 LLM 응답을 반영해야 함
    expect(result.reviews[0].verdict).toBe('request-changes');
    expect(result.reviews[0].issues).toHaveLength(1);
    expect(result.reviews[0].issues[0].severity).toBe('critical');
  });

  it('onAgentCall 훅에 roleId 문자열을 전달한다', async () => {
    const onAgentCall = vi.fn();
    executor.hooks = { onAgentCall };

    callLLM.mockResolvedValue({
      text: 'done',
      provider: 'claude',
      model: 'claude-sonnet-4-6',
      tokenCount: 50,
    });

    const step = {
      action: 'execute-tasks',
      phase: 1,
      tasks: [{ id: 'task-1', title: 'Test', assignee: 'cto', description: 'do it' }],
    };

    await executor._handleStep(step, {});
    // onAgentCall 첫 번째 인수는 roleId 문자열이어야 함
    expect(onAgentCall).toHaveBeenCalledWith('cto', expect.any(Object));
  });
});
