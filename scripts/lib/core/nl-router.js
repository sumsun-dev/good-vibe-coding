/**
 * nl-router — 자연어 → 커맨드/카테고리 매핑 모듈
 *
 * 두 진입점을 제공한다:
 * - `resolveNaturalLanguage(input)` — v1 호환. 자연어 → v1 슬래시 커맨드 (legacy)
 * - `dispatchInput(input, context)` — v2 단일 진입점. status/resume/modify는 우선순위 유지,
 *   그 외는 task-router로 위임 → 5개 작업 유형으로 세분류
 *
 * LLM 호출 없는 규칙 기반.
 */

import { routeTask } from '../engine/task-router.js';

/**
 * 커맨드별 자연어 트리거 패턴.
 * 순서가 우선순위를 결정한다 (앞에 있을수록 먼저 매칭).
 */
const NL_TRIGGER_MAP = {
  hello: [/처음/, /시작하기/, /setup/i, /hello/i, /환경.*설정/, /초기.*설정/, /온보딩/],
  new: [
    // 재개 패턴 (기존 프로젝트 이어서 작업)
    /이어서/,
    /계속.*하/,
    /재개/,
    /이전.*프로젝트/,
    /하던.*프로젝트/,
    /resume/i,
    /continue.*project/i,
    // 신규 생성 패턴
    /팀.*만들/,
    /프로젝트.*시작/,
    /새.*프로젝트/,
    /create.*team/i,
    /new.*project/i,
  ],
  discuss: [/토론/, /기획.*논의/, /회의/, /discuss/i],
  approve: [/승인/, /확정/, /approve/i],
  modify: [
    /수정/,
    /변경/,
    /고쳐/,
    /개선/,
    /추가해/,
    /바꿔/,
    /modify/i,
    /fix.*project/i,
    /update.*project/i,
  ],
  execute: [/실행해/, /구현해/, /만들어.*줘/, /execute/i, /^run\b/i],
  status: [/상태/, /진행.*상황/, /어디.*까지/, /status/i],
  report: [/보고서/, /결과.*보고/, /리포트/, /report/i],
};

/**
 * 자연어 입력을 커맨드로 매핑한다.
 * @param {string} input - 자연어 입력
 * @returns {string|null} 매핑된 커맨드 또는 null
 */
export function resolveNaturalLanguage(input) {
  if (!input || input.trim() === '') return null;

  const normalized = input.trim().toLowerCase();

  for (const [command, patterns] of Object.entries(NL_TRIGGER_MAP)) {
    for (const pattern of patterns) {
      if (pattern.test(normalized)) return command;
    }
  }

  return null;
}

/**
 * status/resume/modify 카테고리 패턴 — `dispatchInput` (v2)와
 * `intent-gate.js` 양쪽에서 공유한다. 단일 출처로 유지해 분기 동작 동기화.
 */
export const DISPATCH_PATTERNS = Object.freeze({
  status: [/상태/, /진행.*상황/, /어디.*까지/, /\bstatus\b/i],
  resume: [
    /이어서/,
    /계속.*하/,
    /재개/,
    /이전.*프로젝트/,
    /하던.*프로젝트/,
    /\bresume\b/i,
    /continue.*project/i,
  ],
  modify: [
    /수정/,
    /변경/,
    /고쳐/,
    /개선/,
    /추가해/,
    /바꿔/,
    /\bmodify\b/i,
    /fix.*project/i,
    /update.*project/i,
  ],
});

const PRIORITY_CHECKS = Object.freeze([
  { category: 'status', patterns: DISPATCH_PATTERNS.status },
  { category: 'resume', patterns: DISPATCH_PATTERNS.resume },
  { category: 'modify', patterns: DISPATCH_PATTERNS.modify },
]);

/**
 * v2 단일 진입점 1차 디스패처.
 *
 * 우선순위: status > resume > modify > task(task-router 위임).
 * 이 함수는 **패턴 매칭만** 수행한다. 최종 분기(예: 신규 사용자가 "추가해줘"를
 * 입력한 경우 modify가 아니라 task로 downgrade해야 하는지)는 호출자가
 * 프로젝트 상태(hasProject 등) 컨텍스트로 판단한다.
 *
 * 특히 "추가해" 패턴은 신규 작업과 수정 작업 모두에 매칭될 수 있으므로,
 * 호출자는 `category === 'modify'` && `!ctx.hasProject` 조건에서 task로
 * downgrade하는 정책을 적용해야 한다.
 *
 * @param {string} input - 사용자 자연어
 * @param {object} [context] - task-router에 전달할 컨텍스트 (예: hasGitRepo)
 * @returns {{
 *   category: 'status' | 'resume' | 'modify' | 'task',
 *   taskRoute?: ReturnType<typeof routeTask>
 * }}
 */
export function dispatchInput(input, context = {}) {
  const safeInput = typeof input === 'string' ? input : '';

  const matched = PRIORITY_CHECKS.find(({ patterns }) => patterns.some((p) => p.test(safeInput)));
  if (matched) return { category: matched.category };

  return { category: 'task', taskRoute: routeTask(safeInput, context) };
}
