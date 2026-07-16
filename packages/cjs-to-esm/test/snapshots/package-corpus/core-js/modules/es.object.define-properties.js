import $ from "../internals/export";
import DESCRIPTORS from "../internals/descriptors";
import _cjs_import from "../internals/object-define-properties";
var defineProperties = _cjs_import.f;

// `Object.defineProperties` method
// https://tc39.es/ecma262/#sec-object.defineproperties
// eslint-disable-next-line es/no-object-defineproperties -- safe
$({
  target: 'Object',
  stat: true,
  forced: Object.defineProperties !== defineProperties,
  sham: !DESCRIPTORS
}, {
  defineProperties: defineProperties
});
const _cjs_default = {};
export default _cjs_default;
