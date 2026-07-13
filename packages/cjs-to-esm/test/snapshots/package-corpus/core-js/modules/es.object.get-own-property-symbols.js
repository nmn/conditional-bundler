import $ from "../internals/export";
import NATIVE_SYMBOL from "../internals/symbol-constructor-detection";
import fails from "../internals/fails";
import { f as _f } from "../internals/object-get-own-property-symbols";
import toObject from "../internals/to-object";
// V8 ~ Chrome 38 and 39 `Object.getOwnPropertySymbols` fails on primitives
// https://bugs.chromium.org/p/v8/issues/detail?id=3443
var FORCED = !NATIVE_SYMBOL || fails(function () {
  _f(1);
});

// `Object.getOwnPropertySymbols` method
// https://tc39.es/ecma262/#sec-object.getownpropertysymbols
$({
  target: 'Object',
  stat: true,
  forced: FORCED
}, {
  getOwnPropertySymbols: function getOwnPropertySymbols(it) {
    var $getOwnPropertySymbols = _f;
    return $getOwnPropertySymbols ? $getOwnPropertySymbols(toObject(it)) : [];
  }
});
const _cjs_default = {};
export default _cjs_default;
