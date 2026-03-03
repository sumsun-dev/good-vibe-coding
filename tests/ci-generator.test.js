import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdir, rm, readFile } from 'fs/promises';
import { resolve } from 'path';
import {
  resolveCIStrategy,
  inferCommands,
  generateCIWorkflow,
} from '../scripts/lib/project/ci-generator.js';

const TMP_DIR = resolve('.tmp-test-ci-generator');

describe('ci-generator', () => {
  beforeEach(async () => {
    await mkdir(TMP_DIR, { recursive: true });
  });

  afterEach(async () => {
    await rm(TMP_DIR, { recursive: true, force: true });
  });

  describe('resolveCIStrategy', () => {
    it('Node.js 스택 → node 전략을 반환한다', () => {
      const strategy = resolveCIStrategy({ techStack: ['express', 'react'] });
      expect(strategy.type).toBe('node');
      expect(strategy.nodeVersions).toEqual(['18', '20', '22']);
    });

    it('Python 스택 → python 전략을 반환한다', () => {
      const strategy = resolveCIStrategy({ techStack: ['fastapi', 'python'] });
      expect(strategy.type).toBe('python');
      expect(strategy.pythonVersions).toEqual(['3.10', '3.11', '3.12']);
    });

    it('Go 스택 → go 전략을 반환한다', () => {
      const strategy = resolveCIStrategy({ techStack: ['gin', 'go'] });
      expect(strategy.type).toBe('go');
    });

    it('Java 스택 → java 전략을 반환한다', () => {
      const strategy = resolveCIStrategy({ techStack: ['spring', 'java'] });
      expect(strategy.type).toBe('java');
    });

    it('미지원 스택 → 기본 node로 fallback한다', () => {
      const strategy = resolveCIStrategy({ techStack: ['unknown-stack'] });
      expect(strategy.type).toBe('node');
    });

    it('빈 스택 → 기본 node로 fallback한다', () => {
      const strategy = resolveCIStrategy({});
      expect(strategy.type).toBe('node');
    });

    it('codebaseInfo에서 스택을 감지한다', () => {
      const strategy = resolveCIStrategy({
        codebaseInfo: { techStack: ['django', 'postgresql'] },
      });
      expect(strategy.type).toBe('python');
    });
  });

  describe('inferCommands', () => {
    it('package.json scripts에서 test/lint/build 커맨드를 추론한다', () => {
      const cmds = inferCommands('node', {
        scripts: { test: 'vitest', lint: 'eslint .', build: 'tsc' },
      });
      expect(cmds.test).toBe('npm test');
      expect(cmds.lint).toBe('npm run lint');
      expect(cmds.build).toBe('npm run build');
    });

    it('scripts가 없으면 기본값을 사용한다', () => {
      const cmds = inferCommands('node', {});
      expect(cmds.test).toBe('npm test');
      expect(cmds.lint).toBeNull();
      expect(cmds.build).toBeNull();
    });

    it('Python 프로젝트 기본 커맨드를 반환한다', () => {
      const cmds = inferCommands('python');
      expect(cmds.test).toBe('pytest');
      expect(cmds.lint).toBe('flake8');
    });

    it('Go 프로젝트 기본 커맨드를 반환한다', () => {
      const cmds = inferCommands('go');
      expect(cmds.test).toBe('go test ./...');
      expect(cmds.lint).toBe('go vet ./...');
    });

    it('Java 프로젝트 기본 커맨드를 반환한다', () => {
      const cmds = inferCommands('java');
      expect(cmds.test).toContain('gradle');
    });
  });

  describe('generateCIWorkflow', () => {
    it('Node.js CI 워크플로우 파일을 생성한다', async () => {
      const strategy = { type: 'node', nodeVersions: ['18', '20'] };
      const commands = { test: 'npm test', lint: 'npm run lint', build: null };

      const result = await generateCIWorkflow(TMP_DIR, strategy, commands);

      expect(result.success).toBe(true);
      expect(result.filePath).toContain('ci.yml');

      const content = await readFile(result.filePath, 'utf-8');
      expect(content).toContain('name:');
      expect(content).toContain('npm test');
      expect(content).toContain('npm run lint');
      expect(content).toContain('18');
      expect(content).toContain('20');
    });

    it('Python CI 워크플로우를 생성한다', async () => {
      const strategy = { type: 'python', pythonVersions: ['3.11'] };
      const commands = { test: 'pytest', lint: 'flake8', build: null };

      const result = await generateCIWorkflow(TMP_DIR, strategy, commands);

      expect(result.success).toBe(true);
      const content = await readFile(result.filePath, 'utf-8');
      expect(content).toContain('pytest');
      expect(content).toContain('python');
    });

    it('Go CI 워크플로우를 생성한다', async () => {
      const strategy = { type: 'go', goVersion: '1.21' };
      const commands = { test: 'go test ./...', lint: 'go vet ./...', build: 'go build ./...' };

      const result = await generateCIWorkflow(TMP_DIR, strategy, commands);

      expect(result.success).toBe(true);
      const content = await readFile(result.filePath, 'utf-8');
      expect(content).toContain('go test');
    });

    it('Java CI 워크플로우를 생성한다', async () => {
      const strategy = { type: 'java', javaVersion: '17' };
      const commands = { test: './gradlew test', lint: null, build: './gradlew build' };

      const result = await generateCIWorkflow(TMP_DIR, strategy, commands);

      expect(result.success).toBe(true);
      const content = await readFile(result.filePath, 'utf-8');
      expect(content).toContain('gradlew');
    });
  });
});
