import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  setupProjectInfra,
  buildProjectClaudeMd,
  buildProjectReadme,
  buildGitignore,
  buildProjectAgents,
  appendToClaudeMd,
} from '../scripts/lib/project/project-scaffolder.js';
import { readFile, rm, mkdir, writeFile } from 'fs/promises';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const TMP_DIR = resolve(__dirname, '../.tmp-test-scaffolder');

describe('project-scaffolder', () => {
  beforeEach(async () => {
    await mkdir(TMP_DIR, { recursive: true });
  });

  afterEach(async () => {
    await rm(TMP_DIR, { recursive: true, force: true });
  });

  describe('buildGitignore', () => {
    it('Next.js 스택용 .gitignore를 반환한다', () => {
      const result = buildGitignore('next-js');
      expect(result).toContain('node_modules/');
      expect(result).toContain('.next/');
      expect(result).toContain('.env');
    });

    it('Python FastAPI 스택용 .gitignore를 반환한다', () => {
      const result = buildGitignore('python-fastapi');
      expect(result).toContain('__pycache__/');
      expect(result).toContain('.venv/');
      expect(result).toContain('.env');
    });

    it('React+Node 스택용 .gitignore를 반환한다', () => {
      const result = buildGitignore('react-node');
      expect(result).toContain('node_modules/');
      expect(result).toContain('dist/');
    });

    it('알 수 없는 스택은 기본 .gitignore를 반환한다', () => {
      const result = buildGitignore('unknown-stack');
      expect(result).toContain('node_modules/');
      expect(result).toContain('.env');
    });

    it('null/undefined 스택은 기본 .gitignore를 반환한다', () => {
      expect(buildGitignore(null)).toContain('node_modules/');
      expect(buildGitignore(undefined)).toContain('node_modules/');
      expect(buildGitignore('')).toContain('node_modules/');
    });
  });

  describe('buildProjectAgents', () => {
    it('기본 에이전트 파일 목록을 반환한다', () => {
      const agents = buildProjectAgents('next-js');
      expect(agents).toBeInstanceOf(Array);
      expect(agents.length).toBeGreaterThanOrEqual(2);

      const paths = agents.map((a) => a.path);
      expect(paths).toContain('.good-vibe/agents/code-reviewer.md');
      expect(paths).toContain('.good-vibe/agents/tdd-coach.md');
    });

    it('각 에이전트에 path와 content가 있다', () => {
      const agents = buildProjectAgents('next-js');
      for (const agent of agents) {
        expect(agent).toHaveProperty('path');
        expect(agent).toHaveProperty('content');
        expect(agent.content.length).toBeGreaterThan(0);
      }
    });
  });

  describe('buildProjectClaudeMd', () => {
    it('프로젝트명과 설명을 포함한 CLAUDE.md를 생성한다', async () => {
      const result = await buildProjectClaudeMd({
        name: 'My App',
        description: '테스트 프로젝트입니다',
        techStack: 'Next.js',
      });

      expect(result).toContain('My App');
      expect(result).toContain('테스트 프로젝트입니다');
      expect(result).toContain('Next.js');
    });

    it('플레이스홀더 섹션이 포함된다', async () => {
      const result = await buildProjectClaudeMd({
        name: 'Test',
        description: 'desc',
        techStack: 'React',
      });

      expect(result).toContain('<!-- architecture-placeholder -->');
      expect(result).toContain('<!-- decisions-placeholder -->');
    });
  });

  describe('buildProjectReadme', () => {
    it('프로젝트명과 설명을 포함한 README.md를 생성한다', async () => {
      const result = await buildProjectReadme({
        name: 'My App',
        description: '테스트 프로젝트입니다',
        techStack: 'Next.js',
      });

      expect(result).toContain('My App');
      expect(result).toContain('테스트 프로젝트입니다');
      expect(result).toContain('Next.js');
    });
  });

  describe('setupProjectInfra', () => {
    it('프로젝트 폴더와 파일을 생성한다', async () => {
      const targetDir = resolve(TMP_DIR, 'test-project');
      const result = await setupProjectInfra({
        name: 'Test Project',
        description: '테스트용 프로젝트',
        techStack: 'Next.js',
        targetDir,
      });

      expect(result.projectDir).toBe(targetDir);
      expect(result.files).toBeInstanceOf(Array);
      expect(result.files.length).toBeGreaterThanOrEqual(5);

      const writtenPaths = result.files.filter((f) => f.written).map((f) => f.path);
      expect(writtenPaths.some((p) => p.endsWith('CLAUDE.md'))).toBe(true);
      expect(writtenPaths.some((p) => p.endsWith('README.md'))).toBe(true);
      expect(writtenPaths.some((p) => p.endsWith('.gitignore'))).toBe(true);
      expect(writtenPaths.some((p) => p.includes('code-reviewer.md'))).toBe(true);
      expect(writtenPaths.some((p) => p.includes('tdd-coach.md'))).toBe(true);
      expect(writtenPaths.some((p) => p.includes('.good-vibe') && p.endsWith('README.md'))).toBe(
        true,
      );
    });

    it('CLAUDE.md 내용이 올바르다', async () => {
      const targetDir = resolve(TMP_DIR, 'test-claude');
      await setupProjectInfra({
        name: 'Hello World',
        description: '안녕하세요',
        techStack: 'React',
        targetDir,
      });

      const content = await readFile(resolve(targetDir, 'CLAUDE.md'), 'utf-8');
      expect(content).toContain('Hello World');
      expect(content).toContain('안녕하세요');
      expect(content).toContain('React');
    });

    it('name이 없으면 에러를 발생시킨다', async () => {
      await expect(setupProjectInfra({ description: 'test', techStack: 'Node' })).rejects.toThrow(
        'name 필드가 필요합니다',
      );
    });

    it('targetDir 미지정 시 ~/projects/ 하위에 생성한다', async () => {
      const originalHome = process.env.HOME;
      process.env.HOME = TMP_DIR;

      try {
        const result = await setupProjectInfra({
          name: 'Auto Dir',
          description: 'auto',
          techStack: 'Node',
        });
        expect(result.projectDir).toContain('projects');
        expect(result.projectDir).toContain('auto-dir');
      } finally {
        process.env.HOME = originalHome;
      }
    });

    it('기존 파일이 있으면 덮어쓰지 않는다', async () => {
      const targetDir = resolve(TMP_DIR, 'existing-project');
      await mkdir(targetDir, { recursive: true });
      await writeFile(resolve(targetDir, 'CLAUDE.md'), '기존 내용', 'utf-8');

      const result = await setupProjectInfra({
        name: 'Existing',
        description: 'test',
        techStack: 'Node',
        targetDir,
      });

      const claudeFile = result.files.find((f) => f.path.endsWith('CLAUDE.md'));
      expect(claudeFile.written).toBe(false);

      const content = await readFile(resolve(targetDir, 'CLAUDE.md'), 'utf-8');
      expect(content).toBe('기존 내용');
    });
  });

  describe('appendToClaudeMd', () => {
    it('플레이스홀더를 내용으로 교체한다', async () => {
      const claudeMdPath = resolve(TMP_DIR, 'CLAUDE.md');
      await writeFile(
        claudeMdPath,
        `# Test\n\n## Architecture\n<!-- architecture-placeholder -->\n\n## End`,
        'utf-8',
      );

      const result = await appendToClaudeMd(
        claudeMdPath,
        'architecture-placeholder',
        '### 시스템 아키텍처\n- 모놀리식 구조',
      );

      expect(result.success).toBe(true);

      const content = await readFile(claudeMdPath, 'utf-8');
      expect(content).toContain('### 시스템 아키텍처');
      expect(content).toContain('- 모놀리식 구조');
      expect(content).not.toContain('<!-- architecture-placeholder -->');
    });

    it('파일이 없으면 실패를 반환한다', async () => {
      const nonexistentDir = resolve(TMP_DIR, 'nonexistent');
      const result = await appendToClaudeMd(
        resolve(nonexistentDir, 'CLAUDE.md'),
        'test',
        'content',
      );
      expect(result.success).toBe(false);
      expect(result.error).toContain('찾을 수 없습니다');
    });

    it('CLAUDE.md가 아닌 파일을 거부한다', async () => {
      const evilPath = resolve(TMP_DIR, 'evil.md');
      await expect(appendToClaudeMd(evilPath, 'test', 'content')).rejects.toThrow(
        'CLAUDE.md 파일이어야 합니다',
      );
    });

    it('플레이스홀더가 없으면 실패를 반환한다', async () => {
      const claudeMdPath = resolve(TMP_DIR, 'sub', 'CLAUDE.md');
      await mkdir(dirname(claudeMdPath), { recursive: true });
      await writeFile(claudeMdPath, '# Test\nNo placeholder here', 'utf-8');

      const result = await appendToClaudeMd(claudeMdPath, 'nonexistent-section', 'content');
      expect(result.success).toBe(false);
      expect(result.error).toContain('플레이스홀더를 찾을 수 없습니다');
    });

    it('교체 후 백업 파일이 생성된다', async () => {
      const claudeMdPath = resolve(TMP_DIR, 'backup', 'CLAUDE.md');
      await mkdir(dirname(claudeMdPath), { recursive: true });
      await writeFile(claudeMdPath, '<!-- decisions-placeholder -->', 'utf-8');

      await appendToClaudeMd(claudeMdPath, 'decisions-placeholder', '결정 사항');

      const { fileExists: fe } = await import('../scripts/lib/core/file-writer.js');
      expect(await fe(`${claudeMdPath}.backup`)).toBe(true);
    });
  });
});
