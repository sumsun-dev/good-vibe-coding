/**
 * cache — 지연 로딩 캐시 유틸리티
 * 모듈 레벨 캐시를 표준화된 패턴으로 대체.
 */

/**
 * 지연 로딩 캐시.
 * 최초 get() 호출 시 loader를 실행하고 결과를 캐시한다.
 */
export class LazyCache {
  /**
   * @param {function(): Promise<*>} loader - 데이터 로드 함수
   */
  constructor(loader) {
    this._loader = loader;
    this._data = null;
    this._loaded = false;
    this._pending = null;
  }

  /**
   * 캐시된 데이터를 반환한다. 없으면 loader를 실행.
   * 동시 호출 시 loader가 한 번만 실행되도록 보장한다.
   */
  async get() {
    if (this._loaded) return this._data;
    if (!this._pending) {
      this._pending = this._loader().then((data) => {
        this._data = data;
        this._loaded = true;
        this._pending = null;
        return data;
      }).catch((err) => {
        this._pending = null;
        throw err;
      });
    }
    return this._pending;
  }

  /**
   * 캐시를 초기화한다 (테스트용).
   */
  clear() {
    this._data = null;
    this._loaded = false;
    this._pending = null;
  }

  /** 캐시가 로드되었는지 확인 */
  get loaded() {
    return this._loaded;
  }
}
