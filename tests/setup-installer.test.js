import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { mkdir, rm, writeFile, readFile } from 'fs/promises';
import {
  listInstalled,
  installItem,
  installItems,
  formatInstallResults,
} from '../scripts/lib/agent/setup-installer.js';
import * as appPaths from '../scripts/lib/core/app-paths.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const TMP_DIR = resolve(__dirname, '../.tmp-test-installer');

describe('setup-installer', () => {
  beforeEach(async () => {
    await mkdir(TMP_DIR, { recursive: true });
    // Mock app-paths to use temp directory
    vi.spyOn(appPaths, 'claudeDir').mockReturnValue(TMP_DIR);
    vi.spyOn(appPaths, 'userSkillsDir').mockReturnValue(resolve(TMP_DIR, 'skills'));
    vi.spyOn(appPaths, 'userAgentsDir').mockReturnValue(resolve(TMP_DIR, 'agents'));
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await rm(TMP_DIR, { recursive: true, force: true });
  });

  // --- listInstalled ---
  describe('listInstalled', () => {
    it('설치된 스킬과 에이전트를 반환한다', async () => {
      const skillDir = resolve(TMP_DIR, 'skills', 'test-skill');
      const agentDir = resolve(TMP_DIR, 'agents');
      await mkdir(skillDir, { recursive: true });
      await mkdir(agentDir, { recursive: true });
      await writeFile(resolve(skillDir, 'SKILL.md'), 'content');
      await writeFile(resolve(agentDir, 'test-agent.md'), 'content');

      const result = await listInstalled();
      expect(result.skills).toContain('test-skill');
      expect(result.agents).toContain('test-agent');
    });

    it('빈 디렉토리에서 빈 배열을 반환한다', async () => {
      await mkdir(resolve(TMP_DIR, 'skills'), { recursive: true });
      await mkdir(resolve(TMP_DIR, 'agents'), { recursive: true });

      const result = await listInstalled();
      expect(result.skills).toEqual([]);
      expect(result.agents).toEqual([]);
    });

    it('디렉토리 미존재 시 빈 배열을 반환한다', async () => {
      const result = await listInstalled();
      expect(result.skills).toEqual([]);
      expect(result.agents).toEqual([]);
    });
  });

  // --- installItem ---
  describe('installItem', () => {
    it('소스 파일을 대상 경로에 설치한다', async () => {
      const item = {
        id: 'project-setup',
        sourcePath: 'skills/project-setup/SKILL.md',
        installPath: 'skills/project-setup/SKILL.md',
      };
      const result = await installItem(item);
      expect(result.installed).toBe(true);
      expect(result.skipped).toBe(false);
      expect(result.id).toBe('project-setup');

      const content = await readFile(result.path, 'utf-8');
      expect(content.length).toBeGreaterThan(0);
    });

    it('이미 존재하는 파일은 skip한다', async () => {
      const targetDir = resolve(TMP_DIR, 'skills', 'project-setup');
      await mkdir(targetDir, { recursive: true });
      await writeFile(resolve(targetDir, 'SKILL.md'), 'existing');

      const item = {
        id: 'project-setup',
        sourcePath: 'skills/project-setup/SKILL.md',
        installPath: 'skills/project-setup/SKILL.md',
      };
      const result = await installItem(item);
      expect(result.installed).toBe(false);
      expect(result.skipped).toBe(true);

      const content = await readFile(result.path, 'utf-8');
      expect(content).toBe('existing');
    });

    it('부모 디렉토리를 자동 생성한다', async () => {
      const item = {
        id: 'code-reviewer-kr',
        sourcePath: 'agents/code-reviewer-kr.md',
        installPath: 'agents/code-reviewer-kr.md',
      };
      const result = await installItem(item);
      expect(result.installed).toBe(true);
      expect(result.path).toContain('agents');
    });

    it('installPath path traversal을 차단한다', async () => {
      const item = {
        id: 'malicious',
        sourcePath: 'agents/code-reviewer-kr.md',
        installPath: '../../etc/passwd',
      };
      await expect(installItem(item)).rejects.toThrow('허용 범위를 벗어났습니다');
    });

    it('sourcePath path traversal을 차단한다', async () => {
      const item = {
        id: 'malicious',
        sourcePath: '../../../etc/passwd',
        installPath: 'agents/safe.md',
      };
      await expect(installItem(item)).rejects.toThrow('허용 범위를 벗어났습니다');
    });

    it('소스 파일 미존재 시 에러를 던진다', async () => {
      const item = {
        id: 'nonexistent',
        sourcePath: 'agents/does-not-exist.md',
        installPath: 'agents/does-not-exist.md',
      };
      await expect(installItem(item)).rejects.toThrow();
    });
  });

  // --- installItems ---
  describe('installItems', () => {
    it('여러 항목을 배치 설치한다', async () => {
      const items = [
        {
          id: 'project-setup',
          sourcePath: 'skills/project-setup/SKILL.md',
          installPath: 'skills/project-setup/SKILL.md',
        },
        {
          id: 'code-reviewer-kr',
          sourcePath: 'agents/code-reviewer-kr.md',
          installPath: 'agents/code-reviewer-kr.md',
        },
      ];
      const results = await installItems(items);
      expect(results).toHaveLength(2);
      expect(results.every((r) => r.installed)).toBe(true);
    });

    it('에러 발생 시 나머지 항목을 계속 설치한다', async () => {
      const items = [
        {
          id: 'nonexistent',
          sourcePath: 'agents/does-not-exist.md',
          installPath: 'agents/does-not-exist.md',
        },
        {
          id: 'code-reviewer-kr',
          sourcePath: 'agents/code-reviewer-kr.md',
          installPath: 'agents/code-reviewer-kr.md',
        },
      ];
      const results = await installItems(items);
      expect(results).toHaveLength(2);
      expect(results[0].error).toBeDefined();
      expect(results[0].installed).toBe(false);
      expect(results[1].installed).toBe(true);
    });

    it('부분 성공을 처리한다 (이미 설치된 항목 포함)', async () => {
      const targetDir = resolve(TMP_DIR, 'skills', 'project-setup');
      await mkdir(targetDir, { recursive: true });
      await writeFile(resolve(targetDir, 'SKILL.md'), 'existing');

      const items = [
        {
          id: 'project-setup',
          sourcePath: 'skills/project-setup/SKILL.md',
          installPath: 'skills/project-setup/SKILL.md',
        },
        {
          id: 'code-reviewer-kr',
          sourcePath: 'agents/code-reviewer-kr.md',
          installPath: 'agents/code-reviewer-kr.md',
        },
      ];
      const results = await installItems(items);
      expect(results[0].skipped).toBe(true);
      expect(results[1].installed).toBe(true);
    });
  });

  // --- formatInstallResults ---
  describe('formatInstallResults', () => {
    it('설치/스킵 혼합 결과를 포맷한다', () => {
      const results = [
        { id: 'skill-a', installed: true, skipped: false, path: '/tmp/skills/a/SKILL.md' },
        { id: 'agent-b', installed: false, skipped: true, path: '/tmp/agents/b.md' },
      ];
      const out = formatInstallResults(results);
      expect(out).toContain('skill-a');
      expect(out).toContain('[설치]');
      expect(out).toContain('agent-b');
      expect(out).toContain('[스킵]');
      expect(out).toContain('설치: 1개');
      expect(out).toContain('건너뜀: 1개');
    });

    it('에러 결과를 포맷한다', () => {
      const results = [
        { id: 'bad-item', installed: false, skipped: false, error: '파일 없음', path: '' },
      ];
      const out = formatInstallResults(results);
      expect(out).toContain('[실패]');
      expect(out).toContain('bad-item');
      expect(out).toContain('파일 없음');
    });

    it('빈 배열이면 안내 메시지를 반환한다', () => {
      const out = formatInstallResults([]);
      expect(out).toContain('설치할 항목이 없습니다');
    });

    it('전체 설치 결과를 포맷한다', () => {
      const results = [
        { id: 'a', installed: true, skipped: false, path: '/p/a' },
        { id: 'b', installed: true, skipped: false, path: '/p/b' },
      ];
      const out = formatInstallResults(results);
      expect(out).toContain('설치: 2개');
      expect(out).toContain('건너뜀: 0개');
    });

    it('전체 스킵 결과를 포맷한다', () => {
      const results = [{ id: 'a', installed: false, skipped: true, path: '/p/a' }];
      const out = formatInstallResults(results);
      expect(out).toContain('설치: 0개');
      expect(out).toContain('건너뜀: 1개');
    });
  });
});
