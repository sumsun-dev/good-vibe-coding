import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { scanConfigFiles, resetConfigFiles, summarizeConfigFiles } from '../scripts/lib/config-scanner.js';
import { writeFile, rm, mkdir, readFile } from 'fs/promises';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { fileExists } from '../scripts/lib/file-writer.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const TMP_DIR = resolve(__dirname, '../.tmp-test-scanner');

describe('config-scanner', () => {
  beforeEach(async () => {
    await mkdir(TMP_DIR, { recursive: true });
  });

  afterEach(async () => {
    await rm(TMP_DIR, { recursive: true, force: true });
  });

  describe('scanConfigFiles', () => {
    it('빈 디렉토리에서는 빈 배열을 반환한다', async () => {
      const files = await scanConfigFiles(TMP_DIR);
      expect(files).toEqual([]);
    });

    it('CLAUDE.md만 존재하면 1개를 반환한다', async () => {
      await writeFile(resolve(TMP_DIR, 'CLAUDE.md'), '# Test', 'utf-8');

      const files = await scanConfigFiles(TMP_DIR);
      expect(files).toHaveLength(1);
      expect(files[0].relativePath).toBe('CLAUDE.md');
      expect(files[0].category).toBe('claude-md');
      expect(files[0].exists).toBe(true);
    });

    it('rules/core.md만 존재하면 1개를 반환한다', async () => {
      await mkdir(resolve(TMP_DIR, 'rules'), { recursive: true });
      await writeFile(resolve(TMP_DIR, 'rules', 'core.md'), '# Rules', 'utf-8');

      const files = await scanConfigFiles(TMP_DIR);
      expect(files).toHaveLength(1);
      expect(files[0].relativePath).toBe('rules/core.md');
      expect(files[0].category).toBe('rules');
    });

    it('agents/*.md 파일만 존재하면 해당 개수를 반환한다', async () => {
      await mkdir(resolve(TMP_DIR, 'agents'), { recursive: true });
      await writeFile(resolve(TMP_DIR, 'agents', 'reviewer.md'), '# Agent', 'utf-8');
      await writeFile(resolve(TMP_DIR, 'agents', 'coach.md'), '# Agent', 'utf-8');

      const files = await scanConfigFiles(TMP_DIR);
      expect(files).toHaveLength(2);
      expect(files.every(f => f.category === 'agents')).toBe(true);
    });

    it('전체 구조를 스캔한다', async () => {
      await writeFile(resolve(TMP_DIR, 'CLAUDE.md'), '# Test', 'utf-8');
      await mkdir(resolve(TMP_DIR, 'rules'), { recursive: true });
      await writeFile(resolve(TMP_DIR, 'rules', 'core.md'), '# Rules', 'utf-8');
      await mkdir(resolve(TMP_DIR, 'agents'), { recursive: true });
      await writeFile(resolve(TMP_DIR, 'agents', 'reviewer.md'), '# Agent', 'utf-8');

      const files = await scanConfigFiles(TMP_DIR);
      expect(files).toHaveLength(3);
    });

    it('파일 크기 정보를 포함한다', async () => {
      const content = '# Test Content';
      await writeFile(resolve(TMP_DIR, 'CLAUDE.md'), content, 'utf-8');

      const files = await scanConfigFiles(TMP_DIR);
      expect(files[0].size).toBeGreaterThan(0);
    });

    it('agents 디렉토리의 non-md 파일은 무시한다', async () => {
      await mkdir(resolve(TMP_DIR, 'agents'), { recursive: true });
      await writeFile(resolve(TMP_DIR, 'agents', 'reviewer.md'), '# Agent', 'utf-8');
      await writeFile(resolve(TMP_DIR, 'agents', 'notes.txt'), 'text', 'utf-8');
      await writeFile(resolve(TMP_DIR, 'agents', 'config.json'), '{}', 'utf-8');

      const files = await scanConfigFiles(TMP_DIR);
      expect(files).toHaveLength(1);
      expect(files[0].relativePath).toBe('agents/reviewer.md');
    });
  });

  describe('resetConfigFiles', () => {
    it('백업 후 파일을 삭제한다', async () => {
      const filePath = resolve(TMP_DIR, 'CLAUDE.md');
      await writeFile(filePath, '# Original', 'utf-8');

      const files = [{ path: filePath, relativePath: 'CLAUDE.md', category: 'claude-md', exists: true, size: 10 }];
      const results = await resetConfigFiles(files, { backup: true });

      expect(results).toHaveLength(1);
      expect(results[0].backedUp).toBe(true);
      expect(results[0].deleted).toBe(true);
      expect(await fileExists(filePath)).toBe(false);
      expect(await fileExists(`${filePath}.backup`)).toBe(true);
    });

    it('backup=false이면 백업 없이 삭제한다', async () => {
      const filePath = resolve(TMP_DIR, 'CLAUDE.md');
      await writeFile(filePath, '# Original', 'utf-8');

      const files = [{ path: filePath, relativePath: 'CLAUDE.md', category: 'claude-md', exists: true, size: 10 }];
      const results = await resetConfigFiles(files, { backup: false });

      expect(results[0].backedUp).toBe(false);
      expect(results[0].deleted).toBe(true);
      expect(await fileExists(filePath)).toBe(false);
      expect(await fileExists(`${filePath}.backup`)).toBe(false);
    });

    it('여러 파일을 한번에 삭제한다', async () => {
      const file1 = resolve(TMP_DIR, 'CLAUDE.md');
      const file2 = resolve(TMP_DIR, 'rules', 'core.md');
      await writeFile(file1, '# A', 'utf-8');
      await mkdir(resolve(TMP_DIR, 'rules'), { recursive: true });
      await writeFile(file2, '# B', 'utf-8');

      const files = [
        { path: file1, relativePath: 'CLAUDE.md', category: 'claude-md', exists: true, size: 3 },
        { path: file2, relativePath: 'rules/core.md', category: 'rules', exists: true, size: 3 },
      ];
      const results = await resetConfigFiles(files);

      expect(results).toHaveLength(2);
      expect(results.every(r => r.deleted)).toBe(true);
    });

    it('exists=false인 파일은 스킵한다', async () => {
      const files = [{ path: resolve(TMP_DIR, 'nope.md'), relativePath: 'nope.md', category: 'claude-md', exists: false, size: 0 }];
      const results = await resetConfigFiles(files);

      expect(results).toHaveLength(1);
      expect(results[0].deleted).toBe(false);
      expect(results[0].backedUp).toBe(false);
    });
  });

  describe('summarizeConfigFiles', () => {
    it('카테고리별 카운트를 반환한다', () => {
      const files = [
        { relativePath: 'CLAUDE.md', category: 'claude-md', exists: true, size: 100 },
        { relativePath: 'rules/core.md', category: 'rules', exists: true, size: 200 },
        { relativePath: 'agents/a.md', category: 'agents', exists: true, size: 50 },
        { relativePath: 'agents/b.md', category: 'agents', exists: true, size: 60 },
      ];

      const summary = summarizeConfigFiles(files);

      expect(summary.total).toBe(4);
      expect(summary.claudeMd).toBe(1);
      expect(summary.rules).toBe(1);
      expect(summary.agents).toBe(2);
    });

    it('빈 배열이면 모두 0을 반환한다', () => {
      const summary = summarizeConfigFiles([]);

      expect(summary.total).toBe(0);
      expect(summary.claudeMd).toBe(0);
      expect(summary.rules).toBe(0);
      expect(summary.agents).toBe(0);
    });
  });
});
