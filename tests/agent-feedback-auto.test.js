import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdir, rm, readFile } from 'fs/promises';
import { resolve } from 'path';
import {
  autoApplyFeedback,
  setOverridesDir,
  saveAgentOverride,
  loadAgentOverride,
} from '../scripts/lib/agent/agent-feedback.js';
import { fileExists } from '../scripts/lib/core/file-writer.js';

const TMP_DIR = resolve('.tmp-test-agent-feedback-auto');

beforeEach(async () => {
  await mkdir(TMP_DIR, { recursive: true });
  setOverridesDir(TMP_DIR);
});

afterEach(async () => {
  await rm(TMP_DIR, { recursive: true, force: true });
});

describe('autoApplyFeedback', () => {
  it('피드백 리스트를 자동으로 저장한다', async () => {
    const feedbackList = [
      { roleId: 'backend', feedback: '# 개선사항\n- 에러 처리 강화' },
      { roleId: 'frontend', feedback: '# 개선사항\n- 접근성 개선' },
    ];
    await autoApplyFeedback(feedbackList);

    const backendContent = await loadAgentOverride('backend');
    expect(backendContent).toContain('에러 처리 강화');
    const frontendContent = await loadAgentOverride('frontend');
    expect(frontendContent).toContain('접근성 개선');
  });

  it('기존 오버라이드를 .bak으로 백업한다', async () => {
    await saveAgentOverride('backend', '기존 오버라이드 내용');
    const feedbackList = [{ roleId: 'backend', feedback: '새로운 개선사항' }];
    await autoApplyFeedback(feedbackList);

    const bakPath = resolve(TMP_DIR, 'backend.md.bak');
    expect(await fileExists(bakPath)).toBe(true);
    const bakContent = await readFile(bakPath, 'utf-8');
    expect(bakContent).toBe('기존 오버라이드 내용');

    const current = await loadAgentOverride('backend');
    expect(current).toContain('새로운 개선사항');
  });

  it('빈 피드백 리스트를 처리한다', async () => {
    await autoApplyFeedback([]);
    // 에러 없이 처리됨
  });

  it('null 피드백 리스트를 처리한다', async () => {
    await autoApplyFeedback(null);
    // 에러 없이 처리됨
  });

  it('피드백 없는 항목은 건너뛴다', async () => {
    const feedbackList = [
      { roleId: 'backend', feedback: '' },
      { roleId: 'frontend', feedback: '유효한 피드백' },
    ];
    await autoApplyFeedback(feedbackList);

    const backendContent = await loadAgentOverride('backend');
    expect(backendContent).toBeNull();
    const frontendContent = await loadAgentOverride('frontend');
    expect(frontendContent).toContain('유효한 피드백');
  });
});
