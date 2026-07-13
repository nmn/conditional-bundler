import $ from "../internals/export";
import repeat from "../internals/string-repeat";
// `String.prototype.repeat` method
// https://tc39.es/ecma262/#sec-string.prototype.repeat
$({
  target: 'String',
  proto: true
}, {
  repeat: repeat
});
const _cjs_default = {};
export default _cjs_default;
