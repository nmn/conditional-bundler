import fails from "../internals/fails";
import wellKnownSymbol from "../internals/well-known-symbol";
import V8_VERSION from "../internals/environment-v8-version";
var SPECIES = wellKnownSymbol('species');
const _cjs_default = function (METHOD_NAME) {
  // We can't use this feature detection in V8 since it causes
  // deoptimization and serious performance degradation
  // https://github.com/zloirock/core-js/issues/677
  return V8_VERSION >= 51 || !fails(function () {
    var array = [];
    var constructor = array.constructor = {};
    constructor[SPECIES] = function () {
      return {
        foo: 1
      };
    };
    return array[METHOD_NAME](Boolean).foo !== 1;
  });
};
export default _cjs_default;
