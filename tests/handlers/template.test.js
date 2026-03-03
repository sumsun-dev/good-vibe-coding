import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../scripts/cli-utils.js', () => ({
  readStdin: vi.fn(),
  output: vi.fn(),
  parseArgs: vi.fn(),
}));

vi.mock('../../scripts/lib/project/template-scaffolder.js', () => ({
  listTemplates: vi.fn(),
  loadTemplate: vi.fn(),
  scaffold: vi.fn(),
  getTemplatesForProjectType: vi.fn(),
}));

import { readStdin, output, parseArgs } from '../../scripts/cli-utils.js';
import {
  listTemplates,
  loadTemplate,
  scaffold,
  getTemplatesForProjectType,
} from '../../scripts/lib/project/template-scaffolder.js';
import { commands } from '../../scripts/handlers/template.js';

describe('template handler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('list-templates', () => {
    it('전체 템플릿 목록을 출력해야 한다', async () => {
      const templates = [
        { name: 'next-app', displayName: 'Next.js', description: 'Next.js 앱', projectType: 'web' },
      ];
      parseArgs.mockReturnValue({});
      listTemplates.mockResolvedValue(templates);

      await commands['list-templates']();
      expect(output).toHaveBeenCalledWith([
        { name: 'next-app', displayName: 'Next.js', description: 'Next.js 앱', projectType: 'web' },
      ]);
    });

    it('타입 필터가 있으면 해당 타입만 출력해야 한다', async () => {
      const templates = [
        {
          name: 'express-api',
          displayName: 'Express',
          description: 'API 서버',
          projectType: 'api',
        },
      ];
      parseArgs.mockReturnValue({ type: 'api' });
      getTemplatesForProjectType.mockResolvedValue(templates);

      await commands['list-templates']();
      expect(getTemplatesForProjectType).toHaveBeenCalledWith('api');
      expect(output).toHaveBeenCalledWith([
        {
          name: 'express-api',
          displayName: 'Express',
          description: 'API 서버',
          projectType: 'api',
        },
      ]);
    });
  });

  describe('get-template', () => {
    it('템플릿을 로드하고 출력해야 한다', async () => {
      const template = { name: 'cli-app', files: [] };
      parseArgs.mockReturnValue({ name: 'cli-app' });
      loadTemplate.mockResolvedValue(template);

      await commands['get-template']();
      expect(loadTemplate).toHaveBeenCalledWith('cli-app');
      expect(output).toHaveBeenCalledWith(template);
    });
  });

  describe('scaffold', () => {
    it('템플릿으로 프로젝트를 생성해야 한다', async () => {
      const result = { created: true, files: ['index.js', 'package.json'] };
      readStdin.mockResolvedValue({
        template: 'next-app',
        targetDir: '/tmp/project',
        variables: { name: 'my-app' },
      });
      scaffold.mockResolvedValue(result);

      await commands['scaffold']();
      expect(scaffold).toHaveBeenCalledWith(
        'next-app',
        '/tmp/project',
        { name: 'my-app' },
        {
          overwrite: false,
          backup: true,
        },
      );
      expect(output).toHaveBeenCalledWith(result);
    });
  });
});
