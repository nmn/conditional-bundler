import $ from "../internals/export";
import uncurryThis from "../internals/function-uncurry-this";
import hiddenKeys from "../internals/hidden-keys";
import isObject from "../internals/is-object";
import hasOwn from "../internals/has-own-property";
import _cjs_import from "../internals/object-define-property";
import getOwnPropertyNamesModule from "../internals/object-get-own-property-names";
import getOwnPropertyNamesExternalModule from "../internals/object-get-own-property-names-external";
import isExtensible from "../internals/object-is-extensible";
import uid from "../internals/uid";
import FREEZING from "../internals/freezing";
var defineProperty = _cjs_import.f;
var REQUIRED = false;
var METADATA = uid('meta');
var id = 0;
var setMetadata = function (it) {
  defineProperty(it, METADATA, {
    value: {
      objectID: 'O' + id++,
      // object ID
      weakData: {} // weak collections IDs
    }
  });
};
var fastKey = function (it, create) {
  // return a primitive with prefix
  if (!isObject(it)) return typeof it == 'symbol' ? it : (typeof it == 'string' ? 'S' : 'P') + it;
  if (!hasOwn(it, METADATA)) {
    // can't set metadata to uncaught frozen object
    if (!isExtensible(it)) return 'F';
    // not necessary to add metadata
    if (!create) return 'E';
    // add missing metadata
    setMetadata(it);
    // return object ID
  }
  return it[METADATA].objectID;
};
var getWeakData = function (it, create) {
  if (!hasOwn(it, METADATA)) {
    // can't set metadata to uncaught frozen object
    if (!isExtensible(it)) return true;
    // not necessary to add metadata
    if (!create) return false;
    // add missing metadata
    setMetadata(it);
    // return the store of weak collections IDs
  }
  return it[METADATA].weakData;
};

// add metadata on freeze-family methods calling
var onFreeze = function (it) {
  if (FREEZING && REQUIRED && isExtensible(it) && !hasOwn(it, METADATA)) setMetadata(it);
  return it;
};
var enable = function () {
  meta.enable = function () {/* empty */};
  REQUIRED = true;
  var getOwnPropertyNames = getOwnPropertyNamesModule.f;
  var splice = uncurryThis([].splice);
  var test = {};
  // eslint-disable-next-line unicorn/no-immediate-mutation -- ES3 syntax limitation
  test[METADATA] = 1;

  // prevent exposing of metadata key
  if (getOwnPropertyNames(test).length) {
    getOwnPropertyNamesModule.f = function (it) {
      var result = getOwnPropertyNames(it);
      for (var i = 0, length = result.length; i < length; i++) {
        if (result[i] === METADATA) {
          splice(result, i, 1);
          break;
        }
      }
      return result;
    };
    $({
      target: 'Object',
      stat: true,
      forced: true
    }, {
      getOwnPropertyNames: getOwnPropertyNamesExternalModule.f
    });
  }
};
const _cjs_default = {
  enable: enable,
  fastKey: fastKey,
  getWeakData: getWeakData,
  onFreeze: onFreeze
};
hiddenKeys[METADATA] = true;
const _enable = _cjs_default["enable"];
export { _enable as enable };
const _fastKey = _cjs_default["fastKey"];
export { _fastKey as fastKey };
const _getWeakData = _cjs_default["getWeakData"];
export { _getWeakData as getWeakData };
const _onFreeze = _cjs_default["onFreeze"];
export { _onFreeze as onFreeze };
export default _cjs_default;
