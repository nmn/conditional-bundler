import $ from "../internals/export";
import fill from "../internals/array-fill";
import addToUnscopables from "../internals/add-to-unscopables";
// `Array.prototype.fill` method
// https://tc39.es/ecma262/#sec-array.prototype.fill
$({
  target: 'Array',
  proto: true
}, {
  fill: fill
});

// https://tc39.es/ecma262/#sec-array.prototype-@@unscopables
addToUnscopables('fill');
const _cjs_default = {};
export default _cjs_default;
