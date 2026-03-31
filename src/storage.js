/**
 * storage — SDK 스토리지 추상화
 * FileStorage (파일시스템), MemoryStorage (인메모리), 커스텀 스토리지 지원.
 */

import { resolve, normalize, sep } from 'path';

/**
 * resolvedPath가 rootDir 내부에 있는지 검증한다.
 * @param {string} resolvedPath
 * @param {string} rootDir
 */
function assertIdWithinBase(resolvedPath, rootDir) {
  const np = normalize(resolvedPath).toLowerCase();
  const nr = normalize(rootDir).toLowerCase();
  if (!np.startsWith(nr + sep) && np !== nr) {
    throw new Error(`스토리지 경로가 허용 범위를 벗어났습니다 (baseDir: ${rootDir})`);
  }
}

/**
 * 스토리지 입력을 적절한 구현체로 변환한다.
 * @param {string|object} input - 'memory', 경로 문자열, 또는 { read, write, list } 객체
 * @returns {object} 스토리지 인터페이스
 */
export function resolveStorage(input) {
  if (input === 'memory') return new MemoryStorage();
  if (typeof input === 'string') return new FileStorage(input);
  if (typeof input === 'object' && input !== null && typeof input.read === 'function') return input;
  if (typeof input === 'object' && input !== null) {
    // eslint-disable-next-line no-console
    console.warn(
      '[good-vibe] 커스텀 스토리지에 read() 메서드가 없어 MemoryStorage로 폴백합니다. ' +
        '커스텀 스토리지는 { read(id), write(id, data), list() } 인터페이스를 구현해야 합니다.',
    );
  }
  return new MemoryStorage();
}

/**
 * 파일시스템 기반 스토리지.
 * project-manager.js를 래핑하되, 인스턴스 내부에서 경로를 관리한다.
 * 전역 app-paths 상태를 변경하지 않음.
 */
export class FileStorage {
  constructor(baseDir) {
    this._baseDir = baseDir;
  }

  async read(id) {
    const { readFile } = await import('fs/promises');
    const dir = resolve(this._baseDir, id);
    assertIdWithinBase(dir, this._baseDir);
    const filePath = resolve(dir, 'project.json');
    try {
      const content = await readFile(filePath, 'utf-8');
      return JSON.parse(content);
    } catch (err) {
      if (err.code === 'ENOENT') return null;
      throw err;
    }
  }

  async write(id, data) {
    const { writeFile, mkdir } = await import('fs/promises');
    const dir = resolve(this._baseDir, id);
    assertIdWithinBase(dir, this._baseDir);
    await mkdir(dir, { recursive: true });
    await writeFile(resolve(dir, 'project.json'), JSON.stringify(data, null, 2), 'utf-8');
  }

  async list() {
    const { readdir, readFile } = await import('fs/promises');
    try {
      const entries = await readdir(this._baseDir, { withFileTypes: true });
      const dirs = entries.filter((e) => e.isDirectory());
      const results = await Promise.all(
        dirs.map(async (entry) => {
          const filePath = resolve(this._baseDir, entry.name, 'project.json');
          try {
            const content = await readFile(filePath, 'utf-8');
            return JSON.parse(content);
          } catch {
            return null;
          }
        }),
      );
      return results.filter(Boolean);
    } catch (err) {
      if (err.code === 'ENOENT') return [];
      throw err;
    }
  }
}

/**
 * structuredClone의 안전한 래퍼. 순환 참조 시 JSON fallback.
 */
function safeClone(data) {
  try {
    return structuredClone(data);
  } catch {
    try {
      return JSON.parse(JSON.stringify(data));
    } catch {
      return data; // 최악의 경우 원본 반환 (얕은 복사 리스크)
    }
  }
}

/**
 * 인메모리 스토리지 (테스트/프로토타이핑용).
 * read/write 모두 safeClone으로 격리.
 */
export class MemoryStorage {
  constructor() {
    this._store = new Map();
  }

  async read(id) {
    const data = this._store.get(id);
    return data ? safeClone(data) : null;
  }

  async write(id, data) {
    this._store.set(id, safeClone(data));
  }

  async list() {
    return [...this._store.values()].map((v) => safeClone(v));
  }
}
