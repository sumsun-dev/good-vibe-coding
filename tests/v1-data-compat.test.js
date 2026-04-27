/**
 * v1 영속 데이터 호환성 회귀 테스트 (PRD §8.5, §10 작업 13)
 *
 * v1 시절 만들어진 6개 영속 데이터를 v2 로더가 그대로 읽을 수 있는지 검증한다.
 * v2 메이저 릴리즈 후 기존 사용자가 데이터 손실/마이그레이션 부담 없이 갈아탈 수 있어야 한다.
 *
 * 검증 대상 (PRD §8.5):
 *   1. ~/.claude/good-vibe/projects/{id}/project.json
 *   2. ~/.claude/good-vibe/projects/{id}/journal.jsonl
 *   3. ~/.claude/good-vibe/agent-overrides/{roleId}.md  (사용자 레벨)
 *   4. {projectDir}/.good-vibe/agent-overrides/{roleId}.md  (프로젝트 레벨)
 *   5. ~/.claude/good-vibe/custom-templates/{name}.json
 *   6. ~/.claude/good-vibe/auth/auth.json
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdir, rm, writeFile } from 'fs/promises';
import { resolve } from 'path';

import {
  getProject,
  listProjects,
  setBaseDir as setProjectsBaseDir,
} from '../scripts/lib/project/project-manager.js';
import { readJournalEntries, setJournalBaseDir } from '../scripts/lib/project/journal.js';
import {
  loadAgentOverride,
  loadProjectOverride,
  listAgentOverrides,
  setOverridesDir,
} from '../scripts/lib/agent/agent-feedback.js';
import { loadTemplate, setCustomTemplatesDir } from '../scripts/lib/project/template-scaffolder.js';
import { loadAuth, setAuthDir } from '../scripts/lib/llm/auth-manager.js';
import { configure, resetConfiguration } from '../scripts/lib/core/app-paths.js';

const TMP_DIR = resolve('.tmp-test-v1-data-compat');
const PROJECTS_DIR = resolve(TMP_DIR, 'projects');
const OVERRIDES_DIR = resolve(TMP_DIR, 'agent-overrides');
const CUSTOM_TEMPLATES_DIR = resolve(TMP_DIR, 'custom-templates');
const AUTH_DIR = resolve(TMP_DIR, 'auth');
// 프로젝트 레벨 오버라이드는 projectsDir() 하위에 있어야 assertWithinRoot 검증을 통과한다.
const PROJECT_DIR_FOR_LOCAL_OVERRIDE = resolve(PROJECTS_DIR, 'sample-project');

beforeEach(async () => {
  await mkdir(TMP_DIR, { recursive: true });
  configure({ baseDir: TMP_DIR });
  setProjectsBaseDir(PROJECTS_DIR);
  setJournalBaseDir(PROJECTS_DIR);
  setOverridesDir(OVERRIDES_DIR);
  setCustomTemplatesDir(CUSTOM_TEMPLATES_DIR);
  setAuthDir(AUTH_DIR);
});

afterEach(async () => {
  resetConfiguration();
  await rm(TMP_DIR, { recursive: true, force: true });
});

/**
 * v1 시절 project.json 형태 (executionState 없는 1.0.x 초기 프로젝트).
 * journal[]을 project.json 안에 인라인으로 가졌던 시점.
 */
function buildV1ProjectFixture(projectId) {
  return {
    id: projectId,
    name: 'Telegram Bot',
    type: 'cli-app',
    description: '날씨 알림 봇',
    mode: 'quick-build',
    status: 'completed',
    team: [
      { roleId: 'cto', model: 'opus' },
      { roleId: 'backend', model: 'sonnet' },
      { roleId: 'qa', model: 'haiku' },
    ],
    document: {
      title: 'Telegram Weather Bot',
      sections: [{ heading: '아키텍처', body: 'Telegraf + OpenWeatherMap' }],
    },
    tasks: [
      {
        id: 't-1',
        title: 'Bot 셋업',
        assignee: 'backend',
        phase: 1,
        status: 'completed',
      },
    ],
    journal: [
      { type: 'project-created', timestamp: 1700000000000, projectId },
      { type: 'phase-started', timestamp: 1700000001000, phase: 1 },
      { type: 'phase-completed', timestamp: 1700000002000, phase: 1 },
    ],
    createdAt: '2025-12-01T10:00:00.000Z',
    updatedAt: '2025-12-01T11:30:00.000Z',
  };
}

describe('v1 영속 데이터 호환성 — §8.5 회귀 테스트', () => {
  describe('1. project.json (v1 포맷)', () => {
    it('v1 시절 project.json을 v2 getProject가 모든 핵심 필드 보존하여 읽는다', async () => {
      const projectId = 'telegram-bot-2025-12-abc123def456';
      const fixture = buildV1ProjectFixture(projectId);
      const projectDir = resolve(PROJECTS_DIR, projectId);
      await mkdir(projectDir, { recursive: true });
      await writeFile(
        resolve(projectDir, 'project.json'),
        JSON.stringify(fixture, null, 2),
        'utf-8',
      );

      const loaded = await getProject(projectId);

      expect(loaded).not.toBeNull();
      expect(loaded.id).toBe(projectId);
      expect(loaded.name).toBe('Telegram Bot');
      expect(loaded.mode).toBe('quick-build');
      expect(loaded.status).toBe('completed');
      expect(loaded.team).toHaveLength(3);
      expect(loaded.team[0].roleId).toBe('cto');
      expect(loaded.document.title).toBe('Telegram Weather Bot');
      expect(loaded.tasks).toHaveLength(1);
      expect(loaded.createdAt).toBe('2025-12-01T10:00:00.000Z');
    });

    it('listProjects가 v1 fixture를 정상 열거한다', async () => {
      const projectId = 'sample-2025-12-aabbccddeeff';
      const fixture = buildV1ProjectFixture(projectId);
      const projectDir = resolve(PROJECTS_DIR, projectId);
      await mkdir(projectDir, { recursive: true });
      await writeFile(
        resolve(projectDir, 'project.json'),
        JSON.stringify(fixture, null, 2),
        'utf-8',
      );

      const items = await listProjects();

      expect(items.length).toBeGreaterThanOrEqual(1);
      expect(items.find((p) => p.id === projectId)).toBeDefined();
    });
  });

  describe('2. journal.jsonl (v1 라인 포맷)', () => {
    it('v1 시절 jsonl 파일의 라인을 readJournalEntries가 그대로 읽는다', async () => {
      const projectId = 'jsonl-fixture-2025-12-112233445566';
      const projectDir = resolve(PROJECTS_DIR, projectId);
      await mkdir(projectDir, { recursive: true });
      const lines = [
        JSON.stringify({ type: 'project-created', timestamp: 1700000000000, projectId }),
        JSON.stringify({ type: 'phase-started', timestamp: 1700000001000, phase: 1 }),
        JSON.stringify({ type: 'agent-call', timestamp: 1700000001500, role: 'cto' }),
        JSON.stringify({ type: 'phase-completed', timestamp: 1700000002000, phase: 1 }),
      ].join('\n');
      await writeFile(resolve(projectDir, 'journal.jsonl'), lines + '\n', 'utf-8');

      const entries = await readJournalEntries(projectId);

      expect(entries).toHaveLength(4);
      expect(entries[0].type).toBe('project-created');
      expect(entries[3].phase).toBe(1);
      expect(entries.every((e) => typeof e.timestamp === 'number')).toBe(true);
    });

    it('손상된 라인이 섞여 있어도 graceful skip 하며 정상 라인은 유지한다', async () => {
      const projectId = 'corrupted-2025-12-aabbccddee01';
      const projectDir = resolve(PROJECTS_DIR, projectId);
      await mkdir(projectDir, { recursive: true });
      const content = [
        JSON.stringify({ type: 'good-1', timestamp: 1700000000000 }),
        '{ this is not json',
        '',
        JSON.stringify({ type: 'good-2', timestamp: 1700000001000 }),
      ].join('\n');
      await writeFile(resolve(projectDir, 'journal.jsonl'), content, 'utf-8');

      const entries = await readJournalEntries(projectId);

      expect(entries).toHaveLength(2);
      expect(entries.map((e) => e.type)).toEqual(['good-1', 'good-2']);
    });

    it('project.json + journal.jsonl 동시 존재 시 jsonl이 우선되고 hydrate된다', async () => {
      const projectId = 'hydrate-2025-12-deadbeefcafe';
      const projectDir = resolve(PROJECTS_DIR, projectId);
      await mkdir(projectDir, { recursive: true });
      // project.json journal[]은 v1 인라인 (구버전)
      const fixture = buildV1ProjectFixture(projectId);
      await writeFile(
        resolve(projectDir, 'project.json'),
        JSON.stringify(fixture, null, 2),
        'utf-8',
      );
      // jsonl이 신규 source of truth — 다른 내용으로 덮어씀
      const newerLines = [
        JSON.stringify({ type: 'newer-event', timestamp: 1700000099000, source: 'jsonl' }),
      ].join('\n');
      await writeFile(resolve(projectDir, 'journal.jsonl'), newerLines + '\n', 'utf-8');

      const loaded = await getProject(projectId);

      expect(loaded.executionState?.journal).toBeDefined();
      expect(loaded.executionState.journal).toHaveLength(1);
      expect(loaded.executionState.journal[0].type).toBe('newer-event');
      expect(loaded.executionState.journal[0].source).toBe('jsonl');
    });
  });

  describe('3. agent-overrides/*.md (사용자 레벨)', () => {
    it('v1 시절 마크다운 오버라이드를 loadAgentOverride가 그대로 반환한다', async () => {
      await mkdir(OVERRIDES_DIR, { recursive: true });
      const content = [
        '# CTO Override',
        '',
        '## 추가 가이드',
        '- 모든 결정은 보안 영향 평가를 거친다',
        '- TDD를 강제한다',
      ].join('\n');
      await writeFile(resolve(OVERRIDES_DIR, 'cto.md'), content, 'utf-8');

      const loaded = await loadAgentOverride('cto');

      expect(loaded).toBe(content);
    });

    it('listAgentOverrides가 v1 fixture를 모두 enumerate한다', async () => {
      await mkdir(OVERRIDES_DIR, { recursive: true });
      await writeFile(resolve(OVERRIDES_DIR, 'cto.md'), '# CTO', 'utf-8');
      await writeFile(resolve(OVERRIDES_DIR, 'qa.md'), '# QA', 'utf-8');
      await writeFile(resolve(OVERRIDES_DIR, 'security.md'), '# Security', 'utf-8');

      const items = await listAgentOverrides();

      expect(items).toHaveLength(3);
      expect(items.map((i) => i.roleId).sort()).toEqual(['cto', 'qa', 'security']);
      expect(items.every((i) => typeof i.updatedAt === 'string')).toBe(true);
    });
  });

  describe('4. {projectDir}/.good-vibe/agent-overrides/*.md (프로젝트 레벨)', () => {
    it('프로젝트 레벨 오버라이드를 loadProjectOverride가 정상 읽는다', async () => {
      const localOverridesDir = resolve(
        PROJECT_DIR_FOR_LOCAL_OVERRIDE,
        '.good-vibe',
        'agent-overrides',
      );
      await mkdir(localOverridesDir, { recursive: true });
      const content = '# Backend (project-local)\n\n- 이 프로젝트만의 지침';
      await writeFile(resolve(localOverridesDir, 'backend.md'), content, 'utf-8');

      const loaded = await loadProjectOverride(PROJECT_DIR_FOR_LOCAL_OVERRIDE, 'backend');

      expect(loaded).toBe(content);
    });
  });

  describe('5. custom-templates/*.json', () => {
    it('v1 시절 커스텀 템플릿 JSON을 loadTemplate이 그대로 반환한다', async () => {
      await mkdir(CUSTOM_TEMPLATES_DIR, { recursive: true });
      const template = {
        name: 'my-bot',
        displayName: 'My Custom Bot',
        version: '1.0.0',
        files: [
          { path: 'package.json', content: '{"name": "{{name}}"}' },
          { path: 'src/index.js', content: 'console.log("hello");' },
        ],
      };
      await writeFile(
        resolve(CUSTOM_TEMPLATES_DIR, 'my-bot.json'),
        JSON.stringify(template, null, 2),
        'utf-8',
      );

      const loaded = await loadTemplate('my-bot');

      expect(loaded.name).toBe('my-bot');
      expect(loaded.displayName).toBe('My Custom Bot');
      expect(loaded.files).toHaveLength(2);
      expect(loaded.files[0].path).toBe('package.json');
    });

    it('커스텀이 없으면 built-in으로 fallback한다 (v1과 동일 동작 보장)', async () => {
      // 커스텀 디렉토리는 비워둠
      await mkdir(CUSTOM_TEMPLATES_DIR, { recursive: true });

      const loaded = await loadTemplate('next-app');

      expect(loaded).toBeDefined();
      expect(loaded.name).toBe('next-app');
      expect(Array.isArray(loaded.files)).toBe(true);
    });
  });

  describe('6. auth/auth.json (멀티프로바이더 크레덴셜)', () => {
    it('v1 시절 auth.json을 loadAuth가 프로바이더별로 반환한다', async () => {
      await mkdir(AUTH_DIR, { recursive: true });
      const credentials = {
        claude: { type: 'api-key', apiKey: 'sk-ant-test-001' },
        openai: { type: 'api-key', apiKey: 'sk-test-openai-002' },
        gemini: { type: 'cli', cliPath: '/usr/local/bin/gemini' },
      };
      await writeFile(
        resolve(AUTH_DIR, 'auth.json'),
        JSON.stringify(credentials, null, 2),
        'utf-8',
      );

      const claude = await loadAuth('claude');
      const openai = await loadAuth('openai');
      const gemini = await loadAuth('gemini');
      const missing = await loadAuth('unknown-provider');

      expect(claude).toEqual({ type: 'api-key', apiKey: 'sk-ant-test-001' });
      expect(openai).toEqual({ type: 'api-key', apiKey: 'sk-test-openai-002' });
      expect(gemini).toEqual({ type: 'cli', cliPath: '/usr/local/bin/gemini' });
      expect(missing).toBeNull();
    });

    it('auth.json이 없으면 loadAuth가 null을 반환한다 (graceful)', async () => {
      // AUTH_DIR 자체를 만들지 않음
      const loaded = await loadAuth('claude');
      expect(loaded).toBeNull();
    });
  });
});
