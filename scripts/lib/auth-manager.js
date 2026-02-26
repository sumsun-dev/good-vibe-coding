/**
 * auth-manager — 크레덴셜 관리
 *
 * API Key: 직접 입력 → auth.json 저장
 * CLI: Gemini CLI 자체 인증 활용
 *
 * 크레덴셜은 config와 분리 저장 (auth.json).
 */

import { readFile, writeFile, mkdir } from 'fs/promises';
import { resolve } from 'path';
import { homedir } from 'os';

const DEFAULT_AUTH_DIR = resolve(homedir(), '.claude', 'good-vibe');
const DEFAULT_PROVIDERS_DIR = DEFAULT_AUTH_DIR;

let authDir = DEFAULT_AUTH_DIR;
let providersDir = DEFAULT_PROVIDERS_DIR;

/** 테스트용 디렉토리 오버라이드 */
export function setAuthDir(dir) { authDir = dir; }
export function setProvidersDir(dir) { providersDir = dir; }
export function resetDirs() { authDir = DEFAULT_AUTH_DIR; providersDir = DEFAULT_PROVIDERS_DIR; }

const AUTH_FILENAME = 'auth.json';
const PROVIDERS_FILENAME = 'providers.json';

/** 기본 프로바이더 설정 */
const DEFAULT_PROVIDERS_CONFIG = {
  defaultProvider: 'claude',
  reviewStrategy: 'single',
  providers: {
    claude: {
      enabled: true,
      authType: 'api-key',
      model: 'claude-sonnet-4-6',
    },
    openai: {
      enabled: false,
      authType: 'api-key',
      model: 'gpt-4o',
    },
    gemini: {
      enabled: false,
      authType: 'cli',
      model: 'gemini-2.0-flash',
    },
  },
};

// --- 크레덴셜 CRUD ---

/**
 * 전체 인증 데이터를 로딩한다.
 * @returns {Promise<object>}
 */
async function loadAllAuth() {
  const authPath = resolve(authDir, AUTH_FILENAME);
  try {
    const content = await readFile(authPath, 'utf-8');
    return JSON.parse(content);
  } catch {
    return {};
  }
}

/**
 * 전체 인증 데이터를 저장한다.
 * @param {object} allAuth
 */
async function saveAllAuth(allAuth) {
  await mkdir(authDir, { recursive: true });
  const authPath = resolve(authDir, AUTH_FILENAME);
  await writeFile(authPath, JSON.stringify(allAuth, null, 2), 'utf-8');
}

/**
 * 프로바이더 인증 정보를 로딩한다.
 * @param {string} providerId
 * @returns {Promise<object|null>}
 */
export async function loadAuth(providerId) {
  const allAuth = await loadAllAuth();
  return allAuth[providerId] || null;
}

/**
 * 프로바이더 인증 정보를 저장한다.
 * @param {string} providerId
 * @param {object} authData
 */
export async function saveAuth(providerId, authData) {
  const allAuth = await loadAllAuth();
  const updated = { ...allAuth, [providerId]: authData };
  await saveAllAuth(updated);
}

/**
 * 프로바이더 인증 정보를 제거한다.
 * @param {string} providerId
 */
export async function removeAuth(providerId) {
  const allAuth = await loadAllAuth();
  const { [providerId]: _, ...rest } = allAuth;
  await saveAllAuth(rest);
}

/**
 * 연결된 프로바이더 목록을 반환한다.
 * @returns {Promise<Array<{ providerId: string, type: string, connectedAt?: string }>>}
 */
export async function listConnectedProviders() {
  const allAuth = await loadAllAuth();
  return Object.entries(allAuth).map(([id, auth]) => ({
    providerId: id,
    type: auth.type || 'api-key',
    connectedAt: auth.connectedAt || null,
  }));
}

// --- 프로바이더 설정 ---

/**
 * 프로바이더 설정을 로딩한다.
 * @returns {Promise<object>}
 */
export async function loadProvidersConfig() {
  const configPath = resolve(providersDir, PROVIDERS_FILENAME);
  try {
    const content = await readFile(configPath, 'utf-8');
    return JSON.parse(content);
  } catch {
    return { ...DEFAULT_PROVIDERS_CONFIG };
  }
}

/**
 * 특정 프로바이더 설정을 로딩한다.
 * @param {string} providerId
 * @returns {Promise<object|null>}
 */
export async function loadProviderConfig(providerId) {
  const config = await loadProvidersConfig();
  return config.providers?.[providerId] || null;
}

/**
 * 프로바이더 설정을 저장한다.
 * @param {object} config
 */
export async function saveProvidersConfig(config) {
  await mkdir(providersDir, { recursive: true });
  const configPath = resolve(providersDir, PROVIDERS_FILENAME);
  await writeFile(configPath, JSON.stringify(config, null, 2), 'utf-8');
}

/**
 * 프로바이더를 활성화/비활성화한다.
 * @param {string} providerId
 * @param {boolean} enabled
 */
export async function setProviderEnabled(providerId, enabled) {
  const config = await loadProvidersConfig();
  if (!config.providers[providerId]) {
    throw new Error(`알 수 없는 프로바이더: ${providerId}`);
  }
  config.providers[providerId] = { ...config.providers[providerId], enabled };
  await saveProvidersConfig(config);
}

/**
 * 리뷰 전략을 설정한다.
 * @param {'single' | 'cross-model'} strategy
 */
export async function setReviewStrategy(strategy) {
  if (strategy !== 'single' && strategy !== 'cross-model') {
    throw new Error(`잘못된 전략: ${strategy}. 'single' 또는 'cross-model' 사용`);
  }
  const config = await loadProvidersConfig();
  config.reviewStrategy = strategy;
  await saveProvidersConfig(config);
}

// --- API Key 인증 ---

/**
 * API Key로 인증한다.
 * @param {string} providerId - 'claude' | 'openai'
 * @param {string} apiKey
 * @returns {Promise<object>}
 */
export async function connectWithApiKey(providerId, apiKey) {
  if (!apiKey || apiKey.trim() === '') {
    throw new Error('API Key가 비어있습니다');
  }

  const authData = {
    type: 'api-key',
    apiKey: apiKey.trim(),
    connectedAt: new Date().toISOString(),
  };

  await saveAuth(providerId, authData);
  await setProviderEnabled(providerId, true);

  return authData;
}

// --- CLI 인증 (Gemini) ---

/**
 * Gemini CLI로 인증한다.
 * CLI가 자체 인증을 처리하므로 연결 메타데이터만 저장.
 * @returns {Promise<object>}
 */
export async function connectGeminiCli() {
  const authData = {
    type: 'cli',
    connectedAt: new Date().toISOString(),
  };

  await saveAuth('gemini', authData);
  await setProviderEnabled('gemini', true);

  return authData;
}

/**
 * 프로바이더 연결 상태 요약을 반환한다.
 * @returns {Promise<object>}
 */
export async function getProviderStatus() {
  const config = await loadProvidersConfig();
  const connected = await listConnectedProviders();
  const connectedIds = new Set(connected.map(c => c.providerId));

  const status = {};
  for (const [id, provConfig] of Object.entries(config.providers)) {
    status[id] = {
      enabled: provConfig.enabled,
      authType: provConfig.authType,
      model: provConfig.model,
      connected: connectedIds.has(id),
    };
  }

  return {
    defaultProvider: config.defaultProvider,
    reviewStrategy: config.reviewStrategy,
    providers: status,
  };
}
