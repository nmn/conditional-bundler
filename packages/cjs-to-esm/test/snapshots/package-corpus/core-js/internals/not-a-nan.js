var $RangeError = RangeError;
const _cjs_default = function (it) {
  // eslint-disable-next-line no-self-compare -- NaN check
  if (it === it) return it;
  throw new $RangeError('NaN is not allowed');
};
export default _cjs_default;
