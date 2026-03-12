// perspective-manager.js — UX 관점 순환 관리
// Shell에서 호출: node perspective-manager.js <command> [args...]

import { readFileSync } from 'fs';

export const PERSPECTIVES = [
  {
    id: 'first-time-user',
    name: '첫 사용자',
    files: ['commands/hello.md', 'commands/new.md', 'guides/common/00-quick-start.md'],
  },
  {
    id: 'command-flow',
    name: '커맨드 플로우',
    files: ['commands/*.md', 'scripts/cli.js', 'scripts/lib/core/nl-router.js'],
  },
  {
    id: 'error-recovery',
    name: '에러 복구',
    files: ['scripts/lib/core/validators.js', 'scripts/cli.js', 'scripts/handlers/*.js'],
  },
  {
    id: 'guide-coverage',
    name: '가이드 완성도',
    files: ['guides/**/*.md', 'commands/*.md'],
  },
  {
    id: 'sdk-dx',
    name: 'SDK DX',
    files: ['src/*.js', 'plugin/adapter.js', 'package.json'],
  },
  {
    id: 'mode-confusion',
    name: '모드 혼동 방지',
    files: ['commands/new.md', 'commands/execute.md', 'CLAUDE.md'],
  },
  {
    id: 'onboarding-quality',
    name: '온보딩 품질',
    files: ['presets/**/*.json', 'templates/*.hbs', 'scripts/lib/core/onboarding-generator.js'],
  },
  {
    id: 'intermediate-user',
    name: '중급 사용자',
    files: ['commands/*.md', 'agents/*.md', 'skills/*/SKILL.md'],
  },
];

const perspectiveMap = new Map(PERSPECTIVES.map((p) => [p.id, p]));

/**
 * 실행 횟수 기반으로 현재 관점을 결정
 * 매일 1회 실행되므로 8일마다 같은 관점이 반복됨
 * @param {number} executionCount - 히스토리 카운트
 * @returns {object} PERSPECTIVES 항목
 */
export function getCurrentPerspective(executionCount) {
  const count = Number.isFinite(executionCount) && executionCount >= 0 ? executionCount : 0;
  const index = count % PERSPECTIVES.length;
  return PERSPECTIVES[index];
}

/**
 * 관점 ID로 분석 대상 파일 패턴 배열을 반환
 * @param {string} perspectiveId
 * @returns {string[]}
 */
export function getPerspectiveAnalysisFiles(perspectiveId) {
  const perspective = perspectiveMap.get(perspectiveId);
  return perspective ? [...perspective.files] : [];
}

/**
 * 관점별 히스토리 컨텍스트를 생성
 * @param {string} perspectiveId
 * @param {object[]} historyEntries - UX 히스토리 엔트리 배열
 * @returns {string}
 */
export function buildPerspectiveContext(perspectiveId, historyEntries) {
  const perspective = perspectiveMap.get(perspectiveId);
  if (!perspective) return '';

  const lines = [];
  lines.push(`## 현재 관점: ${perspective.name} (${perspective.id})`);
  lines.push('');
  lines.push('### 분석 대상 파일');
  for (const f of perspective.files) {
    lines.push(`- ${f}`);
  }

  if (!historyEntries || historyEntries.length === 0) {
    lines.push('');
    lines.push('### 이전 실행 이력');
    lines.push('이력 없음 (첫 실행)');
    return lines.join('\n');
  }

  lines.push('');
  lines.push('### 이전 실행 이력');

  const samePerspective = historyEntries.filter((e) => e.perspective === perspectiveId);
  const otherEntries = historyEntries.filter((e) => e.perspective !== perspectiveId);

  if (samePerspective.length > 0) {
    lines.push('');
    lines.push(`**동일 관점 (${perspectiveId}) 이전 결과:**`);
    for (const entry of samePerspective) {
      const cats = Array.isArray(entry.categories) ? entry.categories.join(', ') : '';
      const sla = entry.slaScore ? ` (SLA: ${entry.slaScore}/10)` : '';
      lines.push(`- ${entry.date}: ${entry.issues || 0}건 [${cats}]${sla}`);
    }
  }

  if (otherEntries.length > 0) {
    lines.push('');
    lines.push('**다른 관점 최근 결과:**');
    for (const entry of otherEntries.slice(-5)) {
      const sla = entry.slaScore ? ` (SLA: ${entry.slaScore}/10)` : '';
      lines.push(`- ${entry.date} [${entry.perspective}]: ${entry.issues || 0}건${sla}`);
    }
  }

  return lines.join('\n');
}

// CLI 진입점
if (
  typeof process !== 'undefined' &&
  process.argv[1] &&
  import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/'))
) {
  const [command, ...args] = process.argv.slice(2);

  switch (command) {
    case 'current': {
      const count = parseInt(args[0], 10) || 0;
      const perspective = getCurrentPerspective(count);
      console.log(JSON.stringify(perspective));
      break;
    }
    case 'files': {
      const id = args[0];
      const files = getPerspectiveAnalysisFiles(id);
      console.log(JSON.stringify(files));
      break;
    }
    case 'context': {
      const [id, historyFile] = args;
      let entries = [];
      if (historyFile) {
        try {
          const content = readFileSync(historyFile, 'utf-8').trim();
          if (content) {
            entries = content
              .split('\n')
              .filter((l) => l.trim())
              .map((l) => {
                try {
                  return JSON.parse(l);
                } catch {
                  return null;
                }
              })
              .filter(Boolean);
          }
        } catch {
          // 파일 없음
        }
      }
      console.log(buildPerspectiveContext(id, entries));
      break;
    }
    default:
      console.error(`Unknown command: ${command}`);
      process.exit(1);
  }
}
