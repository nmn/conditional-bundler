import $ from "../internals/export";
import isArray from "../internals/is-array";
// `Array.isArray` method
// https://tc39.es/ecma262/#sec-array.isarray
$({
  target: 'Array',
  stat: true
}, {
  isArray: isArray
});
const _cjs_default = {};
export default _cjs_default;
