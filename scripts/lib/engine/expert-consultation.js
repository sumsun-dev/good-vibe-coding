/**
 * expert-consultation — 에이전트 간 전문가 협의 모듈
 * 태스크 실행 중 [CONSULT:role]: question 패턴으로 다른 역할에게 ad-hoc 질문.
 * review-conversation.js 패턴을 재사용하며, 최대 1회 왕복으로 제한.
 */

import { randomBytes } from 'crypto';

const CONSULT_PATTERN = /\[CONSULT:([a-zA-Z_-]+)\]:\s*([^\n]+)/g;

/**
 * 태스크 출력에서 consultation 요청을 추출한다.
 * @param {string} taskOutput - 에이전트의 태스크 출력
 * @returns {Array<{role: string, question: string}>} 첫 번째 요청만 반환 (최대 1개)
 */
export function extractConsultationRequests(taskOutput) {
  if (!taskOutput || typeof taskOutput !== 'string') return [];

  const matches = [];
  let match;
  // reset lastIndex for safety
  CONSULT_PATTERN.lastIndex = 0;
  while ((match = CONSULT_PATTERN.exec(taskOutput)) !== null) {
    matches.push({ role: match[1], question: match[2].trim() });
  }

  // 첫 번째만 반환
  return matches.slice(0, 1);
}

/**
 * 전문가 협의를 오케스트레이션한다 (1왕복).
 * @param {object} options
 * @param {object} options.requester - 요청자 팀원 정보
 * @param {object} options.expert - 전문가 팀원 정보
 * @param {object} options.task - 태스크 정보
 * @param {string} options.taskOutput - 태스크 실행 결과물
 * @param {string} options.question - 질문 내용
 * @param {object|null} options.messageBus - 메시지 버스 (null이면 메시지 기록 건너뜀)
 * @param {Function} options.callLLM - LLM 호출 함수
 * @returns {Promise<{consultationHappened: boolean, answer?: string, role?: string}>}
 */
export async function orchestrateConsultation({
  requester,
  expert,
  task,
  taskOutput,
  question,
  messageBus,
  callLLM,
}) {
  const threadId = `consult-${task.id}-${Date.now()}-${randomBytes(2).toString('hex')}`;

  try {
    // 1) 요청자 → 전문가: 질문 메시지 전송
    if (messageBus) {
      await messageBus.send(requester.roleId, expert.roleId, {
        type: 'consultation',
        content: question,
        threadId,
      });
    }

    // 2) 전문가에게 답변 요청 (LLM 호출)
    const prompt = buildConsultationPrompt(expert, task, taskOutput, question, requester);
    const response = await callLLM('claude', prompt, {});
    const answer = response.text;

    // 3) 전문가 → 요청자: 답변 메시지 전송
    if (messageBus) {
      await messageBus.send(expert.roleId, requester.roleId, {
        type: 'consultation-reply',
        content: answer,
        threadId,
      });
    }

    return {
      consultationHappened: true,
      answer,
      role: expert.roleId,
    };
  } catch {
    // LLM 호출 실패 시 graceful degradation
    return { consultationHappened: false };
  }
}

/**
 * 태스크 출력에 전문가 협의 결과를 추가한다.
 * @param {string} taskOutput - 원본 태스크 출력
 * @param {object} consultation - orchestrateConsultation 결과
 * @returns {string} enriched 출력
 */
export function enrichTaskOutputWithConsultation(taskOutput, consultation) {
  if (!consultation || !consultation.consultationHappened) {
    return taskOutput;
  }

  return `${taskOutput}\n\n## Expert Consultation\n- **전문가**: ${consultation.role}\n- **답변**: ${consultation.answer}`;
}

/**
 * 전문가 답변 프롬프트를 생성한다.
 */
function buildConsultationPrompt(expert, task, taskOutput, question, requester) {
  return `당신은 **${expert.displayName}** (${expert.role})입니다.

## 상황
${requester.displayName} (${requester.role})이 태스크 "${task.title}" 실행 중 전문적인 의견을 요청했습니다.

## 태스크 결과물 (참고)
${taskOutput}

## 질문
${question}

## 지시사항
전문가로서 간결하고 구체적으로 답변하세요.
실행 가능한 권고사항을 포함하세요.`;
}
