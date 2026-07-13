var log = Math.log;
var LOG10E = Math.LOG10E;

// eslint-disable-next-line es/no-math-log10 -- safe
const _cjs_default = Math.log10 || function log10(x) {
  return log(x) * LOG10E;
};
export default _cjs_default;
