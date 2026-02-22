/**
 * growth-manager — 팀원 성장 시스템 모듈
 * 피드백 데이터를 분석하여 GrowthProfile을 생성하고 프롬프트에 주입한다.
 */

import { getFeedbackHistory, getTeamStats } from './feedback-manager.js';

const STRENGTH_KEYWORDS = {
  '설계': '설계',
  '아키텍처': '아키텍처',
  '깔끔': '코드 품질',
  '품질': '코드 품질',
  '안정': '안정성',
  '성능': '성능',
  '훌륭': '전반적 우수',
  '뛰어': '전반적 우수',
  '우수': '전반적 우수',
  '좋은': '전반적 우수',
  'API': 'API 설계',
  '보안': '보안',
  '테스트': '테스트',
  '문서': '문서화',
  'UI': 'UI/UX',
  'UX': 'UI/UX',
  '자동화': '자동화',
  '협업': '협업',
  '소통': '소통',
  '리더십': '리더십',
};

const IMPROVEMENT_KEYWORDS = {
  '부족': '보완 필요',
  '미흡': '보완 필요',
  '필요': '개선 필요',
  '느리': '속도 개선',
  '느린': '속도 개선',
  '에러': '에러 처리',
  '오류': '에러 처리',
  '복잡': '복잡도 개선',
  '어렵': '가독성 개선',
};

const LEVEL_NAMES = ['', 'Beginner', 'Growing', 'Competent', 'Advanced', 'Expert'];

/**
 * 평균 평점과 프로젝트 수로 성장 레벨을 계산한다.
 * @param {number} avgRating - 평균 평점
 * @param {number} projectCount - 프로젝트 수
 * @returns {{ level: number, levelName: string }}
 */
export function calculateGrowthLevel(avgRating, projectCount) {
  let level = 1;

  if (projectCount >= 5 && avgRating >= 4.5) {
    level = 5;
  } else if (projectCount >= 4 && avgRating >= 4.0) {
    level = 4;
  } else if (projectCount >= 3 && avgRating >= 3.0) {
    level = 3;
  } else if (projectCount >= 2 && avgRating >= 2.0) {
    level = 2;
  }

  return { level, levelName: LEVEL_NAMES[level] };
}

/**
 * 피드백 코멘트에서 강점/개선점 키워드를 추출한다.
 * @param {Array<{comment: string}>} feedbacks - 피드백 배열
 * @returns {{ strengths: string[], improvements: string[] }}
 */
export function extractInsights(feedbacks) {
  const strengthSet = new Set();
  const improvementSet = new Set();

  for (const feedback of feedbacks) {
    const comment = feedback.comment || '';
    if (!comment) continue;

    for (const [keyword, label] of Object.entries(STRENGTH_KEYWORDS)) {
      if (comment.includes(keyword)) {
        // 부정 컨텍스트에서 언급된 강점 키워드는 개선점으로 분류
        const negIdx = findNegativeContext(comment, keyword);
        if (negIdx) {
          improvementSet.add(label);
        } else {
          strengthSet.add(label);
        }
      }
    }

    for (const [keyword, label] of Object.entries(IMPROVEMENT_KEYWORDS)) {
      if (comment.includes(keyword)) {
        improvementSet.add(label);
      }
    }
  }

  return {
    strengths: [...strengthSet],
    improvements: [...improvementSet],
  };
}

/**
 * 부정 컨텍스트에서 키워드가 사용되었는지 확인한다.
 */
function findNegativeContext(comment, keyword) {
  const negativePatterns = ['부족', '미흡', '없', '안 ', '못 '];
  const idx = comment.indexOf(keyword);
  if (idx === -1) return false;

  const surrounding = comment.slice(Math.max(0, idx - 5), idx + keyword.length + 5);
  return negativePatterns.some(neg => surrounding.includes(neg));
}

/**
 * 성장 목표 문자열을 생성한다.
 * @param {number} level - 현재 레벨
 * @param {string[]} improvements - 개선점 목록
 * @returns {string} 성장 목표
 */
export function generateGrowthGoal(level, improvements) {
  if (level >= 5) {
    return '팀 멘토링 및 기술 리더십 강화';
  }

  if (improvements.length > 0) {
    const top = improvements.slice(0, 2).join(', ');
    return `${top} 역량 강화로 다음 레벨 달성`;
  }

  const defaultGoals = {
    1: '첫 프로젝트 경험을 통한 기본 역량 확보',
    2: '다양한 프로젝트 참여로 실전 경험 축적',
    3: '전문 분야 심화로 Advanced 레벨 도전',
    4: '팀 리딩과 복합 프로젝트로 Expert 달성',
  };

  return defaultGoals[level] || '지속적인 성장 추구';
}

/**
 * 성장 프로필의 한 줄 요약을 생성한다.
 * @param {object} profile - GrowthProfile (부분)
 * @returns {string} 한 줄 요약
 */
export function generateGrowthSummary(profile) {
  const parts = [`Lv.${profile.level} ${profile.levelName}`];

  if (profile.strengths.length > 0) {
    parts.push(`${profile.strengths.slice(0, 2).join('·')}에 강점`);
  }

  if (profile.improvements.length > 0) {
    parts.push(`${profile.improvements.slice(0, 2).join('·')} 개선 필요`);
  }

  if (profile.totalProjects === 0) {
    parts.push('첫 프로젝트 경험 필요');
  }

  return parts.join(' — ');
}

/**
 * 단일 역할의 GrowthProfile을 분석한다.
 * @param {string} roleId - 역할 ID
 * @returns {Promise<object>} GrowthProfile
 */
export async function analyzeGrowth(roleId) {
  const feedbacks = await getFeedbackHistory(roleId);
  const totalProjects = feedbacks.length;
  const avgRating = totalProjects > 0
    ? feedbacks.reduce((sum, f) => sum + f.rating, 0) / totalProjects
    : 0;

  const { level, levelName } = calculateGrowthLevel(avgRating, totalProjects);
  const { strengths, improvements } = extractInsights(feedbacks);
  const growthGoal = generateGrowthGoal(level, improvements);

  const profile = {
    roleId,
    level,
    levelName,
    avgRating,
    totalProjects,
    strengths,
    improvements,
    growthGoal,
  };

  profile.growthSummary = generateGrowthSummary(profile);

  return profile;
}

/**
 * 팀 전체의 GrowthProfile Map을 반환한다.
 * @param {string[]} roleIds - 역할 ID 배열
 * @returns {Promise<Map<string, object>>} roleId → GrowthProfile
 */
export async function getGrowthProfiles(roleIds) {
  const profiles = new Map();

  for (const roleId of roleIds) {
    const profile = await analyzeGrowth(roleId);
    profiles.set(roleId, profile);
  }

  return profiles;
}

/**
 * GrowthProfile을 프롬프트 주입용 마크다운 블록으로 변환한다.
 * @param {object} profile - GrowthProfile
 * @returns {string} 마크다운 블록
 */
export function buildGrowthContext(profile) {
  const lines = [
    `📈 **성장 이력** (Lv.${profile.level} ${profile.levelName})`,
    `- 평균 평점: ${profile.avgRating > 0 ? profile.avgRating.toFixed(1) : '-'}/5`,
    `- 프로젝트 경험: ${profile.totalProjects}건`,
  ];

  if (profile.strengths.length > 0) {
    lines.push(`- 강점: ${profile.strengths.join(', ')}`);
  }

  if (profile.improvements.length > 0) {
    lines.push(`- 개선 과제: ${profile.improvements.join(', ')}`);
  }

  lines.push(`- 성장 목표: ${profile.growthGoal}`);

  return lines.join('\n');
}

/**
 * /growth 커맨드용 성장 현황 테이블을 생성한다.
 * @param {Map<string, object>} profiles - roleId → GrowthProfile
 * @returns {string} 테이블 마크다운
 */
export function formatGrowthReport(profiles) {
  if (profiles.size === 0) {
    return '아직 성장 데이터가 없습니다. `/feedback`으로 팀원 피드백을 남겨주세요.';
  }

  const header = '| 역할 | 레벨 | 평균 평점 | 프로젝트 | 강점 | 개선점 | 목표 |\n|------|------|----------|----------|------|--------|------|\n';

  const rows = [...profiles.entries()]
    .map(([roleId, p]) => {
      const rating = p.avgRating > 0 ? p.avgRating.toFixed(1) : '-';
      const strengths = p.strengths.length > 0 ? p.strengths.slice(0, 2).join(', ') : '-';
      const improvements = p.improvements.length > 0 ? p.improvements.slice(0, 2).join(', ') : '-';
      return `| ${roleId} | Lv.${p.level} ${p.levelName} | ${rating} | ${p.totalProjects} | ${strengths} | ${improvements} | ${p.growthGoal} |`;
    })
    .join('\n');

  return `# 팀원 성장 현황\n\n${header}${rows}`;
}
