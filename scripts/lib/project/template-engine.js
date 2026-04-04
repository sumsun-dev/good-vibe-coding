import Handlebars from 'handlebars';
import { readFile } from 'fs/promises';
import { resolve } from 'path';
import { pluginRoot } from '../core/app-paths.js';
import { assertWithinRoot } from '../core/validators.js';

/**
 * Handlebars 인스턴스를 생성하고 커스텀 헬퍼를 등록한다.
 */
function createHandlebarsInstance() {
  const hbs = Handlebars.create();

  hbs.registerHelper('ifEquals', function (a, b, options) {
    return a === b ? options.fn(this) : options.inverse(this);
  });

  hbs.registerHelper('ifIncludes', function (arr, value, options) {
    if (Array.isArray(arr) && arr.includes(value)) {
      return options.fn(this);
    }
    return options.inverse(this);
  });

  hbs.registerHelper('join', function (arr, separator) {
    if (!Array.isArray(arr)) return '';
    return arr.join(typeof separator === 'string' ? separator : ', ');
  });

  hbs.registerHelper('bullet', function (arr) {
    if (!Array.isArray(arr)) return '';
    return arr.map((item) => `- ${item}`).join('\n');
  });

  hbs.registerHelper('add', function (a, b) {
    return a + b;
  });

  return hbs;
}

const hbs = createHandlebarsInstance();

/**
 * 템플릿 파일을 읽고 데이터로 렌더링한다.
 * @param {string} templatePath - templates/ 디렉토리 기준 상대 경로
 * @param {object} data - 템플릿에 전달할 데이터
 * @returns {Promise<string>} 렌더링된 문자열
 */
export async function renderTemplate(templatePath, data) {
  const templatesDir = resolve(pluginRoot(), 'templates');
  const fullPath = resolve(templatesDir, templatePath);
  assertWithinRoot(fullPath, templatesDir, 'templatePath');
  const source = await readFile(fullPath, 'utf-8');
  const template = hbs.compile(source, { noEscape: true });
  return template(data);
}

/**
 * 문자열 템플릿을 직접 렌더링한다.
 * @param {string} source - Handlebars 템플릿 문자열
 * @param {object} data - 템플릿에 전달할 데이터
 * @returns {string} 렌더링된 문자열
 */
export function renderString(source, data) {
  const template = hbs.compile(source, { noEscape: true });
  return template(data);
}
