/**
 * review-conversation — 리뷰어-구현자 간 1왕복 대화 오케스트레이션
 * 리뷰어가 질문하면 구현자가 답변하고, 리뷰어가 최종 판정을 내린다.
 * 최대 1왕복으로 제한하여 무한 루프와 비용 증가를 방지한다.
 */

import { parseTaskReview } from './review-engine.js';

/**
 * 리뷰 대화를 오케스트레이션한다.
 * @param {object} options
 * @param {object} options.reviewer - 리뷰어 팀원 정보
 * @param {object} options.implementer - 구현자 팀원 정보
 * @param {object} options.task - 태스크 정보
 * @param {string} options.taskOutput - 태스크 실행 결과물
 * @param {object} options.review - 초기 리뷰 결과 ({ verdict, issues, text, question? })
 * @param {object|null} options.messageBus - 메시지 버스 (null이면 메시지 기록 건너뜀)
 * @param {Function} options.callLLM - LLM 호출 함수 (provider, prompt, options) => response
 * @returns {Promise<{ verdict: string, issues: Array, conversationHappened: boolean }>}
 */
export async function orchestrateReviewConversation({
  reviewer,
  implementer,
  task,
  taskOutput,
  review,
  messageBus,
  callLLM,
}) {
  // 질문이 없으면 원본 리뷰 그대로 반환
  if (!review.question) {
    return {
      verdict: review.verdict,
      issues: review.issues || [],
      conversationHappened: false,
    };
  }

  const threadId = `review-${task.id}-${Date.now()}`;

  try {
    // 1) 리뷰어 → 구현자: 질문 메시지 전송
    if (messageBus) {
      await messageBus.send(reviewer.roleId, implementer.roleId, {
        type: 'question',
        content: review.question,
        threadId,
      });
    }

    // 2) 구현자에게 답변 요청 (LLM 호출)
    const answerPrompt = buildAnswerPrompt(implementer, task, taskOutput, review.question);
    const answerResponse = await callLLM('claude', answerPrompt, {});
    const answer = answerResponse.text;

    // 구현자 → 리뷰어: 답변 메시지 전송
    if (messageBus) {
      await messageBus.send(implementer.roleId, reviewer.roleId, {
        type: 'answer',
        content: answer,
        threadId,
      });
    }

    // 3) 리뷰어에게 최종 리뷰 요청 (답변 반영, 최대 1왕복)
    const finalReviewPrompt = buildFinalReviewPrompt(reviewer, task, taskOutput, review, answer);
    const finalResponse = await callLLM('claude', finalReviewPrompt, {});
    const finalReview = parseTaskReview(finalResponse.text);

    return {
      verdict: finalReview.verdict,
      issues: finalReview.issues || [],
      conversationHappened: true,
    };
  } catch {
    // LLM 호출 실패 시 원본 리뷰를 유지하며 graceful degradation
    return {
      verdict: review.verdict,
      issues: review.issues || [],
      conversationHappened: false,
    };
  }
}

/**
 * 구현자 답변 프롬프트를 생성한다.
 */
function buildAnswerPrompt(implementer, task, taskOutput, question) {
  return `당신은 **${implementer.displayName}** (${implementer.role})입니다.

## 작업 정보
- ID: ${task.id}
- 제목: ${task.title}

## 당신의 작업 결과물
${taskOutput}

## 리뷰어의 질문
${question}

## 지시사항
리뷰어의 질문에 구체적으로 답변하세요.
코드의 관련 부분을 인용하여 설명하세요.`;
}

/**
 * 리뷰어 최종 리뷰 프롬프트를 생성한다.
 */
function buildFinalReviewPrompt(reviewer, task, taskOutput, originalReview, answer) {
  return `당신은 **${reviewer.displayName}** (${reviewer.role})입니다.

## 리뷰 대상 작업
- ID: ${task.id}
- 제목: ${task.title}

## 작업 결과물
${taskOutput}

## 당신의 이전 리뷰
${originalReview.text}

## 구현자의 답변
${answer}

## 지시사항
구현자의 답변을 반영하여 최종 리뷰를 작성하세요.
답변이 만족스러우면 verdict를 "approve"로 변경할 수 있습니다.

### 출력 형식 (반드시 아래 JSON 형식으로 출력)

\`\`\`json
{
  "verdict": "approve" 또는 "request-changes",
  "issues": [
    {
      "severity": "critical 또는 important 또는 minor",
      "description": "이슈 설명",
      "suggestion": "수정 방안"
    }
  ]
}
\`\`\``;
}
