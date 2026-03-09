import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../scripts/cli-utils.js', () => ({
  readStdin: vi.fn(),
  output: vi.fn(),
}));

vi.mock('fs/promises', () => ({
  readFile: vi.fn(),
}));

import { readStdin, output } from '../../scripts/cli-utils.js';
import { readFile } from 'fs/promises';
import { commands } from '../../scripts/handlers/learn.js';

describe('learn handler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('list-guides', () => {
    it('카테고리와 guideMap을 반환해야 한다', async () => {
      await commands['list-guides']();
      expect(output).toHaveBeenCalledTimes(1);

      const result = output.mock.calls[0][0];
      expect(result.categories).toBeInstanceOf(Array);
      expect(result.categories.length).toBe(4);
      expect(result.categories[0].name).toBe('공통 기초');
      expect(result.categories[1].name).toBe('개발자 심화');
      expect(result.categories[2].name).toBe('PM/기획자 심화');
      expect(result.categories[3].name).toBe('디자이너 심화');
      expect(result.guideMap).toBeDefined();
      expect(result.guideMap['기초']).toBe('common/01-what-is-claude-code.md');
      expect(result.guideMap['TDD']).toBe('developer/tdd-workflow.md');
    });

    it('각 카테고리에 guides 배열이 있어야 한다', async () => {
      await commands['list-guides']();
      const result = output.mock.calls[0][0];
      for (const category of result.categories) {
        expect(category.guides).toBeInstanceOf(Array);
        expect(category.guides.length).toBeGreaterThan(0);
        for (const guide of category.guides) {
          expect(guide).toHaveProperty('topic');
          expect(guide).toHaveProperty('file');
          expect(guide).toHaveProperty('title');
        }
      }
    });
  });

  describe('get-guide', () => {
    it('유효한 주제로 가이드 내용을 반환해야 한다', async () => {
      const guideContent = '# Claude Code란?\n\n기초 가이드 내용입니다.';
      readStdin.mockResolvedValue({ topic: '기초' });
      readFile.mockResolvedValue(guideContent);

      await commands['get-guide']();

      expect(readFile).toHaveBeenCalledTimes(1);
      expect(output).toHaveBeenCalledWith({
        found: true,
        topic: '기초',
        file: 'common/01-what-is-claude-code.md',
        content: guideContent,
      });
    });

    it('무효한 주제로 found: false와 availableTopics를 반환해야 한다', async () => {
      readStdin.mockResolvedValue({ topic: '없는주제' });

      await commands['get-guide']();

      expect(readFile).not.toHaveBeenCalled();
      expect(output).toHaveBeenCalledTimes(1);

      const result = output.mock.calls[0][0];
      expect(result.found).toBe(false);
      expect(result.topic).toBe('없는주제');
      expect(result.availableTopics).toBeInstanceOf(Array);
      expect(result.availableTopics).toContain('기초');
      expect(result.availableTopics).toContain('TDD');
    });

    it('빈 주제로 found: false를 반환해야 한다', async () => {
      readStdin.mockResolvedValue({ topic: '' });

      await commands['get-guide']();

      const result = output.mock.calls[0][0];
      expect(result.found).toBe(false);
    });

    it('topic 필드 없이도 found: false를 반환해야 한다', async () => {
      readStdin.mockResolvedValue({});

      await commands['get-guide']();

      const result = output.mock.calls[0][0];
      expect(result.found).toBe(false);
    });

    it('파일 읽기 실패 시 에러 메시지를 반환해야 한다', async () => {
      readStdin.mockResolvedValue({ topic: '기초' });
      readFile.mockRejectedValue(new Error('ENOENT'));

      await commands['get-guide']();

      expect(output).toHaveBeenCalledWith({
        found: false,
        topic: '기초',
        file: 'common/01-what-is-claude-code.md',
        error: '가이드 파일을 찾을 수 없습니다',
      });
    });

    it('주제 앞뒤 공백을 제거해야 한다', async () => {
      readStdin.mockResolvedValue({ topic: '  TDD  ' });
      readFile.mockResolvedValue('# TDD\n가이드 내용');

      await commands['get-guide']();

      const result = output.mock.calls[0][0];
      expect(result.found).toBe(true);
      expect(result.topic).toBe('TDD');
    });
  });
});
