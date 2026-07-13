import "../modules/es.string.trim-left";
import $ from "../internals/export";
import trimStart from "../internals/string-trim-start";
// TODO: Remove this line from `core-js@4`

// `String.prototype.trimStart` method
// https://tc39.es/ecma262/#sec-string.prototype.trimstart
// eslint-disable-next-line es/no-string-prototype-trimstart-trimend -- safe
$({
  target: 'String',
  proto: true,
  name: 'trimStart',
  forced: ''.trimStart !== trimStart
}, {
  trimStart: trimStart
});
const _cjs_default = {};
export default _cjs_default;
