import { resolve } from 'path';
import { renderString } from './template-engine.js';
import {
  ensureDir,
  safeWriteFile,
  readJsonFile,
  listFilesByExtension,
} from '../core/file-writer.js';
import { notFoundError, assertWithinRoot } from '../core/validators.js';
import { pluginRoot } from '../core/app-paths.js';

const BUILTIN_TEMPLATES_DIR = resolve(pluginRoot(), 'presets/templates');

import { customTemplatesDir as defaultCustomTemplatesDir } from '../core/app-paths.js';

let customTemplatesDir = defaultCustomTemplatesDir();

/**
 * 테스트용 커스텀 템플릿 디렉토리 변경
 * @param {string} dir
 */
export function setCustomTemplatesDir(dir) {
  customTemplatesDir = dir;
}

/**
 * 템플릿 객체 유효성 검증
 * @param {object} template
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateTemplate(template) {
  const errors = [];

  if (!template.name) {
    errors.push('name is required');
  }

  if (!Array.isArray(template.files) || template.files.length === 0) {
    errors.push('files must have at least one entry');
  } else {
    template.files.forEach((file, i) => {
      if (!file.path) {
        errors.push(`files[${i}]: path is required`);
      }
      if (file.content === undefined || file.content === null) {
        errors.push(`files[${i}]: content is required`);
      }
    });
  }

  return { valid: errors.length === 0, errors };
}

/**
 * 디렉토리에서 JSON 템플릿 파일 목록 읽기
 * @param {string} dir
 * @returns {Promise<object[]>}
 */
async function loadTemplatesFromDir(dir) {
  const entries = await listFilesByExtension(dir, '.json');
  const templates = [];
  for (const entry of entries) {
    try {
      const data = await readJsonFile(resolve(dir, entry));
      if (data) templates.push(data);
    } catch (err) {
      process.stderr.write(`경고: 템플릿 파일 로드 실패 (${entry}): ${err.message}\n`);
    }
  }
  return templates;
}

/**
 * 이름으로 템플릿 로딩 (custom 우선, built-in fallback)
 * @param {string} name
 * @returns {Promise<object>}
 */
export async function loadTemplate(name) {
  // custom 먼저
  const customPath = resolve(customTemplatesDir, `${name}.json`);
  const customData = await readJsonFile(customPath);
  if (customData) return customData;

  // built-in fallback
  const builtinPath = resolve(BUILTIN_TEMPLATES_DIR, `${name}.json`);
  const builtinData = await readJsonFile(builtinPath);
  if (builtinData) return builtinData;

  throw notFoundError(`Template not found: ${name}`);
}

/**
 * 전체 템플릿 목록 (built-in + custom, 중복 시 custom 우선)
 * @returns {Promise<object[]>}
 */
export async function listTemplates() {
  const builtinTemplates = await loadTemplatesFromDir(BUILTIN_TEMPLATES_DIR);
  const customTemplates = await loadTemplatesFromDir(customTemplatesDir);

  const templateMap = new Map();
  for (const t of builtinTemplates) {
    templateMap.set(t.name, t);
  }
  for (const t of customTemplates) {
    templateMap.set(t.name, t);
  }

  return [...templateMap.values()];
}

/**
 * 프로젝트 타입에 맞는 템플릿 목록
 * @param {string} projectType
 * @returns {Promise<object[]>}
 */
export async function getTemplatesForProjectType(projectType) {
  const all = await listTemplates();
  return all.filter((t) => t.projectType === projectType);
}

/**
 * 템플릿 변수 해석 (default + userVars 병합)
 * @param {object} template
 * @param {object} userVars
 * @returns {object}
 */
export function resolveVariables(template, userVars) {
  const defaults = {};
  if (template.variables) {
    for (const [key, def] of Object.entries(template.variables)) {
      if (def.default !== undefined) {
        defaults[key] = def.default;
      }
    }
  }
  return { ...defaults, ...userVars };
}

/**
 * 템플릿 파일들을 렌더링
 * @param {object} template
 * @param {object} variables
 * @returns {Array<{path: string, content: string}>}
 */
export function renderTemplateFiles(template, variables) {
  if (!template.files || template.files.length === 0) return [];
  return template.files.map((file) => ({
    path: renderString(file.path, variables),
    content: renderString(file.content, variables),
  }));
}

/**
 * 전체 스캐폴딩 실행
 * @param {string} templateName
 * @param {string} targetDir
 * @param {object} userVars
 * @param {object} options
 * @param {boolean} options.overwrite - 덮어쓰기 (기본: false)
 * @param {boolean} options.backup - 백업 (기본: true)
 * @returns {Promise<{files: Array, postScaffoldMessage: string|null}>}
 */
export async function scaffold(templateName, targetDir, userVars = {}, options = {}) {
  const { overwrite = false, backup = true } = options;

  const template = await loadTemplate(templateName);
  const variables = resolveVariables(template, userVars);
  const renderedFiles = renderTemplateFiles(template, variables);

  // 디렉토리 생성
  await ensureDir(targetDir);
  if (Array.isArray(template.directories)) {
    for (const dir of template.directories) {
      const fullDir = resolve(targetDir, dir);
      assertWithinRoot(fullDir, targetDir, 'template directory');
      await ensureDir(fullDir);
    }
  }

  // 파일 쓰기
  const results = [];
  for (const file of renderedFiles) {
    const fullPath = resolve(targetDir, file.path);
    assertWithinRoot(fullPath, targetDir, 'template file path');
    const result = await safeWriteFile(fullPath, file.content, { overwrite, backup });
    results.push({ path: file.path, ...result });
  }

  return {
    files: results,
    postScaffoldMessage: template.postScaffoldMessage || null,
  };
}
