import $ from "../internals/export";
import exec from "../internals/regexp-exec";
// `RegExp.prototype.exec` method
// https://tc39.es/ecma262/#sec-regexp.prototype.exec
$({
  target: 'RegExp',
  proto: true,
  forced: /./.exec !== exec
}, {
  exec: exec
});
const _cjs_default = {};
export default _cjs_default;
