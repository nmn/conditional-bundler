import $ from "../internals/export";
import assign from "../internals/object-assign";
// `Object.assign` method
// https://tc39.es/ecma262/#sec-object.assign
// eslint-disable-next-line es/no-object-assign -- required for testing
$({
  target: 'Object',
  stat: true,
  arity: 2,
  forced: Object.assign !== assign
}, {
  assign: assign
});
const _cjs_default = {};
export default _cjs_default;
