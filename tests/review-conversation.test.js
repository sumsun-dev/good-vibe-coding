import { describe, it, expect, vi, beforeEach } from 'vitest';
import { orchestrateReviewConversation } from '../scripts/lib/engine/review-conversation.js';
import { MemoryMessageBus } from '../scripts/lib/core/message-bus.js';

function makeReviewer() {
  return {
    roleId: 'qa',
    displayName: 'QA',
    role: 'QA Engineer',
    skills: ['testing'],
  };
}

function makeImplementer() {
  return {
    roleId: 'backend',
    displayName: 'Backend',
    role: 'Backend Developer',
    skills: ['api'],
  };
}

function makeTask() {
  return {
    id: 'task-1',
    title: 'API 구현',
    assignee: 'backend',
    description: 'REST API 엔드포인트 구현',
  };
}

describe('orchestrateReviewConversation', () => {
  let bus;
  let callLLM;

  beforeEach(() => {
    bus = new MemoryMessageBus();
    bus.registerAgents(['qa', 'backend']);
    callLLM = vi.fn();
  });

  it('질문이 없으면 원본 리뷰를 그대로 반환한다', async () => {
    const review = {
      verdict: 'approve',
      issues: [],
      text: '```json\n{"verdict":"approve","issues":[]}\n```',
    };

    const result = await orchestrateReviewConversation({
      reviewer: makeReviewer(),
      implementer: makeImplementer(),
      task: makeTask(),
      taskOutput: 'code output',
      review,
      messageBus: bus,
      callLLM,
    });

    expect(result.verdict).toBe('approve');
    expect(result.conversationHappened).toBe(false);
    expect(callLLM).not.toHaveBeenCalled();
  });

  it('질문이 있으면 구현자에게 질문 → 답변 → 최종 리뷰 1왕복', async () => {
    const review = {
      verdict: 'request-changes',
      issues: [{ severity: 'important', description: 'SQL injection 위험' }],
      text: '```json\n{"verdict":"request-changes","issues":[{"severity":"important","description":"SQL injection 위험"}]}\n```',
      question: '쿼리 파라미터화를 사용하고 있나요?',
    };

    // 1) 구현자 답변
    callLLM.mockResolvedValueOnce({
      text: '네, parameterized query를 사용합니다. PreparedStatement를 확인해주세요.',
      provider: 'claude',
      model: 'test',
      tokenCount: 50,
    });

    // 2) 리뷰어 최종 리뷰
    callLLM.mockResolvedValueOnce({
      text: '```json\n{"verdict":"approve","issues":[]}\n```',
      provider: 'claude',
      model: 'test',
      tokenCount: 50,
    });

    const result = await orchestrateReviewConversation({
      reviewer: makeReviewer(),
      implementer: makeImplementer(),
      task: makeTask(),
      taskOutput: 'code output',
      review,
      messageBus: bus,
      callLLM,
    });

    expect(result.conversationHappened).toBe(true);
    expect(result.verdict).toBe('approve');
    expect(callLLM).toHaveBeenCalledTimes(2);

    // 메시지 버스에 대화가 기록됨
    const qaMessages = await bus.receive('qa', { includeRead: true });
    const backendMessages = await bus.receive('backend', { includeRead: true });
    // 리뷰어(qa) → 구현자(backend) 질문
    expect(backendMessages.length).toBe(1);
    expect(backendMessages[0].type).toBe('question');
    // 구현자(backend) → 리뷰어(qa) 답변
    expect(qaMessages.length).toBe(1);
    expect(qaMessages[0].type).toBe('answer');
  });

  it('최대 1왕복만 허용한다 (무한 루프 방지)', async () => {
    const review = {
      verdict: 'request-changes',
      issues: [],
      text: 'review text',
      question: '질문입니다',
    };

    callLLM
      .mockResolvedValueOnce({
        text: '답변입니다',
        provider: 'claude',
        model: 'test',
        tokenCount: 30,
      })
      .mockResolvedValueOnce({
        text: '```json\n{"verdict":"request-changes","issues":[{"severity":"important","description":"아직 부족"}]}\n```',
        provider: 'claude',
        model: 'test',
        tokenCount: 50,
      });

    const result = await orchestrateReviewConversation({
      reviewer: makeReviewer(),
      implementer: makeImplementer(),
      task: makeTask(),
      taskOutput: 'code output',
      review,
      messageBus: bus,
      callLLM,
    });

    // 2번만 호출 (답변 + 최종 리뷰)
    expect(callLLM).toHaveBeenCalledTimes(2);
    expect(result.conversationHappened).toBe(true);
  });

  it('LLM 호출 실패 시 원본 리뷰를 유지한다 (graceful degradation)', async () => {
    const review = {
      verdict: 'request-changes',
      issues: [{ severity: 'important', description: '이슈' }],
      text: 'review text',
      question: '질문입니다',
    };

    callLLM.mockRejectedValueOnce(new Error('API 한도 초과'));

    const result = await orchestrateReviewConversation({
      reviewer: makeReviewer(),
      implementer: makeImplementer(),
      task: makeTask(),
      taskOutput: 'code output',
      review,
      messageBus: bus,
      callLLM,
    });

    expect(result.conversationHappened).toBe(false);
    expect(result.verdict).toBe('request-changes');
    expect(result.issues.length).toBe(1);
  });

  it('messageBus가 없어도 동작한다 (메시지 기록만 건너뜀)', async () => {
    const review = {
      verdict: 'request-changes',
      issues: [],
      text: 'text',
      question: '질문',
    };

    callLLM
      .mockResolvedValueOnce({ text: '답변', provider: 'claude', model: 'test', tokenCount: 20 })
      .mockResolvedValueOnce({
        text: '```json\n{"verdict":"approve","issues":[]}\n```',
        provider: 'claude',
        model: 'test',
        tokenCount: 30,
      });

    const result = await orchestrateReviewConversation({
      reviewer: makeReviewer(),
      implementer: makeImplementer(),
      task: makeTask(),
      taskOutput: 'code output',
      review,
      messageBus: null,
      callLLM,
    });

    expect(result.conversationHappened).toBe(true);
    expect(result.verdict).toBe('approve');
  });
});
