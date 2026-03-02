import { describe, it, expect } from 'vitest';
import { execSync } from 'child_process';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { COMMAND_SCHEMAS, getCommandSchema, listCommandSchemas } from '../scripts/lib/command-schemas.js';

const CLI_PATH = resolve('scripts/cli.js');

// cli.js의 COMMAND_MAP 키를 정적 파싱으로 추출
function getCommandMapKeys() {
  const cliSource = readFileSync(CLI_PATH, 'utf-8');
  // COMMAND_MAP = { ... } 블록 내의 모든 'key': 'handler' 패턴 추출
  const mapMatch = cliSource.match(/const COMMAND_MAP\s*=\s*\{([\s\S]*?)\};/);
  if (!mapMatch) return [];
  const mapBlock = mapMatch[1];
  const keys = [];
  const regex = /'([a-z][\w-]*)'\s*:/g;
  let match;
  while ((match = regex.exec(mapBlock)) !== null) {
    keys.push(match[1]);
  }
  return keys;
}

describe('COMMAND_SCHEMAS 레지스트리', () => {
  it('15개 이상의 핵심 커맨드 스키마가 정의되어 있다', () => {
    const count = Object.keys(COMMAND_SCHEMAS).length;
    expect(count).toBeGreaterThanOrEqual(15);
  });

  it('각 스키마 엔트리에 필수 필드가 있다', () => {
    for (const [command, schema] of Object.entries(COMMAND_SCHEMAS)) {
      expect(schema.handler, `${command}: handler 누락`).toBeTruthy();
      expect(schema.inputMethod, `${command}: inputMethod 누락`).toBeTruthy();
      expect(['stdin', 'args', 'none'], `${command}: 유효하지 않은 inputMethod`).toContain(schema.inputMethod);
      expect(schema.input, `${command}: input 누락`).toBeTruthy();
      expect(schema.output, `${command}: output 누락`).toBeTruthy();
      expect(schema.description, `${command}: description 누락`).toBeTruthy();
    }
  });

  it('COMMAND_SCHEMAS의 모든 커맨드가 COMMAND_MAP에 존재한다', () => {
    const mapKeys = getCommandMapKeys();
    for (const command of Object.keys(COMMAND_SCHEMAS)) {
      expect(mapKeys, `${command}가 COMMAND_MAP에 없습니다`).toContain(command);
    }
  });

  it('input.type은 object이다', () => {
    for (const [command, schema] of Object.entries(COMMAND_SCHEMAS)) {
      expect(schema.input.type, `${command}: input.type이 object여야 합니다`).toBe('object');
    }
  });
});

describe('getCommandSchema', () => {
  it('존재하는 커맨드 스키마를 반환한다', () => {
    const schema = getCommandSchema('create-project');
    expect(schema).toBeTruthy();
    expect(schema.handler).toBe('project');
    expect(schema.inputMethod).toBe('stdin');
    expect(schema.description).toBeTruthy();
  });

  it('존재하지 않는 커맨드는 null을 반환한다', () => {
    expect(getCommandSchema('nonexistent-command')).toBeNull();
  });

  it('init-execution 스키마를 반환한다', () => {
    const schema = getCommandSchema('init-execution');
    expect(schema).toBeTruthy();
    expect(schema.handler).toBe('execution');
    expect(schema.input.properties.id.required).toBe(true);
  });
});

describe('listCommandSchemas', () => {
  it('핸들러별로 그룹화된 스키마를 반환한다', () => {
    const grouped = listCommandSchemas();
    expect(grouped).toBeTruthy();
    expect(typeof grouped).toBe('object');
  });

  it('project 핸들러 그룹에 create-project이 포함된다', () => {
    const grouped = listCommandSchemas();
    expect(grouped.project).toBeDefined();
    const commands = grouped.project.map(e => e.command);
    expect(commands).toContain('create-project');
  });

  it('execution 핸들러 그룹에 init-execution이 포함된다', () => {
    const grouped = listCommandSchemas();
    expect(grouped.execution).toBeDefined();
    const commands = grouped.execution.map(e => e.command);
    expect(commands).toContain('init-execution');
  });

  it('각 엔트리에 command 필드가 포함된다', () => {
    const grouped = listCommandSchemas();
    for (const entries of Object.values(grouped)) {
      for (const entry of entries) {
        expect(entry.command).toBeTruthy();
        expect(entry.handler).toBeTruthy();
      }
    }
  });
});

describe('describe-command CLI 핸들러 (e2e)', () => {
  function cliExecArgs(command) {
    return JSON.parse(
      execSync(`node ${CLI_PATH} ${command}`, {
        input: '',
        encoding: 'utf-8',
        timeout: 10_000,
      })
    );
  }

  function cliExecRaw(command) {
    try {
      const stdout = execSync(`node ${CLI_PATH} ${command}`, {
        input: '',
        encoding: 'utf-8',
        timeout: 10_000,
      });
      return { exitCode: 0, stdout, stderr: '' };
    } catch (err) {
      return { exitCode: err.status, stdout: '', stderr: err.stderr || '' };
    }
  }

  it('--command로 특정 커맨드 스키마를 조회한다', () => {
    const result = cliExecArgs('describe-command --command init-execution');
    expect(result.command).toBe('init-execution');
    expect(result.handler).toBe('execution');
    expect(result.inputMethod).toBe('stdin');
    expect(result.input).toBeTruthy();
    expect(result.output).toBeTruthy();
    expect(result.description).toBeTruthy();
  });

  it('--command 없이 호출하면 전체 스키마를 반환한다', () => {
    const result = cliExecArgs('describe-command');
    expect(result.project).toBeDefined();
    expect(result.execution).toBeDefined();
  });

  it('존재하지 않는 커맨드는 NOT_FOUND', () => {
    const result = cliExecRaw('describe-command --command nonexistent');
    expect(result.exitCode).toBe(3);
    expect(result.stderr).toContain('NOT_FOUND');
  });
});
