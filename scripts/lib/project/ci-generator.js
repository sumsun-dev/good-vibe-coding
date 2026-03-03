/**
 * ci-generator — GitHub Actions CI 워크플로우 자동 생성
 *
 * 기술 스택을 분석하여 적합한 CI 워크플로우를 생성한다.
 * 순수 함수 + 파일 생성 분리 구조.
 */

import { mkdir, writeFile } from 'fs/promises';
import { resolve, dirname } from 'path';

const NODE_STACKS = ['node', 'express', 'react', 'vue', 'angular', 'svelte', 'nextjs', 'next', 'nestjs', 'koa', 'npm', 'yarn'];
const PYTHON_STACKS = ['python', 'fastapi', 'django', 'flask', 'pytorch', 'tensorflow', 'pandas'];
const GO_STACKS = ['go', 'gin', 'echo', 'fiber'];
const JAVA_STACKS = ['java', 'spring', 'kotlin', 'gradle', 'maven'];

/**
 * 기술 스택에서 CI 전략을 결정한다 (pure).
 * @param {object} options
 * @param {string[]} [options.techStack] - 기술 스택 배열
 * @param {object} [options.codebaseInfo] - codebase-scanner 결과
 * @returns {object} CI 전략
 */
export function resolveCIStrategy(options = {}) {
  const stacks = (options.techStack || options.codebaseInfo?.techStack || [])
    .map(s => s.toLowerCase());

  if (stacks.some(s => PYTHON_STACKS.includes(s))) {
    return { type: 'python', pythonVersions: ['3.10', '3.11', '3.12'] };
  }
  if (stacks.some(s => GO_STACKS.includes(s))) {
    return { type: 'go', goVersion: '1.21' };
  }
  if (stacks.some(s => JAVA_STACKS.includes(s))) {
    return { type: 'java', javaVersion: '17' };
  }

  return { type: 'node', nodeVersions: ['18', '20', '22'] };
}

/**
 * 기술 스택에서 test/lint/build 커맨드를 추론한다 (pure).
 * @param {string} type - CI 전략 타입
 * @param {object} [packageJson] - package.json 내용
 * @returns {{test: string, lint: string|null, build: string|null}}
 */
export function inferCommands(type, packageJson) {
  switch (type) {
    case 'python':
      return { test: 'pytest', lint: 'flake8', build: null };
    case 'go':
      return { test: 'go test ./...', lint: 'go vet ./...', build: 'go build ./...' };
    case 'java':
      return { test: './gradlew test', lint: null, build: './gradlew build' };
    case 'node':
    default: {
      const scripts = packageJson?.scripts || {};
      return {
        test: 'npm test',
        lint: scripts.lint ? 'npm run lint' : null,
        build: scripts.build ? 'npm run build' : null,
      };
    }
  }
}

/**
 * CI 워크플로우 파일을 생성한다.
 * @param {string} projectDir - 프로젝트 디렉토리
 * @param {object} strategy - resolveCIStrategy 결과
 * @param {object} commands - inferCommands 결과
 * @returns {Promise<{success: boolean, filePath: string}>}
 */
export async function generateCIWorkflow(projectDir, strategy, commands) {
  const filePath = resolve(projectDir, '.github', 'workflows', 'ci.yml');
  await mkdir(dirname(filePath), { recursive: true });

  const content = buildWorkflowYaml(strategy, commands);
  await writeFile(filePath, content, 'utf-8');

  return { success: true, filePath };
}

/**
 * 워크플로우 YAML을 빌드한다 (pure, 내부 헬퍼).
 */
function buildWorkflowYaml(strategy, commands) {
  switch (strategy.type) {
    case 'python':
      return buildPythonWorkflow(strategy, commands);
    case 'go':
      return buildGoWorkflow(strategy, commands);
    case 'java':
      return buildJavaWorkflow(strategy, commands);
    case 'node':
    default:
      return buildNodeWorkflow(strategy, commands);
  }
}

function buildNodeWorkflow(strategy, commands) {
  const versions = (strategy.nodeVersions || ['18', '20', '22']).map(v => `'${v}'`).join(', ');
  const steps = ['      - uses: actions/checkout@v4',
    '      - uses: actions/setup-node@v4',
    '        with:',
    '          node-version: ${{ matrix.node-version }}',
    '          cache: npm',
    '      - run: npm ci'];

  if (commands.lint) steps.push(`      - run: ${commands.lint}`);
  if (commands.build) steps.push(`      - run: ${commands.build}`);
  steps.push(`      - run: ${commands.test}`);

  return `name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        node-version: [${versions}]
    steps:
${steps.join('\n')}
`;
}

function buildPythonWorkflow(strategy, commands) {
  const versions = (strategy.pythonVersions || ['3.11']).map(v => `'${v}'`).join(', ');
  const steps = ['      - uses: actions/checkout@v4',
    '      - uses: actions/setup-python@v5',
    '        with:',
    '          python-version: ${{ matrix.python-version }}',
    '      - run: pip install -r requirements.txt'];

  if (commands.lint) steps.push(`      - run: ${commands.lint}`);
  steps.push(`      - run: ${commands.test}`);

  return `name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        python-version: [${versions}]
    steps:
${steps.join('\n')}
`;
}

function buildGoWorkflow(strategy, commands) {
  const version = strategy.goVersion || '1.21';
  const steps = ['      - uses: actions/checkout@v4',
    '      - uses: actions/setup-go@v5',
    '        with:',
    `          go-version: '${version}'`];

  if (commands.lint) steps.push(`      - run: ${commands.lint}`);
  if (commands.build) steps.push(`      - run: ${commands.build}`);
  steps.push(`      - run: ${commands.test}`);

  return `name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
${steps.join('\n')}
`;
}

function buildJavaWorkflow(strategy, commands) {
  const version = strategy.javaVersion || '17';
  const steps = ['      - uses: actions/checkout@v4',
    '      - uses: actions/setup-java@v4',
    '        with:',
    `          java-version: '${version}'`,
    '          distribution: temurin'];

  if (commands.build) steps.push(`      - run: ${commands.build}`);
  steps.push(`      - run: ${commands.test}`);

  return `name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
${steps.join('\n')}
`;
}
