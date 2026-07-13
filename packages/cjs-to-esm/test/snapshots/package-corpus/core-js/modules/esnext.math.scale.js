import $ from "../internals/export";
import scale from "../internals/math-scale";
// `Math.scale` method
// https://rwaldron.github.io/proposal-math-extensions/
$({
  target: 'Math',
  stat: true,
  forced: true
}, {
  scale: scale
});
const _cjs_default = {};
export default _cjs_default;
