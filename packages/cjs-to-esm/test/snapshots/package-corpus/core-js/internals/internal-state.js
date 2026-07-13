import NATIVE_WEAK_MAP from "../internals/weak-map-basic-detection";
import globalThis from "../internals/global-this";
import isObject from "../internals/is-object";
import createNonEnumerableProperty from "../internals/create-non-enumerable-property";
import hasOwn from "../internals/has-own-property";
import shared from "../internals/shared-store";
import sharedKey from "../internals/shared-key";
import hiddenKeys from "../internals/hidden-keys";
var OBJECT_ALREADY_INITIALIZED = 'Object already initialized';
var TypeError = globalThis.TypeError;
var WeakMap = globalThis.WeakMap;
var set, get, has;
var enforce = function (it) {
  return has(it) ? get(it) : set(it, {});
};
var getterFor = function (TYPE) {
  return function (it) {
    var state;
    if (!isObject(it) || (state = get(it)).type !== TYPE) {
      throw new TypeError('Incompatible receiver, ' + TYPE + ' required');
    }
    return state;
  };
};
if (NATIVE_WEAK_MAP || shared.state) {
  var store = shared.state || (shared.state = new WeakMap());
  /* eslint-disable no-self-assign -- prototype methods protection */
  store.get = store.get;
  store.has = store.has;
  store.set = store.set;
  /* eslint-enable no-self-assign -- prototype methods protection */
  set = function (it, metadata) {
    if (store.has(it)) throw new TypeError(OBJECT_ALREADY_INITIALIZED);
    metadata.facade = it;
    store.set(it, metadata);
    return metadata;
  };
  get = function (it) {
    return store.get(it) || {};
  };
  has = function (it) {
    return store.has(it);
  };
} else {
  var STATE = sharedKey('state');
  hiddenKeys[STATE] = true;
  set = function (it, metadata) {
    if (hasOwn(it, STATE)) throw new TypeError(OBJECT_ALREADY_INITIALIZED);
    metadata.facade = it;
    createNonEnumerableProperty(it, STATE, metadata);
    return metadata;
  };
  get = function (it) {
    return hasOwn(it, STATE) ? it[STATE] : {};
  };
  has = function (it) {
    return hasOwn(it, STATE);
  };
}
const _cjs_default = {
  set: set,
  get: get,
  has: has,
  enforce: enforce,
  getterFor: getterFor
};
const _set = _cjs_default["set"];
export { _set as set };
const _get = _cjs_default["get"];
export { _get as get };
const _has = _cjs_default["has"];
export { _has as has };
const _enforce = _cjs_default["enforce"];
export { _enforce as enforce };
const _getterFor = _cjs_default["getterFor"];
export { _getterFor as getterFor };
export default _cjs_default;
