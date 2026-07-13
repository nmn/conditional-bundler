import wellKnownSymbol from "../internals/well-known-symbol";
import create from "../internals/object-create";
import { f as _f } from "../internals/object-define-property";
var defineProperty = _f;
var UNSCOPABLES = wellKnownSymbol('unscopables');
var ArrayPrototype = Array.prototype;

// Array.prototype[@@unscopables]
// https://tc39.es/ecma262/#sec-array.prototype-@@unscopables
if (ArrayPrototype[UNSCOPABLES] === undefined) {
  defineProperty(ArrayPrototype, UNSCOPABLES, {
    configurable: true,
    value: create(null)
  });
}

// add a key to Array.prototype[@@unscopables]
const _cjs_default = function (key) {
  ArrayPrototype[UNSCOPABLES][key] = true;
};
export default _cjs_default;
