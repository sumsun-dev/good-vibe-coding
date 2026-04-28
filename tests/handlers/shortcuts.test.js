/**
 * install-shortcuts / uninstall-shortcuts 핸들러 E2E 테스트.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { execSync } from 'child_process';
import { mkdir, rm, readFile, writeFile, readdir } from 'fs/promises';
import { resolve } from 'path';

const CLI_PATH = resolve('scripts/cli.js');
const TMP_DIR = resolve('.tmp-test-shortcuts-handler');
const TARGET_DIR = resolve(TMP_DIR, 'commands');

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
      timeout: 10_000,
    }),
  );
}

function execRaw(command, input) {
  try {
    const stdout = execSync(`node ${CLI_PATH} ${command}`, {
      input: input !== undefined ? JSON.stringify(input) : '',
      encoding: 'utf-8',
      timeout: 10_000,
    });
    return { exitCode: 0, stdout, stderr: '' };
  } catch (err) {
    return { exitCode: err.status, stdout: '', stderr: err.stderr || '' };
  }
}

describe('handlers/infra — install-shortcuts E2E', () => {
  it('targetDir 지정 시 8개 파일을 작성하고 success 응답', async () => {
    const r = exec('install-shortcuts', { targetDir: TARGET_DIR });
    expect(r.success).toBe(true);
    expect(r.installed).toHaveLength(8);
    expect(r.skipped).toHaveLength(0);
    const files = await readdir(TARGET_DIR);
    expect(files.filter((f) => f.endsWith('.md'))).toHaveLength(8);
  });

  it('각 래퍼는 description, targetSkill, $ARGUMENTS 포함', async () => {
    exec('install-shortcuts', { targetDir: TARGET_DIR });
    const gv = await readFile(resolve(TARGET_DIR, 'gv.md'), 'utf-8');
    expect(gv).toContain('good-vibe:gv');
    expect(gv).toContain('$ARGUMENTS');
    expect(gv).toContain('description:');
  });

  it('두 번째 호출은 멱등 (모두 skip)', async () => {
    exec('install-shortcuts', { targetDir: TARGET_DIR });
    const r2 = exec('install-shortcuts', { targetDir: TARGET_DIR });
    expect(r2.installed).toHaveLength(0);
    expect(r2.skipped).toHaveLength(8);
    expect(r2.skipped[0].reason).toBe('already-installed');
  });

  it('force=true 면 덮어쓰기', async () => {
    exec('install-shortcuts', { targetDir: TARGET_DIR });
    await writeFile(resolve(TARGET_DIR, 'gv.md'), 'tampered', 'utf-8');
    const r = exec('install-shortcuts', { targetDir: TARGET_DIR, force: true });
    expect(r.installed).toHaveLength(8);
    const content = await readFile(resolve(TARGET_DIR, 'gv.md'), 'utf-8');
    expect(content).toContain('good-vibe:gv');
  });

  it('targetDir이 homedir() 바깥이면 INPUT_ERROR (path traversal 차단)', () => {
    const r = execRaw('install-shortcuts', { targetDir: '/etc/foo' });
    expect(r.exitCode).toBe(2);
    expect(r.stderr).toMatch(/targetDir/);
  });

  it('uninstall-shortcuts → 우리가 설치한 파일만 제거', async () => {
    exec('install-shortcuts', { targetDir: TARGET_DIR });
    await writeFile(resolve(TARGET_DIR, 'gv-status.md'), '# user override', 'utf-8');
    const r = exec('uninstall-shortcuts', { targetDir: TARGET_DIR });
    expect(r.success).toBe(true);
    expect(r.removed.length).toBeGreaterThan(0);
    expect(r.preserved).toContainEqual(
      expect.objectContaining({ name: 'gv-status', reason: 'not-owned' }),
    );
    const userFile = await readFile(resolve(TARGET_DIR, 'gv-status.md'), 'utf-8');
    expect(userFile).toBe('# user override');
  });
});
