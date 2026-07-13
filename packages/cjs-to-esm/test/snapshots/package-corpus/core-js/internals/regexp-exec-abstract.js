import call from "../internals/function-call";
import anObject from "../internals/an-object";
import isCallable from "../internals/is-callable";
import classof from "../internals/classof-raw";
import regexpExec from "../internals/regexp-exec";
var $TypeError = TypeError;

// `RegExpExec` abstract operation
// https://tc39.es/ecma262/#sec-regexpexec
const _cjs_default = function (R, S) {
  var exec = R.exec;
  if (isCallable(exec)) {
    var result = call(exec, R, S);
    if (result !== null) anObject(result);
    return result;
  }
  if (classof(R) === 'RegExp') return call(regexpExec, R, S);
  throw new $TypeError('RegExp#exec called on incompatible receiver');
};
export default _cjs_default;
