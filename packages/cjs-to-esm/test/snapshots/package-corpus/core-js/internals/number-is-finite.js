import globalThis from "../internals/global-this";
var globalIsFinite = globalThis.isFinite;

// `Number.isFinite` method
// https://tc39.es/ecma262/#sec-number.isfinite
// eslint-disable-next-line es/no-number-isfinite -- safe
const _cjs_default = Number.isFinite || function isFinite(it) {
  return typeof it == 'number' && globalIsFinite(it);
};
export default _cjs_default;
