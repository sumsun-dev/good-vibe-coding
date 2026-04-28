import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdir, rm, readFile, writeFile, readdir } from 'fs/promises';
import { resolve } from 'path';
import {
  SHORTCUT_DEFINITIONS,
  buildWrapperContent,
  installShortcuts,
  uninstallShortcuts,
  WRAPPER_SIGNATURE,
} from '../scripts/lib/core/shortcuts-installer.js';

const TMP_DIR = resolve('.tmp-test-shortcuts');

describe('shortcuts-installer', () => {
  beforeEach(async () => {
    await mkdir(TMP_DIR, { recursive: true });
  });

  afterEach(async () => {
    await rm(TMP_DIR, { recursive: true, force: true });
  });

  describe('SHORTCUT_DEFINITIONS', () => {
    it('7개 단축어를 정의해야 한다', () => {
      expect(SHORTCUT_DEFINITIONS).toHaveLength(7);
    });

    it('각 단축어는 name, targetSkill, description 필드를 가져야 한다', () => {
      for (const def of SHORTCUT_DEFINITIONS) {
        expect(def).toHaveProperty('name');
        expect(def).toHaveProperty('targetSkill');
        expect(def).toHaveProperty('description');
        expect(def.targetSkill).toMatch(/^good-vibe:/);
      }
    });

    it('필수 단축어를 모두 포함해야 한다', () => {
      const names = SHORTCUT_DEFINITIONS.map((d) => d.name);
      expect(names).toEqual(
        expect.arrayContaining([
          'gv',
          'gv-status',
          'gv-execute',
          'gv-resume',
          'gv-team',
          'gv-cost',
          'gv-agent-history',
        ]),
      );
    });
  });

  describe('buildWrapperContent', () => {
    it('description과 targetSkill을 포함한 마크다운을 생성해야 한다', () => {
      const def = {
        name: 'gv',
        targetSkill: 'good-vibe:gv',
        description: 'NL 진입점',
        argumentHint: '<자연어>',
      };
      const content = buildWrapperContent(def);
      expect(content).toContain('description: "NL 진입점"');
      expect(content).toContain('argument-hint: "<자연어>"');
      expect(content).toContain('good-vibe:gv');
      expect(content).toContain('$ARGUMENTS');
    });

    it('argumentHint가 없으면 frontmatter에서 생략되어야 한다', () => {
      const def = {
        name: 'gv-status',
        targetSkill: 'good-vibe:gv-status',
        description: '상태 조회',
      };
      const content = buildWrapperContent(def);
      expect(content).not.toContain('argument-hint');
      expect(content).toContain('good-vibe:gv-status');
    });

    it('서명(WRAPPER_SIGNATURE)을 포함해야 한다 (uninstall 식별용)', () => {
      const def = SHORTCUT_DEFINITIONS[0];
      const content = buildWrapperContent(def);
      expect(content).toContain(WRAPPER_SIGNATURE);
    });

    it('description 안의 큰따옴표/백슬래시를 이스케이프해야 한다 (YAML 안전성)', () => {
      const def = {
        name: 'evil',
        targetSkill: 'good-vibe:evil',
        description: 'has " quote and \\ slash',
      };
      const content = buildWrapperContent(def);
      expect(content).toContain('description: "has \\" quote and \\\\ slash"');
    });
  });

  describe('installShortcuts', () => {
    it('지정 디렉토리에 7개 파일을 작성해야 한다', async () => {
      const result = await installShortcuts({ targetDir: TMP_DIR });
      expect(result.installed).toHaveLength(7);
      expect(result.skipped).toHaveLength(0);
      const files = await readdir(TMP_DIR);
      expect(files.filter((f) => f.endsWith('.md'))).toHaveLength(7);
    });

    it('targetDir이 없으면 자동 생성해야 한다', async () => {
      const nestedDir = resolve(TMP_DIR, 'nested', 'commands');
      await installShortcuts({ targetDir: nestedDir });
      const files = await readdir(nestedDir);
      expect(files.filter((f) => f.endsWith('.md'))).toHaveLength(7);
    });

    it('이미 같은 단축어가 존재하면 skip 한다 (멱등성)', async () => {
      await installShortcuts({ targetDir: TMP_DIR });
      const result = await installShortcuts({ targetDir: TMP_DIR });
      expect(result.installed).toHaveLength(0);
      expect(result.skipped).toHaveLength(7);
    });

    it('force=true 면 기존 파일을 덮어쓴다', async () => {
      await installShortcuts({ targetDir: TMP_DIR });
      const filePath = resolve(TMP_DIR, 'gv.md');
      await writeFile(filePath, 'modified', 'utf-8');
      const result = await installShortcuts({ targetDir: TMP_DIR, force: true });
      expect(result.installed).toHaveLength(7);
      const content = await readFile(filePath, 'utf-8');
      expect(content).toContain('good-vibe:gv');
    });

    it('우리 서명 없는 동명 파일은 force 없이 skip + 충돌 보고', async () => {
      const filePath = resolve(TMP_DIR, 'gv.md');
      await mkdir(TMP_DIR, { recursive: true });
      await writeFile(filePath, '# 사용자가 직접 만든 파일', 'utf-8');
      const result = await installShortcuts({ targetDir: TMP_DIR });
      expect(result.skipped).toContainEqual(
        expect.objectContaining({ name: 'gv', reason: 'conflict' }),
      );
      expect(result.installed.length).toBeLessThan(7);
    });
  });

  describe('uninstallShortcuts', () => {
    it('우리가 설치한 7개 파일만 제거한다', async () => {
      await installShortcuts({ targetDir: TMP_DIR });
      const result = await uninstallShortcuts({ targetDir: TMP_DIR });
      expect(result.removed).toHaveLength(7);
      const files = await readdir(TMP_DIR);
      expect(files.filter((f) => f.endsWith('.md'))).toHaveLength(0);
    });

    it('서명 없는 동명 파일은 보존한다', async () => {
      const filePath = resolve(TMP_DIR, 'gv.md');
      await writeFile(filePath, '# 사용자 파일', 'utf-8');
      const result = await uninstallShortcuts({ targetDir: TMP_DIR });
      expect(result.removed).toHaveLength(0);
      expect(result.preserved).toContainEqual(
        expect.objectContaining({ name: 'gv', reason: 'not-owned' }),
      );
      const content = await readFile(filePath, 'utf-8');
      expect(content).toBe('# 사용자 파일');
    });

    it('파일이 존재하지 않으면 무시한다', async () => {
      const result = await uninstallShortcuts({ targetDir: TMP_DIR });
      expect(result.removed).toHaveLength(0);
      expect(result.preserved).toHaveLength(0);
    });
  });
});
