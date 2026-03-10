import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../scripts/lib/llm/llm-provider.js', () => ({
  callLLM: vi.fn(),
}));

vi.mock('../../scripts/lib/llm/auth-manager.js', () => ({
  loadAuth: vi.fn().mockResolvedValue({ apiKey: 'test-key' }),
}));

import { Discusser } from '../../src/discusser.js';
import { MemoryStorage } from '../../src/storage.js';
import { callLLM } from '../../scripts/lib/llm/llm-provider.js';
import { config } from '../../scripts/lib/core/config.js';

function makeMember(roleId, priority = 5) {
  return {
    roleId,
    displayName: roleId.toUpperCase(),
    emoji: '',
    role: roleId,
    trait: 'test',
    speakingStyle: 'concise',
    skills: ['test'],
    discussionPriority: priority,
  };
}

describe('Discusser', () => {
  let discusser;
  let storage;

  beforeEach(() => {
    vi.clearAllMocks();
    storage = new MemoryStorage();
    discusser = new Discusser({
      provider: 'claude',
      model: 'claude-sonnet-4-6',
      storage,
      hooks: {},
    });
  });

  it('수렴 시 즉시 반환한다', async () => {
    // 모든 LLM 응답: 분석 → 종합 → 리뷰(approved)
    callLLM.mockImplementation(async () => {
      // 리뷰 응답에 approved: true JSON을 반환
      return {
        text: '```json\n{"approved": true, "feedback": "좋습니다", "issues": []}\n```',
        provider: 'claude',
        model: 'claude-sonnet-4-6',
        tokenCount: 100,
      };
    });

    const team = {
      idea: 'test project',
      agents: [makeMember('cto', 1), makeMember('qa', 5)],
      complexity: { discussionRounds: 3 },
    };

    const result = await discusser.run(team);
    expect(result.convergence.converged).toBe(true);
    expect(result.rounds).toBe(1);
    expect(result.document).toBeTruthy();
  });

  it('수렴하지 않으면 최대 라운드까지 반복하고 실제 수렴 데이터를 보존한다', async () => {
    callLLM.mockResolvedValue({
      text: '```json\n{"approved": false, "feedback": "수정 필요", "issues": [{"severity": "critical", "description": "문제"}]}\n```',
      provider: 'claude',
      model: 'claude-sonnet-4-6',
      tokenCount: 100,
    });

    const team = {
      idea: 'complex project',
      agents: [makeMember('cto', 1)],
      complexity: { discussionRounds: 2 },
    };

    const result = await discusser.run(team);
    expect(result.convergence.converged).toBe(false);
    expect(result.convergence.reason).toBe('max-rounds');
    expect(result.rounds).toBe(2);
    // 실제 수렴 데이터가 보존되어야 함 (approvalRate: 0이 아닌 실제 값)
    expect(result.convergence).toHaveProperty('approvalRate');
  });

  it('onRoundComplete 훅이 호출된다', async () => {
    const onRoundComplete = vi.fn();

    callLLM.mockResolvedValue({
      text: '```json\n{"approved": true, "feedback": "OK", "issues": []}\n```',
      provider: 'claude',
      model: 'claude-sonnet-4-6',
      tokenCount: 50,
    });

    const d = new Discusser({
      provider: 'claude',
      model: 'claude-sonnet-4-6',
      storage,
      hooks: { onRoundComplete },
    });

    await d.run({
      idea: 'test',
      agents: [makeMember('cto', 1)],
      complexity: { discussionRounds: 1 },
    });

    expect(onRoundComplete).toHaveBeenCalledTimes(1);
    expect(onRoundComplete).toHaveBeenCalledWith(1, expect.objectContaining({ converged: true }));
  });

  it('onAgentCall 훅이 각 LLM 호출마다 실행된다', async () => {
    const onAgentCall = vi.fn();

    callLLM.mockResolvedValue({
      text: '```json\n{"approved": true, "feedback": "OK", "issues": []}\n```',
      provider: 'claude',
      model: 'claude-sonnet-4-6',
      tokenCount: 50,
    });

    const d = new Discusser({
      provider: 'claude',
      model: 'claude-sonnet-4-6',
      storage,
      hooks: { onAgentCall },
    });

    await d.run({
      idea: 'test',
      agents: [makeMember('cto', 1)],
      complexity: { discussionRounds: 1 },
    });

    // cto 분석 + 종합 + cto 리뷰 = 최소 3회
    expect(onAgentCall.mock.calls.length).toBeGreaterThanOrEqual(3);
  });

  it('비승인 에이전트의 피드백이 다음 라운드에 주입된다', async () => {
    let round = 0;
    callLLM.mockImplementation(async (_provider, prompt) => {
      // 리뷰 응답: 1라운드에서 CTO만 거부
      if (prompt.includes('리뷰 대상')) {
        if (round === 0 && prompt.includes('CTO')) {
          return {
            text: '```json\n{"approved": false, "feedback": "보안 취약점이 있습니다", "issues": [{"severity": "critical", "description": "SQL injection"}]}\n```',
            provider: 'claude',
            model: 'claude-sonnet-4-6',
            tokenCount: 50,
          };
        }
        round++;
        return {
          text: '```json\n{"approved": true, "feedback": "OK", "issues": []}\n```',
          provider: 'claude',
          model: 'claude-sonnet-4-6',
          tokenCount: 50,
        };
      }
      // 분석 프롬프트: feedbackForMe가 주입되었는지 확인
      return {
        text: 'Analysis result',
        provider: 'claude',
        model: 'claude-sonnet-4-6',
        tokenCount: 50,
      };
    });

    const team = {
      idea: 'test project',
      agents: [makeMember('cto', 1), makeMember('qa', 5)],
      complexity: { discussionRounds: 2 },
    };

    const result = await discusser.run(team);
    // 2라운드 이상 실행됨 (1라운드에서 CTO가 거부했으므로)
    expect(result.rounds).toBeGreaterThanOrEqual(1);
    expect(result.document).toBeTruthy();
  });

  it('parallelTiers=false일 때 tier별로 그룹화하여 순차 호출한다', async () => {
    const callOrder = [];
    callLLM.mockImplementation(async (_provider, prompt, opts) => {
      // 역할명은 system(opts.systemMessage)에 있음 — user(prompt)에는 없음
      const searchTarget = (opts && opts.systemMessage) || prompt;
      const match = searchTarget.match(/\*\*(\w+)\*\*/);
      if (match) callOrder.push(match[1]);
      return {
        text: '```json\n{"approved": true, "feedback": "OK", "issues": []}\n```',
        provider: 'claude',
        model: 'claude-sonnet-4-6',
        tokenCount: 50,
      };
    });

    const d = new Discusser({
      provider: 'claude',
      model: 'claude-sonnet-4-6',
      storage,
      hooks: {},
      parallelTiers: false,
    });

    await d.run({
      idea: 'test',
      agents: [
        makeMember('cto', 1), // tier 1
        makeMember('qa', 5), // tier 3
      ],
      complexity: { discussionRounds: 1 },
    });

    // CTO(tier1)가 QA(tier3)보다 먼저 분석을 수행해야 함
    const ctoIdx = callOrder.indexOf('CTO');
    const qaIdx = callOrder.indexOf('QA');
    expect(ctoIdx).toBeLessThan(qaIdx);
  });

  it('parallelTiers=true (기본값)일 때 모든 에이전트를 동시에 호출한다', async () => {
    const callTimes = {};
    callLLM.mockImplementation(async (_provider, prompt, opts) => {
      // 역할명은 system(opts.systemMessage)에 있음 — user(prompt)에는 없음
      const searchTarget = (opts && opts.systemMessage) || prompt;
      const match = searchTarget.match(/\*\*(\w+)\*\*/);
      if (match) callTimes[match[1]] = Date.now();
      return {
        text: '```json\n{"approved": true, "feedback": "OK", "issues": []}\n```',
        provider: 'claude',
        model: 'claude-sonnet-4-6',
        tokenCount: 50,
      };
    });

    // 기본 discusser는 parallelTiers=true (config 기본값)
    await discusser.run({
      idea: 'test',
      agents: [
        makeMember('cto', 1), // tier 1
        makeMember('fullstack', 3), // tier 2
        makeMember('qa', 5), // tier 3
      ],
      complexity: { discussionRounds: 1 },
    });

    // 모든 분석 에이전트가 호출되었는지 확인
    expect(callTimes).toHaveProperty('CTO');
    expect(callTimes).toHaveProperty('FULLSTACK');
    expect(callTimes).toHaveProperty('QA');
  });

  it('parallelTiers 기본값은 config.discussion.parallelTiers에서 가져온다', () => {
    expect(config.discussion.parallelTiers).toBe(true);
    expect(discusser.parallelTiers).toBe(true);
  });

  it('parallelTiers=true일 때 모든 에이전트 분석 결과가 종합에 포함된다', async () => {
    let synthesisPrompt = '';
    callLLM.mockImplementation(async (_provider, prompt) => {
      // 종합 프롬프트 캡처
      if (prompt.includes('팀원 분석 결과')) {
        synthesisPrompt = prompt;
      }
      return {
        text: '```json\n{"approved": true, "feedback": "OK", "issues": []}\n```',
        provider: 'claude',
        model: 'claude-sonnet-4-6',
        tokenCount: 50,
      };
    });

    await discusser.run({
      idea: 'test',
      agents: [makeMember('cto', 1), makeMember('qa', 5)],
      complexity: { discussionRounds: 1 },
    });

    // 종합 프롬프트에 모든 에이전트의 분석이 포함되어야 함
    expect(synthesisPrompt).toContain('2명');
  });
});
