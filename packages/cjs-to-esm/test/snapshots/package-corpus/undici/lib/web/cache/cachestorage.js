import { Cache as _Cache } from "./cache";
import { webidl as _webidl } from "../webidl";
import { kEnumerableProperty as _kEnumerableProperty } from "../../core/util";
import { kConstruct as _kConstruct } from "../../core/symbols";
class CacheStorage {
  /**
   * @see https://w3c.github.io/ServiceWorker/#dfn-relevant-name-to-cache-map
   * @type {Map<string, import('./cache').requestResponseList}
   */
  #caches = new Map();
  constructor() {
    if (arguments[0] !== _kConstruct) {
      _webidl.illegalConstructor();
    }
    _webidl.util.markAsUncloneable(this);
  }
  async match(request, options = {}) {
    _webidl.brandCheck(this, CacheStorage);
    _webidl.argumentLengthCheck(arguments, 1, 'CacheStorage.match');
    request = _webidl.converters.RequestInfo(request);
    options = _webidl.converters.MultiCacheQueryOptions(options);

    // 1.
    if (options.cacheName != null) {
      // 1.1.1.1
      if (this.#caches.has(options.cacheName)) {
        // 1.1.1.1.1
        const cacheList = this.#caches.get(options.cacheName);
        const cache = new _Cache(_kConstruct, cacheList);
        return await cache.match(request, options);
      }
    } else {
      // 2.
      // 2.2
      for (const cacheList of this.#caches.values()) {
        const cache = new _Cache(_kConstruct, cacheList);

        // 2.2.1.2
        const response = await cache.match(request, options);
        if (response !== undefined) {
          return response;
        }
      }
    }
  }

  /**
   * @see https://w3c.github.io/ServiceWorker/#cache-storage-has
   * @param {string} cacheName
   * @returns {Promise<boolean>}
   */
  async has(cacheName) {
    _webidl.brandCheck(this, CacheStorage);
    const prefix = 'CacheStorage.has';
    _webidl.argumentLengthCheck(arguments, 1, prefix);
    cacheName = _webidl.converters.DOMString(cacheName, prefix, 'cacheName');

    // 2.1.1
    // 2.2
    return this.#caches.has(cacheName);
  }

  /**
   * @see https://w3c.github.io/ServiceWorker/#dom-cachestorage-open
   * @param {string} cacheName
   * @returns {Promise<Cache>}
   */
  async open(cacheName) {
    _webidl.brandCheck(this, CacheStorage);
    const prefix = 'CacheStorage.open';
    _webidl.argumentLengthCheck(arguments, 1, prefix);
    cacheName = _webidl.converters.DOMString(cacheName, prefix, 'cacheName');

    // 2.1
    if (this.#caches.has(cacheName)) {
      // await caches.open('v1') !== await caches.open('v1')

      // 2.1.1
      const cache = this.#caches.get(cacheName);

      // 2.1.1.1
      return new _Cache(_kConstruct, cache);
    }

    // 2.2
    const cache = [];

    // 2.3
    this.#caches.set(cacheName, cache);

    // 2.4
    return new _Cache(_kConstruct, cache);
  }

  /**
   * @see https://w3c.github.io/ServiceWorker/#cache-storage-delete
   * @param {string} cacheName
   * @returns {Promise<boolean>}
   */
  async delete(cacheName) {
    _webidl.brandCheck(this, CacheStorage);
    const prefix = 'CacheStorage.delete';
    _webidl.argumentLengthCheck(arguments, 1, prefix);
    cacheName = _webidl.converters.DOMString(cacheName, prefix, 'cacheName');
    return this.#caches.delete(cacheName);
  }

  /**
   * @see https://w3c.github.io/ServiceWorker/#cache-storage-keys
   * @returns {Promise<string[]>}
   */
  async keys() {
    _webidl.brandCheck(this, CacheStorage);

    // 2.1
    const keys = this.#caches.keys();

    // 2.2
    return [...keys];
  }
}
Object.defineProperties(CacheStorage.prototype, {
  [Symbol.toStringTag]: {
    value: 'CacheStorage',
    configurable: true
  },
  match: _kEnumerableProperty,
  has: _kEnumerableProperty,
  open: _kEnumerableProperty,
  delete: _kEnumerableProperty,
  keys: _kEnumerableProperty
});
const _cjs_default = {
  CacheStorage
};
const _CacheStorage = _cjs_default["CacheStorage"];
export { _CacheStorage as CacheStorage };
export default _cjs_default;
