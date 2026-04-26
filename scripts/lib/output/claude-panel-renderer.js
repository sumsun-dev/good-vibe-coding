/**
 * claude-panel-renderer — Claude Code stdout markdown 라이브 패널 렌더러.
 *
 * PRD #235 §3.5/§7-4, 스파이크 A-0a 결과 적용.
 * Claude Code가 stdout markdown을 자동 렌더링하므로 패널 API 대신 stdout으로 동등한 UX 제공.
 *
 * 호출자가 메트릭 객체를 주입하면 markdown 문자열을 반환한다.
 * 순수 함수 — 외부 의존성 0.
 */

export const STATE_MARKERS = Object.freeze({
  DONE: '✓',
  CURRENT: '⏳',
  PENDING: '⏸',
  TERMINAL: '—',
  FAILED: '✗',
});

export const EVENT_LIMIT_DEFAULT = 5;
const EVENT_LIMIT_MAX = 50;
const HEADING_DEPTH_DEFAULT = 2;

const SEVERITY_LABEL = Object.freeze({
  info: 'INFO',
  warning: 'WARNING',
  critical: 'CRITICAL',
});

const TERMINAL_STATES = new Set(['done', 'failed']);

/**
 * 라이브 패널을 markdown 문자열로 렌더링.
 *
 * @param {object} options
 * @returns {string} markdown
 */
export function renderPanel(options) {
  const opts = options || {};
  const taskType = opts.taskType || 'unknown';
  const currentState = opts.currentState || 'pending';
  const graphStates = Array.isArray(opts.graphStates) ? opts.graphStates : [currentState];
  const costUsd = sanitizeNumber(opts.costUsd);
  const tokens = sanitizeNumber(opts.tokens);
  const recentEvents = Array.isArray(opts.recentEvents) ? opts.recentEvents : [];
  const riskSignal = opts.riskSignal || null;
  const budgetConfig = opts.budgetConfig || null;
  const eventLimit =
    Number.isInteger(opts.eventLimit) && opts.eventLimit > 0
      ? Math.min(opts.eventLimit, EVENT_LIMIT_MAX)
      : EVENT_LIMIT_DEFAULT;
  const headingDepth = Number.isInteger(opts.headingDepth)
    ? Math.max(1, Math.min(6, opts.headingDepth))
    : HEADING_DEPTH_DEFAULT;

  const sections = [
    renderHeader(taskType, currentState, headingDepth),
    renderProgress(graphStates, currentState, headingDepth),
    renderMetrics(costUsd, tokens, budgetConfig, headingDepth),
  ];

  if (riskSignal) sections.push(renderRisk(riskSignal, headingDepth));
  sections.push(renderEvents(recentEvents, eventLimit, headingDepth));

  return sections.filter(Boolean).join('\n\n');
}

function headingPrefix(depth) {
  return '#'.repeat(depth);
}

function renderHeader(taskType, currentState, depth) {
  return `${headingPrefix(depth)} ⚙️ /gv ${taskType} · ${currentState}`;
}

function renderProgress(graphStates, currentState, depth) {
  const currentIdx = graphStates.indexOf(currentState);
  const lines = [`${headingPrefix(depth + 1)} 진행`, '| 단계 | 상태 |', '| ---- | ---- |'];

  for (let i = 0; i < graphStates.length; i++) {
    const state = graphStates[i];
    let marker;

    if (TERMINAL_STATES.has(state)) {
      // terminal 상태가 현재면 ✓(done) 또는 ✗(failed), 아니면 — 표시
      if (i === currentIdx) {
        marker = state === 'failed' ? STATE_MARKERS.FAILED : STATE_MARKERS.DONE;
      } else {
        marker = STATE_MARKERS.TERMINAL;
      }
    } else if (currentIdx < 0) {
      // currentState가 graphStates에 없음 — 모든 비-terminal은 알 수 없음으로 표시
      marker = STATE_MARKERS.PENDING;
    } else if (i < currentIdx) {
      marker = STATE_MARKERS.DONE;
    } else if (i === currentIdx) {
      marker = STATE_MARKERS.CURRENT;
    } else {
      marker = STATE_MARKERS.PENDING;
    }

    lines.push(`| ${state} | ${marker} |`);
  }

  return lines.join('\n');
}

function renderMetrics(costUsd, tokens, budgetConfig, depth) {
  const lines = [`${headingPrefix(depth + 1)} 메트릭`];
  lines.push(
    `- 비용: $${costUsd.toFixed(2)} USD${formatBudgetUsage(costUsd, budgetConfig?.maxCostUsd, '예산')}`,
  );
  lines.push(
    `- 토큰: ${formatThousands(tokens)}${formatBudgetUsage(tokens, budgetConfig?.maxTokens, '토큰 예산')}`,
  );
  return lines.join('\n');
}

function formatThousands(n) {
  // ICU 의존 없이 천 단위 콤마 직접 처리
  return Math.round(n)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

function formatBudgetUsage(current, max, label) {
  if (!max || max <= 0) return '';
  const pct = Math.round((current / max) * 100);
  return ` (${label} ${pct}%)`;
}

function renderRisk(riskSignal, depth) {
  const severityLabel =
    SEVERITY_LABEL[riskSignal.severity] || (riskSignal.severity || '').toString().toUpperCase();
  const reason = riskSignal.reason || '';
  const action = riskSignal.suggestedAction || '';
  const lines = [`${headingPrefix(depth + 1)} 위험 신호`, `> ⚠️ ${severityLabel} — ${reason}`];
  if (action) lines.push(`> 권고: ${action}`);
  return lines.join('\n');
}

function renderEvents(events, limit, depth) {
  // 최근 N개를 잘라낸 뒤 reverse — 최신 이벤트가 표 상단에 오도록 의도적 역순.
  const recent = events.slice(-limit).reverse();
  const lines = [`${headingPrefix(depth + 1)} 최근 이벤트`];
  if (recent.length === 0) {
    lines.push('_아직 기록된 이벤트가 없습니다._');
    return lines.join('\n');
  }
  for (const ev of recent) {
    const time = formatTime(ev.timestamp);
    const desc = ev.description ? ` — ${ev.description}` : '';
    lines.push(`- ${time} ${ev.type || 'unknown'}${desc}`);
  }
  return lines.join('\n');
}

function formatTime(timestamp) {
  if (!timestamp) return '--:--:--';
  try {
    const d = new Date(timestamp);
    if (Number.isNaN(d.getTime())) return '--:--:--';
    return d.toISOString().slice(11, 19);
  } catch {
    return '--:--:--';
  }
}

function sanitizeNumber(n) {
  const num = Number(n);
  if (!Number.isFinite(num) || num < 0) return 0;
  return num;
}
