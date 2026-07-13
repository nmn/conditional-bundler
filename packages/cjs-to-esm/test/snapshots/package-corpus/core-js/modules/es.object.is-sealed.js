import $ from "../internals/export";
import fails from "../internals/fails";
import isObject from "../internals/is-object";
import classof from "../internals/classof-raw";
import ARRAY_BUFFER_NON_EXTENSIBLE from "../internals/array-buffer-non-extensible";
// eslint-disable-next-line es/no-object-issealed -- safe
var $isSealed = Object.isSealed;
var FORCED = ARRAY_BUFFER_NON_EXTENSIBLE || fails(function () {
  $isSealed(1);
});

// `Object.isSealed` method
// https://tc39.es/ecma262/#sec-object.issealed
$({
  target: 'Object',
  stat: true,
  forced: FORCED
}, {
  isSealed: function isSealed(it) {
    if (!isObject(it)) return true;
    if (ARRAY_BUFFER_NON_EXTENSIBLE && classof(it) === 'ArrayBuffer') return true;
    return $isSealed ? $isSealed(it) : false;
  }
});
const _cjs_default = {};
export default _cjs_default;
