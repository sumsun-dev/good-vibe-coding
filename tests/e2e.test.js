/**
 * E2E 테스트 — Generation → Execution 파이프라인 전체 검증
 */
import { describe, it, expect, afterEach } from 'vitest';
import { execSync } from 'child_process';
import { mkdtempSync, existsSync, readFileSync } from 'fs';
import { tmpdir } from 'os';
import { join, resolve } from 'path';
import { cleanup, verifyAndMaterialize } from '../scripts/lib/engine/execution-verifier.js';
import { materializeCode, materializeBatch, extractMaterializableBlocks } from '../scripts/lib/engine/code-materializer.js';
import { checkQualityGate, checkEnhancedQualityGate } from '../scripts/lib/engine/review-engine.js';
import { buildTddExecutionPrompt, buildExecutionPrompt, isCodeTask } from '../scripts/lib/engine/task-distributor.js';
import {
  SINGLE_FILE_OUTPUT, MULTI_FILE_OUTPUT, TEXT_ONLY_OUTPUT,
  NESTED_DIR_OUTPUT, TDD_OUTPUT,
} from './fixtures/index.js';
import {
  CODE_TASK, NON_CODE_TASK, PROJECT_WITH_TASKS,
} from './fixtures/projects.js';
import {
  BACKEND_MEMBER, CTO_MEMBER, DEFAULT_TEAM,
} from './fixtures/teams.js';

const CLI_PATH = resolve('scripts/cli.js');

function cliExec(command, input) {
  const inputJson = JSON.stringify(input);
  return JSON.parse(
    execSync(`node ${CLI_PATH} ${command}`, {
      input: inputJson,
      encoding: 'utf-8',
      timeout: 10_000,
    })
  );
}

// --- 시나리오 1: 코드 Materialization ---

describe('E2E: 코드 Materialization', () => {
  const tempDirs = [];

  afterEach(() => {
    for (const dir of tempDirs) {
      cleanup(dir);
    }
    tempDirs.length = 0;
  });

  function createTempDir() {
    const dir = mkdtempSync(join(tmpdir(), 'gvc-e2e-'));
    tempDirs.push(dir);
    return dir;
  }

  it('fixture 출력 → 프로젝트 디렉토리에 파일 기록', async () => {
    const dir = createTempDir();
    const result = await materializeCode(MULTI_FILE_OUTPUT, dir);

    expect(result.materializedCount).toBe(4);

    // 모든 파일이 올바르게 기록되었는지 검증
    const serverContent = readFileSync(join(dir, 'src/server.js'), 'utf-8');
    expect(serverContent).toContain('express');

    const usersContent = readFileSync(join(dir, 'src/routes/users.js'), 'utf-8');
    expect(usersContent).toContain('getUsers');

    const pkgContent = readFileSync(join(dir, 'package.json'), 'utf-8');
    expect(JSON.parse(pkgContent).name).toBe('test-app');

    const testContent = readFileSync(join(dir, 'tests/users.test.js'), 'utf-8');
    expect(testContent).toContain('test');
  });

  it('중첩 디렉토리 구조 → 정확한 경로에 기록', async () => {
    const dir = createTempDir();
    const result = await materializeCode(NESTED_DIR_OUTPUT, dir);

    expect(result.materializedCount).toBe(3);
    expect(existsSync(join(dir, 'src/controllers/auth/login.js'))).toBe(true);
    expect(existsSync(join(dir, 'src/controllers/auth/register.js'))).toBe(true);
    expect(existsSync(join(dir, 'src/middleware/auth.js'))).toBe(true);

    const loginContent = readFileSync(join(dir, 'src/controllers/auth/login.js'), 'utf-8');
    expect(loginContent).toContain('login');
  });

  it('배치 기록 → 여러 태스크 출력 일괄 처리', async () => {
    const dir = createTempDir();
    const taskOutputs = [
      { taskId: 'task-1', output: SINGLE_FILE_OUTPUT },
      { taskId: 'task-2', output: NESTED_DIR_OUTPUT },
      { taskId: 'task-3', output: TEXT_ONLY_OUTPUT },
    ];

    const result = await materializeBatch(taskOutputs, dir);

    expect(result.results).toHaveLength(3);
    expect(result.totalFiles).toBe(4); // 1 + 3 + 0
    expect(result.results[0].result.materializedCount).toBe(1);
    expect(result.results[1].result.materializedCount).toBe(3);
    expect(result.results[2].result.materializedCount).toBe(0);
  });
});

// --- 시나리오 2: 검증 성공 → 기록 ---

describe('E2E: verifyAndMaterialize', () => {
  const tempDirs = [];

  afterEach(() => {
    for (const dir of tempDirs) {
      cleanup(dir);
    }
    tempDirs.length = 0;
  });

  function createTempDir() {
    const dir = mkdtempSync(join(tmpdir(), 'gvc-e2e-vam-'));
    tempDirs.push(dir);
    return dir;
  }

  it('검증 성공 → 파일 기록 확인', async () => {
    const dir = createTempDir();
    const md = '결과:\n```javascript src/utils.js\nconst sum = (a, b) => a + b;\n```';
    const task = { id: 'task-1', projectType: 'cli-tool' };

    const result = await verifyAndMaterialize(md, task, dir);

    expect(result.verified).toBe(true);
    expect(result.materializeResult.materializedCount).toBe(1);
    expect(existsSync(join(dir, 'src/utils.js'))).toBe(true);

    const content = readFileSync(join(dir, 'src/utils.js'), 'utf-8');
    expect(content).toContain('sum');
  });

  // --- 시나리오 3: 검증 실패 → 미기록 ---

  it('검증 실패 → 프로젝트에 파일 없음, tempDir 보존', async () => {
    const dir = createTempDir();
    const md = '결과:\n```javascript src/broken.js\nconst x = {{\n```';
    const task = { id: 'task-1', projectType: 'cli-tool' };

    const result = await verifyAndMaterialize(md, task, dir);

    expect(result.verified).toBe(false);
    expect(result.materializeResult).toBeUndefined();
    expect(existsSync(join(dir, 'src/broken.js'))).toBe(false);

    // tempDir 보존 (디버깅용)
    if (result.tempDir) {
      expect(existsSync(result.tempDir)).toBe(true);
      cleanup(result.tempDir);
    }
  });

  it('다중 파일 검증+기록 → 모두 성공', async () => {
    const dir = createTempDir();
    const md = [
      '```javascript src/a.js\nconst a = 1;\n```',
      '```javascript src/b.js\nconst b = 2;\n```',
      '```javascript src/c.js\nconst c = 3;\n```',
    ].join('\n');
    const task = { id: 'task-1', projectType: 'cli-tool' };

    const result = await verifyAndMaterialize(md, task, dir);

    expect(result.verified).toBe(true);
    expect(result.materializeResult.materializedCount).toBe(3);
    expect(existsSync(join(dir, 'src/a.js'))).toBe(true);
    expect(existsSync(join(dir, 'src/b.js'))).toBe(true);
    expect(existsSync(join(dir, 'src/c.js'))).toBe(true);
  });
});

// --- 시나리오 4-5: 강화 품질 게이트 ---

describe('E2E: 강화된 품질 게이트', () => {
  const approvedReviews = [
    { verdict: 'approve', issues: [] },
    { verdict: 'approve', issues: [{ severity: 'minor', description: '네이밍 개선' }] },
  ];

  const rejectedReviews = [
    { verdict: 'approve', issues: [] },
    { verdict: 'request-changes', issues: [{ severity: 'critical', description: '보안 취약점' }] },
  ];

  it('리뷰 approve + 검증 통과 → passed: true', () => {
    const executionResult = { verified: true };
    const result = checkEnhancedQualityGate(approvedReviews, executionResult);

    expect(result.passed).toBe(true);
  });

  it('리뷰 approve + 검증 실패 → passed: false', () => {
    const executionResult = { verified: false };
    const result = checkEnhancedQualityGate(approvedReviews, executionResult);

    expect(result.passed).toBe(false);
  });

  it('리뷰 reject → passed: false (검증 결과 무관)', () => {
    const executionResult = { verified: true };
    const result = checkEnhancedQualityGate(rejectedReviews, executionResult);

    expect(result.passed).toBe(false);
  });
});

// --- 시나리오 6: Phase 전체 사이클 ---

describe('E2E: Phase 전체 사이클', () => {
  const tempDirs = [];

  afterEach(() => {
    for (const dir of tempDirs) {
      cleanup(dir);
    }
    tempDirs.length = 0;
  });

  function createTempDir() {
    const dir = mkdtempSync(join(tmpdir(), 'gvc-e2e-cycle-'));
    tempDirs.push(dir);
    return dir;
  }

  it('프롬프트 → 실행 → 기록 → 리뷰 → 게이트', async () => {
    // 1. 프롬프트 생성
    const prompt = buildExecutionPrompt(CODE_TASK, BACKEND_MEMBER);
    expect(prompt).toContain('도윤');
    expect(prompt).toContain(CODE_TASK.title);

    // 2. Mock 실행 결과 (에이전트 대신 fixture 사용)
    const mockOutput = SINGLE_FILE_OUTPUT;

    // 3. 코드 태스크 판별
    expect(isCodeTask(CODE_TASK)).toBe(true);

    // 4. 검증 + 기록
    const dir = createTempDir();
    const verifyResult = await verifyAndMaterialize(mockOutput, CODE_TASK, dir);
    expect(verifyResult.verified).toBe(true);
    expect(verifyResult.materializeResult.materializedCount).toBe(1);

    // 5. 리뷰 (mock)
    const reviews = [
      { verdict: 'approve', issues: [] },
      { verdict: 'approve', issues: [{ severity: 'minor', description: '사소한 개선' }] },
    ];

    // 6. 품질 게이트
    const gateResult = checkQualityGate(reviews);
    expect(gateResult.passed).toBe(true);

    // 7. 강화 품질 게이트
    const enhancedResult = checkEnhancedQualityGate(reviews, verifyResult);
    expect(enhancedResult.passed).toBe(true);
  });
});

// --- 시나리오 7-8: CLI 커맨드 ---

describe('E2E: CLI 커맨드', () => {
  const tempDirs = [];

  afterEach(() => {
    for (const dir of tempDirs) {
      cleanup(dir);
    }
    tempDirs.length = 0;
  });

  function createTempDir() {
    const dir = mkdtempSync(join(tmpdir(), 'gvc-e2e-cli-'));
    tempDirs.push(dir);
    return dir;
  }

  it('materialize-code CLI → JSON 출력 검증', () => {
    const dir = createTempDir();
    const result = cliExec('materialize-code', {
      taskOutput: SINGLE_FILE_OUTPUT,
      projectDir: dir,
    });

    expect(result.materializedCount).toBe(1);
    expect(result.files).toHaveLength(1);
    expect(existsSync(join(dir, 'src/app.js'))).toBe(true);
  });

  it('verify-and-materialize CLI → JSON 출력 검증', () => {
    const dir = createTempDir();
    const result = cliExec('verify-and-materialize', {
      taskOutput: '결과:\n```javascript src/hello.js\nconst hello = "world";\n```',
      task: { id: 'task-1', projectType: 'cli-tool' },
      projectDir: dir,
    });

    expect(result.verified).toBe(true);
    expect(result.materializeResult.materializedCount).toBe(1);
  });

  it('extract-materializable-blocks CLI → 블록 추출', () => {
    const result = cliExec('extract-materializable-blocks', {
      taskOutput: MULTI_FILE_OUTPUT,
    });

    expect(result.blocks).toHaveLength(4);
    expect(result.blocks[0].filename).toBe('src/server.js');
  });

  it('is-code-task CLI → 코드 태스크 판별', () => {
    const codeResult = cliExec('is-code-task', { task: CODE_TASK });
    expect(codeResult.isCodeTask).toBe(true);

    const nonCodeResult = cliExec('is-code-task', { task: NON_CODE_TASK });
    expect(nonCodeResult.isCodeTask).toBe(false);
  });
});

// --- 시나리오 9: TDD 프롬프트 ---

describe('E2E: TDD 프롬프트 생성', () => {
  it('RED/GREEN/REFACTOR 포함 확인', () => {
    const prompt = buildTddExecutionPrompt(CODE_TASK, BACKEND_MEMBER);

    expect(prompt).toContain('RED');
    expect(prompt).toContain('GREEN');
    expect(prompt).toContain('REFACTOR');
    expect(prompt).toContain('.test.js');
    expect(prompt).toContain('vitest');
    expect(prompt).toContain('파일명');
  });

  it('TDD 프롬프트에 팀원 페르소나 포함', () => {
    const prompt = buildTddExecutionPrompt(CODE_TASK, BACKEND_MEMBER);

    expect(prompt).toContain(BACKEND_MEMBER.displayName);
    expect(prompt).toContain(BACKEND_MEMBER.role);
    expect(prompt).toContain(BACKEND_MEMBER.trait);
  });

  it('TDD 프롬프트에 프로젝트 유형 힌트', () => {
    const prompt = buildTddExecutionPrompt(CODE_TASK, BACKEND_MEMBER, { projectType: 'api-server' });

    expect(prompt).toContain('api-server');
  });

  it('TDD 프롬프트 CLI → JSON 출력', () => {
    const result = cliExec('tdd-execution-prompt', {
      task: CODE_TASK,
      teamMember: BACKEND_MEMBER,
      context: { testFramework: 'jest' },
    });

    expect(result.prompt).toContain('jest');
    expect(result.prompt).toContain('RED');
  });
});

// --- 시나리오 10: 수정 루프 통합 ---

describe('E2E: 수정 루프', () => {
  const tempDirs = [];

  afterEach(() => {
    for (const dir of tempDirs) {
      cleanup(dir);
    }
    tempDirs.length = 0;
  });

  function createTempDir() {
    const dir = mkdtempSync(join(tmpdir(), 'gvc-e2e-fix-'));
    tempDirs.push(dir);
    return dir;
  }

  it('검증 실패 → 수정 → 재검증 → 성공', async () => {
    const dir = createTempDir();

    // 1차 시도: 구문 오류 코드
    const brokenOutput = '```javascript src/calc.js\nconst x = {{\n```';
    const task = { id: 'task-1', projectType: 'cli-tool' };

    const firstResult = await verifyAndMaterialize(brokenOutput, task, dir);
    expect(firstResult.verified).toBe(false);
    expect(existsSync(join(dir, 'src/calc.js'))).toBe(false);

    // tempDir cleanup
    if (firstResult.tempDir) cleanup(firstResult.tempDir);

    // 2차 시도: 수정된 코드 (에이전트 수정 시뮬레이션)
    const fixedOutput = '```javascript src/calc.js\nconst x = { value: 1 };\n```';

    const secondResult = await verifyAndMaterialize(fixedOutput, task, dir);
    expect(secondResult.verified).toBe(true);
    expect(secondResult.materializeResult.materializedCount).toBe(1);
    expect(existsSync(join(dir, 'src/calc.js'))).toBe(true);

    const content = readFileSync(join(dir, 'src/calc.js'), 'utf-8');
    expect(content).toContain('value: 1');
  });
});

// --- 시나리오 11: 오케스트레이션 라운드 ---

describe('E2E: 오케스트레이션 라운드 (mock)', () => {
  it('분석 프롬프트 → mock 응답 → 리뷰 → 수렴 체크', async () => {
    const { buildAgentAnalysisPrompt, buildSynthesisPrompt, buildReviewPrompt, checkConvergence } = await import('../scripts/lib/engine/orchestrator.js');

    const project = {
      ...PROJECT_WITH_TASKS,
      team: DEFAULT_TEAM,
    };

    // 1. 분석 프롬프트 생성
    const analysisPrompt = buildAgentAnalysisPrompt(project, CTO_MEMBER, {});
    expect(analysisPrompt).toContain(CTO_MEMBER.displayName);
    expect(analysisPrompt).toContain(project.name);

    // 2. Mock 에이전트 응답
    const agentOutputs = DEFAULT_TEAM.map(member => ({
      roleId: member.roleId,
      role: member.role,
      emoji: member.emoji,
      analysis: `${member.displayName}의 분석: 이 프로젝트는 좋은 구조를 가지고 있습니다.`,
    }));

    // 3. 종합 프롬프트
    const synthesisPrompt = buildSynthesisPrompt(project, agentOutputs, 1);
    expect(synthesisPrompt).toContain('라운드 1');

    // 4. 리뷰 프롬프트
    const reviewPrompt = buildReviewPrompt(CTO_MEMBER, '종합 기획서 내용', 1);
    expect(reviewPrompt).toContain(CTO_MEMBER.displayName);

    // 5. 수렴 확인 (80% 이상 승인)
    const reviews = DEFAULT_TEAM.map(member => ({
      roleId: member.roleId,
      approved: true,
      feedback: '좋습니다',
      issues: [],
    }));

    const convergence = checkConvergence(reviews);
    expect(convergence.converged).toBe(true);
    expect(convergence.approvalRate).toBe(1.0);
  });

  it('수렴 실패 시나리오', async () => {
    const { checkConvergence } = await import('../scripts/lib/engine/orchestrator.js');

    // 5명 중 2명만 승인 (40%) → 수렴 실패
    const reviews = [
      { roleId: 'cto', approved: true, feedback: '승인', issues: [] },
      { roleId: 'backend', approved: true, feedback: '승인', issues: [] },
      { roleId: 'frontend', approved: false, feedback: '반대', issues: [{ severity: 'critical', description: 'UI 누락' }] },
      { roleId: 'qa', approved: false, feedback: '반대', issues: [{ severity: 'important', description: '테스트 부족' }] },
      { roleId: 'security', approved: false, feedback: '반대', issues: [{ severity: 'critical', description: '보안 이슈' }] },
    ];

    const convergence = checkConvergence(reviews);
    expect(convergence.converged).toBe(false);
    expect(convergence.approvalRate).toBe(0.4);
    expect(convergence.blockers.length).toBeGreaterThan(0);
  });
});

// --- 추가 E2E: isCodeTask + extractMaterializableBlocks 통합 ---

describe('E2E: isCodeTask + extractMaterializableBlocks 통합', () => {
  it('코드 태스크 → 기록 가능한 블록 → 기록', async () => {
    // 코드 태스크 확인
    expect(isCodeTask(CODE_TASK)).toBe(true);

    // 기록 가능한 블록 추출
    const blocks = extractMaterializableBlocks(TDD_OUTPUT);
    expect(blocks.length).toBe(2);
    expect(blocks[0].filename).toBe('src/calculator.test.js');
    expect(blocks[1].filename).toBe('src/calculator.js');
  });

  it('비코드 태스크 → 기록 불필요', () => {
    expect(isCodeTask(NON_CODE_TASK)).toBe(false);

    // 텍스트 전용 출력은 기록 가능한 블록 없음
    const blocks = extractMaterializableBlocks(TEXT_ONLY_OUTPUT);
    expect(blocks.length).toBe(0);
  });
});

// --- CLI 에러 경로 ---

describe('E2E: CLI 에러 경로', () => {
  function cliExecRaw(command, input) {
    try {
      execSync(`node ${CLI_PATH} ${command}`, {
        input: input ? JSON.stringify(input) : '',
        encoding: 'utf-8',
        timeout: 10_000,
      });
      return { exitCode: 0, stderr: '' };
    } catch (err) {
      return { exitCode: err.status, stderr: err.stderr || '' };
    }
  }

  it('존재하지 않는 커맨드는 exit 1과 사용 가능한 명령 목록을 반환한다', () => {
    const result = cliExecRaw('nonexistent-command-xyz');
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('사용 가능한 명령');
  });

  it('유사한 커맨드를 제안한다', () => {
    const result = cliExecRaw('build-teem');  // build-team 유사
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('혹시 이 커맨드를 찾으셨나요?');
    expect(result.stderr).toContain('build-team');
  });

  it('커맨드 없이 실행하면 사용법을 출력한다', () => {
    const result = cliExecRaw('');
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('사용법');
  });

  it('필수 필드 누락 시 INPUT_ERROR exit 2와 에러 힌트를 반환한다', () => {
    const result = cliExecRaw('create-project', {});
    expect(result.exitCode).toBe(2);
    expect(result.stderr).toContain('INPUT_ERROR');
    expect(result.stderr).toContain('💡');
  });

  it('존재하지 않는 프로젝트 조회 시 NOT_FOUND exit 3과 에러 힌트를 반환한다', () => {
    const result = cliExecRaw('get-project --id non-existent-id-xyz');
    expect(result.exitCode).toBe(3);
    expect(result.stderr).toContain('NOT_FOUND');
    expect(result.stderr).toContain('💡');
  });
});

// --- COMMAND_MAP 완전성 ---

describe('E2E: COMMAND_MAP 완전성', () => {
  it('COMMAND_MAP의 모든 커맨드가 실제 핸들러에 존재한다', async () => {
    // 14개 핸들러에서 모든 커맨드를 수집
    const handlerModules = {
      project: await import('../scripts/handlers/project.js'),
      team: await import('../scripts/handlers/team.js'),
      discussion: await import('../scripts/handlers/discussion.js'),
      execution: await import('../scripts/handlers/execution.js'),
      review: await import('../scripts/handlers/review.js'),
      build: await import('../scripts/handlers/build.js'),
      eval: await import('../scripts/handlers/eval.js'),
      auth: await import('../scripts/handlers/auth.js'),
      feedback: await import('../scripts/handlers/feedback.js'),
      infra: await import('../scripts/handlers/infra.js'),
      metrics: await import('../scripts/handlers/metrics.js'),
      template: await import('../scripts/handlers/template.js'),
      task: await import('../scripts/handlers/task.js'),
      recommendation: await import('../scripts/handlers/recommendation.js'),
    };

    const allHandlerCommands = new Set();
    for (const mod of Object.values(handlerModules)) {
      for (const cmd of Object.keys(mod.commands)) {
        allHandlerCommands.add(cmd);
      }
    }

    // cli.js의 listAllCommands() 결과 확인 (COMMAND_MAP 기반)
    const cliOutput = execSync(`node ${CLI_PATH} nonexistent-xyz 2>&1 || true`, {
      encoding: 'utf-8',
      timeout: 10_000,
    });

    // 핸들러에 있는 커맨드가 모두 COMMAND_MAP에 있는지 확인
    for (const cmd of allHandlerCommands) {
      expect(cliOutput).toContain(cmd);
    }
  });
});
