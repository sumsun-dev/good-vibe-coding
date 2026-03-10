import { describe, it, expect, vi } from 'vitest';
import {
  extractConsultationRequests,
  orchestrateConsultation,
  enrichTaskOutputWithConsultation,
} from '../scripts/lib/engine/expert-consultation.js';

describe('extractConsultationRequests', () => {
  it('유효한 패턴을 파싱한다', () => {
    const output =
      '작업 결과...\n[CONSULT:security]: 인증 방식은 JWT vs Session 중 어떤 게 나을까요?';
    const results = extractConsultationRequests(output);
    expect(results).toHaveLength(1);
    expect(results[0].role).toBe('security');
    expect(results[0].question).toBe('인증 방식은 JWT vs Session 중 어떤 게 나을까요?');
  });

  it('빈 입력이면 빈 배열을 반환한다', () => {
    expect(extractConsultationRequests('')).toEqual([]);
    expect(extractConsultationRequests(null)).toEqual([]);
    expect(extractConsultationRequests(undefined)).toEqual([]);
  });

  it('첫 번째 패턴만 반환한다', () => {
    const output = '[CONSULT:cto]: 아키텍처 질문\n[CONSULT:qa]: 테스트 질문';
    const results = extractConsultationRequests(output);
    expect(results).toHaveLength(1);
    expect(results[0].role).toBe('cto');
  });

  it('잘못된 형식은 무시한다', () => {
    const output = '[CONSULT]: 역할 없는 질문\nCONSULT:cto: 괄호 없음';
    expect(extractConsultationRequests(output)).toEqual([]);
  });

  it('하이픈이 포함된 역할 ID를 지원한다', () => {
    const output = '[CONSULT:ui-ux]: 디자인 시스템은 어떻게?';
    const results = extractConsultationRequests(output);
    expect(results).toHaveLength(1);
    expect(results[0].role).toBe('ui-ux');
  });
});

describe('orchestrateConsultation', () => {
  const makeCallLLM = (text) =>
    vi.fn().mockResolvedValue({ text, provider: 'claude', model: 'test' });

  const requester = { roleId: 'backend', displayName: 'Backend', role: 'Backend' };
  const expert = { roleId: 'security', displayName: 'Security', role: 'Security' };
  const task = { id: 'task-1', title: 'API 구현' };

  it('1왕복 성공', async () => {
    const callLLM = makeCallLLM('JWT를 추천합니다');
    const messageBus = {
      send: vi.fn().mockResolvedValue({ id: 'msg-1' }),
    };

    const result = await orchestrateConsultation({
      requester,
      expert,
      task,
      taskOutput: '코드 작성 완료',
      question: 'JWT vs Session?',
      messageBus,
      callLLM,
    });

    expect(result.consultationHappened).toBe(true);
    expect(result.answer).toBe('JWT를 추천합니다');
    expect(result.role).toBe('security');
    expect(callLLM).toHaveBeenCalledTimes(1);
  });

  it('messageBus에 메시지를 기록한다', async () => {
    const callLLM = makeCallLLM('답변');
    const messageBus = {
      send: vi.fn().mockResolvedValue({ id: 'msg-1' }),
    };

    await orchestrateConsultation({
      requester,
      expert,
      task,
      taskOutput: '출력',
      question: '질문?',
      messageBus,
      callLLM,
    });

    // consultation 질문 + consultation-reply 답변
    expect(messageBus.send).toHaveBeenCalledTimes(2);
    expect(messageBus.send.mock.calls[0][0]).toBe('backend');
    expect(messageBus.send.mock.calls[0][1]).toBe('security');
    expect(messageBus.send.mock.calls[0][2].type).toBe('consultation');
    expect(messageBus.send.mock.calls[1][0]).toBe('security');
    expect(messageBus.send.mock.calls[1][1]).toBe('backend');
    expect(messageBus.send.mock.calls[1][2].type).toBe('consultation-reply');
  });

  it('LLM 실패 시 graceful degradation', async () => {
    const callLLM = vi.fn().mockRejectedValue(new Error('LLM error'));
    const messageBus = {
      send: vi.fn().mockResolvedValue({ id: 'msg-1' }),
    };

    const result = await orchestrateConsultation({
      requester,
      expert,
      task,
      taskOutput: '출력',
      question: '질문?',
      messageBus,
      callLLM,
    });

    expect(result.consultationHappened).toBe(false);
  });

  it('null messageBus에서도 동작한다', async () => {
    const callLLM = makeCallLLM('답변');

    const result = await orchestrateConsultation({
      requester,
      expert,
      task,
      taskOutput: '출력',
      question: '질문?',
      messageBus: null,
      callLLM,
    });

    expect(result.consultationHappened).toBe(true);
    expect(result.answer).toBe('답변');
  });
});

describe('enrichTaskOutputWithConsultation', () => {
  it('답변을 append한다', () => {
    const original = '기존 출력';
    const result = enrichTaskOutputWithConsultation(original, {
      consultationHappened: true,
      answer: 'JWT를 추천합니다',
      role: 'security',
    });

    expect(result).toContain('기존 출력');
    expect(result).toContain('Expert Consultation');
    expect(result).toContain('security');
    expect(result).toContain('JWT를 추천합니다');
  });

  it('consultationHappened=false면 원본을 유지한다', () => {
    const original = '기존 출력';
    const result = enrichTaskOutputWithConsultation(original, {
      consultationHappened: false,
    });
    expect(result).toBe('기존 출력');
  });
});
