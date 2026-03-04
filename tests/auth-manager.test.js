import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import {
  setAuthDir,
  setProvidersDir,
  resetDirs,
  loadAuth,
  saveAuth,
  removeAuth,
  listConnectedProviders,
  loadProvidersConfig,
  loadProviderConfig,
  saveProvidersConfig,
  setProviderEnabled,
  setReviewStrategy,
  connectWithApiKey,
  getProviderStatus,
} from '../scripts/lib/llm/auth-manager.js';

let tempDir;

beforeEach(() => {
  tempDir = mkdtempSync(join(tmpdir(), 'auth-test-'));
  setAuthDir(tempDir);
  setProvidersDir(tempDir);
});

afterEach(() => {
  resetDirs();
  try {
    rmSync(tempDir, { recursive: true });
  } catch {
    // expected
  }
});

// --- 크레덴셜 CRUD ---

describe('saveAuth / loadAuth', () => {
  it('인증 정보를 저장하고 로딩한다', async () => {
    await saveAuth('claude', { type: 'api-key', apiKey: 'sk-test' });
    const auth = await loadAuth('claude');
    expect(auth).toEqual({ type: 'api-key', apiKey: 'sk-test' });
  });

  it('존재하지 않는 프로바이더는 null을 반환한다', async () => {
    const auth = await loadAuth('nonexistent');
    expect(auth).toBeNull();
  });

  it('여러 프로바이더를 독립적으로 저장한다', async () => {
    await saveAuth('claude', { type: 'api-key', apiKey: 'sk-claude' });
    await saveAuth('openai', { type: 'api-key', apiKey: 'sk-openai' });

    const claude = await loadAuth('claude');
    const openai = await loadAuth('openai');
    expect(claude.apiKey).toBe('sk-claude');
    expect(openai.apiKey).toBe('sk-openai');
  });

  it('같은 프로바이더를 덮어쓴다', async () => {
    await saveAuth('claude', { type: 'api-key', apiKey: 'old-key' });
    await saveAuth('claude', { type: 'api-key', apiKey: 'new-key' });
    const auth = await loadAuth('claude');
    expect(auth.apiKey).toBe('new-key');
  });
});

describe('removeAuth', () => {
  it('인증 정보를 제거한다', async () => {
    await saveAuth('claude', { type: 'api-key', apiKey: 'sk-test' });
    await removeAuth('claude');
    const auth = await loadAuth('claude');
    expect(auth).toBeNull();
  });

  it('다른 프로바이더에 영향을 주지 않는다', async () => {
    await saveAuth('claude', { type: 'api-key', apiKey: 'sk-claude' });
    await saveAuth('openai', { type: 'api-key', apiKey: 'sk-openai' });
    await removeAuth('claude');
    const openai = await loadAuth('openai');
    expect(openai.apiKey).toBe('sk-openai');
  });
});

describe('listConnectedProviders', () => {
  it('연결된 프로바이더 목록을 반환한다', async () => {
    await saveAuth('claude', { type: 'api-key', apiKey: 'sk-test', connectedAt: '2025-01-01' });
    await saveAuth('openai', { type: 'api-key', apiKey: 'sk-test2' });
    const list = await listConnectedProviders();
    expect(list).toHaveLength(2);
    expect(list[0].providerId).toBe('claude');
    expect(list[0].type).toBe('api-key');
    expect(list[1].providerId).toBe('openai');
  });

  it('비어있으면 빈 배열을 반환한다', async () => {
    const list = await listConnectedProviders();
    expect(list).toEqual([]);
  });
});

describe('loadAllAuth error propagation', () => {
  it('JSON 파싱 에러는 전파한다', async () => {
    const { writeFileSync } = await import('fs');
    const authPath = join(tempDir, 'auth.json');
    writeFileSync(authPath, '{ invalid json !!!', 'utf-8');
    await expect(loadAuth('claude')).rejects.toThrow();
  });
});

describe('loadProvidersConfig error propagation', () => {
  it('JSON 파싱 에러는 전파한다', async () => {
    const { writeFileSync } = await import('fs');
    const configPath = join(tempDir, 'providers.json');
    writeFileSync(configPath, '{ broken json', 'utf-8');
    await expect(loadProvidersConfig()).rejects.toThrow();
  });
});

// --- 프로바이더 설정 ---

describe('loadProvidersConfig', () => {
  it('기본 설정을 반환한다 (파일 없을 때)', async () => {
    const config = await loadProvidersConfig();
    expect(config.defaultProvider).toBe('claude');
    expect(config.providers.claude.enabled).toBe(true);
    expect(config.providers.openai.enabled).toBe(false);
    expect(config.providers.gemini.enabled).toBe(false);
  });

  it('저장된 설정을 로딩한다', async () => {
    await saveProvidersConfig({
      defaultProvider: 'openai',
      reviewStrategy: 'cross-model',
      providers: {},
    });
    const config = await loadProvidersConfig();
    expect(config.defaultProvider).toBe('openai');
    expect(config.reviewStrategy).toBe('cross-model');
  });
});

describe('loadProviderConfig', () => {
  it('특정 프로바이더 설정을 반환한다', async () => {
    const config = await loadProviderConfig('claude');
    expect(config.enabled).toBe(true);
    expect(config.model).toBe('claude-sonnet-4-6');
  });

  it('없는 프로바이더는 null을 반환한다', async () => {
    const config = await loadProviderConfig('nonexistent');
    expect(config).toBeNull();
  });
});

describe('setProviderEnabled', () => {
  it('프로바이더를 활성화한다', async () => {
    await setProviderEnabled('openai', true);
    const config = await loadProviderConfig('openai');
    expect(config.enabled).toBe(true);
  });

  it('알 수 없는 프로바이더는 에러를 던진다', async () => {
    await expect(setProviderEnabled('unknown', true)).rejects.toThrow('알 수 없는 프로바이더');
  });
});

describe('setReviewStrategy', () => {
  it('cross-model 전략을 설정한다', async () => {
    await setReviewStrategy('cross-model');
    const config = await loadProvidersConfig();
    expect(config.reviewStrategy).toBe('cross-model');
  });

  it('single 전략을 설정한다', async () => {
    await setReviewStrategy('single');
    const config = await loadProvidersConfig();
    expect(config.reviewStrategy).toBe('single');
  });

  it('잘못된 전략은 에러를 던진다', async () => {
    await expect(setReviewStrategy('invalid')).rejects.toThrow('잘못된 전략');
  });
});

// --- API Key 인증 ---

describe('connectWithApiKey', () => {
  it('API Key로 연결하고 프로바이더를 활성화한다', async () => {
    const auth = await connectWithApiKey('openai', 'sk-test-key');
    expect(auth.type).toBe('api-key');
    expect(auth.apiKey).toBeUndefined(); // 반환값에 apiKey를 포함하지 않음 (보안)
    expect(auth.connectedAt).toBeTruthy();

    // auth.json에 저장 확인
    const loaded = await loadAuth('openai');
    expect(loaded.apiKey).toBe('sk-test-key');

    // 프로바이더 활성화 확인
    const config = await loadProviderConfig('openai');
    expect(config.enabled).toBe(true);
  });

  it('빈 API Key는 에러를 던진다', async () => {
    await expect(connectWithApiKey('openai', '')).rejects.toThrow('API Key가 비어있습니다');
    await expect(connectWithApiKey('openai', '  ')).rejects.toThrow('API Key가 비어있습니다');
  });

  it('유효하지 않은 프로바이더 ID는 에러를 던진다', async () => {
    await expect(connectWithApiKey('invalid-provider', 'sk-key')).rejects.toThrow('유효하지 않은 프로바이더');
    await expect(connectWithApiKey(null, 'sk-key')).rejects.toThrow('유효하지 않은 프로바이더');
  });

  it('API Key 앞뒤 공백을 제거한다', async () => {
    await connectWithApiKey('claude', '  sk-trimmed  ');
    const auth = await loadAuth('claude');
    expect(auth.apiKey).toBe('sk-trimmed');
  });

  it('반환값에 apiKey가 노출되지 않는다 (보안)', async () => {
    const result = await connectWithApiKey('claude', 'sk-secret-key');
    expect(result.apiKey).toBeUndefined();
    expect(JSON.stringify(result)).not.toContain('sk-secret-key');
  });

  it('알 수 없는 프로바이더는 에러를 던진다', async () => {
    await expect(connectWithApiKey('unknown-provider', 'sk-test')).rejects.toThrow(
      '유효하지 않은 프로바이더',
    );
  });

  it('null API Key는 에러를 던진다', async () => {
    await expect(connectWithApiKey('claude', null)).rejects.toThrow();
  });
});

// --- 상태 요약 ---

describe('getProviderStatus', () => {
  it('전체 프로바이더 상태를 반환한다', async () => {
    await connectWithApiKey('claude', 'sk-test');
    const status = await getProviderStatus();

    expect(status.defaultProvider).toBe('claude');
    expect(status.providers.claude.connected).toBe(true);
    expect(status.providers.claude.enabled).toBe(true);
    expect(status.providers.openai.connected).toBe(false);
    expect(status.providers.gemini.connected).toBe(false);
  });

  it('연결 없으면 모두 disconnected', async () => {
    const status = await getProviderStatus();
    expect(status.providers.claude.connected).toBe(false);
    expect(status.providers.openai.connected).toBe(false);
    expect(status.providers.gemini.connected).toBe(false);
  });
});
