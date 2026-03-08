/**
 * nl-router — 자연어 → 커맨드 매핑 모듈
 * LLM 호출 없이 규칙 기반으로 필수 6개 커맨드를 매핑한다.
 */

/**
 * 커맨드별 자연어 트리거 패턴.
 * 순서가 우선순위를 결정한다 (앞에 있을수록 먼저 매칭).
 */
const NL_TRIGGER_MAP = {
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
