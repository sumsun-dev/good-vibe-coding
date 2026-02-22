import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { exportConfig, importConfig, validateBundle } from '../scripts/lib/config-exporter.js';
import { writeFile, rm, mkdir, readFile } from 'fs/promises';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { fileExists } from '../scripts/lib/file-writer.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const TMP_DIR = resolve(__dirname, '../.tmp-test-exporter');
const SOURCE_DIR = resolve(TMP_DIR, 'source');
const IMPORT_DIR = resolve(TMP_DIR, 'import');

describe('config-exporter', () => {
  beforeEach(async () => {
    await mkdir(SOURCE_DIR, { recursive: true });
    await mkdir(IMPORT_DIR, { recursive: true });
  });

  afterEach(async () => {
    await rm(TMP_DIR, { recursive: true, force: true });
  });

  describe('exportConfig', () => {
    it('설정 파일들을 JSON 번들로 내보낸다', async () => {
      await writeFile(resolve(SOURCE_DIR, 'CLAUDE.md'), '# My Config', 'utf-8');
      await mkdir(resolve(SOURCE_DIR, 'rules'), { recursive: true });
      await writeFile(resolve(SOURCE_DIR, 'rules', 'core.md'), '# My Rules', 'utf-8');

      const outputPath = resolve(TMP_DIR, 'export.json');
      const result = await exportConfig(SOURCE_DIR, outputPath);

      expect(result.exported).toBe(true);
      expect(result.fileCount).toBe(2);
      expect(result.outputPath).toBe(outputPath);

      const bundle = JSON.parse(await readFile(outputPath, 'utf-8'));
      expect(bundle.version).toBe('1.0.0');
      expect(bundle.files).toHaveLength(2);
      expect(bundle.files[0].relativePath).toBe('CLAUDE.md');
      expect(bundle.files[0].content).toBe('# My Config');
    });

    it('파일이 없으면 exported=false를 반환한다', async () => {
      const outputPath = resolve(TMP_DIR, 'empty.json');
      const result = await exportConfig(SOURCE_DIR, outputPath);

      expect(result.exported).toBe(false);
      expect(result.fileCount).toBe(0);
    });

    it('agents 파일도 포함한다', async () => {
      await writeFile(resolve(SOURCE_DIR, 'CLAUDE.md'), '# Config', 'utf-8');
      await mkdir(resolve(SOURCE_DIR, 'agents'), { recursive: true });
      await writeFile(resolve(SOURCE_DIR, 'agents', 'reviewer.md'), '# Agent', 'utf-8');

      const outputPath = resolve(TMP_DIR, 'with-agents.json');
      const result = await exportConfig(SOURCE_DIR, outputPath);

      expect(result.fileCount).toBe(2);
      const bundle = JSON.parse(await readFile(outputPath, 'utf-8'));
      const agentFile = bundle.files.find(f => f.relativePath === 'agents/reviewer.md');
      expect(agentFile).toBeDefined();
      expect(agentFile.category).toBe('agents');
      expect(agentFile.content).toBe('# Agent');
    });
  });

  describe('importConfig', () => {
    it('JSON 번들에서 설정을 복원한다', async () => {
      const bundle = {
        version: '1.0.0',
        exportedAt: new Date().toISOString(),
        sourceDir: SOURCE_DIR,
        files: [
          { relativePath: 'CLAUDE.md', category: 'claude-md', content: '# Restored' },
          { relativePath: 'rules/core.md', category: 'rules', content: '# Restored Rules' },
        ],
      };
      const bundlePath = resolve(TMP_DIR, 'bundle.json');
      await writeFile(bundlePath, JSON.stringify(bundle), 'utf-8');

      const result = await importConfig(bundlePath, IMPORT_DIR);

      expect(result.imported).toBe(true);
      expect(result.fileCount).toBe(2);

      const claudeMd = await readFile(resolve(IMPORT_DIR, 'CLAUDE.md'), 'utf-8');
      expect(claudeMd).toBe('# Restored');

      const rules = await readFile(resolve(IMPORT_DIR, 'rules', 'core.md'), 'utf-8');
      expect(rules).toBe('# Restored Rules');
    });

    it('기존 파일이 있으면 백업한다', async () => {
      await writeFile(resolve(IMPORT_DIR, 'CLAUDE.md'), '# Old', 'utf-8');

      const bundle = {
        version: '1.0.0',
        exportedAt: new Date().toISOString(),
        sourceDir: SOURCE_DIR,
        files: [
          { relativePath: 'CLAUDE.md', category: 'claude-md', content: '# New' },
        ],
      };
      const bundlePath = resolve(TMP_DIR, 'bundle.json');
      await writeFile(bundlePath, JSON.stringify(bundle), 'utf-8');

      const result = await importConfig(bundlePath, IMPORT_DIR);

      expect(result.imported).toBe(true);
      expect(await fileExists(resolve(IMPORT_DIR, 'CLAUDE.md.backup'))).toBe(true);

      const backup = await readFile(resolve(IMPORT_DIR, 'CLAUDE.md.backup'), 'utf-8');
      expect(backup).toBe('# Old');
    });

    it('backup=false이면 백업하지 않는다', async () => {
      await writeFile(resolve(IMPORT_DIR, 'CLAUDE.md'), '# Old', 'utf-8');

      const bundle = {
        version: '1.0.0',
        exportedAt: new Date().toISOString(),
        sourceDir: SOURCE_DIR,
        files: [
          { relativePath: 'CLAUDE.md', category: 'claude-md', content: '# New' },
        ],
      };
      const bundlePath = resolve(TMP_DIR, 'bundle.json');
      await writeFile(bundlePath, JSON.stringify(bundle), 'utf-8');

      await importConfig(bundlePath, IMPORT_DIR, { backup: false });

      expect(await fileExists(resolve(IMPORT_DIR, 'CLAUDE.md.backup'))).toBe(false);
      const content = await readFile(resolve(IMPORT_DIR, 'CLAUDE.md'), 'utf-8');
      expect(content).toBe('# New');
    });

    it('번들 파일이 없으면 에러를 발생시킨다', async () => {
      await expect(importConfig(resolve(TMP_DIR, 'nope.json'), IMPORT_DIR)).rejects.toThrow();
    });
  });

  describe('validateBundle', () => {
    it('유효한 번들은 통과한다', () => {
      const bundle = {
        version: '1.0.0',
        files: [{ relativePath: 'CLAUDE.md', content: '# Test' }],
      };
      expect(() => validateBundle(bundle)).not.toThrow();
    });

    it('version이 누락되면 에러를 발생시킨다', () => {
      const bundle = { files: [{ relativePath: 'CLAUDE.md', content: '# Test' }] };
      expect(() => validateBundle(bundle)).toThrow('version');
    });

    it('files가 비어있으면 에러를 발생시킨다', () => {
      const bundle = { version: '1.0.0', files: [] };
      expect(() => validateBundle(bundle)).toThrow('files');
    });

    it('relativePath가 누락되면 에러를 발생시킨다', () => {
      const bundle = { version: '1.0.0', files: [{ content: '# Test' }] };
      expect(() => validateBundle(bundle)).toThrow('relativePath');
    });

    it('content가 누락되면 에러를 발생시킨다', () => {
      const bundle = { version: '1.0.0', files: [{ relativePath: 'CLAUDE.md' }] };
      expect(() => validateBundle(bundle)).toThrow('content');
    });
  });
});
