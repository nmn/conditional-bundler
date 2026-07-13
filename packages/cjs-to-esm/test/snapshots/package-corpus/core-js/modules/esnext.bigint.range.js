import $ from "../internals/export";
import NumericRangeIterator from "../internals/numeric-range-iterator";
/* eslint-disable es/no-bigint -- safe */

// `BigInt.range` method
// https://github.com/tc39/proposal-iterator.range
// TODO: Remove from `core-js@4`
if (typeof BigInt == 'function') {
  $({
    target: 'BigInt',
    stat: true,
    forced: true
  }, {
    range: function range(start, end, option) {
      return new NumericRangeIterator(start, end, option, 'bigint', BigInt(0), BigInt(1));
    }
  });
}
const _cjs_default = {};
export default _cjs_default;
