import $ from "../internals/export";
import _cjs_import from "../internals/object-to-array";
var $entries = _cjs_import.entries;

// `Object.entries` method
// https://tc39.es/ecma262/#sec-object.entries
$({
  target: 'Object',
  stat: true
}, {
  entries: function entries(O) {
    return $entries(O);
  }
});
const _cjs_default = {};
export default _cjs_default;
