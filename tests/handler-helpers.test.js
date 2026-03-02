import { describe, it, expect, vi, beforeEach } from 'vitest';
import { withProject } from '../scripts/lib/core/handler-helpers.js';

vi.mock('../scripts/lib/project/project-manager.js', () => ({
  getProject: vi.fn(),
}));

const { getProject } = await import('../scripts/lib/project/project-manager.js');

describe('withProject', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('프로젝트가 존재하면 콜백을 실행한다', async () => {
    const mockProject = { id: 'test-id', name: 'Test' };
    getProject.mockResolvedValue(mockProject);

    const result = await withProject('test-id', (project) => ({
      name: project.name,
      computed: true,
    }));

    expect(getProject).toHaveBeenCalledWith('test-id');
    expect(result).toEqual({ name: 'Test', computed: true });
  });

  it('프로젝트가 없으면 NOT_FOUND 에러를 던진다', async () => {
    getProject.mockResolvedValue(null);

    await expect(withProject('missing-id', () => {}))
      .rejects.toThrow('프로젝트를 찾을 수 없습니다: missing-id');
  });

  it('콜백에서 발생한 에러를 전파한다', async () => {
    const mockProject = { id: 'test-id' };
    getProject.mockResolvedValue(mockProject);

    await expect(withProject('test-id', () => {
      throw new Error('콜백 에러');
    })).rejects.toThrow('콜백 에러');
  });

  it('async 콜백을 지원한다', async () => {
    const mockProject = { id: 'test-id', name: 'Async Test' };
    getProject.mockResolvedValue(mockProject);

    const result = await withProject('test-id', async (project) => {
      return { name: project.name };
    });

    expect(result).toEqual({ name: 'Async Test' });
  });
});
