import $ from "../internals/export";
import clamp from "../internals/math-clamp";
// TODO: Remove from `core-js@4`
// `Math.clamp` method
// https://github.com/tc39/proposal-math-clamp
$({
  target: 'Math',
  stat: true,
  forced: true
}, {
  clamp: clamp
});
const _cjs_default = {};
export default _cjs_default;
