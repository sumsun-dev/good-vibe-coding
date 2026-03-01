import { readFile } from 'fs/promises';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(__dirname, '../..');
const AGENTS_DIR = resolve(PROJECT_ROOT, 'agents');

/**
 * 마크다운 콘텐츠에서 "## 지시사항" 이하의 내용을 추출한다.
 * @param {string} markdownContent - 에이전트 .md 파일 내용
 * @returns {string} 지시사항 내용 (없으면 빈 문자열)
 */
export function extractInstructions(markdownContent) {
  if (!markdownContent) return '';

  const marker = '## 지시사항';
  const idx = markdownContent.indexOf(marker);
  if (idx === -1) return '';

  const afterMarker = markdownContent.slice(idx + marker.length);

  // 다음 ## 레벨 헤더를 찾는다 (### 이하는 포함)
  const nextH2 = afterMarker.search(/\n## (?!#)/);

  const content = nextH2 === -1
    ? afterMarker
    : afterMarker.slice(0, nextH2);

  return content.trim();
}

/**
 * 에이전트 배열에 대해 일괄적으로 지시사항을 추출한다.
 * @param {Array<{template: string}>} agents - 에이전트 배열
 * @returns {Promise<Record<string, string>>} 에이전트명 → 지시사항 맵
 */
export async function extractAllInstructions(agents) {
  const result = {};

  for (const agent of agents) {
    const name = agent.template;
    try {
      const filePath = resolve(AGENTS_DIR, `${name}.md`);
      const content = await readFile(filePath, 'utf-8');
      result[name] = extractInstructions(content);
    } catch {
      result[name] = '';
    }
  }

  return result;
}

