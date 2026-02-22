import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdir, rm, readFile } from 'fs/promises';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const TMP_DIR = resolve(__dirname, '../.tmp-test-scaffold');
const CUSTOM_DIR = resolve(TMP_DIR, 'custom-templates');

// Step 1: 검증 + 로딩
describe('template-scaffolder', () => {
  let scaffolder;

  beforeEach(async () => {
    await mkdir(CUSTOM_DIR, { recursive: true });
    scaffolder = await import('../scripts/lib/template-scaffolder.js');
    scaffolder.setCustomTemplatesDir(CUSTOM_DIR);
  });

  afterEach(async () => {
    await rm(TMP_DIR, { recursive: true, force: true });
  });

  describe('validateTemplate', () => {
    it('유효한 템플릿이 통과한다', () => {
      const template = {
        name: 'test',
        displayName: 'Test',
        version: '1.0.0',
        files: [{ path: 'index.js', content: 'console.log("hi")' }],
      };
      const result = scaffolder.validateTemplate(template);
      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('name이 없으면 에러를 반환한다', () => {
      const template = {
        displayName: 'Test',
        version: '1.0.0',
        files: [{ path: 'index.js', content: 'hi' }],
      };
      const result = scaffolder.validateTemplate(template);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('name is required');
    });

    it('files가 빈 배열이면 에러를 반환한다', () => {
      const template = { name: 'test', displayName: 'Test', version: '1.0.0', files: [] };
      const result = scaffolder.validateTemplate(template);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('files must have at least one entry');
    });

    it('files가 없으면 에러를 반환한다', () => {
      const template = { name: 'test', displayName: 'Test', version: '1.0.0' };
      const result = scaffolder.validateTemplate(template);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('files must have at least one entry');
    });

    it('파일에 path 또는 content가 누락되면 에러를 반환한다', () => {
      const template = {
        name: 'test',
        displayName: 'Test',
        version: '1.0.0',
        files: [{ path: 'index.js' }, { content: 'hi' }],
      };
      const result = scaffolder.validateTemplate(template);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('content'))).toBe(true);
      expect(result.errors.some(e => e.includes('path'))).toBe(true);
    });
  });

  describe('loadTemplate', () => {
    it('built-in 템플릿을 로딩한다', async () => {
      const template = await scaffolder.loadTemplate('next-app');
      expect(template.name).toBe('next-app');
      expect(template.displayName).toBe('Next.js App Router');
      expect(template.files.length).toBeGreaterThan(0);
    });

    it('custom 템플릿을 로딩한다', async () => {
      const customTemplate = {
        name: 'my-custom',
        displayName: 'My Custom',
        version: '1.0.0',
        files: [{ path: 'index.js', content: 'custom' }],
      };
      const { writeFile } = await import('fs/promises');
      await writeFile(
        resolve(CUSTOM_DIR, 'my-custom.json'),
        JSON.stringify(customTemplate),
      );

      const template = await scaffolder.loadTemplate('my-custom');
      expect(template.name).toBe('my-custom');
    });

    it('custom이 built-in을 override한다', async () => {
      const customNextApp = {
        name: 'next-app',
        displayName: 'Custom Next.js',
        version: '2.0.0',
        files: [{ path: 'custom.js', content: 'overridden' }],
      };
      const { writeFile } = await import('fs/promises');
      await writeFile(
        resolve(CUSTOM_DIR, 'next-app.json'),
        JSON.stringify(customNextApp),
      );

      const template = await scaffolder.loadTemplate('next-app');
      expect(template.displayName).toBe('Custom Next.js');
      expect(template.version).toBe('2.0.0');
    });

    it('존재하지 않는 템플릿은 에러를 던진다', async () => {
      await expect(scaffolder.loadTemplate('nonexistent')).rejects.toThrow();
    });
  });

  describe('listTemplates', () => {
    it('built-in 5개 템플릿을 반환한다', async () => {
      const list = await scaffolder.listTemplates();
      expect(list.length).toBeGreaterThanOrEqual(5);
      const names = list.map(t => t.name);
      expect(names).toContain('next-app');
      expect(names).toContain('express-api');
      expect(names).toContain('cli-app');
      expect(names).toContain('telegram-bot');
      expect(names).toContain('npm-library');
    });

    it('custom 템플릿을 포함한다', async () => {
      const customTemplate = {
        name: 'my-special',
        displayName: 'My Special',
        version: '1.0.0',
        files: [{ path: 'a.js', content: 'a' }],
      };
      const { writeFile } = await import('fs/promises');
      await writeFile(
        resolve(CUSTOM_DIR, 'my-special.json'),
        JSON.stringify(customTemplate),
      );

      const list = await scaffolder.listTemplates();
      expect(list.some(t => t.name === 'my-special')).toBe(true);
    });

    it('중복 시 custom이 우선한다', async () => {
      const customNextApp = {
        name: 'next-app',
        displayName: 'Custom Next',
        version: '9.0.0',
        files: [{ path: 'x.js', content: 'x' }],
      };
      const { writeFile } = await import('fs/promises');
      await writeFile(
        resolve(CUSTOM_DIR, 'next-app.json'),
        JSON.stringify(customNextApp),
      );

      const list = await scaffolder.listTemplates();
      const nextApp = list.find(t => t.name === 'next-app');
      expect(nextApp.displayName).toBe('Custom Next');
      // 중복 제거 확인
      expect(list.filter(t => t.name === 'next-app').length).toBe(1);
    });
  });

  describe('getTemplatesForProjectType', () => {
    it('web-app 타입에 next-app이 매핑된다', async () => {
      const templates = await scaffolder.getTemplatesForProjectType('web-app');
      expect(templates.some(t => t.name === 'next-app')).toBe(true);
    });

    it('5개 프로젝트 타입에 매핑된 템플릿이 있다', async () => {
      const webApp = await scaffolder.getTemplatesForProjectType('web-app');
      expect(webApp.some(t => t.name === 'next-app')).toBe(true);

      const api = await scaffolder.getTemplatesForProjectType('api-server');
      expect(api.some(t => t.name === 'express-api')).toBe(true);

      const cli = await scaffolder.getTemplatesForProjectType('cli-tool');
      expect(cli.some(t => t.name === 'cli-app')).toBe(true);

      const bot = await scaffolder.getTemplatesForProjectType('telegram-bot');
      expect(bot.some(t => t.name === 'telegram-bot')).toBe(true);

      const lib = await scaffolder.getTemplatesForProjectType('library');
      expect(lib.some(t => t.name === 'npm-library')).toBe(true);
    });

    it('매핑 없는 타입은 빈 배열을 반환한다', async () => {
      const templates = await scaffolder.getTemplatesForProjectType('nonexistent-type');
      expect(templates).toEqual([]);
    });
  });

  // Step 2: 변수 해석 + 파일 렌더링
  describe('resolveVariables', () => {
    it('default 값이 적용된다', () => {
      const template = {
        variables: {
          projectName: { prompt: '이름', default: 'my-app' },
          description: { prompt: '설명', default: 'A project' },
        },
      };
      const resolved = scaffolder.resolveVariables(template, {});
      expect(resolved.projectName).toBe('my-app');
      expect(resolved.description).toBe('A project');
    });

    it('userVars가 default를 덮어쓴다', () => {
      const template = {
        variables: {
          projectName: { prompt: '이름', default: 'my-app' },
        },
      };
      const resolved = scaffolder.resolveVariables(template, { projectName: 'cool-app' });
      expect(resolved.projectName).toBe('cool-app');
    });

    it('variables가 없는 템플릿도 처리한다', () => {
      const template = {};
      const resolved = scaffolder.resolveVariables(template, { extra: 'val' });
      expect(resolved.extra).toBe('val');
    });
  });

  describe('renderTemplateFiles', () => {
    it('변수가 치환된다', () => {
      const template = {
        files: [
          { path: 'README.md', content: '# {{projectName}}\n{{description}}' },
        ],
      };
      const result = scaffolder.renderTemplateFiles(template, {
        projectName: 'my-app',
        description: 'A great app',
      });
      expect(result[0].content).toBe('# my-app\nA great app');
    });

    it('파일 경로도 렌더링된다', () => {
      const template = {
        files: [
          { path: '{{projectName}}/index.js', content: 'hello' },
        ],
      };
      const result = scaffolder.renderTemplateFiles(template, { projectName: 'my-app' });
      expect(result[0].path).toBe('my-app/index.js');
    });

    it('빈 files 배열은 빈 결과를 반환한다', () => {
      const result = scaffolder.renderTemplateFiles({ files: [] }, {});
      expect(result).toEqual([]);
    });
  });

  // Step 3: 스캐폴딩 실행
  describe('scaffold', () => {
    it('파일이 생성된다', async () => {
      const targetDir = resolve(TMP_DIR, 'scaffold-test');
      const result = await scaffolder.scaffold('next-app', targetDir, { projectName: 'test-app', description: 'desc' });
      expect(result.files.length).toBeGreaterThan(0);
      expect(result.files.every(f => f.written)).toBe(true);

      const pkg = await readFile(resolve(targetDir, 'package.json'), 'utf-8');
      expect(pkg).toContain('test-app');
    });

    it('디렉토리가 자동 생성된다', async () => {
      const targetDir = resolve(TMP_DIR, 'scaffold-dirs');
      await scaffolder.scaffold('next-app', targetDir, { projectName: 'app' });

      const { fileExists: fe } = await import('../scripts/lib/file-writer.js');
      expect(await fe(resolve(targetDir, 'src/app'))).toBe(true);
      expect(await fe(resolve(targetDir, 'src/components'))).toBe(true);
    });

    it('overwrite=false일 때 기존 파일을 보존한다', async () => {
      const targetDir = resolve(TMP_DIR, 'scaffold-nooverwrite');
      await mkdir(targetDir, { recursive: true });
      const { writeFile } = await import('fs/promises');
      await writeFile(resolve(targetDir, 'README.md'), 'EXISTING');

      await scaffolder.scaffold('next-app', targetDir, { projectName: 'app' }, { overwrite: false });

      const content = await readFile(resolve(targetDir, 'README.md'), 'utf-8');
      expect(content).toBe('EXISTING');
    });

    it('overwrite=true일 때 기존 파일을 덮어쓴다', async () => {
      const targetDir = resolve(TMP_DIR, 'scaffold-overwrite');
      await mkdir(targetDir, { recursive: true });
      const { writeFile } = await import('fs/promises');
      await writeFile(resolve(targetDir, 'README.md'), 'EXISTING');

      await scaffolder.scaffold('next-app', targetDir, { projectName: 'app' }, { overwrite: true });

      const content = await readFile(resolve(targetDir, 'README.md'), 'utf-8');
      expect(content).toContain('# app');
    });

    it('postScaffoldMessage를 반환한다', async () => {
      const targetDir = resolve(TMP_DIR, 'scaffold-msg');
      const result = await scaffolder.scaffold('next-app', targetDir, { projectName: 'app' });
      expect(result.postScaffoldMessage).toContain('npm install');
    });

    it('존재하지 않는 템플릿은 에러를 던진다', async () => {
      const targetDir = resolve(TMP_DIR, 'scaffold-err');
      await expect(scaffolder.scaffold('nonexistent', targetDir, {})).rejects.toThrow();
    });
  });
});
