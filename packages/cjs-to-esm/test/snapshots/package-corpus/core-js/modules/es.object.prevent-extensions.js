import $ from "../internals/export";
import isObject from "../internals/is-object";
import _cjs_import from "../internals/internal-metadata";
import FREEZING from "../internals/freezing";
import fails from "../internals/fails";
var onFreeze = _cjs_import.onFreeze;
// eslint-disable-next-line es/no-object-preventextensions -- safe
var $preventExtensions = Object.preventExtensions;
var FAILS_ON_PRIMITIVES = fails(function () {
  $preventExtensions(1);
});

// `Object.preventExtensions` method
// https://tc39.es/ecma262/#sec-object.preventextensions
$({
  target: 'Object',
  stat: true,
  forced: FAILS_ON_PRIMITIVES,
  sham: !FREEZING
}, {
  preventExtensions: function preventExtensions(it) {
    return $preventExtensions && isObject(it) ? $preventExtensions(onFreeze(it)) : it;
  }
});
const _cjs_default = {};
export default _cjs_default;
