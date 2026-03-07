/**
 * execution-verifier — 실행 검증 모듈
 * 태스크 출력에서 코드 블록을 추출하고, 임시 프로젝트를 생성하여
 * 빌드/테스트를 실행함으로써 코드의 실제 동작을 검증한다.
 */

import { execFileSync } from 'child_process';
import { mkdtempSync, writeFileSync, mkdirSync, rmSync, existsSync, readdirSync } from 'fs';
import { tmpdir } from 'os';
import { join, dirname, resolve, extname } from 'path';
import { config } from '../core/config.js';
import { assertWithinRoot, AppError } from '../core/validators.js';

/** 실행 가능 언어 목록 */
const EXECUTABLE_LANGUAGES = [
  'js',
  'javascript',
  'ts',
  'typescript',
  'py',
  'python',
  'sh',
  'bash',
  'shell',
  'go',
  'golang',
  'java',
  'kotlin',
  'kt',
  'rust',
  'rs',
];

/** 설정 파일 언어 목록 */
const CONFIG_LANGUAGES = ['json', 'yaml', 'yml', 'toml', 'ini', 'env'];

/** 마크업 언어 목록 */
const MARKUP_LANGUAGES = ['html', 'css', 'md', 'markdown', 'xml', 'svg'];

/** 언어 → 확장자 매핑 (모듈 레벨 상수) */
const LANG_EXT_MAP = {
  javascript: '.js',
  js: '.js',
  typescript: '.ts',
  ts: '.ts',
  python: '.py',
  py: '.py',
  sh: '.sh',
  bash: '.sh',
  shell: '.sh',
  json: '.json',
  yaml: '.yml',
  yml: '.yml',
  toml: '.toml',
  html: '.html',
  css: '.css',
  md: '.md',
  markdown: '.md',
  go: '.go',
  golang: '.go',
  java: '.java',
  kotlin: '.kt',
  kt: '.kt',
  rust: '.rs',
  rs: '.rs',
};

/** 프로젝트 타입 → 빌드 전략 명시적 매핑 */
const PROJECT_TYPE_STRATEGY_MAP = {
  'web-app': 'node',
  'api-server': 'node',
  'cli-tool': 'node',
  library: 'node',
  'mobile-app': 'node',
  'chrome-extension': 'node',
  'telegram-bot': 'node',
  'data-pipeline': 'node',
  'python-app': 'python',
  'go-service': 'go',
  'java-app': 'java',
};

/**
 * 빌드 전략 맵 — 언어별 detect/build/test
 *
 * SECURITY NOTE: 이 전략들은 LLM이 생성한 코드를 /tmp에서 실행한다.
 * - npm install --ignore-scripts: postinstall 스크립트 실행 방지 ✓
 * - npm run build: package.json의 build 스크립트를 실행하므로 임의 코드 실행 가능 ⚠️
 *   (--ignore-scripts 플래그는 npm run의 옵션이 아니므로 무효)
 * - 프로덕션 환경에서는 샌드박스(Docker 등)에서 실행을 권장한다.
 */
export const BUILD_STRATEGIES = {
  node: {
    detect: (files) =>
      files.some((f) => f === 'package.json' || f.endsWith('.js') || f.endsWith('.ts')),
    build: (tempDir) => {
      if (existsSync(join(tempDir, 'package.json'))) {
        const installOut = execFileSync('npm', ['install', '--ignore-scripts'], {
          cwd: tempDir,
          timeout: config.build.defaultTimeout,
          encoding: 'utf-8',
          stdio: ['pipe', 'pipe', 'pipe'],
        });
        // SECURITY: --ignore-scripts는 npm run의 옵션이 아니므로 제거
        // npm run build는 package.json scripts를 실행 — /tmp 격리에 의존
        const buildOut = execFileSync('npm', ['run', 'build'], {
          cwd: tempDir,
          timeout: config.build.defaultTimeout,
          encoding: 'utf-8',
          stdio: ['pipe', 'pipe', 'pipe'],
        });
        return {
          success: true,
          output: [installOut, buildOut].filter(Boolean).join('\n'),
          exitCode: 0,
        };
      }
      // package.json 없으면 JS 파일 syntax check
      const jsFiles = findFilesByExtensions(tempDir, ['.js']);
      if (jsFiles.length === 0) {
        return { success: false, output: 'no .js files found', exitCode: 1 };
      }
      // SECURITY: execFileSync로 개별 실행하여 shell injection 방지
      const outputs = [];
      for (const f of jsFiles) {
        const out = execFileSync('node', ['--check', f], {
          cwd: tempDir,
          timeout: config.build.defaultTimeout,
          encoding: 'utf-8',
          stdio: ['pipe', 'pipe', 'pipe'],
        });
        if (out) outputs.push(out);
      }
      return { success: true, output: outputs.join('\n') || 'syntax check passed', exitCode: 0 };
    },
    test: (tempDir) => {
      if (!existsSync(join(tempDir, 'package.json'))) {
        return { success: null, output: 'no package.json for test execution', exitCode: null };
      }
      const output = execFileSync('npm', ['test'], {
        cwd: tempDir,
        timeout: config.build.defaultTimeout,
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe'],
      });
      return { success: true, output, exitCode: 0 };
    },
  },
  python: {
    detect: (files) =>
      files.some((f) => f === 'requirements.txt' || f === 'pyproject.toml' || f === 'setup.py'),
    build: (tempDir) => {
      const pyFiles = findFilesByExtensions(tempDir, ['.py']);
      if (pyFiles.length === 0) {
        return { success: false, output: 'no .py files found', exitCode: 1 };
      }
      // SECURITY: execFileSync로 개별 실행하여 shell injection 방지
      const outputs = [];
      for (const f of pyFiles) {
        const out = execFileSync('python3', ['-m', 'py_compile', f], {
          cwd: tempDir,
          timeout: config.build.defaultTimeout,
          encoding: 'utf-8',
          stdio: ['pipe', 'pipe', 'pipe'],
        });
        if (out) outputs.push(out);
      }
      return {
        success: true,
        output: outputs.join('\n') || 'python compile check passed',
        exitCode: 0,
      };
    },
    test: (tempDir) => {
      const output = execFileSync('python3', ['-m', 'pytest'], {
        cwd: tempDir,
        timeout: config.build.defaultTimeout,
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe'],
      });
      return { success: true, output, exitCode: 0 };
    },
  },
  go: {
    detect: (files) => files.some((f) => f === 'go.mod'),
    build: (tempDir) => {
      const output = execFileSync('go', ['build', './...'], {
        cwd: tempDir,
        timeout: config.build.goTimeout,
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe'],
      });
      return { success: true, output: output || 'go build passed', exitCode: 0 };
    },
    test: (tempDir) => {
      const output = execFileSync('go', ['test', './...'], {
        cwd: tempDir,
        timeout: config.build.goTimeout,
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe'],
      });
      return { success: true, output, exitCode: 0 };
    },
  },
  java: {
    detect: (files) => files.some((f) => f === 'pom.xml'),
    build: (tempDir) => {
      const output = execFileSync('mvn', ['compile', '-q'], {
        cwd: tempDir,
        timeout: config.build.javaTimeout,
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe'],
      });
      return { success: true, output: output || 'mvn compile passed', exitCode: 0 };
    },
    test: (tempDir) => {
      const output = execFileSync('mvn', ['test', '-q'], {
        cwd: tempDir,
        timeout: config.build.javaTimeout,
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe'],
      });
      return { success: true, output, exitCode: 0 };
    },
  },
};

/**
 * 빌드 전략을 감지한다.
 * 명시적 타입 매핑 우선, 없으면 파일 기반 자동 감지.
 *
 * @param {string[]} files - 프로젝트 내 파일 목록
 * @param {string} [projectType] - 프로젝트 타입
 * @returns {{ strategyId: string, strategy: object } | null}
 */
export function detectBuildStrategy(files, projectType) {
  // 1. 명시적 타입 매핑 우선
  if (projectType && PROJECT_TYPE_STRATEGY_MAP[projectType]) {
    const strategyId = PROJECT_TYPE_STRATEGY_MAP[projectType];
    return { strategyId, strategy: BUILD_STRATEGIES[strategyId] };
  }

  // 2. 파일 기반 자동 감지
  for (const [strategyId, strategy] of Object.entries(BUILD_STRATEGIES)) {
    if (strategy.detect(files)) {
      return { strategyId, strategy };
    }
  }

  return null;
}

/**
 * 마크다운 출력에서 펜스드 코드 블록을 추출한다.
 * 언어 태그와 파일명(info string 또는 코드 내 주석에서)을 감지한다.
 *
 * @param {string} markdownOutput - 마크다운 형식의 태스크 출력
 * @returns {Array<{ language: string, filename: string|null, content: string }>}
 */
export function extractCodeBlocks(markdownOutput) {
  if (!markdownOutput || typeof markdownOutput !== 'string') return [];

  const blocks = [];
  const lines = markdownOutput.split('\n');
  let i = 0;

  while (i < lines.length) {
    const openMatch = lines[i].match(/^(`{3,})(\w*)\s*([\w./-]*)\s*$/);
    if (openMatch) {
      const fenceLen = openMatch[1].length;
      const language = (openMatch[2] || '').trim().toLowerCase();
      const infoFilename = (openMatch[3] || '').trim() || null;
      const contentLines = [];
      i++;

      // closing fence: 같은 수 이상의 백틱만 매칭 (중첩 안전)
      while (i < lines.length) {
        const closeMatch = lines[i].match(/^(`{3,})\s*$/);
        if (closeMatch && closeMatch[1].length >= fenceLen) {
          break;
        }
        contentLines.push(lines[i]);
        i++;
      }

      const content = contentLines.length > 0 ? contentLines.join('\n') + '\n' : '';

      // 코드 내 주석에서 파일명 감지: // filename: src/app.js 또는 # filename: app.py
      let commentFilename = null;
      const filenameCommentMatch = content.match(/^(?:\/\/|#)\s*filename:\s*(.+)$/m);
      if (filenameCommentMatch) {
        commentFilename = filenameCommentMatch[1].trim();
      }

      const filename = infoFilename || commentFilename;
      blocks.push({ language, filename, content });
    }
    i++;
  }

  return blocks;
}

/**
 * 코드 블록을 유형별로 분류한다.
 *
 * @param {Array<{ language: string, filename: string|null, content: string }>} codeBlocks
 * @returns {Array<{ language: string, filename: string|null, content: string, type: string }>}
 */
export function classifyCodeBlocks(codeBlocks) {
  if (!codeBlocks || !Array.isArray(codeBlocks)) return [];

  return codeBlocks.map((block) => {
    const lang = block.language.toLowerCase();
    let type;

    if (EXECUTABLE_LANGUAGES.includes(lang)) {
      type = 'executable';
    } else if (CONFIG_LANGUAGES.includes(lang)) {
      type = 'config';
    } else if (MARKUP_LANGUAGES.includes(lang)) {
      type = 'markup';
    } else {
      type = 'unknown';
    }

    return { ...block, type };
  });
}

/**
 * 코드 블록을 임시 디렉토리에 기록하여 프로젝트 구조를 생성한다.
 *
 * @param {Array<{ language: string, filename: string|null, content: string, type?: string }>} codeBlocks
 * @param {string} projectType - 프로젝트 유형 ('web-app', 'api-server', 'cli-tool' 등)
 * @returns {{ tempDir: string, files: string[] }}
 */
export function writeTemporaryProject(codeBlocks, _projectType) {
  if (!codeBlocks || codeBlocks.length === 0) {
    const tempDir = mkdtempSync(join(tmpdir(), 'gvc-verify-'));
    return { tempDir, files: [] };
  }

  const tempDir = mkdtempSync(join(tmpdir(), 'gvc-verify-'));
  const files = [];

  codeBlocks.forEach((block, idx) => {
    const filename = block.filename || `file-${idx}${LANG_EXT_MAP[block.language] || '.txt'}`;
    const fullPath = resolve(join(tempDir, filename));
    assertWithinRoot(fullPath, tempDir, 'filename');
    const dir = dirname(fullPath);

    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    writeFileSync(fullPath, block.content, 'utf-8');
    files.push(filename);
  });

  return { tempDir, files };
}

/**
 * 전략 함수 실행 시 공통 에러 처리를 수행한다.
 * ENOENT(런타임 미설치)와 일반 오류를 통합 처리한다.
 *
 * @param {Function} strategyFn - 실행할 전략 함수
 * @param {string} fallbackMessage - 일반 오류 시 기본 메시지
 * @returns {{ success: boolean, output: string, exitCode: number }}
 */
function runStrategyWithErrorHandling(strategyFn, fallbackMessage) {
  try {
    return strategyFn();
  } catch (err) {
    if (err.code === 'ENOENT') {
      const cmd = err.path || 'runtime';
      return { success: false, output: `${cmd} not found`, exitCode: 1 };
    }
    return {
      success: false,
      output: err.stderr || err.stdout || err.message || fallbackMessage,
      exitCode: err.status ?? 1,
    };
  }
}

/**
 * 프로젝트 유형에 따라 빌드를 시도한다.
 * BUILD_STRATEGIES 전략 패턴으로 위임한다.
 *
 * @param {string} tempDir - 임시 프로젝트 디렉토리
 * @param {string} projectType - 프로젝트 유형
 * @returns {{ success: boolean, output: string, exitCode: number }}
 */
export function attemptBuild(tempDir, projectType) {
  const files = listTopLevelFiles(tempDir);
  const detected = detectBuildStrategy(files, projectType);

  if (!detected) {
    return { success: false, output: `unsupported project type: ${projectType}`, exitCode: 1 };
  }

  return runStrategyWithErrorHandling(() => detected.strategy.build(tempDir), 'build failed');
}

/**
 * 테스트 파일이 존재하면 테스트를 시도한다.
 * BUILD_STRATEGIES 전략 패턴으로 위임한다.
 *
 * @param {string} tempDir - 임시 프로젝트 디렉토리
 * @param {string} projectType - 프로젝트 유형
 * @returns {{ success: boolean|null, output: string, exitCode: number|null }}
 */
export function attemptTests(tempDir, projectType) {
  const hasTestFiles = findTestFiles(tempDir).length > 0;

  if (!hasTestFiles) {
    return { success: null, output: 'no tests found', exitCode: null };
  }

  const files = listTopLevelFiles(tempDir);
  const detected = detectBuildStrategy(files, projectType);

  if (!detected) {
    return { success: null, output: 'no test strategy found', exitCode: null };
  }

  return runStrategyWithErrorHandling(() => detected.strategy.test(tempDir), 'tests failed');
}

/**
 * 메인 오케스트레이터: 태스크 출력에서 코드를 추출, 빌드, 테스트를 수행한다.
 *
 * @param {string} taskOutput - 태스크 실행 결과물 (마크다운)
 * @param {object} task - 태스크 정보
 * @returns {{ verified: boolean|null, reason?: string, buildResult?: object, testResult?: object, codeBlockCount: number, tempDir?: string }}
 */
export async function verifyExecution(taskOutput, task) {
  const codeBlocks = extractCodeBlocks(taskOutput);

  if (codeBlocks.length === 0) {
    return { verified: null, reason: 'no-code-blocks', codeBlockCount: 0 };
  }

  const classified = classifyCodeBlocks(codeBlocks);
  const projectType = task?.projectType || 'cli-tool';
  let tempDir = null;

  const writeResult = writeTemporaryProject(classified, projectType);
  tempDir = writeResult.tempDir;

  const buildResult = attemptBuild(tempDir, projectType);
  const testResult = attemptTests(tempDir, projectType);

  const verified = buildResult.success === true;

  // 검증 성공 시 임시 디렉토리 삭제, 실패 시 디버깅용 보존
  if (verified) {
    cleanup(tempDir);
  }

  return {
    verified,
    buildResult,
    testResult,
    codeBlockCount: codeBlocks.length,
    tempDir,
  };
}

/**
 * /tmp에서 빌드 검증 후, 성공 시 프로젝트 디렉토리에 파일을 기록한다.
 *
 * @param {string} taskOutput - 태스크 실행 결과물 (마크다운)
 * @param {object} task - 태스크 정보
 * @param {string} projectDir - 프로젝트 디렉토리 경로
 * @param {object} options - materializeCode 옵션
 * @returns {Promise<{verified: boolean|null, buildResult?: object, testResult?: object, codeBlockCount: number, tempDir?: string, materializeResult?: object}>}
 */
export async function verifyAndMaterialize(taskOutput, task, projectDir, options = {}) {
  // 코드 블록을 1회만 추출하여 검증과 기록에 재사용 (중복 파싱 방지)
  const codeBlocks = extractCodeBlocks(taskOutput);

  if (codeBlocks.length === 0) {
    return { verified: null, reason: 'no-code-blocks', codeBlockCount: 0 };
  }

  const classified = classifyCodeBlocks(codeBlocks);
  const projectType = task?.projectType || 'cli-tool';

  const writeResult = writeTemporaryProject(classified, projectType);
  const tempDir = writeResult.tempDir;
  const buildResult = attemptBuild(tempDir, projectType);
  const testResult = attemptTests(tempDir, projectType);
  const verified = buildResult.success === true;

  if (verified) {
    cleanup(tempDir);
  }

  if (!verified) {
    return {
      verified,
      buildResult,
      testResult,
      codeBlockCount: codeBlocks.length,
      tempDir,
    };
  }

  // 검증 성공 → 사전 분류된 블록을 전달하여 재추출 방지 (lazy import으로 순환 의존성 방지)
  const { materializeCode } = await import('./code-materializer.js');
  const materializeResult = await materializeCode(taskOutput, projectDir, {
    ...options,
    _classifiedBlocks: classified,
  });

  return {
    verified: true,
    buildResult,
    testResult,
    codeBlockCount: codeBlocks.length,
    materializeResult,
  };
}

/**
 * 임시 디렉토리를 삭제한다. 오류는 무시한다.
 *
 * @param {string} tempDir - 삭제할 디렉토리 경로
 */
export function cleanup(tempDir) {
  try {
    if (tempDir && existsSync(tempDir)) {
      rmSync(tempDir, { recursive: true, force: true });
    }
  } catch {
    // 오류 무시
  }
}

/**
 * 디렉토리에서 여러 확장자의 파일을 한 번의 순회로 재귀적으로 찾는다.
 * @param {string} dir - 검색 디렉토리
 * @param {string[]} extensions - 확장자 목록 (예: ['.js', '.ts'])
 * @returns {string[]} 파일 경로 배열
 */
function findFilesByExtensions(dir, extensions) {
  const results = [];
  const extSet = new Set(extensions);

  try {
    const entries = readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isSymbolicLink()) continue; // symlink 순환 방지
      const fullPath = join(dir, entry.name);
      if (entry.isDirectory() && entry.name !== 'node_modules') {
        results.push(...findFilesByExtensions(fullPath, extensions));
      } else if (entry.isFile()) {
        if (extSet.has(extname(entry.name))) {
          results.push(fullPath);
        }
      }
    }
  } catch (err) {
    if (err.code !== 'ENOENT') {
      throw new AppError(`파일 검색 오류 (${dir}): ${err.message}`, 'SYSTEM_ERROR');
    }
  }

  return results;
}

/**
 * 디렉토리에서 테스트 파일을 찾는다.
 * @param {string} dir - 검색 디렉토리
 * @returns {string[]} 테스트 파일 경로 배열
 */
const TEST_FILE_REGEX = /\.test\.|\.spec\.|__tests__|_test\.go$|Test\.java$/;

function findTestFiles(dir) {
  const allFiles = findFilesByExtensions(dir, ['.js', '.ts', '.py', '.go', '.java']);
  return allFiles.filter((f) => TEST_FILE_REGEX.test(f));
}

/**
 * 디렉토리의 최상위 파일/디렉토리명 목록을 반환한다.
 * @param {string} dir - 검색 디렉토리
 * @returns {string[]} 파일명 배열
 */
function listTopLevelFiles(dir) {
  try {
    return readdirSync(dir);
  } catch {
    return [];
  }
}
