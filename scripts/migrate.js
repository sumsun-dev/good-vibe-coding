import { readFile, writeFile, rename, stat } from 'fs/promises';
import { resolve, join } from 'path';
import { homedir } from 'os';
import { fileURLToPath } from 'url';

const OLD_NAME = 'good-vibe-coding';
const NEW_NAME = 'good-vibe';

async function exists(path) {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

async function readJson(path) {
  return JSON.parse(await readFile(path, 'utf-8'));
}

async function writeJson(path, data) {
  await writeFile(path, JSON.stringify(data, null, 2), 'utf-8');
}

async function renameDir(oldPath, newPath) {
  if (await exists(oldPath)) {
    if (await exists(newPath)) return false;
    await rename(oldPath, newPath);
    return true;
  }
  return false;
}

/**
 * @param {string} [homeOverride] - 테스트용 홈 디렉토리 오버라이드
 */
export async function migrate(homeOverride) {
  const home = homeOverride || homedir();
  const pluginsDir = join(home, '.claude', 'plugins');
  const installedPath = join(pluginsDir, 'installed_plugins.json');
  const marketplacesPath = join(pluginsDir, 'known_marketplaces.json');
  const cacheDir = join(pluginsDir, 'cache');
  const mktDir = join(pluginsDir, 'marketplaces');

  if (!(await exists(pluginsDir))) {
    return { skipped: true, message: '플러그인이 설치되지 않았습니다.' };
  }

  const steps = [];
  let hasOldRef = false;

  // 1. installed_plugins.json 업데이트
  if (await exists(installedPath)) {
    const installed = await readJson(installedPath);
    const oldKey = Object.keys(installed).find((k) => k.includes(OLD_NAME));
    if (oldKey) {
      hasOldRef = true;
      const newKey = oldKey.replaceAll(OLD_NAME, NEW_NAME);
      const updated = {};
      for (const [k, v] of Object.entries(installed)) {
        if (k === oldKey) {
          updated[newKey] = {
            ...v,
            name: v.name.replaceAll(OLD_NAME, NEW_NAME),
            marketplace: v.marketplace.replaceAll(OLD_NAME, NEW_NAME),
            installPath: v.installPath.replaceAll(OLD_NAME, NEW_NAME),
          };
        } else {
          updated[k] = v;
        }
      }
      await writeJson(installedPath, updated);
      steps.push('installed_plugins.json 업데이트');
    }
  }

  // 2. known_marketplaces.json 업데이트
  if (await exists(marketplacesPath)) {
    const marketplaces = await readJson(marketplacesPath);
    if (marketplaces[OLD_NAME]) {
      hasOldRef = true;
      const updated = {};
      for (const [k, v] of Object.entries(marketplaces)) {
        if (k === OLD_NAME) {
          updated[NEW_NAME] = {
            ...v,
            installLocation: v.installLocation.replaceAll(OLD_NAME, NEW_NAME),
          };
        } else {
          updated[k] = v;
        }
      }
      await writeJson(marketplacesPath, updated);
      steps.push('known_marketplaces.json 업데이트');
    }
  }

  // 3. 디렉토리 이름 변경
  if (await renameDir(join(cacheDir, OLD_NAME), join(cacheDir, NEW_NAME))) {
    hasOldRef = true;
    steps.push('cache 디렉토리 이동');
  }
  if (await renameDir(join(mktDir, OLD_NAME), join(mktDir, NEW_NAME))) {
    hasOldRef = true;
    steps.push('marketplaces 디렉토리 이동');
  }

  if (!hasOldRef && steps.length === 0) {
    return { alreadyMigrated: true, message: '이미 마이그레이션이 완료된 상태입니다.' };
  }

  return {
    success: true,
    steps,
    message: `마이그레이션 완료: ${steps.join(', ')}`,
  };
}

// CLI 실행
const __filename = fileURLToPath(import.meta.url);
const isDirectRun = process.argv[1] && resolve(process.argv[1]) === resolve(__filename);
if (isDirectRun) {
  migrate()
    .then((result) => {
      console.log(result.message); // eslint-disable-line no-console
      if (result.steps) {
        result.steps.forEach((s) => console.log(`  - ${s}`)); // eslint-disable-line no-console
      }
    })
    .catch((err) => {
      console.error(`마이그레이션 실패: ${err.message}`); // eslint-disable-line no-console
      console.error('\n수동 마이그레이션:'); // eslint-disable-line no-console
      console.error('  1. /plugin uninstall good-vibe-coding'); // eslint-disable-line no-console
      console.error('  2. /plugin marketplace update good-vibe'); // eslint-disable-line no-console
      console.error('  3. /plugin install good-vibe@good-vibe'); // eslint-disable-line no-console
    });
}
