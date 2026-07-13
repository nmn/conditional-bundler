import $ from "../internals/export";
import globalThis from "../internals/global-this";
// `globalThis` object
// https://tc39.es/ecma262/#sec-globalthis
$({
  global: true,
  forced: globalThis.globalThis !== globalThis
}, {
  globalThis: globalThis
});
const _cjs_default = {};
export default _cjs_default;
