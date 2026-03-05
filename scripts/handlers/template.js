/**
 * handlers/template — 템플릿 스캐폴딩 커맨드
 */
import { readStdin, output, parseArgs } from '../cli-utils.js';
import {
  listTemplates,
  loadTemplate,
  scaffold,
  getTemplatesForProjectType,
} from '../lib/project/template-scaffolder.js';

const [, , , ...args] = process.argv;

function toTemplateSummary(t) {
  return {
    name: t.name,
    displayName: t.displayName,
    description: t.description,
    projectType: t.projectType,
  };
}

export const commands = {
  'list-templates': async () => {
    const opts = parseArgs(args);
    const templates = opts.type
      ? await getTemplatesForProjectType(opts.type)
      : await listTemplates();
    output(templates.map(toTemplateSummary));
  },

  'get-template': async () => {
    const opts = parseArgs(args);
    const template = await loadTemplate(opts.name);
    output(template);
  },

  scaffold: async () => {
    const data = await readStdin();
    const result = await scaffold(data.template, data.targetDir, data.variables || {}, {
      overwrite: data.overwrite || false,
      backup: data.backup !== false,
    });
    output(result);
  },
};
