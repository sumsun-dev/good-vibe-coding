/**
 * init-project + slugify-name 핸들러 E2E 테스트.
 * github: 'none' 만 검증 (gh CLI 실행 회피). github 분기는 unit 에서 모킹됨.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { execSync } from 'child_process';
import { mkdir, rm, readdir } from 'fs/promises';
import { resolve } from 'path';

const CLI_PATH = resolve('scripts/cli.js');
const TMP_DIR = resolve('.tmp-test-init-project');
const PROJECT_DIR = resolve(TMP_DIR, 'my-bot');

beforeEach(async () => {
  await rm(TMP_DIR, { recursive: true, force: true });
  await mkdir(TMP_DIR, { recursive: true });
});

afterEach(async () => {
  await rm(TMP_DIR, { recursive: true, force: true });
});

function exec(command, input) {
  return JSON.parse(
    execSync(`node ${CLI_PATH} ${command}`, {
      input: input !== undefined ? JSON.stringify(input) : '',
      encoding: 'utf-8',
      timeout: 15_000,
      env: { ...process.env, GOOD_VIBE_BASE_DIR: resolve(TMP_DIR, 'gv-store') },
    }),
  );
}

function execRaw(command, input) {
  try {
    const stdout = execSync(`node ${CLI_PATH} ${command}`, {
      input: input !== undefined ? JSON.stringify(input) : '',
      encoding: 'utf-8',
      timeout: 15_000,
      env: { ...process.env, GOOD_VIBE_BASE_DIR: resolve(TMP_DIR, 'gv-store') },
    });
    return { exitCode: 0, stdout, stderr: '' };
  } catch (err) {
    return { exitCode: err.status, stdout: '', stderr: err.stderr || '' };
  }
}

describe('handlers/infra — slugify-name E2E', () => {
  it('이름 입력 → slug 반환', () => {
    const r = exec('slugify-name', { name: 'My Cool Bot' });
    expect(r.slug).toBe('my-cool-bot');
  });

  it('한글 포함 → 한글 제거 후 영문/숫자만', () => {
    const r = exec('slugify-name', { name: 'AI 트렌딩 Bot 2026' });
    expect(r.slug).toBe('ai-bot-2026');
  });

  it('name 누락 → INPUT_ERROR', () => {
    const r = execRaw('slugify-name', {});
    expect(r.exitCode).toBe(2);
    expect(r.stderr).toMatch(/name/);
  });
});

describe('handlers/infra — init-project E2E', () => {
  it('github=none → 폴더 + Good Vibe 프로젝트 엔트리 생성', () => {
    const r = exec('init-project', {
      name: 'My Bot',
      type: 'cli-tool',
      description: '테스트 봇',
      targetDir: PROJECT_DIR,
      github: 'none',
    });
    expect(r.success).toBe(true);
    expect(r.projectId).toBeTruthy();
    expect(r.infraPath).toBe(PROJECT_DIR);
    expect(r.githubUrl).toBeNull();
    expect(r.warnings).toEqual([]);
  });

  it('생성된 폴더에 기본 scaffold 파일이 작성됨', async () => {
    exec('init-project', {
      name: 'My Bot',
      type: 'cli-tool',
      targetDir: PROJECT_DIR,
      github: 'none',
    });
    const files = await readdir(PROJECT_DIR);
    expect(files.length).toBeGreaterThan(0);
  });

  it('targetDir 누락 → INPUT_ERROR', () => {
    const r = execRaw('init-project', { name: 'X' });
    expect(r.exitCode).toBe(2);
    expect(r.stderr).toMatch(/targetDir/);
  });

  it('targetDir 이 homedir() 바깥 → INPUT_ERROR', () => {
    const r = execRaw('init-project', { name: 'X', targetDir: '/etc/foo' });
    expect(r.exitCode).toBe(2);
    expect(r.stderr).toMatch(/targetDir/);
  });
});
