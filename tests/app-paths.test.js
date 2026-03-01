import { describe, it, expect } from 'vitest';
import {
  baseDir, projectsDir, agentOverridesDir,
  evaluationsDir, customTemplatesDir, authDir,
  claudeDir, userSkillsDir, userAgentsDir,
} from '../scripts/lib/app-paths.js';

describe('app-paths', () => {
  it('baseDir는 .claude/good-vibe를 포함한다', () => {
    expect(baseDir()).toContain('.claude');
    expect(baseDir()).toContain('good-vibe');
  });

  it('projectsDir는 baseDir 하위 projects를 가리킨다', () => {
    expect(projectsDir()).toBe(`${baseDir()}/projects`);
  });

  it('agentOverridesDir는 baseDir 하위 agent-overrides를 가리킨다', () => {
    expect(agentOverridesDir()).toBe(`${baseDir()}/agent-overrides`);
  });

  it('evaluationsDir는 baseDir 하위 evaluations를 가리킨다', () => {
    expect(evaluationsDir()).toBe(`${baseDir()}/evaluations`);
  });

  it('customTemplatesDir는 baseDir 하위 custom-templates를 가리킨다', () => {
    expect(customTemplatesDir()).toBe(`${baseDir()}/custom-templates`);
  });

  it('authDir는 baseDir와 같다', () => {
    expect(authDir()).toBe(baseDir());
  });

  it('claudeDir는 .claude를 가리킨다', () => {
    expect(claudeDir()).toContain('.claude');
    expect(claudeDir()).not.toContain('good-vibe');
  });

  it('userSkillsDir는 claudeDir 하위 skills를 가리킨다', () => {
    expect(userSkillsDir()).toBe(`${claudeDir()}/skills`);
  });

  it('userAgentsDir는 claudeDir 하위 agents를 가리킨다', () => {
    expect(userAgentsDir()).toBe(`${claudeDir()}/agents`);
  });

  it('모든 경로가 절대 경로이다', () => {
    const paths = [baseDir(), projectsDir(), agentOverridesDir(), evaluationsDir(), customTemplatesDir(), claudeDir(), userSkillsDir(), userAgentsDir()];
    for (const p of paths) {
      expect(p.startsWith('/')).toBe(true);
    }
  });
});
