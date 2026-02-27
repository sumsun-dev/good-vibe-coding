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
  }

  /**
   * 캐시된 데이터를 반환한다. 없으면 loader를 실행.
   */
  async get() {
    if (!this._loaded) {
      this._data = await this._loader();
      this._loaded = true;
    }
    return this._data;
  }

  /**
   * 캐시를 초기화한다 (테스트용).
   */
  clear() {
    this._data = null;
    this._loaded = false;
  }

  /** 캐시가 로드되었는지 확인 */
  get loaded() {
    return this._loaded;
  }
}
