import { readFile } from 'fs/promises';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(__dirname, '../..');
const PERSONALITIES_PATH = resolve(PROJECT_ROOT, 'presets', 'personalities.json');

let cachedPersonalities = null;

/**
 * personalities.json을 로드한다 (캐싱).
 * @returns {Promise<object>} 페르소나 데이터
 */
export async function loadPersonalities() {
  if (cachedPersonalities) return cachedPersonalities;
  const content = await readFile(PERSONALITIES_PATH, 'utf-8');
  cachedPersonalities = JSON.parse(content);
  return cachedPersonalities;
}

/**
 * 캐시를 초기화한다 (테스트용).
 */
export function clearCache() {
  cachedPersonalities = null;
}

/**
 * 에이전트 배열과 사용자 선택을 받아 팀원 배열을 생성한다.
 * @param {Array<{template: string, config: object}>} agents - 프리셋의 에이전트 배열
 * @param {object} [personalityChoices={}] - 사용자의 페르소나 선택 (에이전트명 → variant id)
 * @returns {Promise<Array<object>>} 팀원 배열
 */
export async function buildAgentTeam(agents, personalityChoices = {}) {
  const personalities = await loadPersonalities();
  return agents.map(agent => buildTeamMember(agent, personalities, personalityChoices));
}

/**
 * 단일 에이전트의 팀원 객체를 생성한다.
 * @param {object} agent - 에이전트 정보
 * @param {object} personalities - 전체 페르소나 데이터
 * @param {object} choices - 사용자 선택
 * @returns {object} 팀원 객체
 */
function buildTeamMember(agent, personalities, choices) {
  const agentName = agent.template;
  const model = agent.config?.model || 'sonnet';
  const persona = personalities[agentName];

  if (!persona) {
    return {
      agentName,
      role: agentName,
      displayName: agentName,
      emoji: '🤖',
      personality: '',
      description: '',
      speakingStyle: '',
      greeting: '',
      model,
    };
  }

  const chosenId = choices[agentName] || persona.default;
  const variant = persona.variants.find(v => v.id === chosenId) || persona.variants[0];

  return {
    agentName,
    role: persona.role,
    displayName: variant.defaultName,
    emoji: variant.emoji,
    personality: variant.trait,
    description: variant.description,
    speakingStyle: variant.speakingStyle,
    greeting: variant.greeting,
    model,
  };
}

/**
 * 특정 에이전트의 페르소나 변형 목록을 반환한다.
 * @param {string} agentName - 에이전트 이름
 * @returns {Promise<{variants: Array, default: string} | null>} 변형 목록 + 기본값 (없으면 null)
 */
export async function getPersonalityVariants(agentName) {
  const personalities = await loadPersonalities();
  const persona = personalities[agentName];
  if (!persona) return null;

  return {
    role: persona.role,
    variants: persona.variants.map(v => ({
      id: v.id,
      name: v.name,
      emoji: v.emoji,
      description: v.description,
    })),
    default: persona.default,
  };
}
