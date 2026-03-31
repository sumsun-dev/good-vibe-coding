import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { MemoryStorage, FileStorage, resolveStorage } from '../../src/storage.js';
import { mkdir, rm } from 'fs/promises';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const TMP_DIR = resolve(__dirname, '../../.tmp-test-storage');

describe('MemoryStorage', () => {
  let storage;

  beforeEach(() => {
    storage = new MemoryStorage();
  });

  it('read: 존재하지 않는 ID는 null을 반환한다', async () => {
    const result = await storage.read('nonexistent');
    expect(result).toBeNull();
  });

  it('write/read: 데이터를 저장하고 읽을 수 있다', async () => {
    const data = { id: 'test-1', name: 'Test Project' };
    await storage.write('test-1', data);
    const result = await storage.read('test-1');
    expect(result).toEqual(data);
  });

  it('write: 깊은 복사를 수행한다 (원본 변경 미영향)', async () => {
    const data = { id: 'test-1', nested: { value: 1 } };
    await storage.write('test-1', data);
    data.nested.value = 999;
    const result = await storage.read('test-1');
    expect(result.nested.value).toBe(1);
  });

  it('list: 모든 저장된 데이터를 반환한다', async () => {
    await storage.write('a', { id: 'a' });
    await storage.write('b', { id: 'b' });
    const list = await storage.list();
    expect(list).toHaveLength(2);
    expect(list.map((d) => d.id).sort()).toEqual(['a', 'b']);
  });

  it('list: 빈 스토리지는 빈 배열을 반환한다', async () => {
    const list = await storage.list();
    expect(list).toEqual([]);
  });

  it('read: 깊은 복사를 수행한다 (읽은 값 변경 미영향)', async () => {
    const data = { id: 'test-1', nested: { value: 1 } };
    await storage.write('test-1', data);
    const read1 = await storage.read('test-1');
    read1.nested.value = 999;
    const read2 = await storage.read('test-1');
    expect(read2.nested.value).toBe(1);
  });

  it('write: 기존 데이터를 덮어쓴다', async () => {
    await storage.write('test-1', { id: 'test-1', version: 1 });
    await storage.write('test-1', { id: 'test-1', version: 2 });
    const result = await storage.read('test-1');
    expect(result.version).toBe(2);
  });
});

describe('FileStorage', () => {
  beforeEach(async () => {
    await mkdir(TMP_DIR, { recursive: true });
  });

  afterEach(async () => {
    await rm(TMP_DIR, { recursive: true, force: true });
  });

  it('write한 데이터를 read로 읽을 수 있다 (경로 일관성)', async () => {
    const storage = new FileStorage(TMP_DIR);
    const data = { id: 'test-1', name: 'Test Project', status: 'created' };

    await storage.write('test-1', data);
    const result = await storage.read('test-1');

    expect(result).toEqual(data);
  });

  it('존재하지 않는 ID는 null을 반환한다', async () => {
    const storage = new FileStorage(TMP_DIR);
    const result = await storage.read('nonexistent');
    expect(result).toBeNull();
  });

  it('read: path traversal ID를 차단한다', async () => {
    const storage = new FileStorage(TMP_DIR);
    await expect(storage.read('../../etc')).rejects.toThrow('허용 범위를 벗어났습니다');
  });

  it('write: path traversal ID를 차단한다', async () => {
    const storage = new FileStorage(TMP_DIR);
    await expect(storage.write('../escape', { id: 'x' })).rejects.toThrow(
      '허용 범위를 벗어났습니다',
    );
  });
});

describe('resolveStorage', () => {
  it("'memory' 문자열은 MemoryStorage를 반환한다", () => {
    const storage = resolveStorage('memory');
    expect(storage).toBeInstanceOf(MemoryStorage);
  });

  it('커스텀 객체는 그대로 반환한다', () => {
    const custom = {
      read: async () => null,
      write: async () => {},
      list: async () => [],
    };
    const storage = resolveStorage(custom);
    expect(storage).toBe(custom);
  });

  it('null/undefined는 MemoryStorage를 반환한다', () => {
    expect(resolveStorage(null)).toBeInstanceOf(MemoryStorage);
    expect(resolveStorage(undefined)).toBeInstanceOf(MemoryStorage);
  });

  it('문자열 경로는 FileStorage를 반환한다', () => {
    const storage = resolveStorage('/tmp/test-storage');
    expect(storage.constructor.name).toBe('FileStorage');
  });
});
