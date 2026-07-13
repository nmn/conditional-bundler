import * as assert from "node:assert";
import { URLSerializer as _URLSerializer } from "../fetch/data-url";
import { isValidHeaderName as _isValidHeaderName } from "../fetch/util";
/**
 * @see https://url.spec.whatwg.org/#concept-url-equals
 * @param {URL} A
 * @param {URL} B
 * @param {boolean | undefined} excludeFragment
 * @returns {boolean}
 */
function urlEquals(A, B, excludeFragment = false) {
  const serializedA = _URLSerializer(A, excludeFragment);
  const serializedB = _URLSerializer(B, excludeFragment);
  return serializedA === serializedB;
}

/**
 * @see https://github.com/chromium/chromium/blob/694d20d134cb553d8d89e5500b9148012b1ba299/content/browser/cache_storage/cache_storage_cache.cc#L260-L262
 * @param {string} header
 */
function getFieldValues(header) {
  assert(header !== null);
  const values = [];
  for (let value of header.split(',')) {
    value = value.trim();
    if (_isValidHeaderName(value)) {
      values.push(value);
    }
  }
  return values;
}
const _cjs_default = {
  urlEquals,
  getFieldValues
};
const _urlEquals = _cjs_default["urlEquals"];
export { _urlEquals as urlEquals };
const _getFieldValues = _cjs_default["getFieldValues"];
export { _getFieldValues as getFieldValues };
export default _cjs_default;
