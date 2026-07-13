import isArray from "../internals/is-array";
import isConstructor from "../internals/is-constructor";
import isObject from "../internals/is-object";
import wellKnownSymbol from "../internals/well-known-symbol";
var SPECIES = wellKnownSymbol('species');
var $Array = Array;

// a part of `ArraySpeciesCreate` abstract operation
// https://tc39.es/ecma262/#sec-arrayspeciescreate
const _cjs_default = function (originalArray) {
  var C;
  if (isArray(originalArray)) {
    C = originalArray.constructor;
    // cross-realm fallback
    if (isConstructor(C) && (C === $Array || isArray(C.prototype))) C = undefined;else if (isObject(C)) {
      C = C[SPECIES];
      if (C === null) C = undefined;
    }
  }
  return C === undefined ? $Array : C;
};
export default _cjs_default;
