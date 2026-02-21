import { describe, it, expect, beforeAll } from 'vitest';
import { renderTemplate, renderString } from '../scripts/lib/template-engine.js';
import { writeFile, mkdir } from 'fs/promises';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const TEMPLATES_DIR = resolve(__dirname, '../templates');

describe('template-engine', () => {
  describe('renderString', () => {
    it('단순 변수를 치환한다', () => {
      const result = renderString('안녕하세요, {{name}}님!', { name: '개발자' });
      expect(result).toBe('안녕하세요, 개발자님!');
    });

    it('ifEquals 헬퍼가 동작한다', () => {
      const tmpl = '{{#ifEquals role "developer"}}개발자{{else}}기타{{/ifEquals}}';
      expect(renderString(tmpl, { role: 'developer' })).toBe('개발자');
      expect(renderString(tmpl, { role: 'pm' })).toBe('기타');
    });

    it('ifIncludes 헬퍼가 동작한다', () => {
      const tmpl = '{{#ifIncludes skills "tdd"}}TDD 포함{{else}}미포함{{/ifIncludes}}';
      expect(renderString(tmpl, { skills: ['tdd', 'review'] })).toBe('TDD 포함');
      expect(renderString(tmpl, { skills: ['review'] })).toBe('미포함');
    });

    it('join 헬퍼가 동작한다', () => {
      const result = renderString('{{join items ", "}}', { items: ['a', 'b', 'c'] });
      expect(result).toBe('a, b, c');
    });

    it('bullet 헬퍼가 동작한다', () => {
      const result = renderString('{{bullet items}}', { items: ['항목1', '항목2'] });
      expect(result).toBe('- 항목1\n- 항목2');
    });

    it('빈 배열에 join은 빈 문자열을 반환한다', () => {
      expect(renderString('{{join items ", "}}', { items: [] })).toBe('');
    });

    it('배열이 아닌 값에 join은 빈 문자열을 반환한다', () => {
      expect(renderString('{{join items ", "}}', { items: 'not-array' })).toBe('');
    });
  });

  describe('renderTemplate', () => {
    it('파일 기반 템플릿을 렌더링한다', async () => {
      const result = await renderTemplate('claude-md.hbs', {
        roleName: '개발자',
        roleDescription: '소프트웨어 개발',
        language: 'korean',
        workflow: ['기획', 'TDD', '구현', '검증'],
        skills: ['tdd-workflow', 'code-review'],
        agents: [{ name: 'code-reviewer', model: 'sonnet' }],
      });

      expect(result).toContain('개발자');
      expect(result).toContain('Korean');
    });

    it('존재하지 않는 템플릿은 에러를 발생시킨다', async () => {
      await expect(renderTemplate('nonexistent.hbs', {})).rejects.toThrow();
    });
  });
});
