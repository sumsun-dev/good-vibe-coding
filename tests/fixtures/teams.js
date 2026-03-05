/**
 * 테스트용 팀 구성 fixture
 */

export const CTO_MEMBER = {
  roleId: 'cto',
  displayName: '민준',
  emoji: '',
  role: 'CTO',
  trait: '전략적이고 큰 그림을 보는',
  speakingStyle: '명확하고 결단력 있는 어조',
  skills: ['architecture', 'tech-decision', 'code-review'],
  workDomains: ['architecture', 'tech-decision', 'code-review'],
  reviewDomains: ['architecture', 'tech-decision', 'code-review'],
  discussionPriority: 1,
};

export const BACKEND_MEMBER = {
  roleId: 'backend',
  displayName: '도윤',
  emoji: '',
  role: 'Backend Developer',
  trait: '체계적이고 설계 중심의',
  speakingStyle: '논리적이고 구조화된 설명 스타일',
  skills: ['api', 'database', 'auth'],
  workDomains: ['api', 'database', 'auth', 'backend'],
  reviewDomains: ['api', 'database', 'auth', 'code-quality'],
  discussionPriority: 3,
};

export const FRONTEND_MEMBER = {
  roleId: 'frontend',
  displayName: '서현',
  emoji: '',
  role: 'Frontend Developer',
  trait: '사용자 경험에 집중하는',
  speakingStyle: '시각적이고 직관적인 설명',
  skills: ['react', 'css', 'accessibility'],
  workDomains: ['ui', 'frontend', 'react', 'css'],
  reviewDomains: ['ui', 'frontend', 'accessibility', 'code-quality'],
  discussionPriority: 3,
};

export const QA_MEMBER = {
  roleId: 'qa',
  displayName: '지민',
  emoji: '',
  role: 'QA Engineer',
  trait: '꼼꼼하고 체계적인',
  speakingStyle: '조심스럽고 세밀한 어조',
  skills: ['testing', 'e2e', 'tdd'],
  workDomains: ['testing', 'code-quality', 'e2e'],
  reviewDomains: ['testing', 'code-quality', 'e2e'],
  discussionPriority: 5,
};

export const SECURITY_MEMBER = {
  roleId: 'security',
  displayName: '세진',
  emoji: '',
  role: 'Security Engineer',
  trait: '예리하고 보안에 민감한',
  speakingStyle: '경고적이고 신중한 어조',
  skills: ['security', 'auth', 'encryption'],
  workDomains: ['security', 'auth', 'encryption'],
  reviewDomains: ['security', 'auth', 'code-quality'],
  discussionPriority: 5,
};

export const DEVOPS_MEMBER = {
  roleId: 'devops',
  displayName: '현우',
  emoji: '',
  role: 'DevOps Engineer',
  trait: '자동화에 열정적인',
  speakingStyle: '실용적이고 효율적인 어조',
  skills: ['ci-cd', 'docker', 'monitoring'],
  workDomains: ['infrastructure', 'ci-cd', 'deployment'],
  reviewDomains: ['infrastructure', 'ci-cd', 'deployment'],
  discussionPriority: 5,
};

export const FULLSTACK_MEMBER = {
  roleId: 'fullstack',
  displayName: '재원',
  emoji: '',
  role: 'Full-stack Developer',
  trait: '다재다능하고 유연한',
  speakingStyle: '포괄적이고 균형 잡힌 설명',
  skills: ['frontend', 'backend', 'database'],
  workDomains: ['frontend', 'backend', 'api', 'database'],
  reviewDomains: ['frontend', 'backend', 'api', 'code-quality'],
  discussionPriority: 3,
};

export const DATA_MEMBER = {
  roleId: 'data',
  displayName: '수아',
  emoji: '',
  role: 'Data Engineer',
  trait: '분석적이고 데이터 중심의',
  speakingStyle: '수치와 근거를 중시하는 어조',
  skills: ['data-pipeline', 'analytics', 'ml'],
  workDomains: ['data', 'analytics', 'ml'],
  reviewDomains: ['data', 'analytics', 'performance'],
  discussionPriority: 5,
};

export const MARKET_RESEARCHER = {
  roleId: 'market-researcher',
  displayName: '은지',
  emoji: '',
  role: 'Market Researcher',
  trait: '시장 트렌드에 민감한',
  speakingStyle: '데이터 기반의 통찰력 있는 어조',
  skills: ['market-analysis', 'competitor-analysis', 'trend-research'],
  workDomains: ['market-research', 'competitor-analysis'],
  reviewDomains: ['market-research', 'business-strategy'],
  discussionPriority: 1,
};

export const TECH_WRITER = {
  roleId: 'tech-writer',
  displayName: '하은',
  emoji: '',
  role: 'Tech Writer',
  trait: '명확하고 간결한',
  speakingStyle: '읽기 쉽고 정돈된 어조',
  skills: ['documentation', 'api-docs', 'user-guide'],
  workDomains: ['documentation', 'api-docs'],
  reviewDomains: ['documentation', 'readability'],
  discussionPriority: 8,
};

/** 기본 팀 구성 (5명) */
export const DEFAULT_TEAM = [
  CTO_MEMBER,
  BACKEND_MEMBER,
  FRONTEND_MEMBER,
  QA_MEMBER,
  SECURITY_MEMBER,
];

/** 풀스택 팀 구성 */
export const FULLSTACK_TEAM = [CTO_MEMBER, FULLSTACK_MEMBER, QA_MEMBER, DEVOPS_MEMBER];

/** 엔지니어 역할 ID 목록 */
export const ENGINEER_ROLE_IDS = ['backend', 'frontend', 'fullstack', 'devops', 'data'];

/** 비엔지니어 역할 ID 목록 */
export const NON_ENGINEER_ROLE_IDS = ['market-researcher', 'tech-writer'];
