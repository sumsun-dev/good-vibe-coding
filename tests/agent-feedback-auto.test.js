import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdir, rm, readFile } from 'fs/promises';
import { resolve } from 'path';
import {
  autoApplyFeedback,
  autoApplyFeedbackViaShadow,
  setOverridesDir,
  saveAgentOverride,
  loadAgentOverride,
} from '../scripts/lib/agent/agent-feedback.js';
import {
  setShadowDir,
  loadCandidateOverride,
  loadCandidateProvenance,
} from '../scripts/lib/agent/agent-shadow-mode.js';
import { fileExists } from '../scripts/lib/core/file-writer.js';

const TMP_DIR = resolve('.tmp-test-agent-feedback-auto');

beforeEach(async () => {
  await mkdir(TMP_DIR, { recursive: true });
  setOverridesDir(TMP_DIR);
  setShadowDir(TMP_DIR);
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

describe('autoApplyFeedbackViaShadow', () => {
  it('피드백을 candidate로 격리 저장한다 (active.md는 건드리지 않음)', async () => {
    await saveAgentOverride('backend', '# 기존 active 가이드');
    const result = await autoApplyFeedbackViaShadow([
      {
        roleId: 'backend',
        feedback: '# 학습안\n- 에러 처리 강화',
        origin: { source: 'project-feedback', projectId: 'p-1' },
      },
    ]);

    expect(result).toHaveLength(1);
    expect(result[0].roleId).toBe('backend');
    expect(result[0].entryId).toMatch(/^ent-[a-f0-9]{12}$/);

    // active는 그대로
    expect(await loadAgentOverride('backend')).toBe('# 기존 active 가이드');

    // candidate에 저장됨
    const candidate = await loadCandidateOverride('backend');
    expect(candidate).toContain('에러 처리 강화');

    // candidate provenance에 origin entry 추가
    const prov = await loadCandidateProvenance('backend');
    expect(prov.entries).toHaveLength(1);
    expect(prov.entries[0].source).toBe('project-feedback');
    expect(prov.entries[0].projectId).toBe('p-1');
  });

  it('이전 candidate가 남아 있으면 폐기 후 새로 저장 (replacedExisting=true)', async () => {
    await autoApplyFeedbackViaShadow([
      {
        roleId: 'backend',
        feedback: '# 첫 학습안',
        origin: { source: 'project-feedback', projectId: 'p-1' },
      },
    ]);

    const result = await autoApplyFeedbackViaShadow([
      {
        roleId: 'backend',
        feedback: '# 두 번째 학습안',
        origin: { source: 'project-feedback', projectId: 'p-2' },
      },
    ]);

    expect(result[0].replacedExisting).toBe(true);
    expect(await loadCandidateOverride('backend')).toContain('두 번째 학습안');

    // provenance도 새로 시작 (이전 entries 폐기됨)
    const prov = await loadCandidateProvenance('backend');
    expect(prov.entries).toHaveLength(1);
    expect(prov.entries[0].projectId).toBe('p-2');
  });

  it("origin이 명시되지 않으면 defaultOrigin('manual') 적용", async () => {
    await autoApplyFeedbackViaShadow([{ roleId: 'backend', feedback: '# 학습안 (origin 없음)' }]);

    const prov = await loadCandidateProvenance('backend');
    expect(prov.entries[0].source).toBe('manual');
  });

  it('options.defaultOrigin override 적용', async () => {
    await autoApplyFeedbackViaShadow([{ roleId: 'backend', feedback: '# 학습안' }], {
      defaultOrigin: {
        source: 'cross-project-pattern',
        projectIds: ['p-a', 'p-b', 'p-c'],
        pattern: 'edge-case',
        repeatCount: 3,
      },
    });

    const prov = await loadCandidateProvenance('backend');
    expect(prov.entries[0].source).toBe('cross-project-pattern');
    expect(prov.entries[0].pattern).toBe('edge-case');
  });

  it('빈/null 리스트는 빈 결과', async () => {
    expect(await autoApplyFeedbackViaShadow([])).toEqual([]);
    expect(await autoApplyFeedbackViaShadow(null)).toEqual([]);
  });

  it('feedback이 빈 항목은 건너뛴다', async () => {
    const result = await autoApplyFeedbackViaShadow([
      { roleId: 'backend', feedback: '' },
      { roleId: 'frontend', feedback: '# 유효한 학습안' },
    ]);
    expect(result).toHaveLength(1);
    expect(result[0].roleId).toBe('frontend');
  });
});
