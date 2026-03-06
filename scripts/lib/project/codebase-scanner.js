/**
 * codebase-scanner — 프로젝트 폴더 스캔 → 기술 스택/구조 파악 모듈
 * LLM 호출 없이 순수 파일 분석으로 기술 스택을 감지한다.
 */

import { readdir, readFile, stat } from 'fs/promises';
import { resolve, extname, relative, dirname } from 'path';
import { AppError } from '../core/validators.js';
import { config } from '../core/config.js';

const IGNORED_DIRS = config.codebase?.ignoredDirs || [
  'node_modules',
  '.git',
  '.svn',
  'dist',
  'build',
  'coverage',
  '__pycache__',
  '.next',
  '.nuxt',
  'vendor',
  'target',
  '.gradle',
];

const MANIFEST_FILES = [
  'package.json',
  'requirements.txt',
  'pyproject.toml',
  'go.mod',
  'Cargo.toml',
  'pom.xml',
  'build.gradle',
];

const EXT_TO_LANGUAGE = {
  '.js': 'javascript',
  '.mjs': 'javascript',
  '.cjs': 'javascript',
  '.ts': 'typescript',
  '.tsx': 'typescript',
  '.jsx': 'javascript',
  '.py': 'python',
  '.go': 'go',
  '.rs': 'rust',
  '.java': 'java',
  '.kt': 'kotlin',
  '.swift': 'swift',
  '.rb': 'ruby',
  '.php': 'php',
  '.cs': 'csharp',
  '.cpp': 'cpp',
  '.c': 'c',
  '.h': 'c',
  '.vue': 'vue',
  '.svelte': 'svelte',
};

/** 기술 스택 → 역할 매핑 */
const TECH_STACK_ROLE_MAP = config.codebase?.techStackMap || {
  react: 'frontend',
  vue: 'frontend',
  angular: 'frontend',
  svelte: 'frontend',
  nextjs: 'frontend',
  express: 'backend',
  fastapi: 'backend',
  django: 'backend',
  flask: 'backend',
  nestjs: 'backend',
  koa: 'backend',
  gin: 'backend',
  spring: 'backend',
  docker: 'devops',
  kubernetes: 'devops',
  terraform: 'devops',
  tensorflow: 'data',
  pytorch: 'data',
  pandas: 'data',
};

/**
 * 프로젝트 폴더를 스캔하여 기술 스택과 구조를 파악한다.
 * @param {string} projectPath - 스캔할 프로젝트 경로
 * @returns {Promise<object>} 스캔 결과
 */
export async function scanCodebase(projectPath) {
  let pathStat;
  try {
    pathStat = await stat(projectPath);
  } catch {
    throw new AppError(`경로를 찾을 수 없습니다: ${projectPath}`, 'NOT_FOUND');
  }

  if (!pathStat.isDirectory()) {
    throw new AppError(`디렉토리가 아닙니다: ${projectPath}`, 'INPUT_ERROR');
  }

  const [files, manifests] = await Promise.all([
    collectFiles(projectPath, projectPath),
    loadManifests(projectPath),
  ]);

  const { techStack, dependencies } = detectTechStack(files, manifests);
  const languages = countLanguages(files);
  const fileStructure = summarizeFileStructure(files);
  const suggestedRoles = mapTechStackToRoles(techStack);

  return {
    techStack,
    languages,
    dependencies,
    fileStructure,
    suggestedRoles,
    scannedAt: new Date().toISOString(),
  };
}

/**
 * 디렉토리를 재귀 순회하여 파일 목록을 수집한다.
 * @param {string} dir - 현재 디렉토리
 * @param {string} root - 루트 디렉토리
 * @returns {Promise<string[]>} 상대 경로 배열
 */
const MAX_DEPTH = 10;

async function collectFiles(dir, root, depth = 0) {
  if (depth > MAX_DEPTH) return [];

  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    if (IGNORED_DIRS.includes(entry.name)) continue;
    if (entry.name.startsWith('.') && entry.name !== '.env.example') continue;

    const fullPath = resolve(dir, entry.name);

    if (entry.isSymbolicLink()) continue; // symlink 순환 방지
    if (entry.isDirectory()) {
      const subFiles = await collectFiles(fullPath, root, depth + 1);
      files.push(...subFiles);
    } else if (entry.isFile()) {
      files.push(relative(root, fullPath).replace(/\\/g, '/'));
    }
  }

  return files;
}

/**
 * 매니페스트 파일들을 로딩한다.
 * @param {string} projectPath - 프로젝트 경로
 * @returns {Promise<object>} 매니페스트 맵
 */
async function loadManifests(projectPath) {
  const manifests = {};

  const results = await Promise.allSettled(
    MANIFEST_FILES.map((name) =>
      readFile(resolve(projectPath, name), 'utf-8').then((content) => ({ name, content })),
    ),
  );

  for (const result of results) {
    if (result.status !== 'fulfilled') continue;
    const { name, content } = result.value;
    if (name === 'package.json') {
      try {
        manifests[name] = JSON.parse(content);
      } catch {
        /* 손상된 package.json 무시 */
      }
    } else {
      manifests[name] = content;
    }
  }

  return manifests;
}

/**
 * 파일 목록과 매니페스트에서 기술 스택을 감지한다.
 * @param {string[]} files - 파일 경로 배열
 * @param {object} manifests - 매니페스트 맵
 * @returns {{ techStack: string[], dependencies: object }}
 */
export function detectTechStack(files, manifests) {
  const techStack = new Set();
  const dependencies = {};

  // package.json 분석
  const pkg = manifests['package.json'];
  if (pkg && typeof pkg === 'object') {
    techStack.add('node');
    const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };

    for (const [dep, version] of Object.entries(allDeps)) {
      dependencies[dep] = version;
    }

    const depSet = new Set(Object.keys(allDeps));
    if (depSet.has('react') || depSet.has('react-dom')) techStack.add('react');
    if (depSet.has('vue')) techStack.add('vue');
    if (depSet.has('angular') || depSet.has('@angular/core')) techStack.add('angular');
    if (depSet.has('svelte')) techStack.add('svelte');
    if (depSet.has('next')) techStack.add('nextjs');
    if (depSet.has('express')) techStack.add('express');
    if (depSet.has('@nestjs/core')) techStack.add('nestjs');
    if (depSet.has('koa')) techStack.add('koa');
    if (depSet.has('typescript') || depSet.has('ts-node')) {
      techStack.add('typescript');
    }
  }

  // requirements.txt 분석
  const reqTxt = manifests['requirements.txt'];
  if (reqTxt && typeof reqTxt === 'string') {
    techStack.add('python');
    const lines = reqTxt.split('\n').filter((l) => l.trim() && !l.startsWith('#'));
    for (const line of lines) {
      const name = line
        .split(/[=<>!~]/)[0]
        .trim()
        .toLowerCase();
      if (name === 'django') techStack.add('django');
      if (name === 'fastapi') techStack.add('fastapi');
      if (name === 'flask') techStack.add('flask');
      if (name === 'tensorflow' || name === 'torch' || name === 'pytorch') {
        techStack.add('tensorflow');
      }
      if (name === 'pandas') techStack.add('pandas');
    }
  }

  // pyproject.toml 분석
  const pyproject = manifests['pyproject.toml'];
  if (pyproject && typeof pyproject === 'string') {
    techStack.add('python');
    if (pyproject.includes('django')) techStack.add('django');
    if (pyproject.includes('fastapi')) techStack.add('fastapi');
  }

  // go.mod 분석
  if (manifests['go.mod']) techStack.add('go');

  // Cargo.toml 분석
  if (manifests['Cargo.toml']) techStack.add('rust');

  // pom.xml / build.gradle 분석
  if (manifests['pom.xml'] || manifests['build.gradle']) {
    techStack.add('java');
    const pom = manifests['pom.xml'] || '';
    const gradle = manifests['build.gradle'] || '';
    if (pom.includes('spring') || gradle.includes('spring')) techStack.add('spring');
  }

  // Dockerfile 감지 (파일 목록에서)
  if (
    files.some(
      (f) => f === 'Dockerfile' || f === 'docker-compose.yml' || f === 'docker-compose.yaml',
    )
  ) {
    techStack.add('docker');
  }

  return { techStack: [...techStack], dependencies };
}

/**
 * 파일 확장자별 언어 카운트를 반환한다.
 * @param {string[]} files - 파일 경로 배열
 * @returns {Record<string, number>}
 */
function countLanguages(files) {
  const counts = {};
  for (const file of files) {
    const ext = extname(file).toLowerCase();
    const lang = EXT_TO_LANGUAGE[ext];
    if (lang) {
      counts[lang] = (counts[lang] || 0) + 1;
    }
  }
  return counts;
}

/**
 * 기술 스택을 역할 ID로 매핑한다.
 * @param {string[]} techStack - 기술 스택 배열
 * @returns {string[]} 역할 ID 배열 (중복 제거)
 */
export function mapTechStackToRoles(techStack) {
  if (!techStack || techStack.length === 0) return [];

  const roles = new Set();
  for (const tech of techStack) {
    const role = TECH_STACK_ROLE_MAP[tech];
    if (role) roles.add(role);
  }
  return [...roles];
}

/**
 * 파일 구조를 요약 문자열로 생성한다.
 * @param {string[]} files - 파일 경로 배열
 * @returns {string} 디렉토리별 파일 수 요약
 */
export function summarizeFileStructure(files) {
  if (!files || files.length === 0) return '';

  const dirCounts = {};
  for (const file of files) {
    const dir = dirname(file);
    const topDir = dir === '.' ? '(root)' : dir.split('/')[0] + '/';
    dirCounts[topDir] = (dirCounts[topDir] || 0) + 1;
  }

  return Object.entries(dirCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([dir, count]) => `${dir} (${count})`)
    .join(', ');
}
