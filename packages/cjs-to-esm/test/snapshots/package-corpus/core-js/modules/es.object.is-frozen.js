import $ from "../internals/export";
import fails from "../internals/fails";
import isObject from "../internals/is-object";
import classof from "../internals/classof-raw";
import ARRAY_BUFFER_NON_EXTENSIBLE from "../internals/array-buffer-non-extensible";
// eslint-disable-next-line es/no-object-isfrozen -- safe
var $isFrozen = Object.isFrozen;
var FORCED = ARRAY_BUFFER_NON_EXTENSIBLE || fails(function () {
  $isFrozen(1);
});

// `Object.isFrozen` method
// https://tc39.es/ecma262/#sec-object.isfrozen
$({
  target: 'Object',
  stat: true,
  forced: FORCED
}, {
  isFrozen: function isFrozen(it) {
    if (!isObject(it)) return true;
    if (ARRAY_BUFFER_NON_EXTENSIBLE && classof(it) === 'ArrayBuffer') return true;
    return $isFrozen ? $isFrozen(it) : false;
  }
});
const _cjs_default = {};
export default _cjs_default;
