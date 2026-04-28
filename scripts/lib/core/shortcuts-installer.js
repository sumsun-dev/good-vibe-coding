/**
 * shortcuts-installer — 사용자 스코프(~/.claude/commands/)에 unprefixed 단축어 래퍼를 설치/제거.
 *
 * Claude Code 플러그인은 `{plugin}:{cmd}` 네임스페이스가 강제되어 `/good-vibe:gv` 형태로만 호출 가능.
 * 이 모듈은 사용자 폴더에 thin 래퍼 .md 파일을 작성해 `/gv` 같은 네임스페이스 없는 호출을 가능하게 함.
 * 모든 래퍼는 WRAPPER_SIGNATURE 코멘트를 포함 → uninstall 시 우리가 설치한 파일만 안전하게 제거.
 */

import { readFile, writeFile, unlink, readdir } from 'fs/promises';
import { resolve } from 'path';
import { ensureDir, fileExists } from './file-writer.js';
import { AppError } from './validators.js';

function escapeYamlDouble(value) {
  return String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

function wrapFsError(err, action) {
  if (err && err.code === 'EACCES') {
    return new AppError(
      `${action} 권한이 없습니다: ${err.path || err.message}`,
      'PERMISSION_ERROR',
    );
  }
  if (err && err.code === 'EROFS') {
    return new AppError(
      `${action} 대상이 읽기 전용입니다: ${err.path || err.message}`,
      'PERMISSION_ERROR',
    );
  }
  return err;
}

/** 우리가 작성한 래퍼임을 식별하는 서명 (uninstall 안전성) */
export const WRAPPER_SIGNATURE = '<!-- good-vibe:shortcut-wrapper -->';

/** Good Vibe 단축어 정의 — 7개 진입점 */
export const SHORTCUT_DEFINITIONS = [
  {
    name: 'gv',
    targetSkill: 'good-vibe:gv',
    description: 'Good Vibe NL 진입점 — 자연어 한 줄로 의도 분류',
    argumentHint: '<자연어 한 줄>',
  },
  {
    name: 'gv-status',
    targetSkill: 'good-vibe:gv-status',
    description: 'Good Vibe 상태/진행 조회',
  },
  {
    name: 'gv-init',
    targetSkill: 'good-vibe:gv-init',
    description: 'Good Vibe 신규 프로젝트 셋업 — 폴더 + (선택) GitHub repo + 프로젝트 엔트리',
    argumentHint: '[프로젝트 이름]',
  },
  {
    name: 'gv-execute',
    targetSkill: 'good-vibe:gv-execute',
    description: 'Good Vibe 실행 시작 — task-graph 진입점',
    argumentHint: '[interactive|semi-auto|auto]',
  },
  {
    name: 'gv-resume',
    targetSkill: 'good-vibe:gv-resume',
    description: 'Good Vibe 중단 작업 재개',
  },
  {
    name: 'gv-team',
    targetSkill: 'good-vibe:gv-team',
    description: 'Good Vibe 팀 구성 보기/편집',
  },
  {
    name: 'gv-cost',
    targetSkill: 'good-vibe:gv-cost',
    description: 'Good Vibe 비용/예산 임계 조회·설정',
    argumentHint: '[budget setting]',
  },
  {
    name: 'gv-agent-history',
    targetSkill: 'good-vibe:gv-agent-history',
    description: 'Good Vibe 에이전트 자가발전 학습 이력 + revert',
    argumentHint: '[revert]',
  },
];

/**
 * 단축어 정의로 슬래시 커맨드 .md 파일 본문을 생성한다.
 * @param {object} def - 단축어 정의 (name, targetSkill, description, argumentHint?)
 * @returns {string} 마크다운 본문
 */
export function buildWrapperContent(def) {
  const frontmatterLines = ['---', `description: "${escapeYamlDouble(def.description)}"`];
  if (def.argumentHint) {
    frontmatterLines.push(`argument-hint: "${escapeYamlDouble(def.argumentHint)}"`);
  }
  frontmatterLines.push('---');

  const argsLine = def.argumentHint ? ` with these arguments: $ARGUMENTS` : '.';

  return [
    ...frontmatterLines,
    '',
    WRAPPER_SIGNATURE,
    '',
    `Use the Skill tool to invoke \`${def.targetSkill}\`${argsLine}`,
    '',
    'This is a thin wrapper installed by `good-vibe:install-shortcuts`. To remove,',
    'run `good-vibe:uninstall-shortcuts` (or delete this file manually).',
    '',
  ].join('\n');
}

async function classifyExisting(filePath) {
  if (!(await fileExists(filePath))) return 'absent';
  const content = await readFile(filePath, 'utf-8');
  return content.includes(WRAPPER_SIGNATURE) ? 'owned' : 'foreign';
}

/**
 * 사용자 스코프에 단축어 래퍼 7개를 설치한다.
 * @param {object} options
 * @param {string} options.targetDir - 설치 대상 디렉토리 (~/.claude/commands)
 * @param {boolean} [options.force=false] - 기존 파일 덮어쓰기 (서명 있는 파일만)
 * @returns {Promise<{installed: Array, skipped: Array, targetDir: string}>}
 */
export async function installShortcuts({ targetDir, force = false }) {
  try {
    await ensureDir(targetDir);
  } catch (err) {
    throw wrapFsError(err, '단축어 디렉토리 생성');
  }

  const installed = [];
  const skipped = [];

  for (const def of SHORTCUT_DEFINITIONS) {
    const filePath = resolve(targetDir, `${def.name}.md`);
    const status = await classifyExisting(filePath);

    if (status === 'foreign' && !force) {
      skipped.push({ name: def.name, reason: 'conflict', path: filePath });
      continue;
    }

    if (status === 'owned' && !force) {
      skipped.push({ name: def.name, reason: 'already-installed', path: filePath });
      continue;
    }

    try {
      await writeFile(filePath, buildWrapperContent(def), 'utf-8');
    } catch (err) {
      throw wrapFsError(err, `${def.name}.md 쓰기`);
    }
    installed.push({ name: def.name, path: filePath });
  }

  return { installed, skipped, targetDir };
}

/**
 * 사용자 스코프에서 우리가 설치한 단축어를 제거한다.
 * 서명이 없는 동명 파일은 사용자 소유로 간주하여 보존한다.
 * @param {object} options
 * @param {string} options.targetDir - 대상 디렉토리
 * @returns {Promise<{removed: Array, preserved: Array, targetDir: string}>}
 */
export async function uninstallShortcuts({ targetDir }) {
  const removed = [];
  const preserved = [];

  let exists = true;
  try {
    await readdir(targetDir);
  } catch (err) {
    if (err.code === 'ENOENT') exists = false;
    else throw err;
  }

  if (!exists) return { removed, preserved, targetDir };

  for (const def of SHORTCUT_DEFINITIONS) {
    const filePath = resolve(targetDir, `${def.name}.md`);
    const status = await classifyExisting(filePath);

    if (status === 'absent') continue;
    if (status === 'foreign') {
      preserved.push({ name: def.name, reason: 'not-owned', path: filePath });
      continue;
    }

    try {
      await unlink(filePath);
    } catch (err) {
      throw wrapFsError(err, `${def.name}.md 삭제`);
    }
    removed.push({ name: def.name, path: filePath });
  }

  return { removed, preserved, targetDir };
}
