import hasOwn from "./internals/has-own-property";
import isArray from "./internals/is-array";
import isForced from "./internals/is-forced";
import shared from "./internals/shared-store";
var data = isForced.data;
var normalize = isForced.normalize;
var USE_FUNCTION_CONSTRUCTOR = 'USE_FUNCTION_CONSTRUCTOR';
var ASYNC_ITERATOR_PROTOTYPE = 'AsyncIteratorPrototype';
var setAggressivenessLevel = function (object, constant) {
  if (isArray(object)) for (var i = 0; i < object.length; i++) data[normalize(object[i])] = constant;
};
const _cjs_default = function (options) {
  if (options && typeof options == 'object') {
    setAggressivenessLevel(options.useNative, isForced.NATIVE);
    setAggressivenessLevel(options.usePolyfill, isForced.POLYFILL);
    setAggressivenessLevel(options.useFeatureDetection, null);
    if (hasOwn(options, USE_FUNCTION_CONSTRUCTOR)) {
      shared[USE_FUNCTION_CONSTRUCTOR] = !!options[USE_FUNCTION_CONSTRUCTOR];
    }
    if (hasOwn(options, ASYNC_ITERATOR_PROTOTYPE)) {
      shared[ASYNC_ITERATOR_PROTOTYPE] = options[ASYNC_ITERATOR_PROTOTYPE];
    }
  }
};
export default _cjs_default;
