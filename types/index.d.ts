/**
 * good-vibe SDK 타입 정의
 */

// --- Storage ---

export interface StorageInterface {
  read(id: string): Promise<Record<string, unknown> | null>;
  write(id: string, data: Record<string, unknown>): Promise<void>;
  list(): Promise<Record<string, unknown>[]>;
}

export declare class FileStorage implements StorageInterface {
  constructor(baseDir: string);
  read(id: string): Promise<Record<string, unknown> | null>;
  write(id: string, data: Record<string, unknown>): Promise<void>;
  list(): Promise<Record<string, unknown>[]>;
}

export declare class MemoryStorage implements StorageInterface {
  constructor();
  read(id: string): Promise<Record<string, unknown> | null>;
  write(id: string, data: Record<string, unknown>): Promise<void>;
  list(): Promise<Record<string, unknown>[]>;
}

// --- LLM ---

export interface LLMResponse {
  text: string;
  provider: string;
  model: string;
  tokenCount: number;
}

// --- Team & Complexity ---

export interface AgentMember {
  roleId: string;
  role: string;
  emoji: string;
  description: string;
  model?: string;
  personality?: string;
}

export interface ComplexityInfo {
  level: 'simple' | 'medium' | 'complex';
  discussionRounds: number;
  teamSize: { min: number; max: number };
  modelDistribution: Record<string, string>;
}

export interface Team {
  mode: 'quick-build' | 'plan-execute' | 'plan-only';
  agents: AgentMember[];
  optional?: string[];
  complexity: ComplexityInfo;
  idea: string;
  type: string;
  projectId?: string;
}

export interface BuildTeamOptions {
  projectType?: string;
  complexity?: 'simple' | 'medium' | 'complex';
  personalityChoices?: Record<string, string>;
}

// --- Discussion ---

export interface ConvergenceResult {
  converged: boolean;
  approvalRate: number;
  reason?: string;
  blockers?: string[];
}

export interface DiscussResult {
  document: string;
  rounds: number;
  convergence: ConvergenceResult;
}

export interface DiscussHooks {
  onRoundComplete?: (round: number, convergence: ConvergenceResult) => void | Promise<void>;
  onAgentCall?: (roleId: string, response: LLMResponse) => void;
  onError?: (type: string, error: Error) => void;
}

// --- Execution ---

export interface TaskItem {
  id: string;
  title?: string;
  description?: string;
  assignee: string;
  phase?: number;
  type?: string;
}

export interface EscalationContext {
  phase: number;
  failureContext: {
    attempt: number;
    maxAttempts: number;
    issues: Array<{
      description: string;
      severity: string;
      category: string;
    }>;
    previousAttempts: unknown[];
  };
}

export interface PhaseContext {
  phase: number;
  phaseResults?: Record<string, unknown>;
}

export interface CommitStep {
  action: 'commit';
  phase: number;
}

export interface ConfirmStep {
  action: 'confirm-next-phase';
  phase: number;
  context?: PhaseContext;
}

export interface ReviewStep {
  action: 'review-intervention';
  phase: number;
  reviews?: unknown[];
}

export interface ExecuteHooks {
  onEscalation?: (context: EscalationContext) => Promise<'continue' | 'skip' | 'abort'>;
  onPhaseComplete?: (phase: number, context: PhaseContext) => void | Promise<void>;
  onAgentCall?: (roleId: string, response: LLMResponse) => void;
  onCommit?: (step: CommitStep) => void | Promise<void>;
  onConfirmPhase?: (step: ConfirmStep) => Promise<boolean | { proceed: boolean; phaseGuidance?: string }>;
  onReviewIntervention?: (step: ReviewStep) => Promise<{ decision: 'proceed' | 'revise'; revisionGuidance?: string }>;
}

export interface JournalEntry {
  action: string;
  phase: number;
  result: Record<string, unknown>;
}

export interface ExecuteResult {
  status: 'completed' | 'paused' | 'not-started' | 'stuck' | 'max-steps-exceeded';
  projectId: string;
  journal: JournalEntry[];
}

export interface ExecutionStep {
  action: string;
  phase: number;
  tasks?: TaskItem[];
  context?: Record<string, unknown>;
  proceed: () => Promise<void>;
  decide: (decision: 'continue' | 'skip' | 'abort') => Promise<void>;
}

export interface Plan {
  document?: string;
  team?: AgentMember[];
  tasks?: TaskItem[];
  projectId?: string;
}

export interface ProviderConfig {
  providers: Record<string, { model: string }>;
}

// --- GoodVibe Options ---

export interface GoodVibeOptions {
  provider?: 'claude' | 'openai' | 'gemini';
  model?: string;
  storage?: string | StorageInterface;
}

// --- Main Classes ---

export declare class GoodVibe {
  constructor(options?: GoodVibeOptions);

  buildTeam(idea: string, options?: BuildTeamOptions): Promise<Team>;
  discuss(team: Team, hooks?: DiscussHooks): Promise<DiscussResult>;
  execute(plan: Plan, hooks?: ExecuteHooks): Promise<ExecuteResult>;
  executeSteps(plan: Plan): AsyncGenerator<ExecutionStep, void, unknown>;
  report(result: ExecuteResult | Record<string, unknown>): string;
}

export declare class Discusser {
  constructor(options: {
    provider: string;
    model: string;
    storage: StorageInterface;
    hooks?: DiscussHooks;
  });

  run(team: Team): Promise<DiscussResult>;
}

export declare class Executor {
  constructor(options: {
    provider: string;
    model: string;
    storage: StorageInterface;
    hooks?: ExecuteHooks;
    maxSteps?: number;
    enableCrossModel?: boolean;
    providerConfig?: ProviderConfig | null;
  });

  run(plan: Plan): Promise<ExecuteResult>;
  steps(plan: Plan): AsyncGenerator<ExecutionStep, void, unknown>;
}
