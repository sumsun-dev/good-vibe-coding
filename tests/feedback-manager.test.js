import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdir, rm } from 'fs/promises';
import { resolve } from 'path';
import {
  addFeedback,
  getFeedbackHistory,
  getTeamStats,
  formatFeedbackSummary,
  setFeedbackDir,
} from '../scripts/lib/feedback-manager.js';

const TMP_DIR = resolve('.tmp-test-feedback');

beforeEach(async () => {
  await mkdir(TMP_DIR, { recursive: true });
  setFeedbackDir(TMP_DIR);
});

afterEach(async () => {
  await rm(TMP_DIR, { recursive: true, force: true });
});

describe('addFeedback', () => {
  it('정상적으로 피드백을 추가한다', async () => {
    const feedback = await addFeedback('proj-1', 'backend', 4, '좋은 API 설계');
    expect(feedback.projectId).toBe('proj-1');
    expect(feedback.roleId).toBe('backend');
    expect(feedback.rating).toBe(4);
    expect(feedback.comment).toBe('좋은 API 설계');
    expect(feedback.createdAt).toBeTruthy();
  });

  it('rating 범위를 검증한다 (1-5)', async () => {
    await expect(addFeedback('proj-1', 'backend', 0, '')).rejects.toThrow('rating');
    await expect(addFeedback('proj-1', 'backend', 6, '')).rejects.toThrow('rating');
  });

  it('rating이 정수가 아니면 에러', async () => {
    await expect(addFeedback('proj-1', 'backend', 3.5, '')).rejects.toThrow('rating');
  });

  it('여러 피드백을 누적 저장한다', async () => {
    await addFeedback('proj-1', 'backend', 4, 'A');
    await addFeedback('proj-1', 'qa', 5, 'B');
    await addFeedback('proj-2', 'backend', 3, 'C');
    const history = await getFeedbackHistory('backend');
    expect(history.length).toBe(2);
  });
});

describe('getFeedbackHistory', () => {
  it('역할별로 필터링한다', async () => {
    await addFeedback('proj-1', 'backend', 4, 'A');
    await addFeedback('proj-1', 'qa', 5, 'B');
    const backendHistory = await getFeedbackHistory('backend');
    expect(backendHistory.length).toBe(1);
    expect(backendHistory[0].roleId).toBe('backend');
  });

  it('빈 히스토리를 반환한다', async () => {
    const history = await getFeedbackHistory('nonexistent');
    expect(history).toEqual([]);
  });
});

describe('getTeamStats', () => {
  it('평균 평점을 계산한다', async () => {
    await addFeedback('proj-1', 'backend', 4, 'A');
    await addFeedback('proj-2', 'backend', 2, 'B');
    const stats = await getTeamStats();
    const backendStat = stats.find(s => s.roleId === 'backend');
    expect(backendStat.avgRating).toBe(3);
    expect(backendStat.projectCount).toBe(2);
  });

  it('빈 상태에서 빈 배열을 반환한다', async () => {
    const stats = await getTeamStats();
    expect(stats).toEqual([]);
  });
});

describe('formatFeedbackSummary', () => {
  it('포맷을 확인한다', () => {
    const feedbacks = [
      { projectId: 'proj-1', roleId: 'backend', rating: 4, comment: '좋았다', createdAt: '2026-02-22T00:00:00.000Z' },
    ];
    const summary = formatFeedbackSummary(feedbacks);
    expect(summary).toContain('backend');
    expect(summary).toContain('4');
    expect(summary).toContain('좋았다');
  });

  it('빈 피드백은 안내 메시지를 반환한다', () => {
    const summary = formatFeedbackSummary([]);
    expect(summary).toContain('피드백');
  });
});
