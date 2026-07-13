import $ from "../internals/export";
import forEach from "../internals/array-for-each";
// `Array.prototype.forEach` method
// https://tc39.es/ecma262/#sec-array.prototype.foreach
// eslint-disable-next-line es/no-array-prototype-foreach -- safe
$({
  target: 'Array',
  proto: true,
  forced: [].forEach !== forEach
}, {
  forEach: forEach
});
const _cjs_default = {};
export default _cjs_default;
