import $ from "../internals/export";
import _cjs_import from "../internals/object-to-array";
var $values = _cjs_import.values;

// `Object.values` method
// https://tc39.es/ecma262/#sec-object.values
$({
  target: 'Object',
  stat: true
}, {
  values: function values(O) {
    return $values(O);
  }
});
const _cjs_default = {};
export default _cjs_default;
