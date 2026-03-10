/**
 * cross-model-strategy — 크로스 모델 리뷰 라우팅
 *
 * 구현자와 다른 모델을 리뷰어에게 할당하여
 * "같은 모델이 자기 확인" 문제를 해결.
 *
 * 전략:
 * - single: 모든 리뷰를 기본 프로바이더(Claude)로 실행
 * - cross-model: 리뷰어별로 다른 프로바이더를 라운드로빈 배정
 */

import { loadProvidersConfig } from '../llm/auth-manager.js';

/**
 * 활성화된 프로바이더 목록을 반환한다.
 * @param {object} providerConfig - providers.json 설정
 * @returns {string[]} 활성화된 프로바이더 ID 배열
 */
export function getEnabledProviders(providerConfig) {
  if (!providerConfig?.providers) return [];
  return Object.entries(providerConfig.providers)
    .filter(([, config]) => config.enabled)
    .map(([id]) => id);
}

/**
 * 리뷰어별 프로바이더를 할당한다.
 *
 * 전략:
 * - 가용 프로바이더가 1개: 모든 리뷰어에 동일 프로바이더
 * - 가용 프로바이더가 2개+: 구현자와 다른 프로바이더를 우선 배정, 라운드로빈
 *
 * @param {Array<object>} reviewers - 선정된 리뷰어 배열
 * @param {string} implementerProvider - 구현에 사용된 프로바이더
 * @param {object} providerConfig - providers.json 설정
 * @returns {Array<{ reviewer: object, provider: string }>}
 */
export function assignReviewProviders(reviewers, implementerProvider, providerConfig) {
  if (!reviewers || reviewers.length === 0) return [];

  const available = getEnabledProviders(providerConfig);

  // 프로바이더가 없으면 구현자 프로바이더 사용
  if (available.length === 0) {
    return reviewers.map((reviewer) => ({ reviewer, provider: implementerProvider }));
  }

  // 프로바이더가 1개면 단일 모델 리뷰
  if (available.length === 1) {
    return reviewers.map((reviewer) => ({ reviewer, provider: available[0] }));
  }

  // 구현자와 다른 프로바이더 우선 배정
  const otherProviders = available.filter((p) => p !== implementerProvider);

  // 다른 프로바이더가 없으면 (구현자 프로바이더만 활성) 전체 사용
  if (otherProviders.length === 0) {
    return reviewers.map((reviewer) => ({ reviewer, provider: implementerProvider }));
  }

  return reviewers.map((reviewer, idx) => ({
    reviewer,
    provider: otherProviders[idx % otherProviders.length],
  }));
}

/**
 * 현재 리뷰 전략에 따라 프로바이더를 배정한다.
 * cross-model이면 크로스 모델 배정, single이면 기본 프로바이더.
 *
 * @param {Array<object>} reviewers
 * @param {object} providerConfig - providers.json 설정 (없으면 자동 로딩)
 * @returns {Promise<Array<{ reviewer: object, provider: string }>>}
 */
export async function resolveReviewAssignments(reviewers, providerConfig = null) {
  if (!reviewers || reviewers.length === 0) return [];

  const config = providerConfig || (await loadProvidersConfig());
  const defaultProvider = config.defaultProvider || 'claude';

  if (config.reviewStrategy !== 'cross-model') {
    // single 전략: 모두 기본 프로바이더
    return reviewers.map((reviewer) => ({ reviewer, provider: defaultProvider }));
  }

  return assignReviewProviders(reviewers, defaultProvider, config);
}

/**
 * 크로스 모델 리뷰를 실행한다.
 * 각 리뷰어의 프롬프트를 할당된 프로바이더 API로 전송.
 *
 * @param {Array<{ reviewer: object, provider: string }>} assignments
 * @param {object} task - 태스크 정보
 * @param {string} taskOutput - 작업 결과물
 * @returns {Promise<Array<{ reviewer: object, provider: string, model: string, review: object, tokenCount: number }>>}
 */
export async function executeCrossModelReviews(assignments, task, taskOutput) {
  if (!assignments || assignments.length === 0) return [];

  // 동적 import로 순환 참조 방지
  const { buildTaskReviewPrompt, parseTaskReview } = await import('./review-engine.js');
  const { callLLM } = await import('../llm/llm-provider.js');

  const results = await Promise.allSettled(
    assignments.map(async ({ reviewer, provider }) => {
      const { system, user } = buildTaskReviewPrompt(reviewer, task, taskOutput);
      const response = await callLLM(provider, user, { systemMessage: system });
      let review = parseTaskReview(response.text);

      // parse-error 시 형식 강조 프롬프트로 1회 재시도
      if (review.verdict === 'parse-error') {
        const retryUser =
          user +
          '\n\n반드시 위 JSON 형식으로만 응답하세요. 다른 텍스트 없이 ```json ... ``` 블록만 출력하세요.';
        const retryResponse = await callLLM(provider, retryUser, { systemMessage: system });
        review = parseTaskReview(retryResponse.text);

        // 2회 연속 parse-error → fallback
        if (review.verdict === 'parse-error') {
          review = {
            verdict: 'request-changes',
            issues: [{ severity: 'important', description: '리뷰 형식 파싱 실패' }],
          };
        }
      }

      return {
        reviewer,
        provider,
        model: response.model,
        review,
        tokenCount: response.tokenCount,
      };
    }),
  );

  return results.map((result, idx) => {
    if (result.status === 'fulfilled') return result.value;
    // 실패 시 fallback: request-changes + 에러 보고
    return {
      reviewer: assignments[idx].reviewer,
      provider: assignments[idx].provider,
      model: '',
      review: {
        verdict: 'request-changes',
        issues: [
          {
            severity: 'important',
            description: `${assignments[idx].provider} API 호출 실패: ${result.reason?.message || 'unknown error'}`,
            suggestion: 'API 연결 확인 후 재시도',
          },
        ],
      },
      tokenCount: 0,
    };
  });
}

/**
 * 크로스 모델 리뷰 결과 요약을 생성한다.
 * @param {Array<{ reviewer: object, provider: string, review: object, tokenCount: number }>} results
 * @returns {{ providerBreakdown: object, totalTokens: number, crossModelUsed: boolean, summary: string }}
 */
export function summarizeCrossModelResults(results) {
  if (!results || results.length === 0) {
    return {
      providerBreakdown: {},
      totalTokens: 0,
      crossModelUsed: false,
      summary: '리뷰 결과 없음',
    };
  }

  const providerBreakdown = {};
  let totalTokens = 0;
  const providers = new Set();

  for (const result of results) {
    const p = result.provider;
    providers.add(p);
    totalTokens += result.tokenCount || 0;

    if (!providerBreakdown[p]) {
      providerBreakdown[p] = { reviewCount: 0, tokenCount: 0, issues: 0 };
    }
    providerBreakdown[p].reviewCount++;
    providerBreakdown[p].tokenCount += result.tokenCount || 0;
    providerBreakdown[p].issues += result.review?.issues?.length || 0;
  }

  const crossModelUsed = providers.size > 1;

  const providerList = [...providers].join(', ');
  const summary = crossModelUsed
    ? `크로스 모델 리뷰 완료: ${providerList} (${results.length}건, ${totalTokens} 토큰)`
    : `단일 모델 리뷰 완료: ${providerList} (${results.length}건, ${totalTokens} 토큰)`;

  return { providerBreakdown, totalTokens, crossModelUsed, summary };
}
