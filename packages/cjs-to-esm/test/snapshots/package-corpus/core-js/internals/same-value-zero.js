// `SameValueZero` abstract operation
// https://tc39.es/ecma262/#sec-samevaluezero
const _cjs_default = function (x, y) {
  // eslint-disable-next-line no-self-compare -- NaN check
  return x === y || x !== x && y !== y;
};
export default _cjs_default;
