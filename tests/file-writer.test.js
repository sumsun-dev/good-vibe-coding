import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { safeWriteFile, fileExists, backupFile, ensureDir, writeFiles, readJsonFile, listFilesByExtension } from '../scripts/lib/core/file-writer.js';
import { readFile, rm, mkdir } from 'fs/promises';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const TMP_DIR = resolve(__dirname, '../.tmp-test');

describe('file-writer', () => {
  beforeEach(async () => {
    await mkdir(TMP_DIR, { recursive: true });
  });

  afterEach(async () => {
    await rm(TMP_DIR, { recursive: true, force: true });
  });

  describe('ensureDir', () => {
    it('중첩 디렉토리를 생성한다', async () => {
      const dir = resolve(TMP_DIR, 'a/b/c');
      await ensureDir(dir);
      expect(await fileExists(dir)).toBe(true);
    });
  });

  describe('fileExists', () => {
    it('존재하는 파일은 true를 반환한다', async () => {
      const filePath = resolve(TMP_DIR, 'exists.txt');
      const { writeFile: wf } = await import('fs/promises');
      await wf(filePath, 'test', 'utf-8');
      expect(await fileExists(filePath)).toBe(true);
    });

    it('존재하지 않는 파일은 false를 반환한다', async () => {
      expect(await fileExists(resolve(TMP_DIR, 'nope.txt'))).toBe(false);
    });

    it.skipIf(process.platform === 'win32')('EACCES 에러는 전파한다 (ENOENT만 false)', async () => {
      const { chmod, writeFile: wf } = await import('fs/promises');
      const dirPath = resolve(TMP_DIR, 'no-access-dir');
      await mkdir(dirPath, { recursive: true });
      await wf(resolve(dirPath, 'dummy.txt'), 'x', 'utf-8');
      await chmod(dirPath, 0o000);
      try {
        await expect(fileExists(resolve(dirPath, 'dummy.txt'))).rejects.toThrow();
      } finally {
        await chmod(dirPath, 0o755);
      }
    });
  });

  describe('backupFile', () => {
    it('기존 파일을 .backup으로 복사한다', async () => {
      const filePath = resolve(TMP_DIR, 'original.txt');
      const { writeFile: wf } = await import('fs/promises');
      await wf(filePath, '원본 내용', 'utf-8');

      const backupPath = await backupFile(filePath);
      expect(backupPath).toBe(`${filePath}.backup`);

      const content = await readFile(backupPath, 'utf-8');
      expect(content).toBe('원본 내용');
    });

    it('파일이 없으면 null을 반환한다', async () => {
      const result = await backupFile(resolve(TMP_DIR, 'no-file.txt'));
      expect(result).toBeNull();
    });
  });

  describe('safeWriteFile', () => {
    it('새 파일을 생성한다', async () => {
      const filePath = resolve(TMP_DIR, 'new.txt');
      const result = await safeWriteFile(filePath, '새 내용');

      expect(result.written).toBe(true);
      expect(result.backupPath).toBeNull();

      const content = await readFile(filePath, 'utf-8');
      expect(content).toBe('새 내용');
    });

    it('overwrite=false면 기존 파일을 덮어쓰지 않는다', async () => {
      const filePath = resolve(TMP_DIR, 'no-overwrite.txt');
      const { writeFile: wf } = await import('fs/promises');
      await wf(filePath, '기존', 'utf-8');

      const result = await safeWriteFile(filePath, '새 내용', { overwrite: false });
      expect(result.written).toBe(false);

      const content = await readFile(filePath, 'utf-8');
      expect(content).toBe('기존');
    });

    it('overwrite=true면 백업 후 덮어쓴다', async () => {
      const filePath = resolve(TMP_DIR, 'overwrite.txt');
      const { writeFile: wf } = await import('fs/promises');
      await wf(filePath, '기존 내용', 'utf-8');

      const result = await safeWriteFile(filePath, '새 내용', { overwrite: true });
      expect(result.written).toBe(true);
      expect(result.backupPath).toBe(`${filePath}.backup`);

      const content = await readFile(filePath, 'utf-8');
      expect(content).toBe('새 내용');

      const backup = await readFile(result.backupPath, 'utf-8');
      expect(backup).toBe('기존 내용');
    });

    it('backup=false면 백업하지 않는다', async () => {
      const filePath = resolve(TMP_DIR, 'no-backup.txt');
      const { writeFile: wf } = await import('fs/promises');
      await wf(filePath, '기존', 'utf-8');

      const result = await safeWriteFile(filePath, '새 내용', { overwrite: true, backup: false });
      expect(result.written).toBe(true);
      expect(result.backupPath).toBeNull();
    });

    it('중첩 경로의 디렉토리를 자동 생성한다', async () => {
      const filePath = resolve(TMP_DIR, 'deep/nested/file.txt');
      const result = await safeWriteFile(filePath, '깊은 파일');
      expect(result.written).toBe(true);

      const content = await readFile(filePath, 'utf-8');
      expect(content).toBe('깊은 파일');
    });

    it.skipIf(process.platform === 'win32')('심링크 대상에 쓰기를 차단한다', async () => {
      const { writeFile: wf, symlink } = await import('fs/promises');
      const realFile = resolve(TMP_DIR, 'real-target.txt');
      const linkFile = resolve(TMP_DIR, 'link-to-target.txt');

      await wf(realFile, '원본', 'utf-8');
      await symlink(realFile, linkFile);

      await expect(
        safeWriteFile(linkFile, '악의적 내용', { overwrite: true })
      ).rejects.toThrow('심링크 대상에 쓰기가 차단되었습니다');

      const content = await readFile(realFile, 'utf-8');
      expect(content).toBe('원본');
    });
  });

  describe('readJsonFile', () => {
    it('정상 JSON 파일을 읽어 파싱한다', async () => {
      const filePath = resolve(TMP_DIR, 'data.json');
      const { writeFile: wf } = await import('fs/promises');
      await wf(filePath, JSON.stringify({ key: 'value' }), 'utf-8');

      const result = await readJsonFile(filePath);
      expect(result).toEqual({ key: 'value' });
    });

    it('파일이 없으면 null을 반환한다', async () => {
      const result = await readJsonFile(resolve(TMP_DIR, 'missing.json'));
      expect(result).toBeNull();
    });

    it('잘못된 JSON이면 AppError(SYSTEM_ERROR)를 throw한다', async () => {
      const filePath = resolve(TMP_DIR, 'bad.json');
      const { writeFile: wf } = await import('fs/promises');
      await wf(filePath, '{ invalid json', 'utf-8');

      await expect(readJsonFile(filePath)).rejects.toThrow('JSON 파일 읽기 오류');
    });
  });

  describe('writeFiles', () => {
    it('여러 파일을 한번에 쓴다', async () => {
      const files = [
        { path: resolve(TMP_DIR, 'a.txt'), content: '파일 A' },
        { path: resolve(TMP_DIR, 'b.txt'), content: '파일 B' },
      ];

      const results = await writeFiles(files);
      expect(results).toHaveLength(2);
      expect(results.every(r => r.written)).toBe(true);

      const contentA = await readFile(files[0].path, 'utf-8');
      expect(contentA).toBe('파일 A');
    });
  });

  describe('listFilesByExtension', () => {
    it('지정 확장자 파일만 반환한다', async () => {
      const { writeFile: wf } = await import('fs/promises');
      await wf(resolve(TMP_DIR, 'a.json'), '{}', 'utf-8');
      await wf(resolve(TMP_DIR, 'b.json'), '{}', 'utf-8');
      await wf(resolve(TMP_DIR, 'c.txt'), 'text', 'utf-8');
      await wf(resolve(TMP_DIR, 'd.md'), '# md', 'utf-8');

      const jsonFiles = await listFilesByExtension(TMP_DIR, '.json');
      expect(jsonFiles).toHaveLength(2);
      expect(jsonFiles).toContain('a.json');
      expect(jsonFiles).toContain('b.json');

      const mdFiles = await listFilesByExtension(TMP_DIR, '.md');
      expect(mdFiles).toHaveLength(1);
      expect(mdFiles).toContain('d.md');
    });

    it('디렉토리가 없으면 빈 배열을 반환한다', async () => {
      const result = await listFilesByExtension(resolve(TMP_DIR, 'nonexistent'), '.json');
      expect(result).toEqual([]);
    });

    it('확장자가 일치하는 파일이 없으면 빈 배열을 반환한다', async () => {
      const { writeFile: wf } = await import('fs/promises');
      await wf(resolve(TMP_DIR, 'file.txt'), 'text', 'utf-8');

      const result = await listFilesByExtension(TMP_DIR, '.json');
      expect(result).toEqual([]);
    });
  });
});
