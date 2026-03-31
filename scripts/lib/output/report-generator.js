/**
 * report-generator — 프로젝트 보고서 생성 모듈
 */

import { getCostSummary, getAgentPerformanceSummary } from '../project/project-metrics.js';
import {
  analyzeMessagePatterns,
  generateMessageAnalysisSection,
} from '../engine/message-analyzer.js';

/**
 * 전체 프로젝트 보고서를 생성한다.
 * @param {object} project - 프로젝트 전체 데이터
 * @returns {string} 보고서 마크다운
 */
function generateOverviewSection(project, stats, team) {
  return `# 프로젝트 보고서: ${project.name || '(이름 없음)'}

## 개요
- 프로젝트: ${project.name || '(이름 없음)'} (${project.type || 'custom'})
- 팀원: ${team.length}명
- 작업: ${stats.totalTasks}개 (완료: ${stats.completed})
- 모드: ${project.mode || '-'}
- 상태: ${project.status || '-'}`;
}

function generateTeamSection(team, tasksByAssignee) {
  const roleSummaries = team
    .map((member) => {
      const memberTasks = tasksByAssignee.get(member.roleId) || [];
      return generateRoleSummary(member, memberTasks);
    })
    .join('\n\n');

  return `## 팀원별 기여

${roleSummaries}`;
}

function generatePlanSection(project) {
  return `## 기획서

${project.discussion?.planDocument || '(기획서 없음)'}`;
}

function generateStatsTable(stats) {
  return `## 작업 통계

| 역할 | 작업 수 |
|------|---------|
${Object.entries(stats.byRole)
  .map(([role, count]) => `| ${role} | ${count} |`)
  .join('\n')}`;
}

/**
 * 마크다운 텍스트에서 특정 섹션(### 이름)의 내용을 추출한다.
 * @param {string} text - 마크다운 텍스트
 * @param {string} sectionName - 섹션명 (예: '구현 요약')
 * @returns {string|null} 섹션 내용 또는 null
 */
export function extractSection(text, sectionName) {
  if (!text || !sectionName) return null;

  // split 기반 파싱으로 ReDoS 방지
  const safeText = text.slice(0, 100_000);
  const marker = `### ${sectionName}`;
  const startIdx = safeText.indexOf(marker);
  if (startIdx === -1) return null;

  const afterMarker = safeText.slice(startIdx + marker.length);
  const contentStart = afterMarker.indexOf('\n');
  if (contentStart === -1) return null;

  const contentAfterNewline = afterMarker.slice(contentStart + 1);
  const nextSectionIdx = contentAfterNewline.indexOf('\n### ');
  const content =
    nextSectionIdx === -1 ? contentAfterNewline : contentAfterNewline.slice(0, nextSectionIdx);

  const trimmed = content.trim();
  return trimmed || null;
}

/**
 * phaseResults의 모든 taskResult에서 특정 섹션을 수집한다.
 * @param {object} phaseResults - Phase별 결과 객체
 * @param {string} sectionName - 추출할 섹션명
 * @param {(section: string, phase: string) => *} [mapper] - 섹션 값 변환 함수 (기본: 원본 반환)
 * @returns {Array} 수집된 섹션 데이터
 */
function collectFromTaskOutputs(phaseResults, sectionName, mapper) {
  const results = [];
  for (const phase of Object.keys(phaseResults)) {
    const pr = phaseResults[phase];
    for (const tr of pr.taskResults || []) {
      const out = tr.output || tr.taskOutput || '';
      if (!out) continue;
      const section = extractSection(out, sectionName);
      if (section) results.push(mapper ? mapper(section, phase) : section);
    }
  }
  return results;
}

/**
 * phaseResults를 1회 순회하면서 여러 섹션을 동시에 수집한다.
 * collectFromTaskOutputs를 N번 호출하는 대신 단일 패스로 처리하여 O(N×M×S) → O(N×M) 최적화.
 * @param {object} phaseResults - Phase별 결과 객체
 * @param {Array<{ name: string, mapper?: (section: string, phase: string) => * }>} sections
 * @returns {Map<string, Array>} 섹션명 → 수집 결과 맵
 */
function collectMultipleSections(phaseResults, sections) {
  const resultMap = new Map(sections.map((s) => [s.name, []]));
  for (const phase of Object.keys(phaseResults)) {
    const pr = phaseResults[phase];
    for (const tr of pr.taskResults || []) {
      const out = tr.output || tr.taskOutput || '';
      if (!out) continue;
      for (const { name, mapper } of sections) {
        const section = extractSection(out, name);
        if (section) resultMap.get(name).push(mapper ? mapper(section, phase) : section);
      }
    }
  }
  return resultMap;
}

/**
 * 구현 상세 섹션을 생성한다.
 * phaseResults → taskResults → 에이전트 출력에서 추출.
 * @param {object} project - 프로젝트 전체 데이터
 * @returns {string} 구현 상세 마크다운 (데이터 없으면 빈 문자열)
 */
export function generateImplementationDetailsSection(project) {
  const state = project.executionState;
  if (!state || !state.phaseResults || typeof state.phaseResults !== 'object') return '';

  const collected = collectMultipleSections(state.phaseResults, [
    { name: '구현 요약', mapper: (s, phase) => `- Phase ${phase}: ${s}` },
    { name: '핵심 파일' },
    { name: '커스터마이징 포인트' },
  ]);

  const summaries = collected.get('구현 요약');
  const files = collected.get('핵심 파일');
  const customizations = collected.get('커스터마이징 포인트');

  if (summaries.length === 0 && files.length === 0 && customizations.length === 0) return '';

  let section = '## 구현 상세';

  if (summaries.length > 0) {
    section += '\n\n### 구현 요약\n' + summaries.join('\n');
  }

  if (files.length > 0) {
    section += '\n\n### 핵심 파일\n' + files.join('\n');
  }

  if (customizations.length > 0) {
    section += '\n\n### 커스터마이징 포인트\n' + customizations.join('\n');
  }

  return section;
}

/**
 * 환경변수 설정 가이드 섹션을 생성한다.
 * 에이전트 출력에서 "외부 서비스 및 환경변수" 섹션 수집 + 중복 제거.
 * @param {object} project - 프로젝트 전체 데이터
 * @returns {string} 환경변수 가이드 마크다운 (데이터 없으면 빈 문자열)
 */
export function generateEnvGuideSection(project) {
  const state = project.executionState;
  if (!state || !state.phaseResults || typeof state.phaseResults !== 'object') return '';

  const envEntries = new Set();
  const envSections = collectFromTaskOutputs(state.phaseResults, '외부 서비스 및 환경변수');
  for (const envSection of envSections) {
    if (envSection === '없음') continue;
    const lines = envSection.split('\n').slice(0, 100);
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed && trimmed !== '-') envEntries.add(trimmed);
    }
  }

  if (envEntries.size === 0) return '';

  let section = '## 환경변수 설정 가이드\n\n';
  section += '`.env` 파일을 프로젝트 루트에 생성하고 다음 값을 설정하세요:\n\n';
  section += '```\n';
  for (const entry of envEntries) {
    // "- ENV_VAR: 설명" 형태를 "ENV_VAR=  # 설명"으로 변환 시도
    const match = entry.match(/^-?\s*(\w+)\s*[:：]\s*(.+)/);
    if (match) {
      section += `${match[1]}=  # ${match[2]}\n`;
    } else {
      section += `# ${entry}\n`;
    }
  }
  section += '```';

  return section;
}

/**
 * 시작 가이드 섹션을 생성한다.
 * materializeResult의 파일 목록 + 프로젝트 타입별 실행 절차.
 * @param {object} project - 프로젝트 전체 데이터
 * @returns {string} 시작 가이드 마크다운 (데이터 없으면 빈 문자열)
 */
export function generateGettingStartedSection(project) {
  const state = project.executionState;
  if (!state || !state.phaseResults || typeof state.phaseResults !== 'object') return '';

  // 생성된 파일 목록 수집
  const createdFiles = [];
  for (const phase of Object.keys(state.phaseResults)) {
    const pr = state.phaseResults[phase];
    if (pr.materializeResult && Array.isArray(pr.materializeResult.files)) {
      for (const f of pr.materializeResult.files) {
        createdFiles.push(f.path || f);
      }
    }
  }

  // 에이전트 출력에서 실행 방법 추출
  const runMethods = collectFromTaskOutputs(state.phaseResults, '실행 방법');

  if (createdFiles.length === 0 && runMethods.length === 0) return '';

  let section = '## 시작 가이드';

  if (createdFiles.length > 0) {
    section += '\n\n### 생성된 파일\n';
    section += createdFiles.map((f) => `- \`${f}\``).join('\n');
  }

  section += '\n\n### 실행 방법\n';

  if (runMethods.length > 0) {
    section += runMethods.join('\n\n');
  } else {
    // 프로젝트 타입별 기본 실행 가이드
    const type = project.type || 'default';
    const defaultGuides = {
      'telegram-bot':
        '1. `.env` 파일에 `TELEGRAM_BOT_TOKEN` 설정\n2. `npm install`\n3. `npm start`\n4. 텔레그램에서 봇에게 메시지 전송으로 확인',
      'web-app':
        '1. `.env` 파일 설정 (필요 시)\n2. `npm install`\n3. `npm run dev`\n4. 브라우저에서 `http://localhost:3000` 확인',
      'api-server':
        '1. `.env` 파일 설정 (필요 시)\n2. `npm install`\n3. `npm start`\n4. `curl http://localhost:3000/api` 로 확인',
      'cli-tool': '1. `npm install`\n2. `node index.js --help` 로 사용법 확인',
      default: '1. `.env` 파일 설정 (필요 시)\n2. `npm install`\n3. `npm start`',
    };

    section += defaultGuides[type] || defaultGuides.default;
  }

  return section;
}

function generateCostSection(project, tasksByAssignee) {
  if (!project.metrics) return '';

  const costSummary = getCostSummary(project.metrics);
  const contributions = {};
  for (const member of project.team) {
    const memberTasks = tasksByAssignee.get(member.roleId) || [];
    const completedRatio =
      memberTasks.length > 0
        ? memberTasks.filter((t) => t.status === 'completed').length / memberTasks.length
        : 0;
    contributions[member.roleId] = Math.round(completedRatio * 100) / 100;
  }
  const agentPerf = getAgentPerformanceSummary(project.metrics, contributions);

  let section = `\n\n## 비용/성능

| 항목 | 값 |
|------|-----|
| 총 비용 | $${costSummary.totalCostUsd.toFixed(4)} |
| 입력 토큰 | ${costSummary.totalInputTokens.toLocaleString()} |
| 출력 토큰 | ${costSummary.totalOutputTokens.toLocaleString()} |`;

  if (agentPerf.length > 0) {
    section +=
      '\n\n### 에이전트 기여도\n\n| 역할 | 호출 수 | 비용 | 기여도 |\n|------|---------|------|--------|\n';
    section += agentPerf
      .sort((a, b) => b.contributionScore - a.contributionScore)
      .map(
        (a) =>
          `| ${a.roleId} | ${a.callCount} | $${a.costUsd.toFixed(4)} | ${(a.contributionScore * 100).toFixed(0)}% |`,
      )
      .join('\n');
  }

  return section;
}

/**
 * 1-page Executive Summary를 생성한다.
 * @param {object} project - 프로젝트 전체 데이터
 * @param {{ totalTasks: number, completed: number, byRole: object }} stats - 통계
 * @returns {string} Executive Summary 마크다운
 */
export function generateExecutiveSummary(project, stats) {
  const team = project.team || [];
  const state = project.executionState;

  // 핵심 결과
  const completionRate =
    stats.totalTasks > 0 ? Math.round((stats.completed / stats.totalTasks) * 100) : 0;

  let duration = '-';
  if (state && state.startedAt) {
    const start = new Date(state.startedAt);
    const end = state.completedAt ? new Date(state.completedAt) : new Date();
    const diffMin = Math.round((end - start) / 60000);
    duration = diffMin >= 60 ? `${Math.floor(diffMin / 60)}시간 ${diffMin % 60}분` : `${diffMin}분`;
  }

  let section = `## Executive Summary

| 항목 | 결과 |
|------|------|
| 완료율 | ${completionRate}% (${stats.completed}/${stats.totalTasks}) |
| 팀 규모 | ${team.length}명 |
| 소요 시간 | ${duration} |
| 모드 | ${project.mode || '-'} |`;

  // Phase별 품질 게이트 통과율
  if (state && state.phaseResults && typeof state.phaseResults === 'object') {
    const phases = Object.keys(state.phaseResults);
    if (phases.length > 0) {
      const passedPhases = phases.filter((p) => {
        const pr = state.phaseResults[p];
        return pr.qualityGate && pr.qualityGate.passed;
      });
      section += `\n| 품질 검증 | ${passedPhases.length}/${phases.length} Phase 통과 |`;
    }
  }

  // 다음 단계 제안
  section += '\n\n### 다음 단계';
  if (project.status === 'completed') {
    section += '\n1. `.env` 파일 설정 (보고서의 "환경변수 설정 가이드" 참고)';
    section += '\n2. 의존성 설치 및 실행 확인';
    section += '\n3. `good-vibe:report`로 상세 보고서 확인';
    section += '\n4. `good-vibe:feedback`으로 에이전트 피드백 분석';
    section +=
      '\n\n> 설명을 읽고도 잘 모르겠는 부분이 있으면, 어떤 부분이 헷갈리는지 편하게 질문해 주세요!';
  } else if (project.status === 'approved') {
    section += '\n- `good-vibe:execute`로 실행 시작';
  } else if (project.status === 'planning') {
    section += '\n- `good-vibe:discuss`로 추가 토론 또는 `good-vibe:approve`로 승인';
  }

  return section;
}

export function generateReport(project) {
  const stats = generateProjectStats(project);
  const team = project.team || [];
  const tasks = project.tasks || [];

  // Build assignee → tasks Map once to avoid repeated O(team × tasks) filtering
  const tasksByAssignee = new Map();
  for (const task of tasks) {
    const assignee = task.assignee || 'unassigned';
    if (!tasksByAssignee.has(assignee)) {
      tasksByAssignee.set(assignee, []);
    }
    tasksByAssignee.get(assignee).push(task);
  }

  let report = generateOverviewSection(project, stats, team);

  // Executive Summary 삽입
  report += '\n\n' + generateExecutiveSummary(project, stats);

  report += '\n\n' + generateTeamSection(team, tasksByAssignee);
  report += '\n\n' + generatePlanSection(project);
  report += '\n\n' + generateStatsTable(stats);

  const executionSection = generateExecutionSummary(project);
  if (executionSection) {
    report += '\n\n' + executionSection;
  }

  const phaseReflection = buildPhaseReflection(project);
  if (phaseReflection) {
    report += '\n\n' + phaseReflection;
  }

  const implDetails = generateImplementationDetailsSection(project);
  if (implDetails) report += '\n\n' + implDetails;

  const envGuide = generateEnvGuideSection(project);
  if (envGuide) report += '\n\n' + envGuide;

  const gettingStarted = generateGettingStartedSection(project);
  if (gettingStarted) report += '\n\n' + gettingStarted;

  if (project.messageStats) {
    const msgAnalysis = analyzeMessagePatterns(project.messageStats);
    const msgSection = generateMessageAnalysisSection(msgAnalysis);
    if (msgSection) report += '\n\n' + msgSection;
  }

  report += generateCostSection(project, tasksByAssignee);

  return report;
}

/**
 * 역할별 요약을 생성한다.
 * @param {object} teamMember - 팀원 정보
 * @param {Array<object>} tasks - 해당 팀원의 작업 배열
 * @returns {string} 역할 요약 마크다운
 */
export function generateRoleSummary(teamMember, tasks) {
  const completedCount = tasks.filter((t) => t.status === 'completed').length;
  const taskList =
    tasks.length > 0
      ? tasks.map((t) => `  - ${t.title} (${t.status})`).join('\n')
      : '  - (담당 작업 없음)';

  return `### ${teamMember.displayName} (${teamMember.role})
- 담당 작업: ${tasks.length}개 (완료: ${completedCount})
${taskList}`;
}

/**
 * Phase별 실행 기록을 생성한다.
 * @param {object} project - 프로젝트 전체 데이터
 * @returns {string|null} 실행 기록 마크다운 또는 null
 */
export function generateExecutionSummary(project) {
  const state = project.executionState;
  if (!state || !state.phaseResults || typeof state.phaseResults !== 'object') return null;

  const phases = Object.keys(state.phaseResults);
  if (phases.length === 0) return null;

  let section = `## 실행 기록\n\n| Phase | 태스크 | 리뷰 | 품질검증 | 수정시도 |\n|-------|--------|------|---------|---------|`;

  for (const phase of phases) {
    const pr = state.phaseResults[phase];
    const taskCount = (pr.taskResults || []).length;
    const reviews = pr.reviews || [];
    const criticalCount = reviews.reduce(
      (sum, r) => sum + (r.issues || []).filter((i) => i.severity === 'critical').length,
      0,
    );
    const gate = pr.qualityGate;
    const gateStatus = gate ? (gate.passed ? 'PASS' : 'FAIL') : '-';
    const fixAttempts = (state.journal || []).filter(
      (j) => j.phase === Number(phase) && j.action === 'fix',
    ).length;

    section += `\n| ${phase} | ${taskCount}개 | ${reviews.length}건 (critical ${criticalCount}) | ${gateStatus} | ${fixAttempts}회 |`;
  }

  // 타임라인 (journal 기반)
  const journal = state.journal || [];
  if (journal.length > 0) {
    section += '\n\n### 실행 타임라인\n';
    for (const entry of journal) {
      const time = entry.timestamp ? new Date(entry.timestamp).toLocaleTimeString('ko-KR') : '';
      section += `\n- ${time} Phase ${entry.phase}: ${entry.action}${entry.fixAttempt ? ` (시도 ${entry.fixAttempt})` : ''}`;
    }
  }

  return section;
}

/**
 * Phase별 회고 요약을 생성한다.
 * phaseResults는 배열 또는 객체(숫자 키) 형태를 모두 지원한다.
 * @param {object} project - 프로젝트 전체 데이터
 * @returns {string} Phase별 회고 마크다운 (데이터 없으면 빈 문자열)
 */
export function buildPhaseReflection(project) {
  const exec = project.executionState;
  if (!exec || !exec.phaseResults) return '';

  // phaseResults가 배열이면 그대로, 객체이면 값 배열로 변환
  const phaseList = Array.isArray(exec.phaseResults)
    ? exec.phaseResults
    : Object.entries(exec.phaseResults).map(([key, val]) => ({ phaseNumber: Number(key), ...val }));

  if (phaseList.length === 0) return '';

  const lines = ['## Phase별 회고\n'];
  for (const phase of phaseList) {
    const fixAttempts = phase.fixAttempts || 0;
    const quality =
      phase.qualityScore !== null && phase.qualityScore !== undefined
        ? `${phase.qualityScore}점`
        : '-';
    const taskCount = phase.tasks?.length || 0;
    const status = fixAttempts > 0 ? `수정 ${fixAttempts}회` : '첫 시도 통과';
    lines.push(
      `- **Phase ${phase.phaseNumber || '?'}**: 태스크 ${taskCount}개, ${status}, 품질 ${quality}`,
    );
  }
  return lines.join('\n');
}

/**
 * 프로젝트 통계를 생성한다.
 * @param {object} project - 프로젝트 전체 데이터
 * @returns {{ totalTasks: number, completed: number, byRole: object }}
 */
export function generateProjectStats(project) {
  const tasks = project.tasks || [];
  const byRole = {};

  for (const task of tasks) {
    const assignee = task.assignee || 'unassigned';
    byRole[assignee] = (byRole[assignee] || 0) + 1;
  }

  return {
    totalTasks: tasks.length,
    completed: tasks.filter((t) => t.status === 'completed').length,
    byRole,
  };
}
