import "../modules/es.regexp.exec";
import $ from "../internals/export";
import call from "../internals/function-call";
import isCallable from "../internals/is-callable";
import anObject from "../internals/an-object";
import toString from "../internals/to-string";
// TODO: Remove from `core-js@4` since it's moved to entry points

var DELEGATES_TO_EXEC = function () {
  var execCalled = false;
  var re = /[ac]/;
  re.exec = function () {
    execCalled = true;
    return /./.exec.apply(this, arguments);
  };
  return re.test('abc') === true && execCalled;
}();
var nativeTest = /./.test;

// `RegExp.prototype.test` method
// https://tc39.es/ecma262/#sec-regexp.prototype.test
$({
  target: 'RegExp',
  proto: true,
  forced: !DELEGATES_TO_EXEC
}, {
  test: function (S) {
    var R = anObject(this);
    var string = toString(S);
    var exec = R.exec;
    if (!isCallable(exec)) return call(nativeTest, R, string);
    var result = call(exec, R, string);
    if (result === null) return false;
    anObject(result);
    return true;
  }
});
const _cjs_default = {};
export default _cjs_default;
