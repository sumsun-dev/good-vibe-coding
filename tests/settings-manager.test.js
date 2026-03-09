import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdir, rm, writeFile, readFile } from 'fs/promises';
import { resolve } from 'path';
import {
  readSettings,
  writeSettings,
  addPermission,
  addPermissions,
} from '../scripts/lib/core/settings-manager.js';

const TMP_DIR = resolve('.tmp-test-settings-manager');

beforeEach(async () => {
  await mkdir(TMP_DIR, { recursive: true });
});

afterEach(async () => {
  await rm(TMP_DIR, { recursive: true, force: true });
});

describe('settings-manager', () => {
  describe('readSettings', () => {
    it('파일이 없으면 빈 객체를 반환한다', async () => {
      const settingsPath = resolve(TMP_DIR, 'nonexistent.json');
      const result = await readSettings(settingsPath);
      expect(result).toEqual({});
    });

    it('빈 JSON 객체 파일을 읽는다', async () => {
      const settingsPath = resolve(TMP_DIR, 'settings.json');
      await writeFile(settingsPath, '{}', 'utf-8');
      const result = await readSettings(settingsPath);
      expect(result).toEqual({});
    });

    it('기존 설정을 올바르게 읽는다', async () => {
      const settingsPath = resolve(TMP_DIR, 'settings.json');
      const data = { permissions: { allow: ['Bash(git *)'] }, theme: 'dark' };
      await writeFile(settingsPath, JSON.stringify(data), 'utf-8');
      const result = await readSettings(settingsPath);
      expect(result).toEqual(data);
    });

    it('잘못된 JSON이면 에러를 던진다', async () => {
      const settingsPath = resolve(TMP_DIR, 'settings.json');
      await writeFile(settingsPath, '{invalid json', 'utf-8');
      await expect(readSettings(settingsPath)).rejects.toThrow();
    });

    it('JSON 깊이가 20을 초과하면 에러를 던진다', async () => {
      const settingsPath = resolve(TMP_DIR, 'settings.json');
      let deep = { value: 'leaf' };
      for (let i = 0; i < 25; i++) {
        deep = { nested: deep };
      }
      await writeFile(settingsPath, JSON.stringify(deep), 'utf-8');
      await expect(readSettings(settingsPath)).rejects.toThrow('너무 깊습니다');
    });

    it('1MB 초과 파일이면 에러를 던진다', async () => {
      const settingsPath = resolve(TMP_DIR, 'settings.json');
      const bigContent = '{"data":"' + 'x'.repeat(1024 * 1024 + 100) + '"}';
      await writeFile(settingsPath, bigContent, 'utf-8');
      await expect(readSettings(settingsPath)).rejects.toThrow('너무 큽니다');
    });
  });

  describe('writeSettings', () => {
    it('설정을 파일에 쓴다', async () => {
      const settingsPath = resolve(TMP_DIR, 'settings.json');
      const data = { permissions: { allow: ['Bash(node *)'] } };
      await writeSettings(data, settingsPath);
      const content = JSON.parse(await readFile(settingsPath, 'utf-8'));
      expect(content).toEqual(data);
    });

    it('디렉토리가 없으면 생성한다', async () => {
      const settingsPath = resolve(TMP_DIR, 'sub', 'dir', 'settings.json');
      await writeSettings({ foo: 'bar' }, settingsPath);
      const content = JSON.parse(await readFile(settingsPath, 'utf-8'));
      expect(content).toEqual({ foo: 'bar' });
    });
  });

  describe('addPermission', () => {
    it('permissions.allow 배열이 없으면 생성하고 패턴을 추가한다', async () => {
      const settingsPath = resolve(TMP_DIR, 'settings.json');
      await writeFile(settingsPath, '{}', 'utf-8');

      const result = await addPermission('Bash(node * cli.js *)', settingsPath);

      expect(result.added).toBe(true);
      expect(result.alreadyExists).toBe(false);

      const content = JSON.parse(await readFile(settingsPath, 'utf-8'));
      expect(content.permissions.allow).toContain('Bash(node * cli.js *)');
    });

    it('파일이 없으면 새로 생성한다', async () => {
      const settingsPath = resolve(TMP_DIR, 'new-settings.json');

      const result = await addPermission('Bash(node * cli.js *)', settingsPath);

      expect(result.added).toBe(true);
      expect(result.alreadyExists).toBe(false);

      const content = JSON.parse(await readFile(settingsPath, 'utf-8'));
      expect(content.permissions.allow).toEqual(['Bash(node * cli.js *)']);
    });

    it('이미 존재하는 패턴이면 추가하지 않는다', async () => {
      const settingsPath = resolve(TMP_DIR, 'settings.json');
      await writeFile(
        settingsPath,
        JSON.stringify({ permissions: { allow: ['Bash(node * cli.js *)'] } }),
        'utf-8',
      );

      const result = await addPermission('Bash(node * cli.js *)', settingsPath);

      expect(result.added).toBe(false);
      expect(result.alreadyExists).toBe(true);

      const content = JSON.parse(await readFile(settingsPath, 'utf-8'));
      expect(content.permissions.allow).toHaveLength(1);
    });

    it('기존 패턴을 유지하면서 새 패턴을 추가한다', async () => {
      const settingsPath = resolve(TMP_DIR, 'settings.json');
      await writeFile(
        settingsPath,
        JSON.stringify({ permissions: { allow: ['Bash(git *)'] }, theme: 'dark' }),
        'utf-8',
      );

      const result = await addPermission('Bash(node * cli.js *)', settingsPath);

      expect(result.added).toBe(true);

      const content = JSON.parse(await readFile(settingsPath, 'utf-8'));
      expect(content.permissions.allow).toEqual(['Bash(git *)', 'Bash(node * cli.js *)']);
      expect(content.theme).toBe('dark');
    });
  });

  describe('addPermissions', () => {
    it('복수 패턴을 일괄 추가한다', async () => {
      const settingsPath = resolve(TMP_DIR, 'settings.json');
      await writeFile(settingsPath, '{}', 'utf-8');

      const result = await addPermissions(['Read', 'Write', 'Edit'], settingsPath);

      expect(result.added).toEqual(['Read', 'Write', 'Edit']);
      expect(result.skipped).toEqual([]);

      const content = JSON.parse(await readFile(settingsPath, 'utf-8'));
      expect(content.permissions.allow).toEqual(['Read', 'Write', 'Edit']);
    });

    it('중복 패턴은 스킵한다', async () => {
      const settingsPath = resolve(TMP_DIR, 'settings.json');
      await writeFile(
        settingsPath,
        JSON.stringify({ permissions: { allow: ['Read', 'Glob'] } }),
        'utf-8',
      );

      const result = await addPermissions(['Read', 'Write', 'Glob', 'Grep'], settingsPath);

      expect(result.added).toEqual(['Write', 'Grep']);
      expect(result.skipped).toEqual(['Read', 'Glob']);

      const content = JSON.parse(await readFile(settingsPath, 'utf-8'));
      expect(content.permissions.allow).toEqual(['Read', 'Glob', 'Write', 'Grep']);
    });

    it('모두 중복이면 파일을 쓰지 않는다', async () => {
      const settingsPath = resolve(TMP_DIR, 'settings.json');
      await writeFile(settingsPath, JSON.stringify({ permissions: { allow: ['Read'] } }), 'utf-8');

      const result = await addPermissions(['Read'], settingsPath);

      expect(result.added).toEqual([]);
      expect(result.skipped).toEqual(['Read']);
    });

    it('파일이 없으면 새로 생성한다', async () => {
      const settingsPath = resolve(TMP_DIR, 'new-perms.json');

      const result = await addPermissions(['Read', 'Write'], settingsPath);

      expect(result.added).toEqual(['Read', 'Write']);

      const content = JSON.parse(await readFile(settingsPath, 'utf-8'));
      expect(content.permissions.allow).toEqual(['Read', 'Write']);
    });

    it('빈 배열이면 아무것도 추가하지 않는다', async () => {
      const settingsPath = resolve(TMP_DIR, 'settings.json');
      await writeFile(settingsPath, '{}', 'utf-8');

      const result = await addPermissions([], settingsPath);

      expect(result.added).toEqual([]);
      expect(result.skipped).toEqual([]);
    });
  });
});
