/**
 * dynamic-role-designer — 프로젝트별 맞춤형 역할 설계 모듈
 * 15개 고정 역할 외에 LLM이 동적으로 역할을 설계하기 위한 프롬프트/파서를 제공한다.
 */

import { parseJsonArray } from '../core/json-parser.js';
import { inputError } from '../core/validators.js';

const REQUIRED_FIELDS = ['roleId', 'displayName', 'category', 'workDomains'];
const VALID_CATEGORIES = ['leadership', 'engineering', 'design', 'research', 'support'];

/**
 * 맞춤 역할 설계 LLM 프롬프트를 생성한다.
 * @param {string} description - 프로젝트 설명
 * @param {string[]} existingRoles - 이미 구성된 역할 ID 배열
 * @param {object|null} [codebaseInfo=null] - 코드베이스 스캔 결과
 * @returns {string} LLM 프롬프트
 */
export function buildDynamicRolePrompt(description, existingRoles, codebaseInfo = null) {
  if (!description || description.trim() === '') return '';

  let codebaseSection = '';
  if (codebaseInfo) {
    codebaseSection = `\n\n## 코드베이스 정보
- 기술 스택: ${(codebaseInfo.techStack || []).join(', ') || '없음'}
- 파일 구조: ${codebaseInfo.fileStructure || '없음'}`;
  }

  return `다음 프로젝트에 필요한 전문 역할을 설계하세요.
기존 15개 고정 역할로 커버되지 않는 영역이 있다면 맞춤형 역할을 제안하세요.

## 프로젝트 설명
${description}

## 이미 구성된 역할
${existingRoles.length > 0 ? existingRoles.map(r => `- ${r}`).join('\n') : '(없음)'}${codebaseSection}

## 설계 규칙

1. 기존 역할과 중복되지 않는 전문 역할만 제안
2. 각 역할은 명확한 전문 영역(workDomains)을 가져야 함
3. 최소 1개, 최대 3개까지 제안

## 출력 형식 (반드시 JSON 배열)

\`\`\`json
[
  {
    "roleId": "역할-id (kebab-case)",
    "displayName": "표시 이름",
    "category": "engineering 또는 design 또는 research 또는 support",
    "description": "역할 설명",
    "skills": ["스킬1", "스킬2"],
    "workDomains": ["작업 도메인1"],
    "reviewDomains": ["리뷰 도메인1"],
    "discussionPriority": 4,
    "model": "sonnet"
  }
]
\`\`\``;
}

/**
 * LLM 출력을 동적 역할 배열로 파싱한다.
 * dynamic: true를 자동 추가하고 roleId에 "dynamic-" prefix를 보장한다.
 * @param {string} rawOutput - LLM 출력 원문
 * @returns {Array<object>} 동적 역할 배열
 */
export function parseDynamicRoles(rawOutput) {
  if (!rawOutput || rawOutput.trim() === '') return [];

  const parsed = parseJsonArray(rawOutput);
  if (!parsed || parsed.length === 0) return [];

  return parsed.map(role => ({
    roleId: ensureDynamicPrefix(role.roleId || 'unknown'),
    displayName: role.displayName || '',
    dynamic: true,
    category: VALID_CATEGORIES.includes(role.category) ? role.category : 'engineering',
    description: role.description || '',
    skills: Array.isArray(role.skills) ? role.skills : [],
    workDomains: Array.isArray(role.workDomains) ? role.workDomains : [],
    reviewDomains: Array.isArray(role.reviewDomains) ? role.reviewDomains : [],
    discussionPriority: typeof role.discussionPriority === 'number' ? role.discussionPriority : 5,
    model: role.model || 'sonnet',
  }));
}

/**
 * roleId에 "dynamic-" prefix를 보장한다.
 * @param {string} roleId
 * @returns {string}
 */
function ensureDynamicPrefix(roleId) {
  return roleId.startsWith('dynamic-') ? roleId : `dynamic-${roleId}`;
}

/**
 * 동적 역할의 에이전트 마크다운을 생성한다.
 * @param {object} role - 동적 역할 객체
 * @returns {string} 마크다운 문자열
 */
export function buildDynamicAgentMarkdown(role) {
  return `---
roleId: ${role.roleId}
displayName: ${role.displayName}
category: ${role.category || 'engineering'}
dynamic: true
model: ${role.model || 'sonnet'}
skills: [${(role.skills || []).join(', ')}]
workDomains: [${(role.workDomains || []).join(', ')}]
reviewDomains: [${(role.reviewDomains || []).join(', ')}]
discussionPriority: ${role.discussionPriority || 5}
---

# ${role.displayName}

${role.description || ''}

## 역할

이 에이전트는 프로젝트 요구에 맞게 동적으로 생성되었습니다.

## 전문 영역
${(role.skills || []).map(s => `- ${s}`).join('\n')}
`;
}

/**
 * 동적 역할의 필수 필드를 검증한다.
 * @param {object} role - 검증할 역할 객체
 * @returns {boolean} 유효하면 true
 * @throws {AppError} 필수 필드 누락 시
 */
export function validateDynamicRole(role) {
  for (const field of REQUIRED_FIELDS) {
    if (!role[field] || (Array.isArray(role[field]) && role[field].length === 0)) {
      throw inputError(`동적 역할 필수 필드 누락: ${field}`);
    }
  }
  return true;
}
