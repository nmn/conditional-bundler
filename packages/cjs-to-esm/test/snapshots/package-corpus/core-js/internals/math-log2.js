var log = Math.log;
var LN2 = Math.LN2;

// `Math.log2` method
// https://tc39.es/ecma262/#sec-math.log2
// eslint-disable-next-line es/no-math-log2 -- safe
const _cjs_default = Math.log2 || function log2(x) {
  return log(x) / LN2;
};
export default _cjs_default;
