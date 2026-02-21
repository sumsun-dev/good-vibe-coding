import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { generateConfig } from '../scripts/lib/config-generator.js';
import { rm, mkdir, readFile } from 'fs/promises';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const TMP_DIR = resolve(__dirname, '../.tmp-test-config');

describe('config-generator', () => {
  beforeEach(async () => {
    await mkdir(TMP_DIR, { recursive: true });
  });

  afterEach(async () => {
    await rm(TMP_DIR, { recursive: true, force: true });
  });

  describe('generateConfig', () => {
    it('developer 역할의 설정을 생성한다', async () => {
      const result = await generateConfig({
        role: 'developer',
        targetDir: TMP_DIR,
      });

      expect(result.role).toBe('개발자');
      expect(result.filesGenerated).toContain(resolve(TMP_DIR, 'CLAUDE.md'));
      expect(result.filesGenerated).toContain(resolve(TMP_DIR, 'rules', 'core.md'));
      expect(result.preset.skills).toContain('tdd-workflow');
      expect(result.preset.skills).toContain('code-review');
    });

    it('pm 역할의 설정을 생성한다', async () => {
      const result = await generateConfig({
        role: 'pm',
        targetDir: TMP_DIR,
      });

      expect(result.role).toBe('PM / 기획자');
      expect(result.preset.skills).toContain('prd-writer');
    });

    it('존재하지 않는 역할은 에러를 발생시킨다', async () => {
      await expect(generateConfig({
        role: 'nonexistent',
        targetDir: TMP_DIR,
      })).rejects.toThrow();
    });

    it('존재하지 않는 스택 프리셋은 무시한다', async () => {
      const result = await generateConfig({
        role: 'developer',
        stack: 'nonexistent-stack',
        targetDir: TMP_DIR,
      });

      expect(result.role).toBe('개발자');
    });

    it('preset에 agents 정보가 포함된다', async () => {
      const result = await generateConfig({
        role: 'developer',
        targetDir: TMP_DIR,
      });

      expect(result.preset.agents.length).toBeGreaterThan(0);
      expect(result.preset.agents[0].template).toBe('code-reviewer-kr');
    });
  });
});
