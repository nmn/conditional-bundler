import fails from "../internals/fails";
import isObject from "../internals/is-object";
import classof from "../internals/classof-raw";
import ARRAY_BUFFER_NON_EXTENSIBLE from "../internals/array-buffer-non-extensible";
// eslint-disable-next-line es/no-object-isextensible -- safe
var $isExtensible = Object.isExtensible;
var FAILS_ON_PRIMITIVES = fails(function () {
  $isExtensible(1);
});

// `Object.isExtensible` method
// https://tc39.es/ecma262/#sec-object.isextensible
const _cjs_default = FAILS_ON_PRIMITIVES || ARRAY_BUFFER_NON_EXTENSIBLE ? function isExtensible(it) {
  if (!isObject(it)) return false;
  if (ARRAY_BUFFER_NON_EXTENSIBLE && classof(it) === 'ArrayBuffer') return false;
  return $isExtensible ? $isExtensible(it) : true;
} : $isExtensible;
export default _cjs_default;
