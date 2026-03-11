/**
 * handlers/learn — 학습 가이드 커맨드
 */
import { readStdin, output } from '../cli-utils.js';
import { readFile } from 'fs/promises';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const GUIDES_DIR = resolve(__dirname, '../../guides');

/** 주제 → 가이드 파일 매핑 */
const GUIDE_MAP = {
  기초: 'common/01-what-is-claude-code.md',
  소개: 'common/01-what-is-claude-code.md',
  사용법: 'common/02-basic-usage.md',
  시작: 'common/02-basic-usage.md',
  커맨드: 'common/03-commands-and-skills.md',
  에이전트: 'common/04-agents.md',
  자동화: 'common/05-hooks-and-automation.md',
  연동: 'common/06-integrations.md',
  예제: 'common/07-examples.md',
  문제해결: 'common/08-troubleshooting.md',
  SDK: 'common/09-sdk-usage.md',
  실행모드: 'common/10-execution-modes.md',
  CEO: 'common/11-ceo-guide.md',
  퀵스타트: 'common/00-quick-start.md',
  TDD: 'developer/tdd-workflow.md',
  테스트: 'developer/tdd-workflow.md',
  리뷰: 'developer/code-review.md',
  코드리뷰: 'developer/code-review.md',
  PRD: 'pm/prd-writing.md',
  기획서: 'pm/prd-writing.md',
  이슈: 'pm/issue-management.md',
  접근성: 'designer/accessibility.md',
  디자인시스템: 'designer/design-system.md',
  레퍼런스: 'common/03-commands-reference.md',
  고급커맨드: 'common/12-advanced-commands.md',
};

export const commands = {
  /** 가이드 목록 반환 */
  'list-guides': async () => {
    const categories = [
      {
        name: '공통 기초',
        guides: [
          { topic: '퀵스타트', file: 'common/00-quick-start.md', title: '6단계로 프로젝트 끝내기' },
          {
            topic: '기초',
            file: 'common/01-what-is-claude-code.md',
            title: 'Claude Code란 무엇인가?',
          },
          { topic: '사용법', file: 'common/02-basic-usage.md', title: '기본 사용법' },
          {
            topic: '커맨드',
            file: 'common/03-commands-and-skills.md',
            title: '커맨드와 스킬 활용하기',
          },
          { topic: '에이전트', file: 'common/04-agents.md', title: '에이전트 이해하기' },
          { topic: '자동화', file: 'common/05-hooks-and-automation.md', title: '훅과 자동화' },
          { topic: 'CEO', file: 'common/11-ceo-guide.md', title: 'CEO 가이드 (비개발자용)' },
          {
            topic: '레퍼런스',
            file: 'common/03-commands-reference.md',
            title: '커맨드 레퍼런스',
          },
          { topic: '고급커맨드', file: 'common/12-advanced-commands.md', title: '고급 커맨드' },
        ],
      },
      {
        name: '개발자 심화',
        guides: [
          { topic: 'TDD', file: 'developer/tdd-workflow.md', title: 'TDD 워크플로우' },
          { topic: '코드리뷰', file: 'developer/code-review.md', title: '코드 리뷰 자동화' },
        ],
      },
      {
        name: 'PM/기획자 심화',
        guides: [
          { topic: 'PRD', file: 'pm/prd-writing.md', title: 'PRD 작성법' },
          { topic: '이슈', file: 'pm/issue-management.md', title: '이슈 관리' },
        ],
      },
      {
        name: '디자이너 심화',
        guides: [
          { topic: '디자인시스템', file: 'designer/design-system.md', title: '디자인 시스템' },
          { topic: '접근성', file: 'designer/accessibility.md', title: '접근성 가이드' },
        ],
      },
    ];
    output({ categories, guideMap: GUIDE_MAP });
  },

  /** 주제로 가이드 파일 내용 반환 */
  'get-guide': async () => {
    const data = await readStdin();
    const topic = (data.topic || '').trim();
    const file = GUIDE_MAP[topic];
    if (!file) {
      output({ found: false, topic, availableTopics: Object.keys(GUIDE_MAP) });
      return;
    }
    try {
      const content = await readFile(resolve(GUIDES_DIR, file), 'utf-8');
      output({ found: true, topic, file, content });
    } catch {
      output({ found: false, topic, file, error: '가이드 파일을 찾을 수 없습니다' });
    }
  },
};
