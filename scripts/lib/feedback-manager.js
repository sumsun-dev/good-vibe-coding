import { readFile, writeFile } from 'fs/promises';
import { resolve, dirname } from 'path';
import { ensureDir, fileExists } from './file-writer.js';

const DEFAULT_FEEDBACK_DIR = resolve(process.env.HOME || process.env.USERPROFILE, '.claude', 'good-vibe');
let feedbackDir = DEFAULT_FEEDBACK_DIR;

/**
 * 테스트용 피드백 디렉토리를 설정한다.
 * @param {string} dir - 새 디렉토리
 */
export function setFeedbackDir(dir) {
  feedbackDir = dir;
}

function getFeedbackPath() {
  return resolve(feedbackDir, 'feedback.json');
}

/**
 * 전체 피드백을 로드한다.
 * @returns {Promise<Array>} 피드백 배열
 */
async function loadFeedbacks() {
  const path = getFeedbackPath();
  if (!(await fileExists(path))) return [];
  const content = await readFile(path, 'utf-8');
  return JSON.parse(content);
}

/**
 * 전체 피드백을 저장한다.
 * @param {Array} feedbacks - 피드백 배열
 */
async function saveFeedbacks(feedbacks) {
  await ensureDir(feedbackDir);
  await writeFile(getFeedbackPath(), JSON.stringify(feedbacks, null, 2), 'utf-8');
}

/**
 * 피드백을 추가한다.
 * @param {string} projectId - 프로젝트 ID
 * @param {string} roleId - 역할 ID
 * @param {number} rating - 평점 (1-5 정수)
 * @param {string} comment - 코멘트
 * @returns {Promise<object>} 추가된 피드백
 */
export async function addFeedback(projectId, roleId, rating, comment) {
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    throw new Error('rating은 1-5 사이의 정수여야 합니다');
  }

  const feedback = {
    projectId,
    roleId,
    rating,
    comment: comment || '',
    createdAt: new Date().toISOString(),
  };

  const feedbacks = await loadFeedbacks();
  feedbacks.push(feedback);
  await saveFeedbacks(feedbacks);

  return feedback;
}

/**
 * 역할별 피드백 히스토리를 조회한다.
 * @param {string} roleId - 역할 ID
 * @returns {Promise<Array>} 피드백 배열
 */
export async function getFeedbackHistory(roleId) {
  const feedbacks = await loadFeedbacks();
  return feedbacks.filter(f => f.roleId === roleId);
}

/**
 * 역할별 통계를 반환한다.
 * @returns {Promise<Array<{roleId: string, avgRating: number, projectCount: number}>>}
 */
export async function getTeamStats() {
  const feedbacks = await loadFeedbacks();
  if (feedbacks.length === 0) return [];

  const grouped = {};
  for (const f of feedbacks) {
    if (!grouped[f.roleId]) grouped[f.roleId] = [];
    grouped[f.roleId].push(f);
  }

  return Object.entries(grouped).map(([roleId, items]) => ({
    roleId,
    avgRating: items.reduce((sum, f) => sum + f.rating, 0) / items.length,
    projectCount: items.length,
  }));
}

/**
 * 피드백 요약을 포매팅한다.
 * @param {Array} feedbacks - 피드백 배열
 * @returns {string} 표시용 문자열
 */
export function formatFeedbackSummary(feedbacks) {
  if (!feedbacks || feedbacks.length === 0) {
    return '아직 피드백이 없습니다.';
  }

  return feedbacks
    .map(f => `- **${f.roleId}** (${f.rating}/5): ${f.comment}`)
    .join('\n');
}
