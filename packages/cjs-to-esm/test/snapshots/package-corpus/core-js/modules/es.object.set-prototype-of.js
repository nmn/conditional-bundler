import $ from "../internals/export";
import setPrototypeOf from "../internals/object-set-prototype-of";
// `Object.setPrototypeOf` method
// https://tc39.es/ecma262/#sec-object.setprototypeof
$({
  target: 'Object',
  stat: true
}, {
  setPrototypeOf: setPrototypeOf
});
const _cjs_default = {};
export default _cjs_default;
