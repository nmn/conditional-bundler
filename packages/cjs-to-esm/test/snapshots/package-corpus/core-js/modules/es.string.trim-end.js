import "../modules/es.string.trim-right";
import $ from "../internals/export";
import trimEnd from "../internals/string-trim-end";
// TODO: Remove this line from `core-js@4`

// `String.prototype.trimEnd` method
// https://tc39.es/ecma262/#sec-string.prototype.trimend
// eslint-disable-next-line es/no-string-prototype-trimstart-trimend -- safe
$({
  target: 'String',
  proto: true,
  name: 'trimEnd',
  forced: ''.trimEnd !== trimEnd
}, {
  trimEnd: trimEnd
});
const _cjs_default = {};
export default _cjs_default;
