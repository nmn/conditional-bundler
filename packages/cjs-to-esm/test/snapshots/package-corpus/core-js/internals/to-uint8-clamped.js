var floor = Math.floor;

// https://tc39.es/ecma262/#sec-touint8clamp
const _cjs_default = function (it) {
  var number = +it;
  // eslint-disable-next-line no-self-compare -- NaN check
  if (number !== number || number <= 0) return 0;
  if (number >= 0xFF) return 0xFF;
  var f = floor(number);
  if (f + 0.5 < number) return f + 1;
  if (number < f + 0.5) return f;
  // round-half-to-even (banker's rounding)
  return f % 2 === 0 ? f : f + 1;
};
export default _cjs_default;
