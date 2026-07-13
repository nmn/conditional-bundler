import $ from "../internals/export";
import trimStart from "../internals/string-trim-start";
// `String.prototype.trimLeft` method
// https://tc39.es/ecma262/#sec-string.prototype.trimleft
// eslint-disable-next-line es/no-string-prototype-trimleft-trimright -- safe
$({
  target: 'String',
  proto: true,
  name: 'trimStart',
  forced: ''.trimLeft !== trimStart
}, {
  trimLeft: trimStart
});
const _cjs_default = {};
export default _cjs_default;
