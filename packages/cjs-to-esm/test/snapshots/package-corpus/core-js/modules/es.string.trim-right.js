import $ from "../internals/export";
import trimEnd from "../internals/string-trim-end";
// `String.prototype.trimRight` method
// https://tc39.es/ecma262/#sec-string.prototype.trimend
// eslint-disable-next-line es/no-string-prototype-trimleft-trimright -- safe
$({
  target: 'String',
  proto: true,
  name: 'trimEnd',
  forced: ''.trimRight !== trimEnd
}, {
  trimRight: trimEnd
});
const _cjs_default = {};
export default _cjs_default;
