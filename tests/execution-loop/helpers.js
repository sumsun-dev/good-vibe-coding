import { mkdir, rm } from 'fs/promises';
import { resolve } from 'path';
import {
  createProject,
  addProjectTasks,
  updateProjectStatus,
  getProject,
  setBaseDir,
} from '../../scripts/lib/project/project-manager.js';

export { getProject };

// 테스트용 프로젝트 + 태스크 헬퍼
export async function createTestProject(phases = 2) {
  const project = await createProject('테스트', 'web-app', '설명', { mode: 'plan-execute' });
  const tasks = [];
  for (let p = 1; p <= phases; p++) {
    tasks.push({
      id: `task-${p}-1`,
      title: `Phase ${p} 구현`,
      assignee: 'backend',
      description: `Phase ${p} 백엔드 구현`,
      phase: p,
      status: 'pending',
    });
    tasks.push({
      id: `task-${p}-2`,
      title: `Phase ${p} 설계`,
      assignee: 'cto',
      description: `Phase ${p} 아키텍처 설계`,
      phase: p,
      status: 'pending',
    });
  }
  await addProjectTasks(project.id, tasks);
  await updateProjectStatus(project.id, 'approved');
  return getProject(project.id);
}

/**
 * 파일별 고유 테스트 환경 생성 (병렬 실행 시 디렉토리 충돌 방지)
 */
export function createTestEnvironment(suffix) {
  const dir = resolve(`.tmp-test-exec-${suffix}`);
  return {
    TMP_DIR: dir,
    async setup() {
      await mkdir(dir, { recursive: true });
      setBaseDir(dir);
    },
    async cleanup() {
      // Windows에서 한국어 폴더명 삭제 시 ENOTEMPTY 발생 가능 — 재시도
      for (let i = 0; i < 3; i++) {
        try {
          await rm(dir, { recursive: true, force: true });
          break;
        } catch {
          await new Promise((r) => setTimeout(r, 100));
        }
      }
    },
  };
}
