/**
 * auth-manager — 크레덴셜 관리 + OAuth 플로우
 *
 * API Key: 직접 입력 → auth.json 저장
 * OAuth: 로컬 서버 시작 → 브라우저 오픈 → 콜백 수신 → 토큰 교환 → 저장
 *
 * 크레덴셜은 config와 분리 저장 (auth.json).
 */

import { readFile, writeFile, mkdir } from 'fs/promises';
import { resolve } from 'path';
import { homedir } from 'os';
import { randomBytes } from 'crypto';
import { createServer } from 'http';
import { execSync } from 'child_process';

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
const OAUTH_PORT = 9876;

/** OAuth 설정 (프로바이더별) */
const OAUTH_CONFIG = {
  gemini: {
    authEndpoint: 'https://accounts.google.com/o/oauth2/auth',
    tokenEndpoint: 'https://oauth2.googleapis.com/token',
    redirectUri: `http://localhost:${OAUTH_PORT}/callback`,
    scopes: ['https://www.googleapis.com/auth/generative-language'],
  },
};

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

// --- OAuth 인증 ---

/**
 * OAuth 토큰 만료 여부를 확인한다.
 * @param {string} expiresAt - ISO 타임스탬프
 * @returns {boolean}
 */
export function isExpired(expiresAt) {
  if (!expiresAt) return true;
  return new Date(expiresAt) <= new Date();
}

/**
 * OAuth 토큰을 갱신한다.
 * @param {string} providerId
 * @param {object} auth - 현재 인증 정보
 * @returns {Promise<object>} 갱신된 인증 정보
 */
export async function refreshOAuthToken(providerId, auth) {
  const config = OAUTH_CONFIG[providerId];
  if (!config) throw new Error(`OAuth 미지원 프로바이더: ${providerId}`);

  const providerConfig = await loadProviderConfig(providerId);
  const clientId = providerConfig?.oauth?.clientId || '';

  const response = await fetch(config.tokenEndpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      refresh_token: auth.refreshToken,
      client_id: clientId,
      grant_type: 'refresh_token',
    }),
  });

  if (!response.ok) {
    throw new Error(`토큰 갱신 실패 (${response.status}): ${await response.text()}`);
  }

  const data = await response.json();
  const updated = {
    ...auth,
    accessToken: data.access_token,
    expiresAt: new Date(Date.now() + data.expires_in * 1000).toISOString(),
  };

  await saveAuth(providerId, updated);
  return updated;
}

/**
 * OAuth 인증 URL을 생성한다.
 * @param {string} providerId
 * @param {object} options - { clientId }
 * @returns {{ url: string, state: string }}
 */
export function buildOAuthUrl(providerId, options) {
  const config = OAUTH_CONFIG[providerId];
  if (!config) throw new Error(`OAuth 미지원 프로바이더: ${providerId}`);

  const state = randomBytes(16).toString('hex');

  const authUrl = new URL(config.authEndpoint);
  authUrl.searchParams.set('client_id', options.clientId);
  authUrl.searchParams.set('redirect_uri', config.redirectUri);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('scope', config.scopes.join(' '));
  authUrl.searchParams.set('state', state);
  authUrl.searchParams.set('access_type', 'offline');
  authUrl.searchParams.set('prompt', 'consent');

  return { url: authUrl.toString(), state };
}

/**
 * OAuth authorization code로 토큰을 교환한다.
 * @param {string} providerId
 * @param {string} code
 * @param {object} options - { clientId, clientSecret }
 * @returns {Promise<object>} 인증 정보
 */
export async function exchangeOAuthCode(providerId, code, options) {
  const config = OAUTH_CONFIG[providerId];
  if (!config) throw new Error(`OAuth 미지원 프로바이더: ${providerId}`);

  const response = await fetch(config.tokenEndpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: options.clientId,
      client_secret: options.clientSecret,
      redirect_uri: config.redirectUri,
      grant_type: 'authorization_code',
    }),
  });

  if (!response.ok) {
    throw new Error(`토큰 교환 실패 (${response.status}): ${await response.text()}`);
  }

  const data = await response.json();
  const authData = {
    type: 'oauth',
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: new Date(Date.now() + data.expires_in * 1000).toISOString(),
    connectedAt: new Date().toISOString(),
  };

  await saveAuth(providerId, authData);
  await setProviderEnabled(providerId, true);

  return authData;
}

/**
 * OAuth 인증 플로우 실행 (로컬 서버 + 브라우저).
 * @param {string} providerId
 * @param {object} options - { clientId, clientSecret }
 * @returns {Promise<object>} 인증 정보
 */
export async function startOAuthFlow(providerId, options) {
  const { url, state } = buildOAuthUrl(providerId, options);

  const code = await waitForOAuthCallback(url, state);
  return exchangeOAuthCode(providerId, code, options);
}

/**
 * 로컬 서버로 OAuth 콜백 대기.
 * @param {string} authUrl - 브라우저에서 열 인증 URL
 * @param {string} expectedState - CSRF 방지용 state 값
 * @returns {Promise<string>} authorization code
 */
function waitForOAuthCallback(authUrl, expectedState) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      server.close();
      reject(new Error('OAuth 타임아웃 (120초)'));
    }, 120000);

    const server = createServer((req, res) => {
      const url = new URL(req.url, `http://localhost:${OAUTH_PORT}`);

      if (url.pathname !== '/callback') {
        res.writeHead(404);
        res.end();
        return;
      }

      const code = url.searchParams.get('code');
      const state = url.searchParams.get('state');
      const error = url.searchParams.get('error');

      if (error) {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end('<h1>인증 실패</h1><p>터미널로 돌아가세요.</p>');
        clearTimeout(timeout);
        server.close();
        reject(new Error(`OAuth 에러: ${error}`));
        return;
      }

      if (state !== expectedState) {
        res.writeHead(400, { 'Content-Type': 'text/plain' });
        res.end('Invalid state');
        return;
      }

      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end('<h1>인증 완료!</h1><p>이 창을 닫고 터미널로 돌아가세요.</p>');
      clearTimeout(timeout);
      server.close();
      resolve(code);
    });

    server.listen(OAUTH_PORT, () => {
      const cmd = process.platform === 'darwin' ? 'open' :
                  process.platform === 'win32' ? 'start' : 'xdg-open';
      try {
        execSync(`${cmd} "${authUrl}"`);
      } catch {
        // 브라우저 열기 실패 시 URL 출력
        process.stderr.write(`\n브라우저에서 다음 URL을 여세요:\n${authUrl}\n\n`);
      }
    });
  });
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
