import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdir, rm, readFile, writeFile, stat } from 'fs/promises';
import { resolve, join } from 'path';
import { migrate } from '../scripts/migrate.js';

const TMP_DIR = resolve('.tmp-test-migrate');
const PLUGINS_DIR = join(TMP_DIR, '.claude', 'plugins');
const INSTALLED = join(PLUGINS_DIR, 'installed_plugins.json');
const MARKETPLACES_JSON = join(PLUGINS_DIR, 'known_marketplaces.json');
const CACHE_DIR = join(PLUGINS_DIR, 'cache');
const MKT_DIR = join(PLUGINS_DIR, 'marketplaces');

function makeInstalledOld() {
  return {
    'good-vibe-coding@good-vibe-coding': {
      name: 'good-vibe-coding',
      marketplace: 'good-vibe-coding',
      version: '1.1.0',
      installPath: join(CACHE_DIR, 'good-vibe-coding', 'good-vibe-coding', '1.1.0'),
    },
  };
}

function makeInstalledNew() {
  return {
    'good-vibe@good-vibe': {
      name: 'good-vibe',
      marketplace: 'good-vibe',
      version: '1.1.0',
      installPath: join(CACHE_DIR, 'good-vibe', 'good-vibe', '1.1.0'),
    },
  };
}

function makeMarketplacesOld() {
  return {
    'good-vibe-coding': {
      repo: 'sumsun-dev/good-vibe-coding',
      installLocation: join(MKT_DIR, 'good-vibe-coding'),
    },
  };
}

function makeMarketplacesNew() {
  return {
    'good-vibe': {
      repo: 'sumsun-dev/good-vibe-coding',
      installLocation: join(MKT_DIR, 'good-vibe'),
    },
  };
}

async function setupPluginsDir() {
  await mkdir(PLUGINS_DIR, { recursive: true });
}

async function writeJson(path, data) {
  await writeFile(path, JSON.stringify(data, null, 2), 'utf-8');
}

async function readJson(path) {
  return JSON.parse(await readFile(path, 'utf-8'));
}

async function exists(path) {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

describe('migrate', () => {
  beforeEach(async () => {
    await mkdir(TMP_DIR, { recursive: true });
  });

  afterEach(async () => {
    await rm(TMP_DIR, { recursive: true, force: true });
  });

  it('이미 마이그레이션된 상태면 skip 메시지를 반환한다', async () => {
    await setupPluginsDir();
    await writeJson(INSTALLED, makeInstalledNew());
    await writeJson(MARKETPLACES_JSON, makeMarketplacesNew());

    const result = await migrate(TMP_DIR);

    expect(result.alreadyMigrated).toBe(true);
    expect(result.message).toContain('이미');
  });

  it('installed_plugins.json 키를 변환한다', async () => {
    await setupPluginsDir();
    await writeJson(INSTALLED, makeInstalledOld());
    await writeJson(MARKETPLACES_JSON, makeMarketplacesOld());
    await mkdir(join(CACHE_DIR, 'good-vibe-coding'), { recursive: true });
    await mkdir(join(MKT_DIR, 'good-vibe-coding'), { recursive: true });

    await migrate(TMP_DIR);

    const installed = await readJson(INSTALLED);
    expect(installed).toHaveProperty('good-vibe@good-vibe');
    expect(installed).not.toHaveProperty('good-vibe-coding@good-vibe-coding');
    expect(installed['good-vibe@good-vibe'].name).toBe('good-vibe');
    expect(installed['good-vibe@good-vibe'].marketplace).toBe('good-vibe');
  });

  it('known_marketplaces.json 키를 변환한다', async () => {
    await setupPluginsDir();
    await writeJson(INSTALLED, makeInstalledOld());
    await writeJson(MARKETPLACES_JSON, makeMarketplacesOld());
    await mkdir(join(CACHE_DIR, 'good-vibe-coding'), { recursive: true });
    await mkdir(join(MKT_DIR, 'good-vibe-coding'), { recursive: true });

    await migrate(TMP_DIR);

    const marketplaces = await readJson(MARKETPLACES_JSON);
    expect(marketplaces).toHaveProperty('good-vibe');
    expect(marketplaces).not.toHaveProperty('good-vibe-coding');
  });

  it('cache 및 marketplaces 디렉토리 이름을 변경한다', async () => {
    await setupPluginsDir();
    await writeJson(INSTALLED, makeInstalledOld());
    await writeJson(MARKETPLACES_JSON, makeMarketplacesOld());
    await mkdir(join(CACHE_DIR, 'good-vibe-coding'), { recursive: true });
    await mkdir(join(MKT_DIR, 'good-vibe-coding'), { recursive: true });

    await migrate(TMP_DIR);

    expect(await exists(join(CACHE_DIR, 'good-vibe'))).toBe(true);
    expect(await exists(join(CACHE_DIR, 'good-vibe-coding'))).toBe(false);
    expect(await exists(join(MKT_DIR, 'good-vibe'))).toBe(true);
    expect(await exists(join(MKT_DIR, 'good-vibe-coding'))).toBe(false);
  });

  it('플러그인 디렉토리가 없으면 graceful skip한다', async () => {
    // PLUGINS_DIR을 생성하지 않음
    const result = await migrate(TMP_DIR);

    expect(result.skipped).toBe(true);
    expect(result.message).toContain('설치');
  });

  it('부분 마이그레이션 상태에서 나머지만 처리한다', async () => {
    await setupPluginsDir();
    // installed는 이미 새 이름, marketplaces는 아직 옛 이름
    await writeJson(INSTALLED, makeInstalledNew());
    await writeJson(MARKETPLACES_JSON, makeMarketplacesOld());
    // cache는 이미 이동됨, marketplaces는 아직
    await mkdir(join(CACHE_DIR, 'good-vibe'), { recursive: true });
    await mkdir(join(MKT_DIR, 'good-vibe-coding'), { recursive: true });

    const result = await migrate(TMP_DIR);

    expect(result.alreadyMigrated).toBeFalsy();
    expect(result.skipped).toBeFalsy();

    const marketplaces = await readJson(MARKETPLACES_JSON);
    expect(marketplaces).toHaveProperty('good-vibe');
    expect(marketplaces).not.toHaveProperty('good-vibe-coding');
    expect(await exists(join(MKT_DIR, 'good-vibe'))).toBe(true);
    expect(await exists(join(MKT_DIR, 'good-vibe-coding'))).toBe(false);
  });
});
