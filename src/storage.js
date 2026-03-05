/**
 * storage — SDK 스토리지 추상화
 * FileStorage (파일시스템), MemoryStorage (인메모리), 커스텀 스토리지 지원.
 */

/**
 * 스토리지 입력을 적절한 구현체로 변환한다.
 * @param {string|object} input - 'memory', 경로 문자열, 또는 { read, write, list } 객체
 * @returns {object} 스토리지 인터페이스
 */
export function resolveStorage(input) {
  if (input === 'memory') return new MemoryStorage();
  if (typeof input === 'string') return new FileStorage(input);
  if (typeof input === 'object' && input !== null && typeof input.read === 'function') return input;
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
    const { resolve } = await import('path');
    const { readFile } = await import('fs/promises');
    const filePath = resolve(this._baseDir, id, 'project.json');
    try {
      const content = await readFile(filePath, 'utf-8');
      return JSON.parse(content);
    } catch (err) {
      if (err.code === 'ENOENT') return null;
      throw err;
    }
  }

  async write(id, data) {
    const { resolve } = await import('path');
    const { writeFile, mkdir } = await import('fs/promises');
    const dir = resolve(this._baseDir, id);
    await mkdir(dir, { recursive: true });
    await writeFile(resolve(dir, 'project.json'), JSON.stringify(data, null, 2), 'utf-8');
  }

  async list() {
    const { resolve } = await import('path');
    const { readdir, readFile } = await import('fs/promises');
    try {
      const entries = await readdir(this._baseDir, { withFileTypes: true });
      const projects = [];
      for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        const filePath = resolve(this._baseDir, entry.name, 'project.json');
        try {
          const content = await readFile(filePath, 'utf-8');
          projects.push(JSON.parse(content));
        } catch {
          // skip invalid entries
        }
      }
      return projects;
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
