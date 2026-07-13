import $ from "../internals/export";
import bind from "../internals/function-bind";
// TODO: Remove from `core-js@4`

// `Function.prototype.bind` method
// https://tc39.es/ecma262/#sec-function.prototype.bind
// eslint-disable-next-line es/no-function-prototype-bind -- detection
$({
  target: 'Function',
  proto: true,
  forced: Function.bind !== bind
}, {
  bind: bind
});
const _cjs_default = {};
export default _cjs_default;
