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
    // project-manager의 setBaseDir을 사용하여 인스턴스 경로 설정
    // 주의: 동일 프로세스에서 여러 FileStorage 인스턴스를 만들면 마지막 것이 적용됨
    this._initialized = this._init();
  }

  async _init() {
    const { setBaseDir } = await import('../scripts/lib/project-manager.js');
    setBaseDir(this._baseDir);
  }

  async read(id) {
    await this._initialized;
    const { getProject } = await import('../scripts/lib/project-manager.js');
    return getProject(id);
  }

  async write(id, data) {
    await this._initialized;
    const { resolve } = await import('path');
    const { writeFile, mkdir } = await import('fs/promises');
    const dir = resolve(this._baseDir, 'projects', id);
    await mkdir(dir, { recursive: true });
    await writeFile(resolve(dir, 'project.json'), JSON.stringify(data, null, 2), 'utf-8');
  }

  async list() {
    await this._initialized;
    const { listProjects } = await import('../scripts/lib/project-manager.js');
    return listProjects();
  }
}

/**
 * 인메모리 스토리지 (테스트/프로토타이핑용).
 * read/write 모두 structuredClone으로 격리.
 */
export class MemoryStorage {
  constructor() {
    this._store = new Map();
  }

  async read(id) {
    const data = this._store.get(id);
    return data ? structuredClone(data) : null;
  }

  async write(id, data) {
    this._store.set(id, structuredClone(data));
  }

  async list() {
    return [...this._store.values()].map(v => structuredClone(v));
  }
}
