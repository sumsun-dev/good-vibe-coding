/**
 * execution-verifier — 실행 검증 모듈
 * 태스크 출력에서 코드 블록을 추출하고, 임시 프로젝트를 생성하여
 * 빌드/테스트를 실행함으로써 코드의 실제 동작을 검증한다.
 */

import { execSync } from 'child_process';
import { mkdtempSync, writeFileSync, mkdirSync, rmSync, existsSync, readdirSync } from 'fs';
import { tmpdir } from 'os';
import { join, dirname, resolve } from 'path';
import { config } from '../core/config.js';
import { assertWithinRoot } from '../core/validators.js';

/** 실행 가능 언어 목록 */
const EXECUTABLE_LANGUAGES = [
  'js', 'javascript', 'ts', 'typescript',
  'py', 'python', 'sh', 'bash', 'shell',
  'go', 'golang', 'java', 'kotlin', 'kt', 'rust', 'rs',
];

/** 설정 파일 언어 목록 */
const CONFIG_LANGUAGES = ['json', 'yaml', 'yml', 'toml', 'ini', 'env'];

/** 마크업 언어 목록 */
const MARKUP_LANGUAGES = ['html', 'css', 'md', 'markdown', 'xml', 'svg'];

/** 프로젝트 타입 → 빌드 전략 명시적 매핑 */
const PROJECT_TYPE_STRATEGY_MAP = {
  'web-app': 'node',
  'api-server': 'node',
  'cli-tool': 'node',
  'library': 'node',
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
 * npm install에는 --ignore-scripts를 적용하여 postinstall 스크립트 실행을 방지한다.
 * npm run build는 package.json scripts를 실행하므로, 신뢰할 수 없는 입력에 대해
 * 샌드박스 환경(Docker 등)에서의 실행을 권장한다.
 */
export const BUILD_STRATEGIES = {
  node: {
    detect: (files) => files.some(f => f === 'package.json') ||
      files.some(f => f.endsWith('.js') || f.endsWith('.ts')),
    build: (tempDir) => {
      if (existsSync(join(tempDir, 'package.json'))) {
        const output = execSync('npm install --ignore-scripts && npm run build --ignore-scripts', {
          cwd: tempDir, timeout: config.build.defaultTimeout, encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'],
        });
        return { success: true, output, exitCode: 0 };
      }
      // package.json 없으면 JS 파일 syntax check
      const jsFiles = findFilesByExtension(tempDir, '.js');
      if (jsFiles.length === 0) {
        return { success: false, output: 'no .js files found', exitCode: 1 };
      }
      const checkCommands = jsFiles.map(f => `node --check "${f}"`).join(' && ');
      const output = execSync(checkCommands, {
        cwd: tempDir, timeout: config.build.defaultTimeout, encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'],
      });
      return { success: true, output: output || 'syntax check passed', exitCode: 0 };
    },
    test: (tempDir) => {
      if (!existsSync(join(tempDir, 'package.json'))) {
        return { success: null, output: 'no package.json for test execution', exitCode: null };
      }
      const output = execSync('npm test', {
        cwd: tempDir, timeout: config.build.defaultTimeout, encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'],
      });
      return { success: true, output, exitCode: 0 };
    },
  },
  python: {
    detect: (files) => files.some(f => ['requirements.txt', 'pyproject.toml', 'setup.py'].includes(f)),
    build: (tempDir) => {
      const pyFiles = findFilesByExtension(tempDir, '.py');
      if (pyFiles.length === 0) {
        return { success: false, output: 'no .py files found', exitCode: 1 };
      }
      const checkCommands = pyFiles.map(f => `python3 -m py_compile "${f}"`).join(' && ');
      const output = execSync(checkCommands, {
        cwd: tempDir, timeout: config.build.defaultTimeout, encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'],
      });
      return { success: true, output: output || 'python compile check passed', exitCode: 0 };
    },
    test: (tempDir) => {
      const output = execSync('python3 -m pytest', {
        cwd: tempDir, timeout: config.build.defaultTimeout, encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'],
      });
      return { success: true, output, exitCode: 0 };
    },
  },
  go: {
    detect: (files) => files.some(f => f === 'go.mod'),
    build: (tempDir) => {
      const output = execSync('go build ./...', {
        cwd: tempDir, timeout: config.build.goTimeout, encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'],
      });
      return { success: true, output: output || 'go build passed', exitCode: 0 };
    },
    test: (tempDir) => {
      const output = execSync('go test ./...', {
        cwd: tempDir, timeout: config.build.goTimeout, encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'],
      });
      return { success: true, output, exitCode: 0 };
    },
  },
  java: {
    detect: (files) => files.some(f => f === 'pom.xml'),
    build: (tempDir) => {
      const output = execSync('mvn compile -q', {
        cwd: tempDir, timeout: config.build.javaTimeout, encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'],
      });
      return { success: true, output: output || 'mvn compile passed', exitCode: 0 };
    },
    test: (tempDir) => {
      const output = execSync('mvn test -q', {
        cwd: tempDir, timeout: config.build.javaTimeout, encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'],
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
  // 펜스드 코드 블록: ```lang optionalFilename\n...content...\n```
  const codeBlockRegex = /```(\w*)\s*([\w./-]*)\s*\n([\s\S]*?)```/g;
  let match;

  while ((match = codeBlockRegex.exec(markdownOutput)) !== null) {
    const language = (match[1] || '').trim().toLowerCase();
    const infoFilename = (match[2] || '').trim() || null;
    const content = match[3];

    // 코드 내 주석에서 파일명 감지: // filename: src/app.js 또는 # filename: app.py
    let commentFilename = null;
    const filenameCommentMatch = content.match(/^(?:\/\/|#)\s*filename:\s*(.+)$/m);
    if (filenameCommentMatch) {
      commentFilename = filenameCommentMatch[1].trim();
    }

    const filename = infoFilename || commentFilename;

    blocks.push({ language, filename, content });
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

  return codeBlocks.map(block => {
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
export function writeTemporaryProject(codeBlocks, projectType) {
  if (!codeBlocks || codeBlocks.length === 0) {
    const tempDir = mkdtempSync(join(tmpdir(), 'gvc-verify-'));
    return { tempDir, files: [] };
  }

  const tempDir = mkdtempSync(join(tmpdir(), 'gvc-verify-'));
  const files = [];

  /** 언어 → 확장자 매핑 */
  const langExtMap = {
    javascript: '.js', js: '.js',
    typescript: '.ts', ts: '.ts',
    python: '.py', py: '.py',
    sh: '.sh', bash: '.sh', shell: '.sh',
    json: '.json', yaml: '.yml', yml: '.yml',
    toml: '.toml', html: '.html', css: '.css',
    md: '.md', markdown: '.md',
    go: '.go', golang: '.go',
    java: '.java',
    kotlin: '.kt', kt: '.kt',
    rust: '.rs', rs: '.rs',
  };

  codeBlocks.forEach((block, idx) => {
    const filename = block.filename || `file-${idx}${langExtMap[block.language] || '.txt'}`;
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

  try {
    return detected.strategy.build(tempDir);
  } catch (err) {
    if (err.code === 'ENOENT') {
      const cmd = err.path || 'runtime';
      return { success: false, output: `${cmd} not found`, exitCode: 1 };
    }
    return {
      success: false,
      output: err.stderr || err.stdout || err.message || 'build failed',
      exitCode: err.status ?? 1,
    };
  }
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

  try {
    return detected.strategy.test(tempDir);
  } catch (err) {
    if (err.code === 'ENOENT') {
      const cmd = err.path || 'runtime';
      return { success: false, output: `${cmd} not found`, exitCode: 1 };
    }
    return {
      success: false,
      output: err.stderr || err.stdout || err.message || 'tests failed',
      exitCode: err.status ?? 1,
    };
  }
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
  const verifyResult = await verifyExecution(taskOutput, task);

  if (verifyResult.verified === null || verifyResult.verified === false) {
    return {
      verified: verifyResult.verified,
      reason: verifyResult.reason,
      buildResult: verifyResult.buildResult,
      testResult: verifyResult.testResult,
      codeBlockCount: verifyResult.codeBlockCount,
      tempDir: verifyResult.tempDir,
    };
  }

  // 검증 성공 → 프로젝트에 기록 (lazy import으로 순환 의존성 방지)
  const { materializeCode } = await import('./code-materializer.js');
  const materializeResult = await materializeCode(taskOutput, projectDir, options);

  return {
    verified: true,
    buildResult: verifyResult.buildResult,
    testResult: verifyResult.testResult,
    codeBlockCount: verifyResult.codeBlockCount,
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
 * 디렉토리에서 특정 확장자의 파일을 재귀적으로 찾는다.
 * @param {string} dir - 검색 디렉토리
 * @param {string} ext - 확장자 (예: '.js')
 * @returns {string[]} 파일 경로 배열
 */
function findFilesByExtension(dir, ext) {
  const results = [];

  try {
    const entries = readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = join(dir, entry.name);
      if (entry.isDirectory() && entry.name !== 'node_modules') {
        results.push(...findFilesByExtension(fullPath, ext));
      } else if (entry.isFile() && entry.name.endsWith(ext)) {
        results.push(fullPath);
      }
    }
  } catch (err) {
    if (err.code !== 'ENOENT') throw err;
  }

  return results;
}

/**
 * 디렉토리에서 테스트 파일을 찾는다.
 * @param {string} dir - 검색 디렉토리
 * @returns {string[]} 테스트 파일 경로 배열
 */
function findTestFiles(dir) {
  const testPatterns = ['.test.', '.spec.', '__tests__'];

  const allFiles = [
    ...findFilesByExtension(dir, '.js'),
    ...findFilesByExtension(dir, '.ts'),
    ...findFilesByExtension(dir, '.py'),
    ...findFilesByExtension(dir, '.go'),
    ...findFilesByExtension(dir, '.java'),
  ];

  return allFiles.filter(f =>
    testPatterns.some(p => f.includes(p)) ||
    f.endsWith('_test.go') ||
    f.endsWith('Test.java')
  );
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
