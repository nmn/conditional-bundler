import $ from "../internals/export";
import DESCRIPTORS from "../internals/descriptors";
import { f as _f } from "../internals/object-define-property";
var defineProperty = _f;

// `Object.defineProperty` method
// https://tc39.es/ecma262/#sec-object.defineproperty
// eslint-disable-next-line es/no-object-defineproperty -- safe
$({
  target: 'Object',
  stat: true,
  forced: Object.defineProperty !== defineProperty,
  sham: !DESCRIPTORS
}, {
  defineProperty: defineProperty
});
const _cjs_default = {};
export default _cjs_default;
