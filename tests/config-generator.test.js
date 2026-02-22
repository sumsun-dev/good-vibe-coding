import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { generateConfig, generateAndWriteConfig, buildOrchestrationData, getAgentTools, loadAndMergePresets } from '../scripts/lib/config-generator.js';
import { rm, mkdir, readFile } from 'fs/promises';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const TMP_DIR = resolve(__dirname, '../.tmp-test-config');

describe('config-generator', () => {
  beforeEach(async () => {
    await mkdir(TMP_DIR, { recursive: true });
  });

  afterEach(async () => {
    await rm(TMP_DIR, { recursive: true, force: true });
  });

  describe('generateConfig', () => {
    it('developer 역할의 설정을 생성한다', async () => {
      const result = await generateConfig({
        role: 'developer',
        targetDir: TMP_DIR,
      });

      expect(result.role).toBe('개발자');
      expect(result.filesGenerated).toContain(resolve(TMP_DIR, 'CLAUDE.md'));
      expect(result.filesGenerated).toContain(resolve(TMP_DIR, 'rules', 'core.md'));
      expect(result.preset.skills).toContain('tdd-workflow');
      expect(result.preset.skills).toContain('code-review');
    });

    it('pm 역할의 설정을 생성한다', async () => {
      const result = await generateConfig({
        role: 'pm',
        targetDir: TMP_DIR,
      });

      expect(result.role).toBe('PM / 기획자');
      expect(result.preset.skills).toContain('prd-writer');
    });

    it('designer 역할의 설정을 생성한다', async () => {
      const result = await generateConfig({
        role: 'designer',
        targetDir: TMP_DIR,
      });

      expect(result.role).toBe('디자이너');
      expect(result.preset.skills).toContain('design-system');
      expect(result.preset.agents[0].template).toBe('accessibility-checker');
    });

    it('researcher 역할의 설정을 생성한다', async () => {
      const result = await generateConfig({
        role: 'researcher',
        targetDir: TMP_DIR,
      });

      expect(result.role).toBe('리서처 / 분석가');
      expect(result.preset.agents[0].template).toBe('data-analyst-kr');
    });

    it('content-creator 역할의 설정을 생성한다', async () => {
      const result = await generateConfig({
        role: 'content-creator',
        targetDir: TMP_DIR,
      });

      expect(result.role).toBe('콘텐츠 크리에이터');
      expect(result.preset.agents[0].template).toBe('content-editor-kr');
    });

    it('student 역할의 설정을 생성한다', async () => {
      const result = await generateConfig({
        role: 'student',
        targetDir: TMP_DIR,
      });

      expect(result.role).toBe('학생 / 입문자');
      expect(result.preset.agents[0].template).toBe('mentor-kr');
    });

    it('developer + nextjs-supabase 스택 병합 설정을 생성한다', async () => {
      const result = await generateConfig({
        role: 'developer',
        stack: 'nextjs-supabase',
        targetDir: TMP_DIR,
      });

      expect(result.role).toBe('개발자');
      expect(result.preset.stackRules).toBeInstanceOf(Array);
      expect(result.preset.stackRules.length).toBeGreaterThan(0);
      expect(result.preset.stackRules).toContain('Next.js App Router 사용 (app/ 디렉토리 구조)');
    });

    it('developer + nextjs-supabase 스택을 파일로 쓰면 Stack 섹션이 포함된다', async () => {
      await generateAndWriteConfig(
        { role: 'developer', stack: 'nextjs-supabase', targetDir: TMP_DIR },
        { overwrite: true, backup: false }
      );

      const claudeMd = await readFile(resolve(TMP_DIR, 'CLAUDE.md'), 'utf-8');
      expect(claudeMd).toContain('Stack: Next.js + Supabase');
      expect(claudeMd).toContain('Stack Rules');

      const coreRules = await readFile(resolve(TMP_DIR, 'rules', 'core.md'), 'utf-8');
      expect(coreRules).toContain('Stack Rules');
    });

    it('존재하지 않는 역할은 에러를 발생시킨다', async () => {
      await expect(generateConfig({
        role: 'nonexistent',
        targetDir: TMP_DIR,
      })).rejects.toThrow();
    });

    it('존재하지 않는 스택 프리셋은 무시한다', async () => {
      const result = await generateConfig({
        role: 'developer',
        stack: 'nonexistent-stack',
        targetDir: TMP_DIR,
      });

      expect(result.role).toBe('개발자');
      expect(result.preset.stackRules).toEqual([]);
    });

    it('preset에 agents 정보가 포함된다', async () => {
      const result = await generateConfig({
        role: 'developer',
        targetDir: TMP_DIR,
      });

      expect(result.preset.agents.length).toBeGreaterThan(0);
      expect(result.preset.agents[0].template).toBe('code-reviewer-kr');
    });
  });

  describe('agent files', () => {
    it('developer 역할 생성 시 agent .md 파일이 포함된다', async () => {
      const result = await generateConfig({
        role: 'developer',
        targetDir: TMP_DIR,
      });

      expect(result.filesGenerated).toContain(resolve(TMP_DIR, 'agents', 'code-reviewer-kr.md'));
      expect(result.filesGenerated).toContain(resolve(TMP_DIR, 'agents', 'tdd-coach-kr.md'));
    });

    it('생성된 agent 파일에 YAML frontmatter가 포함된다', async () => {
      await generateAndWriteConfig(
        { role: 'developer', targetDir: TMP_DIR },
        { overwrite: true, backup: false }
      );

      const agentMd = await readFile(resolve(TMP_DIR, 'agents', 'code-reviewer-kr.md'), 'utf-8');
      expect(agentMd).toMatch(/^---\r?\n/);
      expect(agentMd).toContain('name: code-reviewer-kr');
      expect(agentMd).toContain('model: sonnet');
      expect(agentMd).toContain('tools: Read, Grep, Glob, Bash');
    });

    it('agent 파일에 personality가 반영된다', async () => {
      await generateAndWriteConfig(
        { role: 'developer', personalities: { 'code-reviewer-kr': 'friendly' }, targetDir: TMP_DIR },
        { overwrite: true, backup: false }
      );

      const agentMd = await readFile(resolve(TMP_DIR, 'agents', 'code-reviewer-kr.md'), 'utf-8');
      expect(agentMd).toContain('서준');
      expect(agentMd).toContain('🤝');
    });

    it('agent 파일에 plugin의 기술 지시사항이 포함된다', async () => {
      await generateAndWriteConfig(
        { role: 'developer', targetDir: TMP_DIR },
        { overwrite: true, backup: false }
      );

      const agentMd = await readFile(resolve(TMP_DIR, 'agents', 'code-reviewer-kr.md'), 'utf-8');
      expect(agentMd).toContain('리뷰 체크리스트');
      expect(agentMd).toContain('보안');
    });

    it('pm 역할 생성 시 doc-reviewer-kr agent 파일이 생성된다', async () => {
      const result = await generateConfig({
        role: 'pm',
        targetDir: TMP_DIR,
      });

      expect(result.filesGenerated).toContain(resolve(TMP_DIR, 'agents', 'doc-reviewer-kr.md'));
    });

    it('student 역할 생성 시 mentor-kr agent 파일이 생성된다', async () => {
      await generateAndWriteConfig(
        { role: 'student', targetDir: TMP_DIR },
        { overwrite: true, backup: false }
      );

      const agentMd = await readFile(resolve(TMP_DIR, 'agents', 'mentor-kr.md'), 'utf-8');
      expect(agentMd).toContain('name: mentor-kr');
      expect(agentMd).toContain('model: haiku');
      expect(agentMd).toContain('tools: Read, Grep, Glob');
    });
  });

  describe('orchestration', () => {
    it('CLAUDE.md에 Team Orchestration 섹션이 포함된다', async () => {
      await generateAndWriteConfig(
        { role: 'developer', targetDir: TMP_DIR },
        { overwrite: true, backup: false }
      );

      const claudeMd = await readFile(resolve(TMP_DIR, 'CLAUDE.md'), 'utf-8');
      expect(claudeMd).toContain('Team Orchestration');
      expect(claudeMd).toContain('subagent_type="code-reviewer-kr"');
      expect(claudeMd).toContain('subagent_type="tdd-coach-kr"');
    });

    it('orchestration 테이블에 팀원 persona가 반영된다', async () => {
      await generateAndWriteConfig(
        { role: 'developer', targetDir: TMP_DIR },
        { overwrite: true, backup: false }
      );

      const claudeMd = await readFile(resolve(TMP_DIR, 'CLAUDE.md'), 'utf-8');
      expect(claudeMd).toContain('준영');
      expect(claudeMd).toContain('코드 리뷰어');
      expect(claudeMd).toContain('🔍');
    });

    it('자동 위임 워크플로우 목록이 포함된다', async () => {
      await generateAndWriteConfig(
        { role: 'developer', targetDir: TMP_DIR },
        { overwrite: true, backup: false }
      );

      const claudeMd = await readFile(resolve(TMP_DIR, 'CLAUDE.md'), 'utf-8');
      expect(claudeMd).toContain('자동 위임 워크플로우');
      expect(claudeMd).toContain('테스트 설계');
      expect(claudeMd).toContain('코드 리뷰');
    });
  });

  describe('team personalities', () => {
    it('personalities 선택을 포함하여 Your Team 섹션을 생성한다', async () => {
      await generateAndWriteConfig(
        {
          role: 'developer',
          personalities: { 'code-reviewer-kr': 'friendly' },
          targetDir: TMP_DIR,
        },
        { overwrite: true, backup: false }
      );

      const claudeMd = await readFile(resolve(TMP_DIR, 'CLAUDE.md'), 'utf-8');
      expect(claudeMd).toContain('Your Team');
      expect(claudeMd).toContain('서준');
      expect(claudeMd).toContain('🤝');
    });

    it('personalities 선택 없이도 기본값으로 Your Team을 생성한다', async () => {
      await generateAndWriteConfig(
        { role: 'developer', targetDir: TMP_DIR },
        { overwrite: true, backup: false }
      );

      const claudeMd = await readFile(resolve(TMP_DIR, 'CLAUDE.md'), 'utf-8');
      expect(claudeMd).toContain('Your Team');
      expect(claudeMd).toContain('준영');
      expect(claudeMd).toContain('🔍');
    });
  });

  describe('buildOrchestrationData', () => {
    it('enabled=true일 때 team 정보를 병합한다', () => {
      const orchestration = {
        enabled: true,
        steps: [
          { agent: 'code-reviewer-kr', trigger: '코드 리뷰 요청 시' },
        ],
      };
      const team = [
        { agentName: 'code-reviewer-kr', displayName: '준영', role: '코드 리뷰어', emoji: '🔍' },
      ];

      const result = buildOrchestrationData(orchestration, team);

      expect(result.enabled).toBe(true);
      expect(result.steps).toHaveLength(1);
      expect(result.steps[0].agentDisplayName).toBe('준영');
      expect(result.steps[0].agentRole).toBe('코드 리뷰어');
      expect(result.steps[0].agentEmoji).toBe('🔍');
    });

    it('enabled=false일 때 비활성 데이터를 반환한다', () => {
      const result = buildOrchestrationData({ enabled: false }, []);
      expect(result).toEqual({ enabled: false, steps: [] });
    });

    it('orchestration이 undefined이면 비활성 데이터를 반환한다', () => {
      const result = buildOrchestrationData(undefined, []);
      expect(result).toEqual({ enabled: false, steps: [] });
    });

    it('team에 없는 agent는 fallback 값을 사용한다', () => {
      const orchestration = {
        enabled: true,
        steps: [{ agent: 'unknown-agent', trigger: 'test' }],
      };
      const team = [];

      const result = buildOrchestrationData(orchestration, team);

      expect(result.steps[0].agentDisplayName).toBe('unknown-agent');
      expect(result.steps[0].agentRole).toBe('unknown-agent');
      expect(result.steps[0].agentEmoji).toBe('🤖');
    });
  });

  describe('getAgentTools', () => {
    it('config.tools가 존재하면 해당 배열을 반환한다', () => {
      const agents = [
        { template: 'code-reviewer-kr', config: { tools: ['Read', 'Grep', 'Glob', 'Bash'] } },
      ];
      expect(getAgentTools(agents, 'code-reviewer-kr')).toEqual(['Read', 'Grep', 'Glob', 'Bash']);
    });

    it('config.tools가 없으면 기본값을 반환한다', () => {
      const agents = [{ template: 'mentor-kr', config: { model: 'haiku' } }];
      expect(getAgentTools(agents, 'mentor-kr')).toEqual(['Read', 'Grep', 'Glob']);
    });

    it('에이전트를 찾지 못하면 기본값을 반환한다', () => {
      expect(getAgentTools([], 'nonexistent')).toEqual(['Read', 'Grep', 'Glob']);
    });
  });

  describe('loadAndMergePresets', () => {
    it('role만 지정하면 stackPreset=null이다', async () => {
      const { rolePreset, stackPreset, merged } = await loadAndMergePresets({ role: 'developer' });
      expect(rolePreset.name).toBe('developer');
      expect(stackPreset).toBeNull();
      expect(merged.agents.length).toBeGreaterThan(0);
    });

    it('role + stack을 병합한다', async () => {
      const { rolePreset, stackPreset, merged } = await loadAndMergePresets({
        role: 'developer',
        stack: 'nextjs-supabase',
      });
      expect(rolePreset.name).toBe('developer');
      expect(stackPreset.name).toBe('nextjs-supabase');
      expect(merged.stackRules.length).toBeGreaterThan(0);
    });

    it('존재하지 않는 stack은 무시한다', async () => {
      const { stackPreset, merged } = await loadAndMergePresets({
        role: 'developer',
        stack: 'nonexistent-stack',
      });
      expect(stackPreset).toBeNull();
      expect(merged.stackRules).toEqual([]);
    });
  });
});
